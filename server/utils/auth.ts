export function verifyCronToken(expected: string | undefined, header: string | undefined): boolean {
  if (!expected) {
    return false
  }
  if (!header) {
    return false
  }
  const m = header.match(/^Bearer (.+)$/)
  if (!m) {
    return false
  }
  return m[1] === expected
}
