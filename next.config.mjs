/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.nintendo.com" },
      { protocol: "https", hostname: "*.nintendo.com" },
      { protocol: "https", hostname: "images.igdb.com" },
    ],
  },
};

export default nextConfig;
