import "./globals.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://tourneypools.com"),
  title: "TourneyPools | Golf Pools for Every Tournament",
  description: "Create a golf pool, draft golfers with friends, and track live scores through tournament week. Works for The Masters, PGA Championship, U.S. Open, and any event.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "TourneyPools | Golf Pools for Every Tournament",
    description: "Create a golf pool, draft golfers with friends, and track live scores through tournament week.",
    images: [{ url: "/OGImage.jpeg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TourneyPools | Golf Pools for Every Tournament",
    description: "Create a golf pool, draft golfers with friends, and track live scores through tournament week.",
    images: ["/OGImage.jpeg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1a365d" />
      </head>
      <body className="relative z-10">
        {children}
      </body>
    </html>
  );
}
