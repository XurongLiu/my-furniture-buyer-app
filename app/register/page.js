"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", budget: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setError("Account created, but automatic login failed. Please log in.");
      router.push("/login");
      return;
    }
    router.push("/catalogue");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input
            required
            value={form.name}
            onChange={update("name")}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={update("email")}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={update("password")}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Starting budget ($, optional)</label>
          <input
            type="number"
            min="0"
            placeholder="1000"
            value={form.budget}
            onChange={update("budget")}
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-stone-600">
        Already have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </div>
  );
}
