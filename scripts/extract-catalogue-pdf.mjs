// One-off: parses data/source/Full-Product-Catalogue.pdf into structured
// per-product records. Run with: node scripts/extract-catalogue-pdf.mjs
//
// The PDF's raw text (verified directly via pdf-parse, not assumed) comes
// out as a flat, consistent sequence per product: name (1-2 lines,
// sometimes hyphen-wrapped), category (1-2 lines), price, an OPTIONAL
// dimensions line, then a numeric item_id. Categories are used as the
// anchor for splitting records apart, since we already know the exact 17
// category strings from the live API's /catalogue/categories endpoint.
import fs from "node:fs";
import { PDFParse } from "pdf-parse";

const CATEGORIES = [
  "Bar furniture",
  "Beds",
  "Bookcases & shelving units",
  "Cabinets & cupboards",
  "Café furniture",
  "Chairs",
  "Chests of drawers & drawer units",
  "Children's furniture",
  "Nursery furniture",
  "Outdoor furniture",
  "Room dividers",
  "Sideboards, buffets & console tables",
  "Sofas & armchairs",
  "TV & media furniture",
  "Tables & desks",
  "Trolleys",
  "Wardrobes",
];

function joinWrapped(a, b) {
  // A trailing hyphen means the word itself wraps (e.g. "drop-" + "leaf" ->
  // "drop-leaf") — no space, and the hyphen stays (it's a real hyphen in
  // the word, not a line-break artifact to discard).
  return a.endsWith("-") ? a + b : `${a} ${b}`;
}

// Page-break footers ("-- 1 of 64 --") get interleaved into the text flow
// at page boundaries and aren't part of any product.
const PAGE_MARKER = /^--\s*\d+\s*of\s*\d+\s*--$/;

async function main() {
  const buf = fs.readFileSync(new URL("../data/source/Full-Product-Catalogue.pdf", import.meta.url));
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  await parser.destroy();

  const lines = result.text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !PAGE_MARKER.test(l));

  // Skip the title/intro block before the first product.
  let i = lines.findIndex((l) => l === "PRODUCTS") + 1;

  const products = [];
  let nameLines = [];

  while (i < lines.length) {
    const line = lines[i];

    // Category match: either a single line, or this line + the next joined.
    let category = CATEGORIES.find((c) => c === line);
    let categoryLineCount = 1;
    if (!category && i + 1 < lines.length) {
      const joined = joinWrapped(line, lines[i + 1]);
      category = CATEGORIES.find((c) => c === joined);
      if (category) categoryLineCount = 2;
    }

    if (!category) {
      // Still part of the product name.
      nameLines.push(line);
      i++;
      continue;
    }

    const name = nameLines.reduce((acc, l) => (acc ? joinWrapped(acc, l) : l), "").trim();
    nameLines = [];
    i += categoryLineCount;

    const priceLine = lines[i];
    const priceMatch = priceLine && priceLine.match(/^\$([\d,]+\.\d{2})$/);
    if (!priceMatch) {
      console.warn(`Expected a price after category "${category}" (name "${name}") at line ${i}, got: ${priceLine}`);
      continue;
    }
    const price = Number(priceMatch[1].replace(/,/g, ""));
    i++;

    let dimensions = null;
    if (lines[i] && /×.*cm$/.test(lines[i])) {
      dimensions = lines[i];
      i++;
    }

    const itemIdLine = lines[i];
    if (!itemIdLine || !/^\d+$/.test(itemIdLine)) {
      console.warn(`Expected an item_id after price for "${name}" at line ${i}, got: ${itemIdLine}`);
      continue;
    }
    const itemId = itemIdLine;
    i++;

    products.push({ itemId, name, category, price, dimensions });
  }

  fs.mkdirSync(new URL("../data", import.meta.url), { recursive: true });
  fs.writeFileSync(
    new URL("../data/catalogue-parsed.json", import.meta.url),
    JSON.stringify(products, null, 2)
  );

  console.log(`Parsed ${products.length} products from ${result.total} pages.`);
}

main().catch((e) => {
  console.error("PDF extraction failed:", e);
  process.exit(1);
});
