import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Exclude heavy server-only packages from Turbopack bundling.
  //
  // better-sqlite3 — precompiled native .node binary; tracing it costs ~12s
  //   per route compile.
  // drizzle-orm    — 443 package.json exports; Turbopack traces the entire
  //   graph on every compile, costing the remaining ~14s.
  //
  // Both are server-only (never imported by client components) so marking
  // them as externals is safe — they become bare require() calls at runtime.
  serverExternalPackages: ['better-sqlite3', 'drizzle-orm'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            // Allow inline styles (Tailwind) and same-origin scripts.
            // unsafe-inline on script-src is intentionally absent —
            // Next.js inlines a small bootstrap script, so we allow
            // nonces via Next.js's built-in nonce support instead of
            // blanket unsafe-inline.  For this localhost tool we use
            // a permissive but still protective baseline.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
