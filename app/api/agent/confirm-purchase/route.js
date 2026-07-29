import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { attemptPurchase } from "@/lib/orderService";
import { callAgentModel } from "@/lib/azureOpenAI";

// Not the main SYSTEM_PROMPT from app/api/agent/chat/route.js — this call
// doesn't need the tool-use instructions (no tools are offered here, so
// the model can't call place_order again mid-explanation), just enough
// framing to produce a plain, helpful message about what just happened.
const EXPLAIN_FAILURE_PROMPT = `You are the same furniture shopping assistant the user has been talking to. A purchase you proposed just failed when actually attempted. Explain the failure to the user in plain, friendly language — no raw error codes, no technical jargon, don't just repeat the error verbatim — and suggest one concrete thing they could try instead (for example: a cheaper item if it was a balance problem, searching again in case a listing is just stale, or checking their balance). Keep it brief and conversational.`;

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);
}

// Confirms a purchase the assistant proposed. Reuses the exact same
// order-placement logic as the catalogue's Buy button (lib/orderService.js)
// — this route's only addition is what happens after a failure: instead of
// handing the raw (if already friendly) error string straight to the chat,
// it's given to the model to turn into a natural explanation + suggestion.
// Successful purchases skip this — the confirmation is already clear
// on its own, and there's no reason to spend an extra model call on it.
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

    const result = await attemptPurchase({
      userId: session.user.id,
      productId: body.productId,
      quantity: body.quantity,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        reply: `✅ Bought ${result.quantity} × ${result.productName} for $${result.total.toFixed(2)} — order #${result.orderId.slice(-6)}. Real balance is now $${result.remainingBalance.toFixed(2)}.`,
        remainingBalance: result.remainingBalance,
      });
    }

    const history = sanitizeHistory(body.history);
    const messages = [
      { role: "system", content: EXPLAIN_FAILURE_PROMPT },
      ...history,
      { role: "system", content: `The purchase attempt just failed: ${result.error}` },
    ];

    let reply = null;
    try {
      const assistantMessage = await callAgentModel(messages);
      reply = assistantMessage.content;
    } catch (err) {
      console.error("Agent model call failed while explaining a purchase failure:", err);
    }

    return NextResponse.json({
      success: false,
      // If the model call itself failed, fall back to the already-friendly
      // message from attemptPurchase rather than leaving the user with nothing.
      reply: reply || `${result.error}`,
    });
  } catch (err) {
    console.error("POST /api/agent/confirm-purchase failed unexpectedly:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
