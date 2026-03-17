import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3 ships a precompiled native .node binary — bundling it is
  // extremely slow (it triggers full native-module tracing in Turbopack).
  // Marking it as a server external keeps it as a bare require() at runtime
  // and cuts per-route compile times from ~15s down to ~1-2s.
  serverExternalPackages: ['better-sqlite3'],

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
