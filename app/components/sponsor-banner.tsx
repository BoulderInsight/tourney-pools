"use client";

import Image from "next/image";

export function BoulderInsightAd() {
  return (
    <a
      href="https://boulderinsight.com?utm_source=masterspool&utm_medium=banner"
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden my-4"
    >
      <div className="bg-gray-900 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <Image
            src="/BIG_logo_white_600x100_hex.png"
            alt="Boulder Insight"
            width={150}
            height={25}
            className="opacity-90"
          />
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Sponsor</span>
        </div>
        <p className="text-white/90 text-sm font-medium leading-snug">
          Are you getting the most out of AI?
        </p>
        <p className="text-white/60 text-xs mt-1 leading-relaxed">
          Stop wondering and start scaling. AI | Automation | Analytics
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-white/40">info@boulderinsight.com</span>
          <span className="text-[10px] text-masters-gold font-semibold">Learn More →</span>
        </div>
      </div>
    </a>
  );
}

export function CustomAd({ imageUrl, linkUrl }: { imageUrl: string; linkUrl?: string }) {
  const content = (
    <div className="rounded-xl overflow-hidden my-4">
      <Image src={imageUrl} alt="Sponsor" width={600} height={100} className="w-full h-auto" />
    </div>
  );

  if (linkUrl) {
    return (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}

export function SponsorBanner({
  tier,
  customAdImage,
  customAdUrl,
}: {
  tier: string;
  customAdImage?: string | null;
  customAdUrl?: string | null;
}) {
  // Paid users with custom ad
  if (tier === "paid" && customAdImage) {
    return <CustomAd imageUrl={customAdImage} linkUrl={customAdUrl || undefined} />;
  }

  // Paid users without custom ad — no ad shown
  if (tier === "paid") {
    return null;
  }

  // Free users — Boulder Insight ad
  return <BoulderInsightAd />;
}
