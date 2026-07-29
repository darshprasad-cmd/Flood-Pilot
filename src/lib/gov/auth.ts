/**
 * Government dashboard access.
 *
 * The requirement is that this view is not exposed to ordinary users, so it is
 * gated in middleware — not merely unlinked. What is behind it is operational
 * information (where response teams are short, which drains are about to fail)
 * that is genuinely different in kind from what a citizen sees.
 *
 * This is a demonstration gate, not an identity system. A real deployment would
 * put SSO in front of it; the seam is `verifyGovToken`, which is the only thing
 * middleware calls.
 */

export const GOV_COOKIE = "fp_gov";

/** Documented so the dashboard can be reviewed without any configuration. */
export const DEMO_ACCESS_CODE = "delhi-flood-control";

export function configuredAccessCode(): string {
  return process.env.GOV_ACCESS_CODE?.trim() || DEMO_ACCESS_CODE;
}

/**
 * Derive the cookie value from the access code.
 *
 * Uses Web Crypto so the same function runs in middleware (edge) and in a route
 * handler (node) without a second implementation drifting out of sync.
 */
export async function deriveGovToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`${code}::floodpilot-gov-v1`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyGovToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await deriveGovToken(configuredAccessCode());
  // Constant-time-ish comparison; lengths are fixed so this is adequate here.
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
