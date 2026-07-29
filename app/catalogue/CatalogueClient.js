"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function CatalogueClient({ products, budget, spent, remaining }) {
  const [quantities, setQuantities] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const cartTotal = useMemo(() => {
    return products.reduce((sum, p) => sum + (quantities[p.id] || 0) * p.price, 0);
  }, [products, quantities]);

  function setQty(productId, qty) {
    const value = Math.max(0, Number(qty) || 0);
    setQuantities((q) => ({ ...q, [productId]: value }));
  }

  async function handlePlaceOrder() {
    setError("");
    setMessage("");
    const items = products
      .filter((p) => quantities[p.id] > 0)
      .map((p) => ({ productId: p.id, quantity: quantities[p.id] }));

    if (items.length === 0) {
      setError("Add at least one item before placing an order.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Could not place order.");
      return;
    }

    setMessage("Order placed! Check My Orders to see it.");
    setQuantities({});
    router.refresh();
  }

  return (
    <div>
      <div className="sticky top-16 z-10 mb-6 rounded border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="text-sm">
            <span className="text-stone-500">Budget ${budget.toFixed(2)}</span>
            <span className="mx-2 text-stone-300">·</span>
            <span className="text-stone-500">Spent ${spent.toFixed(2)}</span>
            <span className="mx-2 text-stone-300">·</span>
            <span className="font-semibold text-stone-900">Remaining ${remaining.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Order total: ${cartTotal.toFixed(2)}</span>
            <button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="rounded bg-stone-900 px-5 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {submitting ? "Placing order..." : "Place order"}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
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
            <input
              type="number"
              min="0"
              value={quantities[product.id] || ""}
              onChange={(e) => setQty(product.id, e.target.value)}
              placeholder="0"
              className="mt-2 w-20 rounded border border-stone-300 px-2 py-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
