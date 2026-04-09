"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function check() {
      const [meRes, poolRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/pool/${slug}`),
      ]);
      if (meRes.ok && poolRes.ok) {
        const me = await meRes.json();
        const pool = await poolRes.json();
        if (me && pool && me.chairmanId === pool.chairmanId) {
          setIsOwner(true);
        }
      }
    }
    check();
  }, [slug]);

  const tabs = [
    { href: `/pool/${slug}`, label: "Leaderboard", alwaysShow: true,
      icon: (a: boolean) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> },
    { href: `/pool/${slug}/scores`, label: "Scores", alwaysShow: false,
      icon: (a: boolean) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> },
    { href: `/pool/${slug}/setup`, label: "Setup", alwaysShow: false,
      icon: (a: boolean) => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={a?2.5:1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  ];

  const visibleTabs = tabs.filter((t) => t.alwaysShow || isOwner);

  return (
    <>
      {children}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-masters-cream-dark">
        <div className="flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {visibleTabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors duration-150 ${active ? "text-masters-green" : "text-gray-400"}`}>
                {tab.icon(active)}
                <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-masters-green" : "text-gray-400"}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
