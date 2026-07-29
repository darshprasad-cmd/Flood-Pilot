import { MemoryStore } from "./memory-store";
import { PostgisStore } from "./postgis-store";
import type { FloodPilotStore } from "./types";

/**
 * Store singleton.
 *
 * Held on `globalThis` so it survives hot reloads in development and is shared
 * across requests handled by the same serverless instance.
 *
 * To move to a real database, implement `FloodPilotStore` and return it here
 * behind an env check — for example `process.env.DATABASE_URL ? new PostgresStore(...)
 * : new MemoryStore()`. Nothing else in the codebase changes.
 */
const globalRef = globalThis as typeof globalThis & {
  __floodpilotStore?: FloodPilotStore;
  __floodpilotSeeded?: boolean;
};

export function getStore(): FloodPilotStore {
  if (!globalRef.__floodpilotStore) {
    const url = process.env.DATABASE_URL?.trim();
    // Constructing PostgisStore is cheap — it defers loading the `pg` driver
    // until its first query, so importing it here costs nothing when unused.
    globalRef.__floodpilotStore = url
      ? new PostgisStore(url)
      : new MemoryStore();
  }
  return globalRef.__floodpilotStore;
}

/** Which persistence layer is actually active, for the status surfaces. */
export function storeName(): string {
  return getStore().name;
}

export function hasSeededDemoData(): boolean {
  return globalRef.__floodpilotSeeded === true;
}

export function markDemoDataSeeded(): void {
  globalRef.__floodpilotSeeded = true;
}

export * from "./types";
export { MemoryStore } from "./memory-store";
