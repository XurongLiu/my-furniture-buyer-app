import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, emoji: true, imageMimeType: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">My Orders</h1>
      {orders.length === 0 ? (
        <p className="mt-4 text-stone-600">You haven&apos;t placed any orders yet.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded border border-stone-200 bg-white p-4">
              <div className="flex justify-between text-sm text-stone-500">
                <span>{new Date(order.createdAt).toLocaleString()}</span>
                <span className="font-semibold text-stone-900">${order.total.toFixed(2)}</span>
              </div>
              <ul className="mt-2 space-y-2 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    {item.product.imageMimeType ? (
                      <img
                        src={`/api/products/${item.product.id}/image`}
                        alt={item.product.name}
                        loading="lazy"
                        className="h-8 w-8 rounded object-contain bg-stone-50"
                      />
                    ) : (
                      <span>{item.product.emoji || "🪑"}</span>
                    )}
                    {item.quantity} × {item.product.name} (${item.unitPrice.toFixed(2)} each)
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
