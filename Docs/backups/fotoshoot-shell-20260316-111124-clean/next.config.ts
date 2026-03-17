import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  devIndicators: false,
  experimental: {
    devtoolSegmentExplorer: false,
  },
  async rewrites() {
    return [
      { source: "/landing", destination: "/darkroomx-common/index.html" },
      { source: "/pricing", destination: "/darkroomx-common/pricing.html" },
      { source: "/faqs", destination: "/darkroomx-common/faqs.html" },
      { source: "/help", destination: "/darkroomx-common/help.html" },
      { source: "/contact", destination: "/darkroomx-common/contact.html" },
      { source: "/privacy", destination: "/darkroomx-common/privacy.html" },
      { source: "/terms", destination: "/darkroomx-common/terms.html" },
      { source: "/signup", destination: "/darkroomx-common/signup.html" },
    ];
  },
};

export default nextConfig;
