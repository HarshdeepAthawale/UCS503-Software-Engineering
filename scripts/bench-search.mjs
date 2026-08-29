// Search latency benchmark (T-39; docs/PRD NFR-P1: search p95 ≤ 300 ms).
//
// Measures the ACTUAL faceted-discovery query — GIN tsvector + websearch_to_tsquery
// + keyset — at a realistic data volume, then reports p50/p95/p99.
//
// It seeds N synthetic postings inside a SINGLE TRANSACTION and ROLLS BACK at the
// end, so it measures the FTS at scale WITHOUT ever committing mock data (honours
// D-06: no seeded/mock data in the real dataset). Run with:
//   node --env-file=.env scripts/bench-search.mjs [rows] [iterations]
import pg from "pg";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL (or DATABASE_URL) is not set.");
  process.exit(1);
}

const ROWS = Number.parseInt(process.argv[2] ?? "5000", 10);
const ITERS = Number.parseInt(process.argv[3] ?? "300", 10);

// Vocabulary sprinkled into the corpus so tsquery actually matches (exercises the
// GIN index rather than scanning an empty result).
const WORDS = [
  "machine", "learning", "research", "backend", "systems", "data", "vision",
  "robotics", "compiler", "security", "network", "cloud", "mobile", "design",
];
const DOMAINS = ["ML", "Systems", "Security", "HCI", "Robotics", "Databases"];
const TYPES = ["RESEARCH", "INTERNSHIP", "TA", "HACKATHON_TEAM", "MICRO_TASK", "REFERRAL"];
const SLA = ["H24", "H48", "WEEK"];
const COLS = 6; // bound params per seeded row

// The exact SQL shape the service issues (default "recent" sort), parameterised.
const SEARCH_SQL = `
  SELECT o.id, o.created_at
  FROM opportunities o
  WHERE o.deleted_at IS NULL
    AND o.status <> 'EXPIRED'::"OppStatus"
    AND to_tsvector('english', coalesce(o.title,'') || ' ' || coalesce(o.description,''))
        @@ websearch_to_tsquery('english', $1)
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT 21
`;

function pct(sorted, p) {
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function report(label, timings, judge) {
  const s = [...timings].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  console.log(`\n── ${label} (ms) ─────────────`);
  console.log(`  mean : ${mean.toFixed(1)}`);
  console.log(`  p50  : ${pct(s, 50).toFixed(1)}`);
  console.log(`  p95  : ${pct(s, 95).toFixed(1)}${judge ? "   (NFR-P1 target ≤ 300 ms)" : ""}`);
  console.log(`  p99  : ${pct(s, 99).toFixed(1)}`);
  if (judge) console.log(`  verdict : ${pct(s, 95) <= 300 ? "PASS ✅" : "OVER BUDGET ❌"}`);
}

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  console.log(`Seeding ${ROWS} postings in a transaction (will roll back)…`);
  await client.query("BEGIN");
  try {
    // A throwaway poster to satisfy the FK; rolled back with everything else.
    const poster = await client.query(
      `INSERT INTO users (id, email, password_hash, role, status, name, created_at, updated_at)
       VALUES (gen_random_uuid(), 'bench+' || gen_random_uuid() || '@example.test', 'x', 'FACULTY', 'ACTIVE', 'Bench Poster', now(), now())
       RETURNING id`,
    );
    const posterId = poster.rows[0].id;

    // Insert in chunks; each row contributes COLS bound params, renumbered $1.. per chunk.
    const CHUNK = 1000;
    for (let start = 0; start < ROWS; start += CHUNK) {
      const end = Math.min(ROWS, start + CHUNK);
      const rowsSql = [];
      const params = [];
      for (let i = start; i < end; i++) {
        const w1 = WORDS[i % WORDS.length];
        const w2 = WORDS[(i * 7) % WORDS.length];
        const w3 = WORDS[(i * 3) % WORDS.length];
        const b = params.length;
        params.push(
          posterId,
          TYPES[i % TYPES.length],
          `${w1} ${w2} opportunity #${i}`,
          `A ${w1} project involving ${w2} and applied ${w3} work at scale.`,
          DOMAINS[i % DOMAINS.length],
          SLA[i % SLA.length],
        );
        rowsSql.push(
          `(gen_random_uuid(), $${b + 1}, $${b + 2}::"OppType", $${b + 3}, $${b + 4}, $${b + 5}, 1, 0, ` +
            `now() + interval '30 days', $${b + 6}::"SlaPledge", 'LIVE'::"OppStatus", ` +
            `now() - (random() * interval '60 days'), now())`,
        );
      }
      await client.query(
        `INSERT INTO opportunities
           (id, poster_id, type, title, description, domain, seat_count, seats_filled, deadline, sla_pledge, status, created_at, updated_at)
         VALUES ${rowsSql.join(",")}`,
        params,
      );
    }
    console.log(`Seeded. Running ${ITERS} searches…`);

    // Warm up (plan cache, buffers) so we measure steady-state latency.
    for (let i = 0; i < 20; i++) {
      await client.query(SEARCH_SQL, [WORDS[i % WORDS.length]]);
    }

    const wall = []; // round-trip wall-clock from THIS machine (includes network RTT)
    const exec = []; // Postgres "Execution Time" (server-side only, no RTT)
    for (let i = 0; i < ITERS; i++) {
      const term =
        i % 3 === 0
          ? `${WORDS[i % WORDS.length]} ${WORDS[(i * 5) % WORDS.length]}`
          : WORDS[i % WORDS.length];

      const t0 = process.hrtime.bigint();
      await client.query(SEARCH_SQL, [term]);
      const t1 = process.hrtime.bigint();
      wall.push(Number(t1 - t0) / 1e6);

      // Server-side execution time via EXPLAIN ANALYZE — excludes client↔DB RTT,
      // which is what NFR-P1 (a deployment-local budget) actually governs.
      const plan = await client.query(
        `EXPLAIN (ANALYZE, FORMAT JSON, TIMING TRUE) ${SEARCH_SQL}`,
        [term],
      );
      exec.push(plan.rows[0]["QUERY PLAN"][0]["Execution Time"]);
    }

    report("wall-clock (this machine → Supabase, incl. network RTT)", wall, false);
    report("server execution time (Postgres, RTT excluded)", exec, true);
    console.log(
      "\nNFR-P1 governs the deployment-local query time (Vercel + Supabase co-located),\n" +
        "which the server-execution figure approximates. The wall-clock gap is this\n" +
        "dev machine's RTT to a remote Supabase region and is not representative.",
    );
  } finally {
    await client.query("ROLLBACK");
    console.log("\nRolled back — no mock data was committed.");
    await client.end();
  }
}

main().catch((e) => {
  console.error("Benchmark failed:", e.message);
  process.exit(1);
});
