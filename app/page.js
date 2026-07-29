import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/catalogue");

  return (
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
  );
}
