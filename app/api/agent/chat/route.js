import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callAgentModel } from "@/lib/azureOpenAI";
import { TOOL_SCHEMAS, executeReadOnlyTool } from "@/lib/agentTools";

const SYSTEM_PROMPT = `You are a helpful shopping assistant for a furniture store, with four tools.

search_catalogue only matches an exact category name — it cannot filter by price, colour, or "vibe" itself. When the user asks for something like "cheap" or a specific colour, fetch a reasonable number of results for the closest category and apply that judgment yourself by reasoning over the price/colour/name fields you get back. Say so plainly when you're doing this (e.g. "the catalogue doesn't filter by price, so I looked at all the bar stools and picked out the cheapest myself").

When you find or recommend products, mention name, category, price, and colour so the user can judge for themselves too.

Never call place_order without first clearly telling the user, in your own words, exactly what you'd buy — item name, quantity, and total price — and only after they've explicitly agreed in the conversation. Placing an order immediately and irreversibly debits the user's real balance.

Keep responses concise and conversational.`;

const MAX_ROUNDS = 6;

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

    const conversationMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...clientHistory,
      { role: "user", content: userMessage },
    ];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let assistantMessage;
      try {
        assistantMessage = await callAgentModel(conversationMessages, TOOL_SCHEMAS);
      } catch (err) {
        console.error("Agent model call failed:", err);
        return respond(clientHistory, userMessage, "Sorry, I couldn't reach the assistant model just now. Please try again.");
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
