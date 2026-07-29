import { prisma } from "@/lib/prisma";

export async function GET(request, { params }) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { imageData: true, imageMimeType: true },
  });

  if (!product?.imageData) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Buffer.from(product.imageData, "base64");

  return new Response(bytes, {
    headers: {
      "Content-Type": product.imageMimeType || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
