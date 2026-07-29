import type { NextConfig } from 'next';

/**
 * Security headers.
 *
 * Audit §6: the PRD (§13) requires CSP, and none of these headers were set.
 * `unsafe-inline` is needed for the pre-paint theme script and Next's inlined
 * styles; everything else is locked to same-origin.
 */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // Transformers.js loads a native ONNX runtime and downloads model weights at
  // runtime. Bundling it breaks both, so it stays external to the server build.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],

  /*
   * onnxruntime-node ships prebuilt binaries for every platform: linux 53 MB,
   * win32 124 MB, darwin 35 MB. File tracing would copy all 211 MB into every
   * serverless function, and Vercel caps a function at 250 MB uncompressed —
   * so the deploy fails on size even though only the Linux binary is ever used.
   *
   * Excluding the two irrelevant platforms drops the runtime to ~53 MB. Local
   * development is unaffected: this only shapes the traced production bundle,
   * not node_modules on your machine.
   */
  outputFileTracingExcludes: {
    '/*': [
      'node_modules/onnxruntime-node/bin/napi-v6/win32/**',
      'node_modules/onnxruntime-node/bin/napi-v6/darwin/**',
      // Test-only; never reachable at runtime but large if traced.
      'node_modules/playwright/**',
      'node_modules/@img/**',
    ],
  },

  /*
   * File tracing follows static imports, but onnxruntime-node loads its native
   * `.node` binary through a computed require that the tracer cannot see. Left
   * alone, the runtime is deployed without its engine, the model fails to load,
   * and scoring silently degrades to lexical — the failure is invisible because
   * the fallback is deliberate.
   *
   * Scoped to the one route that runs the model, so the other functions are not
   * each carrying 53 MB they never execute.
   */
  outputFileTracingIncludes: {
    '/api/news/check': ['node_modules/onnxruntime-node/bin/napi-v6/linux/**'],
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
