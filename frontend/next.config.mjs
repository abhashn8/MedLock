/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    /**
     * Next 14: keep Supabase on the server resolver path to avoid stale/corrupt
     * vendor-chunks (e.g. "Cannot find module './vendor-chunks/@supabase.js'").
     * On Next 15+ this becomes top-level `serverExternalPackages`.
     */
    serverComponentsExternalPackages: ["@supabase/supabase-js", "@supabase/ssr"],
  },
};

export default nextConfig;
