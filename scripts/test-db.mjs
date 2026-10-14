// Applies the migration and seed to a scratch Postgres database and runs supabase/tests/db_test.sql.
// Needs psql and DATABASE_URL pointing at a database you can drop/create (NOT production).
import { execFileSync } from "node:child_process";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to a scratch Postgres database");
  process.exit(1);
}
const psql = (...args) => execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", ...args], { stdio: "inherit" });
psql("-c", "drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists storage cascade; create schema public;");
psql("-f", "supabase/tests/supabase-stub.sql", "-f", "supabase/migrations/20261014000000_init.sql", "-f", "supabase/seed.sql", "-f", "supabase/tests/db_test.sql");
