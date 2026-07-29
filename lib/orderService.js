import { prisma } from "@/lib/prisma";
import { getHackathonBalance, placeHackathonOrder } from "@/lib/hackathonApi";

const NOT_AVAILABLE = "This item is no longer available.";

// Shared by the catalogue's Buy button (app/api/orders/route.js) and the
// assistant's confirm step (app/api/agent/confirm-purchase/route.js) —
// one real order-placement path, so a fix or safety check made here
// applies everywhere a purchase can happen.
//
// Returns { success: true, ...details } or { success: false, error, status }.
// Never throws for expected failure modes (not found, insufficient
// balance) — those are just unsuccessful results, not exceptions.
export async function attemptPurchase({ userId, productId, quantity: rawQuantity }) {
  if (!productId) {
    return { success: false, error: "No product specified.", status: 400 };
  }
  const quantity = Math.max(1, Number(rawQuantity) || 1);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, price: true, externalId: true },
  });
  if (!product || !product.externalId) {
    // Covers both "this productId doesn't exist in our own database
    // (anymore)" and "it exists locally but was never mapped to a real
    // catalogue item" — from the buyer's point of view these are the
    // same thing: there's nothing real to actually buy.
    return { success: false, error: NOT_AVAILABLE, status: 404 };
  }

  const result = await placeHackathonOrder({ itemId: product.externalId, quantity });
  if (result.error) {
    if (result.status === 404) {
      return { success: false, error: NOT_AVAILABLE, status: 404 };
    }
    if (result.status === 402) {
      const total = product.price * quantity;
      const balance = await getHackathonBalance();
      const error =
        balance === null
          ? "You don't have enough balance for this order."
          : `You don't have enough balance for this order — it costs $${total.toFixed(2)}, but only $${balance.toFixed(2)} is available.`;
      return { success: false, error, status: 402 };
    }
    return { success: false, error: result.error, status: result.status || 502 };
  }

  const order = await prisma.order.create({
    data: {
      userId,
      total: result.totalPrice,
      externalOrderId: result.orderId,
      items: {
        create: [{ productId: product.id, quantity, unitPrice: product.price }],
      },
    },
  });

  return {
    success: true,
    orderId: order.id,
    externalOrderId: result.orderId,
    productName: product.name,
    quantity,
    total: result.totalPrice,
    remainingBalance: result.remainingBalance,
  };
}
