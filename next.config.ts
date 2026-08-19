import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.24.159"],
  ...(isStaticExport && {
    output: "export",
    basePath: "/Invoice-checker",
    assetPrefix: "/Invoice-checker",
    trailingSlash: true,
  }),
};

export default nextConfig;
