"use client";

import { useState, useRef, useEffect } from "react";

export default function AssistantClient() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! Ask me things like \"cheap bar stools\" or \"something white for a dining room\" — the catalogue only matches exact categories, so I'll fetch the closest category and judge price/colour myself.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [purchaseState, setPurchaseState] = useState({}); // { submitting, error, message }
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingPurchase]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setInput("");
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: messages.map(({ role, content }) => ({ role, content })),
          message: text,
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON response — data stays null
      }

      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        setMessages((m) => m.slice(0, -1)); // drop the optimistic user message, it never got a reply
        return;
      }

      setMessages(data.history);
      setPendingPurchase(data.pendingPurchase || null);
      setPurchaseState({});
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPurchase() {
    if (!pendingPurchase) return;
    setPurchaseState({ submitting: true });

    try {
      const res = await fetch("/api/agent/confirm-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: pendingPurchase.productId,
          quantity: pendingPurchase.quantity,
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON response
      }

      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: `❌ ${data?.error || "Could not place the order. Please try again."}` }]);
        setPurchaseState({});
        setPendingPurchase(null);
        return;
      }

      // Success replies are pre-formatted with ✅; failure replies come back
      // as the model's own plain-language explanation + suggestion (see
      // app/api/agent/confirm-purchase/route.js) — nothing more to format here.
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setPendingPurchase(null);
      setPurchaseState({});
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "❌ Couldn't reach the server. Please try again." }]);
      setPendingPurchase(null);
      setPurchaseState({});
    }
  }

  function handleCancelPurchase() {
    setPendingPurchase(null);
    setPurchaseState({});
    setMessages((m) => [...m, { role: "assistant", content: "Okay, cancelled — nothing was bought." }]);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <h1 className="mb-4 text-2xl font-bold text-stone-900">Shopping Assistant</h1>

      <div className="flex-1 space-y-3 overflow-y-auto rounded border border-stone-200 bg-white p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                "inline-block max-w-[85%] whitespace-pre-wrap rounded px-3 py-2 text-sm " +
                (m.role === "user" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-900")
              }
            >
              {m.content}
            </span>
          </div>
        ))}

        {loading && <p className="text-sm text-stone-400">Thinking…</p>}

        {pendingPurchase && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm text-stone-800">
              Buy <strong>{pendingPurchase.quantity} × {pendingPurchase.productName}</strong> for{" "}
              <strong>${(pendingPurchase.price * pendingPurchase.quantity).toFixed(2)}</strong>? This places a real
              order and really debits the real balance.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleConfirmPurchase}
                disabled={purchaseState.submitting}
                className="rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {purchaseState.submitting ? "Placing order..." : "Confirm"}
              </button>
              <button
                onClick={handleCancelPurchase}
                disabled={purchaseState.submitting}
                className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the catalogue..."
          disabled={loading}
          className="flex-1 rounded border border-stone-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
