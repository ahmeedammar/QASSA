import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("NEXT_PUBLIC_SITE_URL must be a valid URL")
    .default("http://localhost:3000"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional(),
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url("UPSTASH_REDIS_REST_URL must be a valid URL")
    .optional()
    .or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .optional()
    .or(z.literal("")),
});

export type EnvConfig = z.infer<typeof envSchema>;

export interface EnvValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  warnings: string[];
}

/**
 * Validates the runtime environment against required variables.
 * In production mode, flags missing Redis credentials as a security warning
 * because rate limiting falls back to a permissive no-op without Upstash.
 */
export function validateEnv(
  source: Record<string, string | undefined> = process.env,
): EnvValidationResult {
  const result = envSchema.safeParse(source);
  const warnings: string[] = [];
  const errors: Record<string, string[]> = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      errors[key] = errors[key] || [];
      errors[key].push(issue.message);
    }
  }

  const isProd = (source.NODE_ENV ?? process.env.NODE_ENV) === "production";

  if (isProd) {
    if (!source.UPSTASH_REDIS_REST_URL || !source.UPSTASH_REDIS_REST_TOKEN) {
      warnings.push(
        "UPSTASH_REDIS_* credentials are not configured. Rate limiting is running in permissive no-op mode in production.",
      );
    }
    if (!source.NEXT_PUBLIC_SITE_URL || source.NEXT_PUBLIC_SITE_URL.includes("localhost")) {
      warnings.push(
        "NEXT_PUBLIC_SITE_URL points to localhost in a production environment.",
      );
    }
  }

  return {
    valid: result.success,
    errors,
    warnings,
  };
}

/**
 * Validates environment variables or throws an informative error at startup.
 */
export function requireEnv(): EnvConfig {
  const { valid, errors, warnings } = validateEnv();
  
  for (const warning of warnings) {
    console.warn(`[ENV WARNING] ${warning}`);
  }

  if (!valid) {
    const errorDetails = Object.entries(errors)
      .map(([key, msgs]) => `  - ${key}: ${msgs.join(", ")}`)
      .join("\n");
    throw new Error(
      `[CRITICAL] Invalid environment configuration:\n${errorDetails}`,
    );
  }

  return envSchema.parse(process.env);
}
