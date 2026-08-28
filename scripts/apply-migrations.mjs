// Pure-JS migration runner (no native Prisma schema engine — required on
// Windows-on-ARM64). Applies each prisma/migrations/*/migration.sql in order
// against DIRECT_URL, tracking applied migrations so it is idempotent.
//
// Run with:  node --env-file=.env scripts/apply-migrations.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "prisma", "migrations");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DATABASE_URL) is not set. Run with: node --env-file=.env scripts/apply-migrations.mjs");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_app_migrations" (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await client.query(`SELECT name FROM "_app_migrations"`)).rows.map((r) => r.name),
  );

  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let ran = 0;
  for (const name of dirs) {
    const file = join(migrationsDir, name, "migration.sql");
    if (!existsSync(file)) continue;
    if (applied.has(name)) {
      console.log(`✓ ${name} (already applied)`);
      continue;
    }
    const sql = readFileSync(file, "utf8");
    process.stdout.write(`→ applying ${name} … `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO "_app_migrations"(name) VALUES ($1)`, [name]);
      await client.query("COMMIT");
      console.log("done");
      ran++;
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`\n✗ ${name} failed:\n`, e.message);
      throw e;
    }
  }
  console.log(`\nMigrations complete. ${ran} applied, ${dirs.length - ran} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
