import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { attemptPurchase } from "@/lib/orderService";

// Places a single-item order via the catalogue's Buy button. Mirrors the
// shape of the hackathon API's own POST /orders (one item_id + quantity
// per call) rather than a multi-item cart, since that's all the real
// endpoint this now calls can express.
//
// The whole handler is wrapped in try/catch: whatever goes wrong (bad
// request body, a Prisma error, the hackathon API being unreachable), the
// client always gets back a clean JSON { error } instead of an unhandled
// exception surfacing as a raw 500 / non-JSON response.
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

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 502 });
    }

    return NextResponse.json({
      orderId: result.orderId,
      externalOrderId: result.externalOrderId,
      productName: result.productName,
      quantity: result.quantity,
      total: result.total,
      remainingBalance: result.remainingBalance,
    });
  } catch (err) {
    console.error("POST /api/orders failed unexpectedly:", err);
    return NextResponse.json(
      { error: "Something went wrong placing this order. Please try again." },
      { status: 500 }
    );
  }
}
