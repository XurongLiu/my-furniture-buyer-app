// Client for the Day 1 Participant Guide's Product Search / Order / Balance
// API. See "Catalogue page: real balance instead of a locally-tracked one"
// in architecture.md for the full picture — this is a real account with a
// real, event-tracked balance, not a sandbox to call carelessly.

// Always fetched fresh (no caching): a stale balance is a correctness bug,
// not just an inconvenience, since it's what order placement is checked
// against.
export async function getHackathonBalance() {
  const base = process.env.HACKATHON_API_BASE_URL;
  const userId = process.env.HACKATHON_USER_ID;
  const apiKey = process.env.HACKATHON_API_KEY;

  try {
    const res = await fetch(`${base}/users/${userId}`, {
      headers: { "X-Api-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.balance === "number" ? data.balance : null;
  } catch {
    return null;
  }
}

// Lists products by an exact, case-insensitive category match only — no
// keyword/price/colour/style filtering happens here or anywhere in the
// real API. Needs no auth (public endpoint). Deliberately NOT the plain
// /catalogue endpoint, which embeds every product's image as base64 and
// can take 20+ seconds against the real event catalogue.
export async function searchCatalogue({ category, limit = 25, skip = 0 } = {}) {
  const base = process.env.HACKATHON_API_BASE_URL;
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  params.set("limit", String(limit));
  params.set("skip", String(skip));

  try {
    const res = await fetch(`${base}/catalogue/search-index?${params}`, { cache: "no-store" });
    if (!res.ok) return { error: `Catalogue search failed (status ${res.status}).` };
    return { results: await res.json() };
  } catch {
    return { error: "Couldn't reach the real catalogue. Please try again." };
  }
}

// Full detail for one already-known item_id — needs no auth. The real
// response also includes a base64 image_url field; that is deliberately
// stripped here before it ever reaches an LLM's context (huge, and inert
// as text to a non-vision call — see the tool-design notes for why).
export async function getProductDetail({ itemId }) {
  const base = process.env.HACKATHON_API_BASE_URL;
  try {
    const res = await fetch(`${base}/catalogue/${encodeURIComponent(itemId)}`, { cache: "no-store" });
    if (res.status === 404) return { error: "No product with that id." };
    if (!res.ok) return { error: `Product lookup failed (status ${res.status}).` };
    const { image_url, ...rest } = await res.json();
    return { product: rest };
  } catch {
    return { error: "Couldn't reach the real catalogue. Please try again." };
  }
}

// Friendly, user-facing text for the statuses the guide documents. Shown
// in preference to the API's own {"detail": ...} text, which can be
// technical (exposes raw item_ids) or inconsistently worded — the raw
// detail is still logged server-side (see below) for debugging.
const ORDER_ERROR_MESSAGES = {
  401: "The app's connection to the real order system isn't authorized.",
  403: "The app's real-order credentials don't match the configured account.",
  404: "This item is no longer available.",
  402: "You don't have enough balance for this order.",
  429: "Too many real orders too quickly — please wait a moment and try again.",
};

// Extracts a human-readable message from a FastAPI-style error body.
// HTTPException errors look like {"detail": "some message"} (a string);
// 422 validation errors look like {"detail": [{"msg": "...", ...}, ...]}
// (an array) — both are handled since a malformed request should never
// crash this into an unreadable error.
function extractDetail(data) {
  if (!data || data.detail == null) return null;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return null;
}

// Places a REAL order against the real, event-tracked balance via
// POST /orders. This genuinely debits money-equivalent balance and creates
// a real invoice on the hackathon's side — it is not a local simulation.
//
// Request shape confirmed against the API's own /openapi.json (the
// Participant Guide's example curl command is a flat {item_id, quantity},
// but the actual schema is {user_id, items: [{item_id, quantity}]}).
export async function placeHackathonOrder({ itemId, quantity }) {
  const base = process.env.HACKATHON_API_BASE_URL;
  const userId = process.env.HACKATHON_USER_ID;
  const apiKey = process.env.HACKATHON_API_KEY;

  let res;
  try {
    res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        // Makes an accidental retry (double-click, network blip) safe —
        // resending the same key returns the original result instead of
        // placing (and charging for) a second order.
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        user_id: userId,
        items: [{ item_id: itemId, quantity }],
      }),
      cache: "no-store",
    });
  } catch {
    return { error: "Couldn't reach the real order system. Please try again.", status: 502 };
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // handled by the res.ok check below
  }

  if (!res.ok) {
    const detail = extractDetail(data);
    if (detail) {
      // Kept out of the user-facing message (can be technical / expose raw
      // ids) but logged so a genuinely new failure mode is still visible.
      console.error(`Hackathon order API error (${res.status}):`, detail);
    }
    return {
      error: ORDER_ERROR_MESSAGES[res.status] || detail || `Order failed (status ${res.status}).`,
      status: res.status,
    };
  }

  return {
    orderId: data.order_id,
    totalPrice: data.total_price,
    remainingBalance: data.remaining_balance,
  };
}

// Fetches the real PDF invoice the hackathon API generates per order
// (confirmed directly by calling it against a real placed order — returns
// Content-Type: application/pdf, ~50KB, a ReportLab-generated one-pager).
// Unlike every other call in this file, the response body is binary, not
// JSON, so success/failure has to be told apart by status code alone.
export async function getHackathonInvoice({ orderId }) {
  const base = process.env.HACKATHON_API_BASE_URL;
  const apiKey = process.env.HACKATHON_API_KEY;

  let res;
  try {
    res = await fetch(`${base}/orders/${encodeURIComponent(orderId)}/invoice`, {
      headers: { "X-Api-Key": apiKey },
      cache: "no-store",
    });
  } catch {
    return { error: "Couldn't reach the real order system. Please try again." };
  }

  if (!res.ok) {
    if (res.status === 404) return { error: "That order's invoice is no longer available.", status: 404 };
    const data = await res.json().catch(() => null);
    const detail = extractDetail(data);
    if (detail) console.error(`Hackathon invoice API error (${res.status}):`, detail);
    return { error: ORDER_ERROR_MESSAGES[res.status] || detail || `Invoice fetch failed (status ${res.status}).`, status: res.status };
  }

  const pdfBytes = Buffer.from(await res.arrayBuffer());
  return { pdfBytes };
}
