/**
 * A published version, downloaded and checked end to end before anything is generated from it:
 * the registry's integrity first, then the provenance identity versions.json names for it.
 */

import { readFileSync } from 'fs'
import path from 'path'
import type { TrustedRoot } from '@sigstore/protobuf-specs'
import { fetchProvenanceBundle, verifyProvenance, type Provenance } from './provenance.js'
import { downloadTarball, type Fetch, type Packument } from './registry.js'
import { unpack, type Unpacked } from './tarball.js'
import { identityFor, type VersionsConfig } from './versions.js'

export interface VerifiedPackage extends Unpacked {
  version: string
  integrity: string
  /** Absent only for a version versions.json accepts on integrity alone. */
  provenance?: Provenance
  readme(): string
  changelog(): string
}

export async function fetchVerified(
  config: VersionsConfig,
  packument: Packument,
  version: string,
  trustedRoot: () => Promise<TrustedRoot>,
  fetchImpl: Fetch = fetch,
): Promise<VerifiedPackage> {
  const tarball = await downloadTarball(packument, version, fetchImpl)
  const identity = identityFor(config, version)
  let provenance: Provenance | undefined
  if (identity !== 'integrity-only') {
    const bundle = await fetchProvenanceBundle(config.package, version, fetchImpl)
    if (!bundle) throw new Error(`${config.package}@${version} has no provenance attestation. List it under provenance.integrityOnly only after review.`)
    provenance = verifyProvenance({
      bundle,
      trustedRoot: await trustedRoot(),
      issuer: config.provenance.issuer,
      identity,
      name: config.package,
      version,
      sha512: tarball.sha512,
    })
  }
  const unpacked = unpack(tarball.bytes)
  const read = (file: string) => readFileSync(path.join(unpacked.dir, file), 'utf8')
  return {
    ...unpacked,
    version,
    integrity: packument.versions[version].dist.integrity,
    provenance,
    readme: () => read('README.md'),
    changelog: () => read('CHANGELOG.md'),
  }
}
