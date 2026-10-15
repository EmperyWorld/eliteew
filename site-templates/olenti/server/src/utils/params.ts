/**
 * Coerce Express req.params/req.query value to string (Express types allow string[] and ParsedQs).
 */
export function asString(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return String(value[0] ?? '');
  if (typeof value === 'object') return '';
  return String(value);
}
