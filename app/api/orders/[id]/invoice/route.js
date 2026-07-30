import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHackathonInvoice } from "@/lib/hackathonApi";

// Streams the real PDF invoice for one of the current user's own past
// orders. `id` here is always our local Order.id, never the hackathon's
// externalOrderId directly — looking it up by userId first (rather than
// trusting whatever id is in the URL) is what stops one buyer from
// downloading another buyer's invoice by guessing/incrementing an id.
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new Response("You must be logged in.", { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: { userId: true, externalOrderId: true },
    });

    if (!order || order.userId !== session.user.id) {
      return new Response("Order not found.", { status: 404 });
    }
    if (!order.externalOrderId) {
      return new Response("No real invoice exists for this order.", { status: 404 });
    }

    const result = await getHackathonInvoice({ orderId: order.externalOrderId });
    if (result.error) {
      return new Response(result.error, { status: result.status || 502 });
    }

    return new Response(result.pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${order.externalOrderId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/orders/[id]/invoice failed unexpectedly:", err);
    return new Response("Something went wrong fetching the invoice.", { status: 500 });
  }
}
