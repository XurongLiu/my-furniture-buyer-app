"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-stone-900">
          🪑 Furniture Buyer
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {status === "authenticated" ? (
            <>
              <Link href="/catalogue" className="hover:underline">Catalogue</Link>
              <Link href="/orders" className="hover:underline">My Orders</Link>
              <span className="text-stone-500">{session.user.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700"
              >
                Log out
              </button>
            </>
          ) : status === "loading" ? null : (
            <>
              <Link href="/login" className="hover:underline">Log in</Link>
              <Link
                href="/register"
                className="rounded bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
