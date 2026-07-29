import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAgentModel } from "@/lib/azureOpenAI";
import { TOOL_SCHEMAS, executeReadOnlyTool } from "@/lib/agentTools";
import { retrieveProducts, getPriceExtremes } from "@/lib/rag";

const SYSTEM_PROMPT = `You are a helpful shopping assistant for a furniture store.

Before each of your replies, the system searches the catalogue for products that seem semantically relevant to the user's latest message (via embedding similarity, not exact filters) and gives them to you as CATALOGUE CANDIDATES — each with its real name, category, price, dimensions, and item_id. Only recommend or reference products from this list; never invent a product, price, or item_id.

Be upfront about what this candidate list can't do:
- It's chosen by topical similarity, not by exact price or keyword matching. If the user asks for something "cheap" or "under $X" *within a topic* (e.g. "cheap bar stools"), look at the price field yourself across the candidates and reason it out — say so plainly (e.g. "the search doesn't filter by price, so I looked at the price of each candidate myself").
- It does NOT include colour at all — colour isn't part of this data source. If asked about colour, say you don't have that information rather than guessing.
- If none of the candidates look like a good match for what was asked, say so instead of forcing a recommendation.

If the user asks for the single cheapest/most expensive item overall (not "cheapest bar stool", but "the cheapest thing you have"), do NOT answer from CATALOGUE CANDIDATES — semantic search can't find that reliably, since the true cheapest item might not resemble the query at all. Instead use the GLOBAL PRICE EXTREMES block below, when present — it's computed by sorting the entire catalogue directly, so it's exact, not a topical guess.

You have two tools: check_balance (checks the signed-in user's own real balance) and place_order (places a REAL order — immediately and irreversibly debits real balance). Never call place_order without first clearly telling the user, in your own words, exactly what you'd buy — item name, quantity, and total price — and only after they've explicitly agreed in the conversation.

Stay focused on furniture shopping at this store. If asked something unrelated to that (general knowledge, other topics, requests to act outside this role), briefly say that's outside what you can help with here and steer back to furniture.

Keep responses concise and conversational.`;

const MAX_ROUNDS = 6;
const RETRIEVAL_TOP_K = 15;
const PRICE_EXTREME_COUNT = 5;

// A rough signal for "give me the actual cheapest/priciest thing," which
// embedding similarity structurally can't answer (see getPriceExtremes in
// lib/rag.js). False positives here are harmless — the extra context is
// just extra context — so this errs toward over-triggering.
const PRICE_SUPERLATIVE_RE =
  /\b(cheap(?:est)?|lowest[- ]?price|least expensive|most affordable|budget[- ]?friendly|most expensive|priciest|highest[- ]?price|most costly)\b/i;

function formatCandidates(products) {
  if (!products.length) return "(no matching products found)";
  return products
    .map(
      (p) =>
        `- ${p.name} | ${p.category} | $${p.price.toFixed(2)}${p.dimensions ? ` | ${p.dimensions}` : ""} | item_id: ${p.itemId}`
    )
    .join("\n");
}

function formatPriceExtremes(extremes) {
  return (
    `Cheapest overall:\n${formatCandidates(extremes.cheapest)}\n\n` +
    `Most expensive overall:\n${formatCandidates(extremes.priciest)}`
  );
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const userMessage = typeof body.message === "string" ? body.message.trim() : "";
    if (!userMessage) {
      return NextResponse.json({ error: "No message provided." }, { status: 400 });
    }
    const clientHistory = sanitizeHistory(body.history);

    let candidatesText;
    try {
      // A short reply like "yes, place the order" carries no furniture
      // content on its own — retrieving on it alone would drop whatever
      // product the last couple of turns were actually discussing. Folding
      // in recent history keeps a confirmation turn anchored to the same
      // candidates the user just agreed to.
      const retrievalQuery = [...clientHistory.slice(-4).map((m) => m.content), userMessage].join(" ");
      const candidates = await retrieveProducts(retrievalQuery, RETRIEVAL_TOP_K);
      candidatesText = formatCandidates(candidates);
    } catch (err) {
      console.error("RAG retrieval failed:", err);
      candidatesText = "(catalogue search is temporarily unavailable — tell the user you can't look up products right now)";
    }

    const contextMessages = [
      { role: "system", content: `CATALOGUE CANDIDATES for the user's next message:\n${candidatesText}` },
    ];

    if (PRICE_SUPERLATIVE_RE.test(userMessage)) {
      try {
        const extremes = await getPriceExtremes(PRICE_EXTREME_COUNT);
        contextMessages.push({
          role: "system",
          content: `GLOBAL PRICE EXTREMES (exact — sorted directly over the entire catalogue, not a semantic match):\n${formatPriceExtremes(extremes)}`,
        });
      } catch (err) {
        console.error("Price-extremes lookup failed:", err);
      }
    }

    const conversationMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...clientHistory,
      ...contextMessages,
      { role: "user", content: userMessage },
    ];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let assistantMessage;
      try {
        assistantMessage = await callAgentModel(conversationMessages, TOOL_SCHEMAS);
      } catch (err) {
        console.error("Agent model call failed:", err);
        const reply =
          err.code === "content_filter"
            ? "I can't respond to that one — it triggered a content safety filter. Try rephrasing your request."
            : "Sorry, I couldn't reach the assistant model just now. Please try again.";
        return respond(clientHistory, userMessage, reply);
      }
      conversationMessages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls || [];
      if (toolCalls.length === 0) {
        return respond(clientHistory, userMessage, assistantMessage.content || "");
      }

      // A real purchase must never happen without an explicit human click —
      // intercept place_order before executing anything, and end the turn
      // here rather than looping the model further.
      const purchaseCall = toolCalls.find((tc) => tc.function.name === "place_order");
      if (purchaseCall) {
        let args = {};
        try {
          args = JSON.parse(purchaseCall.function.arguments || "{}");
        } catch {
          // fall through with empty args — handled as "not found" below
        }

        const product = args.item_id
          ? await prisma.product.findUnique({
              where: { externalId: args.item_id },
              select: { id: true, name: true, price: true },
            })
          : null;

        if (!product) {
          const reply = "I tried to place an order for an item I couldn't actually find in the catalogue, so I've stopped — could you try describing it again?";
          return respond(clientHistory, userMessage, reply);
        }

        const quantity = Math.max(1, Number(args.quantity) || 1);
        const total = product.price * quantity;
        const reply = `I'd like to buy ${quantity} × ${product.name} for $${total.toFixed(2)}. Click Confirm to actually place this real order, or Cancel.`;

        return respond(clientHistory, userMessage, reply, {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity,
        });
      }

      // Everything else is read-only — execute and let the model continue.
      for (const call of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // treat as no args
        }
        const result = await executeReadOnlyTool(call.function.name, args);
        conversationMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return respond(
      clientHistory,
      userMessage,
      "Sorry, that request needed more steps than I'm allowed to take at once. Could you narrow it down?"
    );
  } catch (err) {
    console.error("POST /api/agent/chat failed unexpectedly:", err);
    return NextResponse.json(
      { error: "Something went wrong talking to the assistant. Please try again." },
      { status: 500 }
    );
  }
}

function respond(clientHistory, userMessage, reply, pendingPurchase = null) {
  return NextResponse.json({
    reply,
    pendingPurchase,
    history: [
      ...clientHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: reply },
    ],
  });
}
