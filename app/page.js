import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

// Public, no-auth endpoint — safe to call straight from a server component.
// Deliberately NOT the plain /catalogue endpoint: that embeds every product's
// image as base64 and can take 20+ seconds against the real event catalogue.
// /catalogue/search-index returns the same products without images, fast.
async function fetchFeaturedProducts() {
  const base = process.env.HACKATHON_API_BASE_URL;
  try {
    const res = await fetch(`${base}/catalogue/search-index?limit=12`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/catalogue");

  const products = await fetchFeaturedProducts();

  return (
    <div>
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-bold text-stone-900">Welcome to Furniture Buyer</h1>
        <p className="mt-4 text-stone-600">
          Browse our catalogue and place orders against your own shopping budget.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/login" className="rounded bg-stone-900 px-5 py-2.5 text-white hover:bg-stone-700">
            Log in
          </Link>
          <Link href="/register" className="rounded border border-stone-300 px-5 py-2.5 hover:bg-stone-100">
            Sign up
          </Link>
        </div>
      </div>

      {products.length > 0 && (
        <div className="mx-auto mt-12 max-w-5xl">
          <h2 className="mb-4 text-center text-lg font-semibold text-stone-900">
            A few things in the catalogue
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <div key={product.item_id} className="rounded border border-stone-200 bg-white p-4">
                <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  {product.category}
                </span>
                <h3 className="mt-1 font-semibold">{product.product_name}</h3>
                <p className="mt-2 font-medium">${product.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
