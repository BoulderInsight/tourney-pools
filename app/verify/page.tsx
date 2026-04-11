"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      // Redirect old verification links to the new set-password flow
      router.replace(`/set-password?token=${token}&new=1`);
    } else {
      router.replace("/login");
    }
  }, [token, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh]">
      <div className="flex gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[75vh]">
          <div className="flex gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
        </div>
      }>
        <VerifyRedirect />
      </Suspense>
    </main>
  );
}
