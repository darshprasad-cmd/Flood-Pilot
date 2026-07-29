/** Presentation helpers shared by the API layer and the UI. */

export function pct(value01: number, dp = 0): string {
  return `${(value01 * 100).toFixed(dp)}%`;
}

export function depthLabel(cm: number): string {
  if (cm < 1) return "dry";
  if (cm < 10) return `${cm.toFixed(0)} cm`;
  if (cm < 100) return `${cm.toFixed(0)} cm`;
  return `${(cm / 100).toFixed(2)} m`;
}

/** What that depth means to a person standing in it. */
export function depthReference(cm: number): string {
  if (cm < 2) return "surface water only";
  if (cm < 8) return "below kerb height";
  if (cm < 15) return "ankle deep";
  if (cm < 30) return "shin deep";
  if (cm < 50) return "knee deep";
  if (cm < 80) return "thigh deep";
  return "waist deep or worse";
}

export function distanceLabel(metres: number): string {
  if (metres < 950) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function rainLabel(mmPerHr: number): string {
  if (mmPerHr < 0.2) return "none";
  if (mmPerHr < 2.5) return "light";
  if (mmPerHr < 7.5) return "moderate";
  if (mmPerHr < 25) return "heavy";
  if (mmPerHr < 50) return "very heavy";
  return "extreme";
}

export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

export function titleCase(value: string): string {
  return value.replace(/(^|[\s_-])(\w)/g, (_, sep: string, ch: string) =>
    `${sep === "_" || sep === "-" ? " " : sep}${ch.toUpperCase()}`,
  );
}
