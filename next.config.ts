import type { NextConfig } from "next";

import { parseAllowedDevOrigins } from "./src/lib/dev/parse-allowed-dev-origins";

const allowedDevOrigins = parseAllowedDevOrigins(
  process.env.ALLOWED_DEV_ORIGINS,
);

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  // Native binaries must not be bundled by Turbopack/webpack.
  serverExternalPackages: ["@napi-rs/canvas", "ffmpeg-static"],
  // Minimal self-contained server bundle for the Docker image.
  output: "standalone",
  // Type-check app code only - tests are checked by vitest, and stale test
  // typings must not block a production build.
  typescript: { tsconfigPath: "tsconfig.typecheck.json" },
};

export default nextConfig;
