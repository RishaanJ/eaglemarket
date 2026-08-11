import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

// Foreign origins the app is allowed to reach. Keep these named so it is
// obvious what each exception buys, and so nothing gets removed by accident.
const turnstileOrigin = "https://challenges.cloudflare.com";
// Tally hosts the student market-request form, embedded as an iframe.
const tallyOrigin = "https://tally.so";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} ${turnstileOrigin}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // wss:// is load-bearing, not decoration: Supabase realtime rides a
  // websocket. Live price sync and market-freeze notifications both go dark
  // if this is narrowed to https:// alone, and they fail silently.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Turnstile renders its challenge in an iframe; Tally hosts the embedded
  // market-request form. Note that only the *iframe* is allowed — the Tally
  // auto-resize widget script is deliberately not in script-src, so the embed
  // must be a plain fixed-height iframe rather than the scripted variant.
  `frame-src ${turnstileOrigin} ${tallyOrigin}`,
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "script-src-attr 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Origin-Agent-Cluster", value: "?1" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
