/**
 * Credential fingerprinting for query keys (issue #158).
 *
 * Query keys must vary by credential so switching accounts never serves
 * another account's cached data, but embedding the raw secret exposes it in
 * Devtools, cache serialisation and debug logs. This module derives a short,
 * stable, non-reversible discriminator to use in its place.
 *
 * FNV-1a is deliberately non-cryptographic: the goal is non-display of the
 * secret, not cryptographic secrecy, and the Web Crypto alternative is async
 * which does not fit React Query's synchronous key builders.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

const cache = new Map<string, string>()

/**
 * Derive a stable 8-char lowercase-hex fingerprint of a secret.
 *
 * Same input always yields the same output; the output never contains the
 * input. Memoised, so repeated key builds cost a single Map lookup.
 */
export function fingerprint(secret: string): string {
  const cached = cache.get(secret)
  if (cached !== undefined) return cached

  let hash = FNV_OFFSET_BASIS
  for (let i = 0; i < secret.length; i++) {
    hash ^= secret.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0')

  cache.set(secret, hex)
  return hex
}
