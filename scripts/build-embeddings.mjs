// One-off: embeds every parsed product (data/catalogue-parsed.json) with a
// local model (no API key, no per-query cost — fits the "no vector
// database needed, everything fits in memory" scale of 762 products) and
// writes data/catalogue-embeddings.json for the RAG retrieval module to
// load at server startup.
//
// Chunking is per-product (a natural unit here), not fixed-character-count
// — each chunk is one sentence combining name/category/price/dimensions,
// with those same fields kept alongside as structured data so retrieval
// hands the generation step real fields to reason over, not just prose.
import fs from "node:fs";
import { pipeline } from "@xenova/transformers";

function chunkText({ name, category, price, dimensions }) {
  let text = `${name}. Category: ${category}. Price: $${price.toFixed(2)}.`;
  if (dimensions) text += ` Dimensions: ${dimensions}.`;
  return text;
}

async function main() {
  const products = JSON.parse(
    fs.readFileSync(new URL("../data/catalogue-parsed.json", import.meta.url), "utf8")
  );

  console.log(`Embedding ${products.length} products (first run downloads the model, ~90MB)...`);
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  const records = [];
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const text = chunkText(product);
    const output = await extractor(text, { pooling: "mean", normalize: true });
    records.push({ ...product, text, embedding: Array.from(output.data) });
    if ((i + 1) % 100 === 0 || i === products.length - 1) {
      console.log(`  ${i + 1}/${products.length}`);
    }
  }

  fs.writeFileSync(
    new URL("../data/catalogue-embeddings.json", import.meta.url),
    JSON.stringify(records)
  );
  console.log(`Wrote data/catalogue-embeddings.json (${records.length} records).`);
}

main().catch((e) => {
  console.error("Embedding build failed:", e);
  process.exit(1);
});
