/**
 * Verifies that a tarball is the one a named GitHub workflow built and published: the registry's
 * SLSA provenance attestation must be signed through Sigstore by exactly the expected identity, and
 * its subject must be this package version with this tarball's sha512.
 */

import { bundleFromJSON, type SerializedBundle } from '@sigstore/bundle'
import { TrustedRoot } from '@sigstore/protobuf-specs'
import { getTrustedRoot } from '@sigstore/tuf'
import { toSignedEntity, toTrustMaterial, Verifier } from '@sigstore/verify'
import { REGISTRY, type Fetch } from './registry.js'

export const SLSA_PROVENANCE = 'https://slsa.dev/provenance/v1'

interface Attestation {
  predicateType: string
  bundle: SerializedBundle & { dsseEnvelope?: { payload: string; payloadType: string } }
}

/** The registry's SLSA provenance bundle for a version, or undefined when it has none. */
export async function fetchProvenanceBundle(name: string, version: string, fetchImpl: Fetch = fetch): Promise<Attestation['bundle'] | undefined> {
  const response = await fetchImpl(`${REGISTRY}/-/npm/v1/attestations/${name}@${version}`)
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`The attestations for ${name}@${version} answered ${response.status}.`)
  const { attestations } = (await response.json()) as { attestations: Attestation[] }
  return attestations.find(attestation => attestation.predicateType === SLSA_PROVENANCE)?.bundle
}

/** Sigstore's current trusted root, through its TUF repository. */
export function loadTrustedRoot(): Promise<TrustedRoot> {
  return getTrustedRoot()
}

/** A trusted root saved as JSON, as the tests use to verify without the network. */
export function trustedRootFromJson(json: unknown): TrustedRoot {
  return TrustedRoot.fromJSON(json)
}

export interface ProvenanceCheck {
  bundle: unknown
  trustedRoot: TrustedRoot
  issuer: string
  identity: string
  name: string
  version: string
  /** The verified tarball's sha512, as hex. */
  sha512: string
}

export interface Provenance {
  /** The repository the workflow ran in, such as `https://github.com/meocord/meocord`. */
  repository: string
  /** The commit it built. */
  commit: string
}

interface Statement {
  _type: string
  subject: { name: string; digest: Record<string, string> }[]
  predicateType: string
  predicate: {
    buildDefinition: {
      externalParameters: { workflow: { repository: string; path: string; ref: string } }
      resolvedDependencies: { uri: string; digest: { gitCommit?: string } }[]
    }
  }
}

/** Verifies the bundle and returns what it attests; throws when anything does not match. */
export function verifyProvenance(check: ProvenanceCheck): Provenance {
  const bundle = bundleFromJSON(check.bundle)
  const verifier = new Verifier(toTrustMaterial(check.trustedRoot), { tlogThreshold: 1, ctlogThreshold: 1 })
  verifier.verify(toSignedEntity(bundle), { subjectAlternativeName: check.identity, extensions: { issuer: check.issuer } })

  const envelope = bundle.content.$case === 'dsseEnvelope' ? bundle.content.dsseEnvelope : undefined
  if (!envelope) throw new Error(`The provenance for ${check.name}@${check.version} carries no in-toto statement.`)
  const statement = JSON.parse(Buffer.from(envelope.payload).toString('utf8')) as Statement
  if (statement.predicateType !== SLSA_PROVENANCE) {
    throw new Error(`The provenance for ${check.name}@${check.version} is a ${statement.predicateType} statement.`)
  }
  const purl = `pkg:npm/${check.name.replace('@', '%40')}@${check.version}`
  const subject = statement.subject.find(entry => entry.name === purl)
  if (!subject) throw new Error(`The provenance names ${statement.subject.map(entry => entry.name).join(', ')}, not ${purl}.`)
  if (subject.digest.sha512 !== check.sha512) {
    throw new Error(`The provenance for ${purl} attests a different tarball than the one downloaded.`)
  }

  const commit = statement.predicate.buildDefinition.resolvedDependencies.find(dependency => dependency.digest.gitCommit)?.digest.gitCommit
  if (!commit) throw new Error(`The provenance for ${purl} names no commit.`)
  return { repository: statement.predicate.buildDefinition.externalParameters.workflow.repository, commit }
}
