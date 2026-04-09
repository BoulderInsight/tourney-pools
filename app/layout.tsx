import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#006747" />
        <title>Masters Pool</title>
      </head>
      <body className="relative z-10">
        <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
