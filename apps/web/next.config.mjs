import withPWA from "@ducanh2912/next-pwa";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@coach/lib"],
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: { disableDevLogs: true },
})(nextConfig);
