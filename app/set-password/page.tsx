"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isNewAccount = searchParams.get("new") === "1";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-stacked.png" alt="TourneyPools" className="h-28 mb-8" />
        <div className="card p-8">
          <h1 className="font-serif text-2xl text-tp-primary font-bold mb-2">Invalid Link</h1>
          <p className="text-sm text-gray-500 mb-6">This link is invalid or has expired.</p>
          <Link href="/login" className="btn-green inline-block">Go to Sign In</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to set password");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-stacked.png" alt="TourneyPools" className="h-28 mb-8" />
      <div className="card p-8 w-full">
        <h1 className="font-serif text-2xl text-tp-primary mb-1 font-bold text-center">
          {isNewAccount ? "Set Your Password" : "Reset Your Password"}
        </h1>
        <p className="text-xs text-gray-500 mb-6 text-center">
          {isNewAccount
            ? "Choose a password to complete your account setup."
            : "Enter a new password for your account."
          }
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="input-field"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type it again"
              className="input-field"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading} className="btn-green w-full disabled:opacity-60">
            {loading ? "Saving..." : isNewAccount ? "Create Account" : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[75vh]">
          <div className="flex gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
        </div>
      }>
        <SetPasswordContent />
      </Suspense>
    </main>
  );
}
