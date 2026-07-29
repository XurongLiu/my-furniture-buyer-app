import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const body = await request.json();
  const items = body.items || [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Your order is empty." }, { status: 400 });
  }

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  let total = 0;
  const orderItemsData = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return NextResponse.json({ error: "Unknown product in order." }, { status: 400 });
    }
    const quantity = Math.max(1, Number(item.quantity) || 1);
    total += product.price * quantity;
    orderItemsData.push({ productId: product.id, quantity, unitPrice: product.price });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const pastOrders = await prisma.order.aggregate({
    where: { userId: user.id },
    _sum: { total: true },
  });
  const spent = pastOrders._sum.total || 0;
  const remaining = user.budget - spent;

  if (total > remaining) {
    return NextResponse.json(
      {
        error: `This order ($${total.toFixed(2)}) exceeds your remaining budget ($${remaining.toFixed(2)}).`,
      },
      { status: 400 }
    );
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      total,
      items: { create: orderItemsData },
    },
  });

  return NextResponse.json({ id: order.id, total: order.total });
}
