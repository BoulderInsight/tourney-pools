/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    // Environment-controlled CSP enforcement mode
    const cspHeaderName = process.env.CSP_ENFORCE === "1"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";

    // Base CSP policy with tourney-pools specific additions
    const cspValue = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com", // Stripe for checkout
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com", // Cloudinary for golf images
      "font-src 'self'",
      "connect-src 'self' https://api.stripe.com", // Stripe API calls
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com", // Stripe Checkout redirects
      "frame-src https://js.stripe.com https://hooks.stripe.com", // Stripe embedded elements
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: cspHeaderName,
            value: cspValue,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
