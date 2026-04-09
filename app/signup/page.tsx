"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "Signup failed");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="card p-8 w-full">
        <h1 className="font-serif text-2xl text-masters-green mb-1 font-bold text-center">
          Create Account
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          Set up your chairman account to create pools.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="input-field" required />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="input-field" autoComplete="email" required />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" className="input-field" autoComplete="new-password" minLength={6} required />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading} className="btn-green w-full disabled:opacity-60">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-masters-green font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
