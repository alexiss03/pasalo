import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const assignEnvFromFile = (filePath: string) => {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const configDir = dirname(fileURLToPath(import.meta.url));
const apiEnvPath = resolve(configDir, "../../.env");
const rootEnvPath = resolve(configDir, "../../../../.env");

// Prefer apps/api/.env values; only fall back to root .env for missing keys.
assignEnvFromFile(apiEnvPath);
assignEnvFromFile(rootEnvPath);

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().default("*"),
  PAYMONGO_API_BASE_URL: z.string().url().default("https://api.paymongo.com/v1"),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3001"),
  PAYMONGO_PAYMENT_METHOD_TYPES: z.string().default("gcash,paymaya,card,grab_pay"),
  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@pasalo.local"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default("Admin12345!"),
  ENABLE_DEFAULT_ADMIN: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return true;
      }
      return value.toLowerCase() === "true";
    }),
});

export const env = envSchema.parse(process.env);
