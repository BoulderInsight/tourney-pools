"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (data.needsVerification) {
      setEmailSent(true);
    } else if (!res.ok) {
      setError(data.error || "Signup failed");
    }
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] text-center">
        <Image src="/MyMastersPoolstacked.jpeg" alt="My Masters Pool" width={280} height={155} className="mb-6" />
        <div className="card p-8 w-full">
          <div className="w-16 h-16 rounded-full bg-masters-green/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-masters-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-masters-green font-bold mb-2">Check Your Email</h1>
          <p className="text-sm text-gray-500 mb-2">
            We sent a verification link to:
          </p>
          <p className="text-sm font-semibold text-gray-800 mb-6">{email}</p>
          <p className="text-xs text-gray-400">
            Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
          </p>
        </div>
      </div>
    );
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
