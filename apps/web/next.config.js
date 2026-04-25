/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kheloge/shared'],
  images: {
    domains: ['pub-*.r2.dev', 'storage.googleapis.com'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
};

module.exports = nextConfig;
