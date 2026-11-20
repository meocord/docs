// A store spec runs against the server its variable names. Outside CI it skips while that is unset; in CI it
// always runs, so a missing or unreachable service fails the check instead of passing it by skipping.
export function serviceUrl(variable: string): { skip: boolean; url: () => string } {
  const value = process.env[variable]
  return {
    skip: !value && !process.env.CI,
    url: () => {
      if (!value) throw new Error(`${variable} is not set`)
      return value
    },
  }
}
