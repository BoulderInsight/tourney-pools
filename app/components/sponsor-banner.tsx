"use client";

import Image from "next/image";

export function BoulderInsightAd() {
  return (
    <a
      href="https://boulderinsight.com?utm_source=tourneypools&utm_medium=banner"
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden my-4"
    >
      <div className="bg-gray-900 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <Image
            src="/BIG_logo_dark_600x100_hex.png"
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
          <span className="text-[10px] text-tp-accent font-semibold">Learn More →</span>
        </div>
      </div>
    </a>
  );
}

export function CustomAd({ imageUrl, linkUrl, headline, description }: {
  imageUrl?: string | null;
  linkUrl?: string | null;
  headline?: string | null;
  description?: string | null;
}) {
  const hasText = headline || description;
  const hasImage = imageUrl;

  const content = (
    <div className="rounded-xl overflow-hidden my-4 bg-white border border-tp-bg-dark">
      {hasImage && (
        <div className="flex justify-center p-3 pb-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl!} alt="Sponsor" className="max-w-full h-auto max-h-24 object-contain" />
        </div>
      )}
      {hasText && (
        <div className="px-4 py-3">
          {headline && <p className="text-sm font-medium text-gray-800 leading-snug">{headline}</p>}
          {description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>}
        </div>
      )}
      {!hasImage && !hasText && (
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-gray-400 italic">Custom ad</p>
        </div>
      )}
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
  adRemoved,
  customAdImage,
  customAdUrl,
  customAdHeadline,
  customAdDescription,
}: {
  tier: string;
  adRemoved?: boolean;
  customAdImage?: string | null;
  customAdUrl?: string | null;
  customAdHeadline?: string | null;
  customAdDescription?: string | null;
}) {
  const isPro = tier === "pro" || tier === "paid";

  // Pro user chose to remove ad entirely
  if (isPro && adRemoved) {
    return null;
  }

  // Pro user with custom ad
  if (isPro && (customAdImage || customAdHeadline)) {
    return <CustomAd imageUrl={customAdImage} linkUrl={customAdUrl} headline={customAdHeadline} description={customAdDescription} />;
  }

  // Everyone else: Boulder Insight ad
  return <BoulderInsightAd />;
}
