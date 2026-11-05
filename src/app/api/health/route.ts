import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  checks: {
    database: {
      status: "ok" | "error";
      latencyMs?: number;
      message?: string;
    };
    redis: {
      status: "ok" | "not_configured" | "error";
      latencyMs?: number;
      message?: string;
    };
  };
}

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const start = Date.now();
  const uptimeSeconds = Math.floor(process.uptime());
  const environment = process.env.NODE_ENV ?? "development";

  // Check 1: Database connectivity via Supabase
  let dbStatus: "ok" | "error" = "ok";
  let dbLatencyMs: number | undefined;
  let dbMessage: string | undefined;

  try {
    const dbStart = Date.now();
    const supabase = await createClient();
    const { error } = await supabase
      .from("public_barbershops")
      .select("id")
      .limit(1);

    dbLatencyMs = Date.now() - dbStart;
    if (error) {
      dbStatus = "error";
      dbMessage = error.message;
    }
  } catch (err) {
    dbStatus = "error";
    dbMessage = err instanceof Error ? err.message : "Database connection failed";
  }

  // Check 2: Redis rate limiter connectivity
  let redisStatus: "ok" | "not_configured" | "error" = "not_configured";
  let redisLatencyMs: number | undefined;
  let redisMessage: string | undefined;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const redisStart = Date.now();
      const res = await fetch(`${redisUrl}/ping`, {
        headers: { Authorization: `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(3000),
      });
      redisLatencyMs = Date.now() - redisStart;
      if (res.ok) {
        redisStatus = "ok";
      } else {
        redisStatus = "error";
        redisMessage = `Redis responded with HTTP ${res.status}`;
      }
    } catch (err) {
      redisStatus = "error";
      redisMessage = err instanceof Error ? err.message : "Redis connection failed";
    }
  }

  // Determine overall status
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (dbStatus === "error") {
    overallStatus = "unhealthy";
  } else if (redisStatus === "error" || (environment === "production" && redisStatus === "not_configured")) {
    overallStatus = "degraded";
  }

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      environment,
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          message: dbMessage,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
          message: redisMessage,
        },
      },
    },
    { status: statusCode },
  );
}
