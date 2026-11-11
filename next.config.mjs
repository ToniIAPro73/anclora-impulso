/**
 * Same-origin proxy to the Express API (TASK-002, option A).
 * Active only when API_PROXY_TARGET (server-side origin, e.g. https://<service>.onrender.com) is set.
 * Local Next route handlers under /api/logs and /api/csp-report are excluded and keep running in Next.
 */
function apiProxyRewrites() {
  const target = (process.env.API_PROXY_TARGET || '').replace(/\/+$/, '');
  if (!target) return { beforeFiles: [] };
  if (!/^https?:\/\/[^/]+$/.test(target)) {
    throw new Error('API_PROXY_TARGET must be an origin (scheme and host only), without path');
  }
  return {
    beforeFiles: [
      {
        source: '/api/:path((?!logs(?:/|$)|csp-report(?:/|$)).*)',
        destination: `${target}/api/:path*`,
      },
    ],
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return apiProxyRewrites();
  },
  experimental: {
    cpus: 1,
    webpackBuildWorker: false,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false
    }

    return config
  },
}

export default nextConfig
