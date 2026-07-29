import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CatalogueClient from "./CatalogueClient";

export default async function CataloguePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [products, user, orderAgg] = await Promise.all([
    prisma.product.findMany({
      orderBy: { category: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        emoji: true,
        // imageMimeType's presence means a real image is available at
        // /api/products/[id]/image — imageData itself (the base64 bytes)
        // is deliberately NOT selected here so it never lands in the page's
        // HTML; the <img> tag fetches it separately instead.
        imageMimeType: true,
      },
    }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.order.aggregate({
      where: { userId: session.user.id },
      _sum: { total: true },
    }),
  ]);

  const spent = orderAgg._sum.total || 0;
  const remaining = user.budget - spent;

  return (
    <CatalogueClient products={products} budget={user.budget} spent={spent} remaining={remaining} />
  );
}
