"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AccountPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("free");
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState(false);
  const [passSaving, setPassSaving] = useState(false);

  const isPro = tier === "pro" || tier === "paid";

  const fetchAccount = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (!res.ok) {
      router.push("/login");
      return;
    }
    const me = await res.json();
    if (!me) {
      router.push("/login");
      return;
    }
    setName(me.name || "");
    setEmail(me.email || "");
    setTier(me.tier || "free");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPassError("");
    setPassSuccess(false);
    setPassSaving(true);

    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
    });

    if (res.ok) {
      setPassSuccess(true);
      setCurrentPass("");
      setNewPass("");
    } else {
      const data = await res.json();
      setPassError(data.error || "Failed to change password");
    }
    setPassSaving(false);
  }

  async function handleManageSubscription() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  async function handleUpgrade(plan: "monthly" | "annual") {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="flex gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="TourneyPools" className="h-12" />
        <div className="flex flex-col items-end gap-1">
          <Link href="/dashboard" className="text-xs text-tp-primary font-semibold">
            My Pools
          </Link>
          <h1 className="font-serif text-2xl font-bold text-tp-primary">Account</h1>
        </div>
      </div>

      {/* Profile info */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-serif text-lg font-bold text-tp-primary">Profile</h2>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
            isPro ? "bg-tp-accent/15 text-tp-accent-dark" : "bg-gray-100 text-gray-500"
          }`}>
            {isPro ? "Pro" : "Free"}
          </span>
        </div>
        <div className="space-y-2 mt-3">
          <div className="flex gap-3 text-sm py-2 border-b border-tp-bg-dark">
            <span className="w-16 text-gray-400 flex-shrink-0">Name</span>
            <span className="text-gray-800 font-medium">{name}</span>
          </div>
          <div className="flex gap-3 text-sm py-2">
            <span className="w-16 text-gray-400 flex-shrink-0">Email</span>
            <span className="text-gray-800 font-medium">{email}</span>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="card p-5 mb-4">
        <h2 className="font-serif text-lg font-bold text-tp-primary mb-3">Subscription</h2>
        {isPro ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-800">TourneyPools Pro</span>
              <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">Active</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Unlimited pools, unlimited players, no ads, custom branding.</p>
            <button
              onClick={handleManageSubscription}
              className="btn-outline w-full text-xs"
            >
              Manage Subscription
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-4">You&apos;re on the Free plan: 1 pool, up to 8 players.</p>
            <div className="flex gap-2.5">
              <button
                onClick={() => handleUpgrade("monthly")}
                className="flex-1 rounded-xl border-2 border-tp-bg-dark bg-white p-4 text-center active:bg-tp-bg/40 transition-colors"
              >
                <p className="text-lg font-bold text-tp-primary">$4.99</p>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">per month</p>
              </button>
              <button
                onClick={() => handleUpgrade("annual")}
                className="flex-1 rounded-xl border-2 border-tp-accent bg-tp-accent/5 p-4 text-center active:bg-tp-accent/10 transition-colors relative overflow-hidden"
              >
                <span className="absolute top-0 right-0 bg-tp-accent text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">Save 50%</span>
                <p className="text-lg font-bold text-tp-primary">$29.99</p>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">per year</p>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="card p-5 mb-4">
        <h2 className="font-serif text-lg font-bold text-tp-primary mb-3">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">Current Password</label>
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              className="input-field"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">New Password</label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Minimum 6 characters"
              className="input-field"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {passError && <p className="text-red-500 text-xs">{passError}</p>}
          {passSuccess && <p className="text-green-600 text-xs font-semibold">Password changed successfully.</p>}
          <button type="submit" disabled={passSaving} className="btn-green w-full disabled:opacity-60">
            {passSaving ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <button
        onClick={handleLogout}
        className="w-full py-3.5 text-sm font-semibold text-red-500 border-2 border-red-200 rounded-xl active:bg-red-50 transition-colors mt-2"
      >
        Sign Out
      </button>
    </main>
  );
}
