import type { NextConfig } from 'next';
// GitHub Actions supplies the Pages mount path, including an empty path for a
// user/organization site or custom domain. Local development defaults to '/'.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
const config: NextConfig = { output: 'export', basePath, trailingSlash: true, images: { unoptimized: true }, poweredByHeader: false };
export default config;
