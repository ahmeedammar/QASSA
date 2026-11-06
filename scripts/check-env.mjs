#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  }
  return env;
}

const envLocal = loadEnvFile(path.resolve(".env.local"));
const combined = { ...process.env, ...envLocal };

console.log("================================================================================");
console.log("                   QASSA PRODUCTION ENVIRONMENT VERIFICATION                    ");
console.log("================================================================================");

const isDeployedProduction =
  combined.VERCEL_ENV === "production" || combined.NODE_ENV === "production";

const checks = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    validate: (v) => v && v.startsWith("https://") && v.includes(".supabase.co"),
    msg: "Must be a valid HTTPS Supabase project URL",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    validate: (v) => typeof v === "string" && v.length > 20,
    msg: "Must be a non-empty Supabase anon/publishable key",
  },
  {
    key: "NEXT_PUBLIC_SITE_URL",
    required: true,
    validate: (v) => {
      if (typeof v !== "string" || !/^https?:\/\//.test(v)) return false;
      if (!isDeployedProduction) return true;
      return !/(localhost|127\.0\.0\.1|\[::1\])/.test(v);
    },
    msg: isDeployedProduction
      ? "Must be the canonical public origin; a loopback value makes Supabase email links point at localhost"
      : "Must be a valid canonical site origin",
  },
  {
    key: "UPSTASH_REDIS_REST_URL",
    required: false,
    validate: (v) => !v || v.startsWith("https://"),
    msg: "Required for distributed rate limiting across serverless instances in production",
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    required: false,
    validate: (v) => !v || v.length > 10,
    msg: "Required with UPSTASH_REDIS_REST_URL",
  },
];

let failed = false;
let warnings = 0;

for (const c of checks) {
  const val = combined[c.key];
  if (!val) {
    if (c.required) {
      console.log(`❌ [MISSING REQUIRED] ${c.key}: ${c.msg}`);
      failed = true;
    } else {
      console.log(`⚠️  [OPTIONAL/RECOMMENDED] ${c.key}: ${c.msg}`);
      warnings++;
    }
  } else if (!c.validate(val)) {
    console.log(`❌ [INVALID] ${c.key}: ${c.msg} (got: ${val})`);
    failed = true;
  } else {
    const masked = val.length > 15 ? `${val.slice(0, 6)}...${val.slice(-4)}` : "***";
    console.log(`✅ [OK] ${c.key} (${masked})`);
  }
}

console.log("--------------------------------------------------------------------------------");
if (failed) {
  console.log("❌ Production environment check FAILED. Fix missing/invalid variables above.");
  process.exit(1);
} else if (warnings > 0) {
  console.log(`⚠️  Production environment check PASSED with ${warnings} recommendation(s).`);
} else {
  console.log("✅ All production environment checks PASSED cleanly.");
}
console.log("================================================================================");
