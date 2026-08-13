export type PreflightDisposition =
  | "ALLOW"
  | "NEGOTIATE"
  | "SERIALIZE"
  | "ESCALATE"
  | "DENY"

export interface GoalState {
  key: string
  desiredState: string
}

export interface AgentIntent {
  agentId: string
  goal: GoalState
  readResources?: string[]
  writeResources?: string[]
  exclusiveResources?: string[]
  requestedCapabilities?: string[]
}

export interface PreflightInput {
  candidate: AgentIntent
  active: AgentIntent[]
  grantedCapabilities?: string[]
}

export interface PreflightDecision {
  disposition: PreflightDisposition
  reasons: string[]
  conflictingAgents: string[]
  resources: string[]
  deniedCapabilities: string[]
}

export type EvidencePosition = "SUPPORT" | "OPPOSE"

export interface EvidenceSignal {
  id: string
  claimKey: string
  position: EvidencePosition
  sourceId: string
  independenceGroup: string
  confidence?: number
  privateEvidence?: boolean
  decisive?: boolean
}

export type ConsensusState = "NONE" | "UNANIMOUS" | "MAJORITY" | "CONTESTED"
export type DissentState = "NONE" | "PRESENT" | "DECISIVE_PRIVATE_EVIDENCE"

export interface EvidenceSideSummary {
  rawCount: number
  independentCount: number
}

export interface EvidenceAssessment {
  claimKey: string
  rawCount: number
  independentCount: number
  evidenceIndependence: number
  support: EvidenceSideSummary
  oppose: EvidenceSideSummary
  consensusState: ConsensusState
  dissentState: DissentState
  minorityEvidence: EvidenceSignal[]
  signals: EvidenceSignal[]
}

function sortedUnique(values: string[] | undefined): string[] {
  return [...new Set(values ?? [])].sort()
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right)
  return sortedUnique(left.filter((value) => rightSet.has(value)))
}

function mergeUnique(...groups: string[][]): string[] {
  return sortedUnique(groups.flat())
}

function resourcesWrittenBy(intent: AgentIntent): string[] {
  return mergeUnique(intent.writeResources ?? [], intent.exclusiveResources ?? [])
}

function exclusiveConflicts(candidate: AgentIntent, active: AgentIntent): string[] {
  const candidateWritten = resourcesWrittenBy(candidate)
  const activeWritten = resourcesWrittenBy(active)

  return mergeUnique(
    intersection(candidate.exclusiveResources ?? [], activeWritten),
    intersection(active.exclusiveResources ?? [], candidateWritten)
  )
}

function mutableConflicts(candidate: AgentIntent, active: AgentIntent): string[] {
  return intersection(resourcesWrittenBy(candidate), resourcesWrittenBy(active))
}

export function evaluateMultiAgentPreflight(input: PreflightInput): PreflightDecision {
  const granted = new Set(input.grantedCapabilities ?? [])
  const deniedCapabilities = sortedUnique(
    (input.candidate.requestedCapabilities ?? []).filter((capability) => !granted.has(capability))
  )

  if (deniedCapabilities.length > 0) {
    return {
      disposition: "DENY",
      reasons: deniedCapabilities.map((capability) => `capability_not_granted:${capability}`),
      conflictingAgents: [],
      resources: [],
      deniedCapabilities
    }
  }

  const goalConflicts = input.active
    .filter(
      (active) =>
        active.goal.key === input.candidate.goal.key &&
        active.goal.desiredState !== input.candidate.goal.desiredState
    )
    .sort((left, right) => left.agentId.localeCompare(right.agentId))

  if (goalConflicts.length > 0) {
    return {
      disposition: "ESCALATE",
      reasons: [`incompatible_goal_state:${input.candidate.goal.key}`],
      conflictingAgents: goalConflicts.map((active) => active.agentId),
      resources: mergeUnique(
        ...goalConflicts.map((active) => mutableConflicts(input.candidate, active))
      ),
      deniedCapabilities: []
    }
  }

  const exclusive = input.active
    .map((active) => ({ active, resources: exclusiveConflicts(input.candidate, active) }))
    .filter(({ resources }) => resources.length > 0)
    .sort((left, right) => left.active.agentId.localeCompare(right.active.agentId))

  if (exclusive.length > 0) {
    return {
      disposition: "SERIALIZE",
      reasons: ["exclusive_resource_contention"],
      conflictingAgents: exclusive.map(({ active }) => active.agentId),
      resources: mergeUnique(...exclusive.map(({ resources }) => resources)),
      deniedCapabilities: []
    }
  }

  const mutable = input.active
    .map((active) => ({ active, resources: mutableConflicts(input.candidate, active) }))
    .filter(({ resources }) => resources.length > 0)
    .sort((left, right) => left.active.agentId.localeCompare(right.active.agentId))

  if (mutable.length > 0) {
    return {
      disposition: "NEGOTIATE",
      reasons: ["shared_mutable_resource_contention"],
      conflictingAgents: mutable.map(({ active }) => active.agentId),
      resources: mergeUnique(...mutable.map(({ resources }) => resources)),
      deniedCapabilities: []
    }
  }

  return {
    disposition: "ALLOW",
    reasons: ["no_conflict_detected"],
    conflictingAgents: [],
    resources: [],
    deniedCapabilities: []
  }
}

function summarizeSide(signals: EvidenceSignal[], position: EvidencePosition): EvidenceSideSummary {
  const side = signals.filter((signal) => signal.position === position)
  return {
    rawCount: side.length,
    independentCount: new Set(side.map((signal) => signal.independenceGroup)).size
  }
}

function determineMinorityPosition(
  support: EvidenceSideSummary,
  oppose: EvidenceSideSummary
): EvidencePosition | null {
  if (support.independentCount === 0 || oppose.independentCount === 0) {
    return null
  }

  if (support.independentCount === oppose.independentCount) {
    return null
  }

  return support.independentCount < oppose.independentCount ? "SUPPORT" : "OPPOSE"
}

export function assessEvidence(signals: EvidenceSignal[]): EvidenceAssessment[] {
  const claims = sortedUnique(signals.map((signal) => signal.claimKey))

  return claims.map((claimKey) => {
    const claimSignals = signals
      .filter((signal) => signal.claimKey === claimKey)
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id))

    const support = summarizeSide(claimSignals, "SUPPORT")
    const oppose = summarizeSide(claimSignals, "OPPOSE")
    const independentCount = new Set(claimSignals.map((signal) => signal.independenceGroup)).size
    const rawCount = claimSignals.length
    const evidenceIndependence = rawCount === 0 ? 0 : independentCount / rawCount

    let consensusState: ConsensusState = "NONE"
    if (rawCount > 0 && (support.rawCount === 0 || oppose.rawCount === 0)) {
      consensusState = "UNANIMOUS"
    } else if (support.independentCount === oppose.independentCount) {
      consensusState = "CONTESTED"
    } else if (rawCount > 0) {
      consensusState = "MAJORITY"
    }

    const minorityPosition = determineMinorityPosition(support, oppose)
    const minorityEvidence = minorityPosition
      ? claimSignals.filter((signal) => signal.position === minorityPosition)
      : []

    let dissentState: DissentState = minorityEvidence.length > 0 ? "PRESENT" : "NONE"
    if (
      minorityEvidence.some(
        (signal) => signal.privateEvidence === true && signal.decisive === true
      )
    ) {
      dissentState = "DECISIVE_PRIVATE_EVIDENCE"
    }

    return {
      claimKey,
      rawCount,
      independentCount,
      evidenceIndependence,
      support,
      oppose,
      consensusState,
      dissentState,
      minorityEvidence,
      signals: claimSignals
    }
  })
}
