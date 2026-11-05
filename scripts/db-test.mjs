#!/usr/bin/env node
// Database-backed tests against a DISPOSABLE local PostgreSQL server.
// Recreates one scratch database, applies a Supabase shim plus every
// migration, then runs the SQL suites and two-session race tests.
//
// It never reads .env files and refuses any non-loopback host, so it cannot
// reach a Supabase project. See README "Database tests".

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.QASSA_TEST_PG_HOST ?? "localhost";
const port = process.env.QASSA_TEST_PG_PORT ?? "54329";
const user = process.env.QASSA_TEST_PG_USER ?? "postgres";
const database = "qassa_scratch_test";

if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to run: ${host} is not a loopback host.`);
  process.exit(2);
}

function findPsql() {
  if (process.env.QASSA_TEST_PSQL) return process.env.QASSA_TEST_PSQL;
  if (spawnSync("psql", ["--version"]).status === 0) return "psql";
  const winRoot = "C:\\Program Files\\PostgreSQL";
  if (process.platform === "win32" && existsSync(winRoot)) {
    const versions = readdirSync(winRoot)
      .filter((v) => /^\d+$/.test(v))
      .sort((a, b) => Number(b) - Number(a));
    for (const v of versions) {
      const candidate = path.join(winRoot, v, "bin", "psql.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  console.error("psql not found. Set QASSA_TEST_PSQL to its path.");
  process.exit(2);
}

const psql = findPsql();
const baseArgs = ["-X", "-q", "-h", host, "-p", port, "-U", user, "-v", "ON_ERROR_STOP=1"];
const env = { ...process.env, PGCONNECT_TIMEOUT: "5" };
const passed = [];

function collectOk(stderr) {
  for (const line of stderr.split(/\r?\n/)) {
    const match = line.match(/NOTICE:\s+(ok - .*)$/);
    if (match) passed.push(match[1]);
  }
}

function run(args, { db = database, appName } = {}) {
  const result = spawnSync(psql, [...baseArgs, "-d", db, ...args], {
    encoding: "utf8",
    env: appName ? { ...env, PGAPPNAME: appName } : env,
  });
  if (result.error) throw result.error;
  collectOk(result.stderr);
  if (result.status !== 0) {
    throw new Error(`psql ${args.join(" ")} failed:\n${result.stderr}${result.stdout}`);
  }
  return result.stdout.trim();
}

function runAsync(sql, appName) {
  return new Promise((resolve, reject) => {
    const child = spawn(psql, [...baseArgs, "-d", database, "-c", sql], {
      env: { ...env, PGAPPNAME: appName },
    });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      collectOk(stderr);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${appName} failed:\n${stderr}${stdout}`));
    });
  });
}

const query = (sql) => run(["-At", "-c", sql]);

async function waitFor(sql, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (query(sql) === "t") return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

const ids = {
  shopA: "10000000-0000-4000-a000-000000000001",
  serviceA: "20000000-0000-4000-a000-000000000001",
  barberA1: "30000000-0000-4000-a000-000000000001",
  customer1: "00000000-0000-4000-a000-000000000011",
  customer2: "00000000-0000-4000-a000-000000000012",
};
const slot = (hhmm) =>
  `(((now() at time zone 'Africa/Tunis')::date + 7 + time '${hhmm}') at time zone 'Africa/Tunis')`;
const actAs = (userId) =>
  `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`;
const bookSql = (hhmm, key) =>
  `select public.book_appointment('${ids.shopA}', '${ids.barberA1}', '${ids.serviceA}', ${slot(hhmm)}, '${key}')`;

// Session A books and holds its transaction open; session B must block on A's
// row lock, then see the committed result.
async function race({ label, first, second, expectSecond }) {
  const holder = runAsync(
    `${actAs(first.user)} begin; ${bookSql(first.time, first.key)}; select pg_sleep(30); commit;`,
    "qassa_race_a",
  );
  await waitFor(
    "select exists (select 1 from pg_stat_activity where application_name = 'qassa_race_a' and wait_event = 'PgSleep')",
    `${label}: session A holding its booking`,
  );

  const contenderSql =
    expectSecond === "same_id"
      ? `${actAs(second.user)} ${bookSql(second.time, second.key)}`
      : `${actAs(second.user)} select qassa_test.throws($q$${bookSql(second.time, second.key)}$q$, '${expectSecond}', '${label}');`;
  const contender = runAsync(contenderSql, "qassa_race_b");
  await waitFor(
    "select exists (select 1 from pg_stat_activity where application_name = 'qassa_race_b' and wait_event_type = 'Lock')",
    `${label}: session B blocked on A's lock`,
  );
  passed.push(`ok - ${label}: second session blocked on the first session's lock`);

  query("select pg_cancel_backend(pid) from pg_stat_activity where application_name = 'qassa_race_a' and wait_event = 'PgSleep'");
  // Cancelling pg_sleep aborts A's transaction; rerun A's commit path instead.
  await holder.then(
    () => {
      throw new Error(`${label}: session A should have been interrupted`);
    },
    () => undefined,
  );
  return contender;
}

async function main() {
  console.log(`psql: ${psql}`);
  console.log(`server: ${host}:${port} database: ${database} (recreated)`);
  run(["-c", `drop database if exists ${database} with (force)`, "-c", `create database ${database}`], {
    db: "postgres",
  });

  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  run(["-1", "-f", path.join(root, "supabase", "tests", "supabase_shim.sql")]);
  for (const file of migrations) {
    run(["-1", "-f", path.join(migrationsDir, file)]);
    passed.push(`ok - migration ${file} applies on a fresh database`);
  }
  run(["-1", "-f", path.join(root, "supabase", "tests", "helpers.sql")]);

  run([
    "-f", path.join(root, "supabase", "tests", "fixtures.sql"),
    "-f", path.join(root, "supabase", "tests", "booking.test.sql"),
    "-f", path.join(root, "supabase", "tests", "control.test.sql"),
    "-f", path.join(root, "supabase", "tests", "security.test.sql"),
  ]);

  await runRaces();

  console.log(passed.map((p) => `  ${p}`).join("\n"));
  console.log(`\n${passed.length} database checks passed.`);
}

async function runRaces() {
  const key = () => crypto.randomUUID();

  // A commits while B waits: B must fail on the exclusion constraint.
  await raceCommitted({
    label: "concurrent booking of the same slot is rejected by the exclusion constraint",
    first: { user: ids.customer1, time: "15:00", key: key() },
    second: { user: ids.customer2, time: "15:00", key: key() },
    expectSecond: "23P01",
  });
  await raceCommitted({
    label: "concurrent overlapping booking is rejected by the exclusion constraint",
    first: { user: ids.customer1, time: "16:00", key: key() },
    second: { user: ids.customer2, time: "16:15", key: key() },
    expectSecond: "23P01",
  });

  const sharedKey = key();
  const [firstId, secondId] = await raceCommitted({
    label: "concurrent double-submit with one idempotency key",
    first: { user: ids.customer1, time: "17:00", key: sharedKey },
    second: { user: ids.customer1, time: "17:00", key: sharedKey },
    expectSecond: "same_id",
  });
  if (!firstId || firstId !== secondId) {
    throw new Error(`double-submit returned different ids: ${firstId} vs ${secondId}`);
  }
  passed.push("ok - concurrent double-submit returns the same appointment id");

  const counts = query(`
    select string_agg(n::text, ',' order by t) from (
      select t, count(*) n from (values ('15:00'), ('16:00'), ('17:00')) as s(t)
      left join public.appointments a
        on a.status = 'confirmed'
        and tstzrange(a.starts_at, a.occupied_until, '[)')
          && tstzrange(((now() at time zone 'Africa/Tunis')::date + 7 + s.t::time) at time zone 'Africa/Tunis',
                       ((now() at time zone 'Africa/Tunis')::date + 7 + s.t::time + interval '40 minutes') at time zone 'Africa/Tunis', '[)')
      group by t) x`);
  if (counts !== "1,1,1") throw new Error(`expected one booking per raced slot, got ${counts}`);
  passed.push("ok - exactly one confirmed appointment exists for each raced slot");
}

// Like race(), but session A commits after B is observed waiting, so B sees a
// committed competitor rather than an aborted one.
async function raceCommitted({ label, first, second, expectSecond }) {
  const firstSql =
    `${actAs(first.user)} begin; ${bookSql(first.time, first.key)}; ` +
    `select pg_advisory_lock(424242); commit;`;
  query("select pg_advisory_lock(424242)");
  // The superuser session above ends immediately, so hold the gate in a session we control.
  const gate = spawn(psql, [...baseArgs, "-d", database], {
    env: { ...env, PGAPPNAME: "qassa_race_gate" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  gate.stdin.write("select pg_advisory_lock(424242);\n");
  await waitFor(
    "select exists (select 1 from pg_locks l join pg_stat_activity s using (pid) where s.application_name = 'qassa_race_gate' and l.locktype = 'advisory' and l.granted)",
    `${label}: gate lock held`,
  );

  const holder = runAsync(firstSql, "qassa_race_a");
  await waitFor(
    "select exists (select 1 from pg_stat_activity where application_name = 'qassa_race_a' and wait_event_type = 'Lock' and wait_event = 'advisory')",
    `${label}: session A booked and waiting at the gate`,
  );

  const contenderSql =
    expectSecond === "same_id"
      ? `${actAs(second.user)} ${bookSql(second.time, second.key)}`
      : `${actAs(second.user)} select qassa_test.throws($q$${bookSql(second.time, second.key)}$q$, '${expectSecond}', '${label}');`;
  const contender = runAsync(contenderSql, "qassa_race_b");
  await waitFor(
    "select exists (select 1 from pg_stat_activity where application_name = 'qassa_race_b' and wait_event_type = 'Lock' and wait_event = 'transactionid')",
    `${label}: session B blocked on session A's uncommitted booking`,
  );
  passed.push(`ok - ${label}: second session blocked until the first committed`);

  gate.stdin.end("select pg_advisory_unlock(424242);\n\\q\n");
  const [firstOut, secondOut] = await Promise.all([holder, contender]);
  const lastUuid = (out) => out.match(/[0-9a-f-]{36}/g)?.at(0) ?? null;
  return [lastUuid(firstOut), lastUuid(secondOut)];
}

main().catch((error) => {
  console.error(error.message ?? error);
  console.log(passed.map((p) => `  ${p}`).join("\n"));
  console.error(`\nFAILED after ${passed.length} passing checks.`);
  process.exit(1);
});
