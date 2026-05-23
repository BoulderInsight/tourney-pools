"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface PoolContext {
  slug: string;
  isOwner: boolean;
}

export type TopNavActive =
  | "pools"
  | "groups"
  | "admin"
  | "pool-scores"
  | "pool-players";

interface TopNavProps {
  /** Which link should render in the active state. */
  active?: TopNavActive;
  /** When provided, render the per-pool tabs (Leaderboard, Scores, Players, Setup). */
  pool?: PoolContext;
}

/**
 * Logged-in app top bar. Logo on the left, consistent text-xs links on the right:
 * Admin (super only), Pools, Groups, Scores/Players (when on a pool the chairman owns),
 * Sign out. Replaces the prior per-page header markup and the fixed bottom nav.
 */
export default function TopNav({ active, pool }: TopNavProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setIsLoggedIn(true);
          if (data.isSuperAdmin) setIsSuperAdmin(true);
        }
      })
      .catch(() => { /* not logged in or network error; render the minimal bar */ });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const linkClass = (key: TopNavActive) =>
    `text-xs font-semibold transition-colors ${
      active === key
        ? "text-tp-primary underline underline-offset-4 decoration-tp-accent"
        : "text-tp-primary active:underline"
    }`;

  const adminClass = `text-xs font-semibold transition-colors ${
    active === "admin"
      ? "text-purple-700 underline underline-offset-4 decoration-purple-400"
      : "text-purple-600 active:underline"
  }`;

  return (
    <div className="flex items-start justify-between mb-4 -mt-1 gap-3">
      <Link href="/dashboard" aria-label="TourneyPools home" className="flex-shrink-0">
        <img src="/logo.png" alt="TourneyPools" className="h-12" />
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 pt-2">
        {isSuperAdmin && (
          <Link href="/admin" className={adminClass}>Admin</Link>
        )}
        <Link href="/dashboard" className={linkClass("pools")}>Pools</Link>
        <Link href="/groups" className={linkClass("groups")}>Groups</Link>
        {pool?.isOwner && (
          <>
            <Link href={`/pool/${pool.slug}/scores`} className={linkClass("pool-scores")}>
              Scores
            </Link>
            <Link href={`/pool/${pool.slug}/players`} className={linkClass("pool-players")}>
              Players
            </Link>
          </>
        )}
        {isLoggedIn && (
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-medium text-gray-400 active:text-red-500 transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
