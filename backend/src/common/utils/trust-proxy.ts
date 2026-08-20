export function resolveTrustProxy(
  value: string | undefined,
): boolean | number | string {
  if (!value || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}
