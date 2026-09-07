import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadLocalEnv(projectRoot = process.cwd()) {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(projectRoot, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function isEnvValueConfigured(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}
