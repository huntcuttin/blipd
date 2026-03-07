/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.nintendo.com" },
      { protocol: "https", hostname: "*.nintendo.com" },
    ],
  },
};

export default nextConfig;
