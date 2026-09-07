import type { NextConfig } from "next";

import { parseAllowedDevOrigins } from "./src/lib/dev/parse-allowed-dev-origins";

const allowedDevOrigins = parseAllowedDevOrigins(
  process.env.ALLOWED_DEV_ORIGINS,
);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  // Native binaries must not be bundled by Turbopack/webpack.
  serverExternalPackages: ["@napi-rs/canvas", "ffmpeg-static"],
};

export default nextConfig;
