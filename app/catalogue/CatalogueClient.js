"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CatalogueClient({ products, spent, balance: initialBalance }) {
  const [balance, setBalance] = useState(initialBalance);
  const [quantities, setQuantities] = useState({});
  const [buyState, setBuyState] = useState({}); // productId -> { submitting, error, message }
  const router = useRouter();

  function setQty(productId, qty) {
    const value = Math.max(0, Number(qty) || 0);
    setQuantities((q) => ({ ...q, [productId]: value }));
  }

  async function handleBuy(product) {
    const quantity = Math.max(1, quantities[product.id] || 1);

    setBuyState((s) => ({ ...s, [product.id]: { submitting: true } }));

    // Nothing here — a dropped connection, a non-JSON error page, anything
    // unexpected — should ever leave a button stuck on "Buying..." or throw
    // out of this handler uncaught.
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // non-JSON response — data stays null, generic message below
      }

      if (!res.ok) {
        setBuyState((s) => ({
          ...s,
          [product.id]: { error: data?.error || "Could not place order. Please try again." },
        }));
        return;
      }

      setBuyState((s) => ({
        ...s,
        [product.id]: {
          message: `Bought ${data.quantity} × ${data.productName} for $${data.total.toFixed(2)} — order #${data.orderId.slice(-6)}.`,
        },
      }));
      setBalance(data.remainingBalance);
      router.refresh();
    } catch {
      setBuyState((s) => ({
        ...s,
        [product.id]: { error: "Couldn't reach the server. Check your connection and try again." },
      }));
    }
  }

  return (
    <div>
      <div className="sticky top-16 z-10 mb-6 rounded border border-stone-200 bg-white p-4 shadow-sm">
        <div className="text-sm">
          <span className="text-stone-500">Spent through this app ${spent.toFixed(2)}</span>
          <span className="mx-2 text-stone-300">·</span>
          {balance === null ? (
            <span className="font-semibold text-red-600">Real balance unavailable</span>
          ) : (
            <span className="font-semibold text-stone-900">Real balance (live) ${balance.toFixed(2)}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => {
          const state = buyState[product.id] || {};
          return (
            <div key={product.id} className="rounded border border-stone-200 bg-white p-4">
              {product.imageMimeType ? (
                <img
                  src={`/api/products/${product.id}/image`}
                  alt={product.name}
                  loading="lazy"
                  className="h-36 w-full rounded object-contain bg-stone-50"
                />
              ) : (
                <div className="flex h-36 items-center justify-center text-4xl">
                  {product.emoji || "🪑"}
                </div>
              )}
              <span className="mt-2 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                {product.category}
              </span>
              <h3 className="mt-1 font-semibold">{product.name}</h3>
              <p className="text-sm text-stone-500">{product.description}</p>
              <p className="mt-2 font-medium">${product.price.toFixed(2)}</p>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={quantities[product.id] || ""}
                  onChange={(e) => setQty(product.id, e.target.value)}
                  placeholder="1"
                  className="w-16 rounded border border-stone-300 px-2 py-1"
                />
                <button
                  onClick={() => handleBuy(product)}
                  disabled={state.submitting || balance === null}
                  className="flex-1 rounded bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
                >
                  {state.submitting ? "Buying..." : "Buy"}
                </button>
              </div>
              {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
              {state.message && <p className="mt-2 text-sm text-green-600">{state.message}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
