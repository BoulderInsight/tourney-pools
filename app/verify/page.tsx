"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No verification token provided.");
      return;
    }

    async function verify() {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        const data = await res.json();
        setStatus("error");
        setError(data.error || "Verification failed");
      }
    }

    verify();
  }, [token, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center">
      <Image src="/MyMastersPoolstacked.png" alt="My Masters Pool" width={180} height={130} className="mb-6" />

      {status === "verifying" && (
        <>
          <div className="flex gap-3 mb-6">
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
          <p className="font-serif italic text-masters-green/60 text-sm">Verifying your email...</p>
        </>
      )}

      {status === "success" && (
        <div className="card p-8">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-masters-green font-bold mb-2">Email Verified!</h1>
          <p className="text-sm text-gray-500 mb-6">Your account is active. Redirecting to your dashboard...</p>
          <Link href="/dashboard" className="btn-green inline-block">Go to Dashboard</Link>
        </div>
      )}

      {status === "error" && (
        <div className="card p-8">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-masters-green font-bold mb-2">Verification Failed</h1>
          <p className="text-sm text-red-500 mb-6">{error}</p>
          <Link href="/signup" className="btn-outline inline-block">Try Again</Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[75vh]">
        <div className="flex gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
