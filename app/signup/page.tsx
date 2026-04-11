"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ name, email }),
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
      <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
      <div className="flex flex-col items-center justify-center min-h-[75vh] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-stacked.png" alt="TourneyPools" className="h-28 mb-8" />
        <div className="card p-8 w-full">
          <div className="w-16 h-16 rounded-full bg-tp-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-tp-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-tp-primary font-bold mb-2">Check Your Email</h1>
          <p className="text-sm text-gray-500 mb-2">
            We sent a link to set your password to:
          </p>
          <p className="text-sm font-semibold text-gray-800 mb-6">{email}</p>
          <p className="text-xs text-gray-400">
            Click the link in the email to set your password and activate your account. Check your spam folder if you don&apos;t see it.
          </p>
        </div>
      </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-stacked.png" alt="TourneyPools" className="h-28 mb-8" />
      <div className="card p-8 w-full">
        <h1 className="font-serif text-2xl text-tp-primary mb-1 font-bold text-center">
          Create Account
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          Enter your name and email. We&apos;ll send you a link to set your password.
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

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading} className="btn-green w-full disabled:opacity-60">
            {loading ? "Sending..." : "Continue"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-tp-primary font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
    </main>
  );
}
