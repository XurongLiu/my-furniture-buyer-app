import { searchCatalogue, getProductDetail, getHackathonBalance } from "@/lib/hackathonApi";

// Tool schemas for the shopping assistant. Each description is written to
// be honest about what the underlying API actually does — see
// architecture.md's "Shopping assistant agent" section for the reasoning
// behind each one (especially why search_catalogue's description warns
// against fuzzy matching, and why place_order's warns about confirmation).
export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "search_catalogue",
      description:
        "Lists products filtered by an exact, case-insensitive category name, with optional pagination. It does NOT support keyword, price, colour, or style/'vibe' matching — for a request like 'cheap' or a colour, fetch a reasonably sized set of results for the closest category and apply that judgment yourself by reasoning over the returned price/colour/name fields. Say so plainly when you do.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Exact category name, e.g. 'Bar furniture'. Omit to browse without filtering.",
          },
          limit: { type: "integer", minimum: 1, maximum: 100, description: "Max results (default 25)." },
          skip: { type: "integer", minimum: 0, description: "Results to skip, for pagination (default 0)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_detail",
      description:
        "Fetches full detail (including dimensions) for one specific, already-known product id. Not a search tool — only call it after search_catalogue has given you a valid item_id.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "The exact item_id from a prior search_catalogue result." },
        },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_balance",
      description:
        "Checks the current signed-in user's own real balance, live. There is no way to check anyone else's balance.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description:
        "Places a REAL order that immediately and irreversibly debits the user's real balance. Never call this without first clearly telling the user, in the conversation, exactly what you'd buy — item name, quantity, total price — and only after they've explicitly agreed. (The system will also pause for a human confirmation click before anything is actually charged, regardless.)",
      parameters: {
        type: "object",
        properties: {
          item_id: {
            type: "string",
            description: "The exact item_id to buy, from a prior search_catalogue or get_product_detail result.",
          },
          quantity: { type: "integer", minimum: 1, description: "How many to buy (default 1)." },
        },
        required: ["item_id"],
      },
    },
  },
];

// Executes the three read-only tools. place_order is deliberately NOT
// handled here — the agent loop (app/api/agent/chat/route.js) intercepts
// it before anything is executed, since a real purchase must never happen
// without an explicit human confirmation click.
export async function executeReadOnlyTool(name, args) {
  switch (name) {
    case "search_catalogue":
      return searchCatalogue({ category: args.category, limit: args.limit, skip: args.skip });
    case "get_product_detail":
      return getProductDetail({ itemId: args.item_id });
    case "check_balance": {
      const balance = await getHackathonBalance();
      return balance === null ? { error: "Could not fetch the real balance right now." } : { balance };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
