/**
 * Fill `{name}` placeholders in a translated string.
 *
 * Deliberately tiny and deliberately not a formatting library. Alert copy is
 * the one place the interface has to splice live numbers into translated
 * sentences, and every locale needs to be able to put those numbers wherever
 * its grammar wants them — which is exactly what a named placeholder gives you
 * and what string concatenation does not.
 *
 * An unknown key is left visible as `{key}` rather than silently blanked. A
 * flood warning with a hole in it should look broken, because it is.
 */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}
