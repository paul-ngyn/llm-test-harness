import { promises as fs } from "fs";
import path from "path";
import { Suite, Run, Comparison } from "./types";

// Simple JSON-file store. Swap for SQLite/Supabase/Postgres when you outgrow it —
// everything goes through this module, so it's a one-file change.

const DB_PATH = path.join(process.cwd(), "data", "db.json");

interface DB {
  suites: Suite[];
  runs: Run[];
  comparisons: Comparison[];
}

async function load(): Promise<DB> {
  try {
    const db = JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Partial<DB>;
    // comparisons was added after suites/runs — default it for older db.json files.
    return { suites: db.suites ?? [], runs: db.runs ?? [], comparisons: db.comparisons ?? [] };
  } catch {
    return { suites: [], runs: [], comparisons: [] };
  }
}

async function persist(db: DB): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export async function listSuites(): Promise<Suite[]> {
  return (await load()).suites;
}

export async function getSuite(id: string): Promise<Suite | undefined> {
  return (await load()).suites.find((s) => s.id === id);
}

export async function createSuite(suite: Suite): Promise<Suite> {
  const db = await load();
  db.suites.push(suite);
  await persist(db);
  return suite;
}

export async function updateSuite(suite: Suite): Promise<Suite> {
  const db = await load();
  const i = db.suites.findIndex((s) => s.id === suite.id);
  if (i === -1) throw new Error(`Suite ${suite.id} not found`);
  db.suites[i] = suite;
  await persist(db);
  return suite;
}

export async function deleteSuite(id: string): Promise<void> {
  const db = await load();
  db.suites = db.suites.filter((s) => s.id !== id);
  db.runs = db.runs.filter((r) => r.suiteId !== id);
  await persist(db);
}

export async function listRuns(suiteId?: string): Promise<Run[]> {
  const runs = (await load()).runs;
  return suiteId ? runs.filter((r) => r.suiteId === suiteId) : runs;
}

export async function getRun(id: string): Promise<Run | undefined> {
  return (await load()).runs.find((r) => r.id === id);
}

export async function saveRun(run: Run): Promise<Run> {
  const db = await load();
  const i = db.runs.findIndex((r) => r.id === run.id);
  if (i === -1) db.runs.push(run);
  else db.runs[i] = run;
  await persist(db);
  return run;
}

export async function listComparisons(): Promise<Comparison[]> {
  return (await load()).comparisons;
}

export async function getComparison(id: string): Promise<Comparison | undefined> {
  return (await load()).comparisons.find((c) => c.id === id);
}

export async function saveComparison(comparison: Comparison): Promise<Comparison> {
  const db = await load();
  db.comparisons.push(comparison);
  await persist(db);
  return comparison;
}
