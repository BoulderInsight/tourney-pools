"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TopNav from "@/app/components/top-nav";

export default function PoolShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const [isOwner, setIsOwner] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function check() {
      const [meRes, poolRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/pool/${slug}`),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        if (me) {
          setIsLoggedIn(true);
          if (poolRes.ok) {
            const pool = await poolRes.json();
            if (pool && me.chairmanId === pool.chairmanId) {
              setIsOwner(true);
            }
          }
        }
      }
    }
    check();
  }, [slug]);

  return (
    <main className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      {isLoggedIn && <TopNav pool={{ slug, isOwner }} />}
      {children}
    </main>
  );
}
