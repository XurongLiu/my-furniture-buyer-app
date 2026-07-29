import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHackathonBalance, placeHackathonOrder } from "@/lib/hackathonApi";

const NOT_AVAILABLE = "This item is no longer available.";

// Places a single-item order. Mirrors the shape of the hackathon API's own
// POST /orders (one item_id + quantity per call) rather than a multi-item
// cart, since that's all the real endpoint this now calls can express.
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

    const { productId } = body;
    if (!productId) {
      return NextResponse.json({ error: "No product specified." }, { status: 400 });
    }
    const quantity = Math.max(1, Number(body.quantity) || 1);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, price: true, externalId: true },
    });
    if (!product || !product.externalId) {
      // Covers both "this productId doesn't exist in our own database
      // (anymore)" and "it exists locally but was never mapped to a real
      // catalogue item" — from the buyer's point of view these are the
      // same thing: there's nothing real to actually buy.
      return NextResponse.json({ error: NOT_AVAILABLE }, { status: 404 });
    }

    const result = await placeHackathonOrder({ itemId: product.externalId, quantity });
    if (result.error) {
      if (result.status === 404) {
        return NextResponse.json({ error: NOT_AVAILABLE }, { status: 404 });
      }
      if (result.status === 402) {
        const total = product.price * quantity;
        const balance = await getHackathonBalance();
        const error =
          balance === null
            ? "You don't have enough balance for this order."
            : `You don't have enough balance for this order — it costs $${total.toFixed(2)}, but only $${balance.toFixed(2)} is available.`;
        return NextResponse.json({ error }, { status: 402 });
      }
      return NextResponse.json({ error: result.error }, { status: result.status || 502 });
    }

    const order = await prisma.order.create({
      data: {
        userId: session.user.id,
        total: result.totalPrice,
        externalOrderId: result.orderId,
        items: {
          create: [{ productId: product.id, quantity, unitPrice: product.price }],
        },
      },
    });

    return NextResponse.json({
      orderId: order.id,
      externalOrderId: result.orderId,
      productName: product.name,
      quantity,
      total: result.totalPrice,
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
