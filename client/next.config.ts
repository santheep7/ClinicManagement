import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix Next.js/Turbopack workspace root inference when repo contains multiple lockfiles
  turbopack: {
    root: 'c:/Hospital',
  },
};


export default nextConfig;
