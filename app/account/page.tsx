"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@/lib/types";
import TopNav from "@/app/components/top-nav";
import { isProEffective, isPromoActive, formatPromoExpiry } from "@/lib/tier";

export default function AccountPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("free");
  const [proUntil, setProUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState(false);
  const [passSaving, setPassSaving] = useState(false);

  // Payment handles (used by the Tip the Chairman button and chairman-collects deep links)
  const [venmoHandle, setVenmoHandle] = useState("");
  const [cashappHandle, setCashappHandle] = useState("");
  const [paypalHandle, setPaypalHandle] = useState("");
  const [preferredMethod, setPreferredMethod] = useState<PaymentMethod | null>(null);
  const [paySaving, setPaySaving] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState("");

  const isPro = isProEffective(tier, proUntil);
  const onPromo = isPromoActive(tier, proUntil);
  const promoExpiryLabel = formatPromoExpiry(proUntil);

  const fetchAccount = useCallback(async () => {
    const [meRes, acctRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/account"),
    ]);
    if (!meRes.ok) {
      router.push("/login");
      return;
    }
    const me = await meRes.json();
    if (!me) {
      router.push("/login");
      return;
    }
    setName(me.name || "");
    setEmail(me.email || "");
    setTier(me.tier || "free");
    if (acctRes.ok) {
      const acct = await acctRes.json();
      setProUntil(acct.pro_until ?? null);
      setVenmoHandle(acct.venmo_handle || "");
      setCashappHandle(acct.cashapp_handle || "");
      setPaypalHandle(acct.paypal_handle || "");
      setPreferredMethod(
        acct.preferred_method === "venmo" || acct.preferred_method === "cashapp" || acct.preferred_method === "paypal"
          ? acct.preferred_method
          : null
      );
    }
    setLoading(false);
  }, [router]);

  async function handleSavePayments() {
    setPaySaving(true);
    setPayError("");
    setPaySuccess(false);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_payments",
        venmoHandle,
        cashappHandle,
        paypalHandle,
        preferredMethod,
      }),
    });
    setPaySaving(false);
    if (!res.ok) {
      setPayError("Could not save. Try again.");
      return;
    }
    setPaySuccess(true);
    setTimeout(() => setPaySuccess(false), 2000);
  }

  function togglePreferred(m: PaymentMethod) {
    setPreferredMethod((prev) => (prev === m ? null : m));
  }

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
      <TopNav active="account" />
      <h1 className="font-serif text-2xl font-bold text-tp-primary mb-4">Account</h1>

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
              {onPromo ? (
                <span className="text-[10px] bg-tp-accent/15 text-tp-accent-dark px-2 py-0.5 rounded-full font-semibold">
                  Promo · until {promoExpiryLabel}
                </span>
              ) : (
                <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">Active</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {onPromo
                ? "All Pro features are unlocked until your promo ends. Upgrade to keep them after that."
                : "Unlimited pools, unlimited players, no ads, custom branding."}
            </p>
            <button
              onClick={handleManageSubscription}
              className="btn-outline w-full text-xs"
            >
              {onPromo ? "Upgrade to Pro" : "Manage Subscription"}
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

      {/* Payment Info: chairman's own Venmo / Cash App / PayPal handles. Powers the
          Tip the Chairman button on pool leaderboards (and chairman-collects deep
          links once that flow ships). Star marks the preferred app. */}
      <div className="card p-5 mb-4">
        <h2 className="font-serif text-lg font-bold text-tp-primary mb-1">Payment Info</h2>
        <p className="text-xs text-gray-400 mb-4">
          Used for the Tip the Chairman button on your pools. Star your preferred app.
          Leave any blank.
        </p>

        <div className="space-y-2.5 mb-4">
          {([
            { key: "venmo",   label: "Venmo",    value: venmoHandle,   setter: setVenmoHandle   },
            { key: "cashapp", label: "Cash App", value: cashappHandle, setter: setCashappHandle },
            { key: "paypal",  label: "PayPal",   value: paypalHandle,  setter: setPaypalHandle  },
          ] as const).map((row) => {
            const isPreferred = preferredMethod === row.key;
            return (
              <div key={row.key} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 w-16">
                    {row.label}
                  </span>
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => row.setter(e.target.value)}
                    placeholder="handle (no @ needed)"
                    className="input-field pl-[5.25rem]"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={`${row.label} handle`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => togglePreferred(row.key)}
                  disabled={!row.value && !isPreferred}
                  title={isPreferred ? "Preferred app" : row.value ? "Set as preferred" : "Enter a handle first"}
                  aria-label={isPreferred ? `${row.label} is preferred` : `Set ${row.label} as preferred`}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors
                    ${isPreferred ? "text-tp-accent" : row.value ? "text-gray-300 active:text-tp-accent" : "text-gray-200 cursor-not-allowed"}`}
                >
                  <svg className="w-5 h-5" fill={isPreferred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {payError && <p className="text-red-500 text-xs mb-2">{payError}</p>}
        {paySuccess && <p className="text-green-600 text-xs font-semibold mb-2">Saved.</p>}
        <button
          type="button"
          onClick={handleSavePayments}
          disabled={paySaving}
          className="btn-gold w-full disabled:opacity-60"
        >
          {paySaving ? "Saving..." : "Save Payment Info"}
        </button>
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
