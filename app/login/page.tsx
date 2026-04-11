"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
    }
    setLoading(false);
  }

  return (
    <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="card p-8 w-full">
        <h1 className="font-serif text-2xl text-tp-primary mb-1 font-bold text-center">
          Welcome Back
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          Sign in to manage your pools.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="input-field" autoComplete="email" required />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="input-field" autoComplete="current-password" required />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading} className="btn-green w-full disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-tp-primary font-semibold">Create one</Link>
        </p>
      </div>
    </div>
    </main>
  );
}
