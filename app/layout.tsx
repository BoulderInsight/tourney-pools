import "./globals.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masters Pool 2026",
  description: "Create a golf pool, draft golfers with friends, and track live scores through Masters tournament week.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Masters Pool 2026",
    description: "Create a golf pool, draft golfers with friends, and track live scores through Masters tournament week.",
    images: [{ url: "/OGImage.jpeg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Masters Pool 2026",
    description: "Create a golf pool, draft golfers with friends, and track live scores through Masters tournament week.",
    images: ["/OGImage.jpeg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#006747" />
      </head>
      <body className="relative z-10">
        <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
