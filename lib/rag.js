// In-memory RAG retrieval over the product catalogue. Deliberately no
// vector database — 762 products' worth of 384-dim embeddings fit
// comfortably in memory, and a plain linear cosine-similarity scan over
// them is fast enough that an index would be solving a problem this app
// doesn't have.
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "@xenova/transformers";

let recordsPromise = null;
let extractorPromise = null;

function loadRecords() {
  if (!recordsPromise) {
    recordsPromise = Promise.resolve().then(() => {
      const filePath = path.join(process.cwd(), "data", "catalogue-embeddings.json");
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    });
  }
  return recordsPromise;
}

function loadExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractorPromise;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // Both vectors are already L2-normalized at embed time, so the dot
  // product alone is the cosine similarity — no need to divide by norms.
  return dot;
}

// Returns the topK products most semantically similar to the query, each
// with its full structured fields (name, category, price, dimensions,
// itemId) attached — not just the raw chunk text — so the calling code
// can hand the model something to reason over precisely, not just prose.
export async function retrieveProducts(query, topK = 20) {
  const [records, extractor] = await Promise.all([loadRecords(), loadExtractor()]);
  const queryEmbedding = await extractor(query, { pooling: "mean", normalize: true });
  const queryVec = Array.from(queryEmbedding.data);

  const scored = records.map((record) => ({
    score: cosineSimilarity(queryVec, record.embedding),
    itemId: record.itemId,
    name: record.name,
    category: record.category,
    price: record.price,
    dimensions: record.dimensions,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// Embedding similarity only ever surfaces topically-relevant products — it
// can't answer "what's the single cheapest item in the whole catalogue"
// because that item might not resemble the query text at all. For that,
// skip embeddings entirely and sort the full in-memory list directly, so
// price-extreme questions get an exact answer instead of "cheapest among
// whatever 15 items happened to match semantically."
export async function getPriceExtremes(count = 5) {
  const records = await loadRecords();
  const toResult = (r) => ({
    itemId: r.itemId,
    name: r.name,
    category: r.category,
    price: r.price,
    dimensions: r.dimensions,
  });
  const sorted = [...records].sort((a, b) => a.price - b.price);
  return {
    cheapest: sorted.slice(0, count).map(toResult),
    priciest: sorted.slice(-count).reverse().map(toResult),
  };
}
