"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ConfirmModal from "@/app/components/confirm-modal";
import { BoulderInsightAd, CustomAd } from "@/app/components/sponsor-banner";

interface Pool {
  id: string;
  slug: string;
  pool_name: string;
  buy_in: number;
  setup_complete: boolean;
  player_count: number;
  created_at: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get("upgraded") === "1";
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tier, setTier] = useState("free");
  const [customAdImage, setCustomAdImage] = useState<string | null>(null);
  const [customAdUrl, setCustomAdUrl] = useState<string | null>(null);
  const [customAdHeadline, setCustomAdHeadline] = useState<string | null>(null);
  const [customAdDescription, setCustomAdDescription] = useState<string | null>(null);
  const [adRemoved, setAdRemoved] = useState(false);
  const [showAdEditor, setShowAdEditor] = useState(false);
  const [adImageInput, setAdImageInput] = useState("");
  const [adUrlInput, setAdUrlInput] = useState("");
  const [adHeadlineInput, setAdHeadlineInput] = useState("");
  const [adDescriptionInput, setAdDescriptionInput] = useState("");
  const [savingAd, setSavingAd] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isPaid = tier === "paid";
  const canCreatePool = isPaid || pools.length < 1;

  const fetchPools = useCallback(async () => {
    const [poolRes, meRes, acctRes] = await Promise.all([
      fetch("/api/pools"),
      fetch("/api/auth/me"),
      fetch("/api/account"),
    ]);
    if (poolRes.ok) setPools(await poolRes.json());
    if (meRes.ok) {
      const me = await meRes.json();
      if (me?.isSuperAdmin) setIsSuperAdmin(true);
      if (me?.tier) setTier(me.tier);
    }
    if (acctRes.ok) {
      const acct = await acctRes.json();
      setCustomAdImage(acct.custom_ad_image || null);
      setCustomAdUrl(acct.custom_ad_url || null);
      setCustomAdHeadline(acct.custom_ad_headline || null);
      setCustomAdDescription(acct.custom_ad_description || null);
      setAdRemoved(acct.ad_removed || false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  async function createPool() {
    setCreating(true);
    const res = await fetch("/api/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolName: newName || "My Masters Pool" }),
    });
    if (res.ok) {
      const { slug } = await res.json();
      router.push(`/pool/${slug}/setup`);
    }
    setCreating(false);
  }

  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);

  async function confirmDeletePool() {
    if (!deleteModal) return;
    const res = await fetch("/api/pools", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId: deleteModal.id }),
    });
    if (res.ok) {
      setPools((p) => p.filter((pool) => pool.id !== deleteModal.id));
    }
    setDeleteModal(null);
  }

  async function saveCustomAd() {
    setSavingAd(true);
    await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_custom",
        customAdImage: adImageInput || null,
        customAdUrl: adUrlInput || null,
        customAdHeadline: adHeadlineInput || null,
        customAdDescription: adDescriptionInput || null,
      }),
    });
    setCustomAdImage(adImageInput || null);
    setCustomAdUrl(adUrlInput || null);
    setCustomAdHeadline(adHeadlineInput || null);
    setCustomAdDescription(adDescriptionInput || null);
    setAdRemoved(false);
    setShowAdEditor(false);
    setSavingAd(false);
  }

  async function removeAdEntirely() {
    setSavingAd(true);
    await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_ad" }),
    });
    setCustomAdImage(null);
    setCustomAdUrl(null);
    setCustomAdHeadline(null);
    setCustomAdDescription(null);
    setAdRemoved(true);
    setShowAdEditor(false);
    setSavingAd(false);
  }

  async function restoreDefaultAd() {
    setSavingAd(true);
    await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore_default" }),
    });
    setCustomAdImage(null);
    setCustomAdUrl(null);
    setCustomAdHeadline(null);
    setCustomAdDescription(null);
    setAdRemoved(false);
    setShowAdEditor(false);
    setSavingAd(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      setAdImageInput(url);
    }
    setUploading(false);
  }

  async function handleUpgrade() {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
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
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex gap-3">
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with logo */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Image src="/MyMastersPoolstacked.png" alt="My Masters Pool" width={100} height={73} />
          <h1 className="font-serif text-2xl font-bold text-masters-green">My Pools</h1>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Link href="/admin" className="text-xs text-purple-600 font-semibold">
              Admin
            </Link>
          )}
          <button onClick={handleLogout} className="text-xs text-gray-400 active:text-red-500 transition-colors">
            Sign out
          </button>
        </div>
      </div>

      {/* Upgrade success */}
      {justUpgraded && (
        <div className="card p-4 mb-4 bg-masters-gold/10 border-masters-gold/30 text-center">
          <p className="text-sm font-semibold text-masters-gold-dark">Welcome to Premium!</p>
          <p className="text-xs text-gray-500 mt-1">Unlimited pools, no ads, and custom branding are now unlocked.</p>
        </div>
      )}

      {/* Create pool */}
      {canCreatePool ? (
        <div className="card p-4 mb-6">
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Pool name (e.g. Blue Rock Masters)" className="input-field flex-1" />
            <button onClick={createPool} disabled={creating} className="btn-green flex-shrink-0 disabled:opacity-60">
              {creating ? "..." : "Create"}
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-5 mb-6 text-center">
          <p className="text-sm text-gray-600 mb-1 font-medium">You&apos;ve reached the free pool limit</p>
          <p className="text-xs text-gray-400 mb-4">Upgrade to create unlimited pools, remove ads, and add custom branding.</p>
          <button onClick={handleUpgrade} className="btn-gold w-full">
            Upgrade to Premium — $4.99
          </button>
        </div>
      )}

      {/* Tier badge */}
      {!isPaid && pools.length > 0 && (
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Free Plan — 1 pool</span>
          <button onClick={handleUpgrade} className="text-[10px] text-masters-gold font-semibold active:underline">
            Upgrade →
          </button>
        </div>
      )}

      {/* Pool list */}
      {pools.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-serif italic text-gray-400 text-sm">No pools yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool) => (
            <div key={pool.id} className="card overflow-hidden">
              <Link href={pool.setup_complete ? `/pool/${pool.slug}` : `/pool/${pool.slug}/setup`} className="block p-4 active:bg-masters-cream/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-serif font-bold text-gray-900">{pool.pool_name}</span>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{pool.player_count} players</span>
                      <span className="text-gray-200">|</span>
                      <span>${pool.buy_in} buy-in</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pool.setup_complete ? (
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">Live</span>
                    ) : (
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">Draft</span>
                    )}
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
              {/* Share link */}
              {pool.setup_complete && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://mymasterspool.com/pool/${pool.slug}`);
                    setCopied(pool.id);
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-masters-gold border-t border-masters-cream-dark active:bg-masters-gold/5 transition-colors"
                >
                  {copied === pool.id ? (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Link Copied!</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> Copy Invite Link</>
                  )}
                </button>
              )}
              {/* Pool actions */}
              <div className="flex border-t border-masters-cream-dark">
                <Link
                  href={`/pool/${pool.slug}`}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-masters-green active:bg-masters-green/5 transition-colors"
                >
                  View
                </Link>
                <div className="w-px bg-masters-cream-dark" />
                <Link
                  href={`/pool/${pool.slug}/scores`}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-masters-green active:bg-masters-green/5 transition-colors"
                >
                  Scores
                </Link>
                <div className="w-px bg-masters-cream-dark" />
                <Link
                  href={`/pool/${pool.slug}/setup`}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-masters-green active:bg-masters-green/5 transition-colors"
                >
                  Edit
                </Link>
                <div className="w-px bg-masters-cream-dark" />
                <button
                  onClick={() => setDeleteModal({ id: pool.id, name: pool.pool_name })}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-red-400 active:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ad Preview */}
      {pools.length > 0 && (
        <div className="mt-8">
          <div className="gold-rule mb-4" />
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              {adRemoved ? "No ad on your pools" : "Ad showing on your pools"}
            </span>
            {isPaid && (
              <button
                onClick={() => {
                  setAdImageInput(customAdImage || "");
                  setAdUrlInput(customAdUrl || "");
                  setAdHeadlineInput(customAdHeadline || "");
                  setAdDescriptionInput(customAdDescription || "");
                  setShowAdEditor(!showAdEditor);
                }}
                className="text-[10px] text-masters-gold font-semibold active:underline"
              >
                {showAdEditor ? "Cancel" : adRemoved ? "Add an Ad" : "Remove / Replace Ad"}
              </button>
            )}
          </div>

          {/* Current ad preview */}
          {!adRemoved && (
            <div className="pointer-events-none">
              {customAdImage || customAdHeadline ? (
                <CustomAd imageUrl={customAdImage} headline={customAdHeadline} description={customAdDescription} linkUrl={customAdUrl} />
              ) : (
                <BoulderInsightAd />
              )}
            </div>
          )}

          {/* Ad editor (premium only) */}
          {showAdEditor && isPaid && (
            <div className="card p-5 mt-3 animate-slide-up">
              <h3 className="font-serif text-sm font-bold text-masters-green mb-4">Manage Ad</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">
                    Logo / Image
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={adImageInput}
                      onChange={(e) => setAdImageInput(e.target.value)}
                      placeholder="Paste URL or upload below"
                      className="input-field text-xs flex-1"
                    />
                  </div>
                  <label className="mt-2 flex items-center justify-center gap-2 w-full h-12 border-2 border-dashed border-masters-cream-dark rounded-xl text-xs text-masters-green font-semibold cursor-pointer active:bg-masters-green/5 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {uploading ? "Uploading..." : "Upload Image"}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {adImageInput && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-masters-cream-dark">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={adImageInput} alt="Preview" className="max-w-full h-auto max-h-20 mx-auto" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">
                    Headline
                  </label>
                  <input
                    value={adHeadlineInput}
                    onChange={(e) => setAdHeadlineInput(e.target.value)}
                    placeholder="e.g. Check out our awesome product!"
                    className="input-field text-xs"
                    maxLength={80}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">
                    Description
                  </label>
                  <input
                    value={adDescriptionInput}
                    onChange={(e) => setAdDescriptionInput(e.target.value)}
                    placeholder="e.g. Visit example.com for more info"
                    className="input-field text-xs"
                    maxLength={120}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1 block">
                    Link URL (optional)
                  </label>
                  <input
                    value={adUrlInput}
                    onChange={(e) => setAdUrlInput(e.target.value)}
                    placeholder="https://your-website.com"
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-5">
                <button
                  onClick={saveCustomAd}
                  disabled={savingAd || (!adImageInput && !adHeadlineInput)}
                  className="btn-green w-full text-xs disabled:opacity-60"
                >
                  {savingAd ? "Saving..." : "Save Custom Ad"}
                </button>
                <div className="flex gap-2">
                  <button onClick={restoreDefaultAd} disabled={savingAd} className="btn-outline flex-1 text-xs disabled:opacity-60">
                    Use Default Ad
                  </button>
                  <button onClick={removeAdEntirely} disabled={savingAd} className="flex-1 text-xs font-semibold text-red-400 border-2 border-red-200 rounded-xl py-3 active:bg-red-50 transition-colors disabled:opacity-60">
                    Remove Ad
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isPaid && (
            <p className="text-[10px] text-gray-400 text-center mt-2">
              <button onClick={handleUpgrade} className="text-masters-gold font-semibold">Upgrade to Premium</button>
              {" "}to remove or replace this ad.
            </p>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleteModal}
        title="Delete Pool"
        message={deleteModal ? `Are you sure you want to delete "${deleteModal.name}"? All players, golfers, and draft data will be permanently removed.` : ""}
        confirmLabel="Delete Pool"
        danger
        onConfirm={confirmDeletePool}
        onCancel={() => setDeleteModal(null)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
