import { getHackathonBalance } from "@/lib/hackathonApi";

// Tool schemas for the shopping assistant. Catalogue search is no longer a
// tool the model calls — it's handled by RAG retrieval (lib/rag.js), run
// automatically before each model call and injected as context. Only
// actions that aren't "look something up" remain as tools. See
// architecture.md's "Shopping assistant agent" section for the reasoning.
export const TOOL_SCHEMAS = [
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
            description: "The exact item_id to buy, from one of the CATALOGUE CANDIDATES provided in context.",
          },
          quantity: { type: "integer", minimum: 1, description: "How many to buy (default 1)." },
        },
        required: ["item_id"],
      },
    },
  },
];

// Executes the one read-only tool. place_order is deliberately NOT handled
// here — the agent loop (app/api/agent/chat/route.js) intercepts it before
// anything is executed, since a real purchase must never happen without an
// explicit human confirmation click.
export async function executeReadOnlyTool(name) {
  switch (name) {
    case "check_balance": {
      const balance = await getHackathonBalance();
      return balance === null ? { error: "Could not fetch the real balance right now." } : { balance };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
