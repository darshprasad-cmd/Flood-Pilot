import type { ProviderId } from "@/lib/cities/types";

/**
 * Provider availability.
 *
 * Official Indian government feeds — IMD for rainfall, CWC for the Yamuna — are
 * the preferred sources for Delhi, and both require credentials. Rather than
 * pretending otherwise, every provider reports whether it is actually connected,
 * and the resolver falls through in the city's declared preference order while
 * recording which source really answered.
 *
 * This is what makes the "prediction based on" panel truthful instead of
 * decorative: it lists what was used, not what we wish had been used.
 */
export interface ProviderStatus {
  id: ProviderId;
  name: string;
  authority: string;
  /** Configured and usable right now. */
  available: boolean;
  /** Needs a credential that is not present. */
  blockedByCredential: boolean;
  envKey?: string;
  detail: string;
}

export interface ResolvedSignal<T> {
  data: T;
  /** Provider that actually produced this signal. */
  usedProvider: ProviderId;
  /** Providers that were preferred but unavailable, in order. */
  skipped: { id: ProviderId; reason: string }[];
}

export function hasEnv(key: string): boolean {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0;
}

export function env(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
