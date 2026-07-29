// One-off/rerunnable import: loads the real product catalog from the source
// MongoDB collection and replaces whatever is currently in our Product table.
//
// Usage: node --env-file=.env scripts/import-catalog.mjs

import { MongoClient } from "mongodb";
import { PrismaClient } from "@prisma/client";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set (check your .env file).");
  process.exit(1);
}

const prisma = new PrismaClient();
const mongo = new MongoClient(MONGODB_URI);

function buildDescription(doc) {
  const dims = [];
  if (doc.width != null) dims.push(`W${doc.width}`);
  if (doc.depth != null) dims.push(`D${doc.depth}`);
  if (doc.height != null) dims.push(`H${doc.height}`);
  const dimText = dims.length ? `${dims.join(" × ")} cm` : null;
  const colourText = doc.colours?.length ? doc.colours.join("/") : null;
  return [colourText, dimText].filter(Boolean).join(" · ") || doc.category || "";
}

function mapDoc(doc) {
  return {
    externalId: doc.item_id != null ? String(doc.item_id) : null,
    name: doc.product_name || "Unnamed item",
    description: buildDescription(doc),
    price: Number(doc.price) || 0,
    category: doc.category || "Uncategorised",
    imageData: doc.image_url || null,
    imageMimeType: doc.image_mime_type || null,
    sourceUrl: doc.link || null,
  };
}

async function main() {
  await mongo.connect();
  const docs = await mongo.db().collection("catalog").find({}).toArray();
  console.log(`Fetched ${docs.length} documents from MongoDB.`);

  const products = docs.map(mapDoc);

  // Replacing the catalogue: clear out order data that references the old
  // products first (FK constraint), then the old products themselves.
  const deletedItems = await prisma.orderItem.deleteMany({});
  const deletedOrders = await prisma.order.deleteMany({});
  const deletedProducts = await prisma.product.deleteMany({});
  console.log(
    `Cleared ${deletedProducts.count} old products, ${deletedOrders.count} orders, ${deletedItems.count} order items.`
  );

  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const result = await prisma.product.createMany({ data: batch });
    inserted += result.count;
    console.log(`Inserted ${inserted}/${products.length}...`);
  }

  console.log(`Done. ${inserted} products loaded from the real catalog.`);
}

main()
  .catch((e) => {
    console.error("IMPORT FAILED:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongo.close();
    await prisma.$disconnect();
  });
