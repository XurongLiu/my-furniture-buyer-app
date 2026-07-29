import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHackathonBalance } from "@/lib/hackathonApi";
import CatalogueClient from "./CatalogueClient";

export default async function CataloguePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [products, orderAgg, balance] = await Promise.all([
    prisma.product.findMany({
      orderBy: { category: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        emoji: true,
        imageMimeType: true,
      },
    }),
    prisma.order.aggregate({
      where: { userId: session.user.id },
      _sum: { total: true },
    }),
    getHackathonBalance(),
  ]);

  const spent = orderAgg._sum.total || 0;

  return <CatalogueClient products={products} spent={spent} balance={balance} />;
}
