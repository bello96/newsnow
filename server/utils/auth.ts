export function verifyCronToken(expected: string | undefined, header: string | undefined): boolean {
  if (!expected) {
    return false
  }
  if (!header) {
    return false
  }
  if (!header.startsWith("Bearer ")) {
    return false
  }
  const token = header.slice(7).trimStart()
  if (!token) {
    return false
  }
  return token === expected
}
