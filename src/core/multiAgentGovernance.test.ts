import { describe, expect, it } from "vitest"
import {
  assessEvidence,
  evaluateMultiAgentPreflight,
  type AgentIntent,
  type EvidenceSignal
} from "./multiAgentGovernance"

const baseCapabilities = ["filesystem.read", "filesystem.write", "process.start"]

function intent(overrides: Partial<AgentIntent> & Pick<AgentIntent, "agentId">): AgentIntent {
  return {
    agentId: overrides.agentId,
    goal: overrides.goal ?? { key: "backend.runtime", desiredState: "typescript" },
    readResources: overrides.readResources ?? [],
    writeResources: overrides.writeResources ?? [],
    exclusiveResources: overrides.exclusiveResources ?? [],
    requestedCapabilities: overrides.requestedCapabilities ?? []
  }
}

describe("NYXA Multi-Agent Conflict Test Pack", () => {
  it("MAC-001 escalates incompatible desired states for the same goal", () => {
    const active = intent({
      agentId: "agent-rust",
      goal: { key: "backend.runtime", desiredState: "rust" },
      writeResources: ["services/backend"]
    })

    const candidate = intent({
      agentId: "agent-go",
      goal: { key: "backend.runtime", desiredState: "go" },
      writeResources: ["services/backend"]
    })

    const result = evaluateMultiAgentPreflight({
      candidate,
      active: [active],
      grantedCapabilities: baseCapabilities
    })

    expect(result.disposition).toBe("ESCALATE")
    expect(result.conflictingAgents).toEqual(["agent-rust"])
    expect(result.reasons).toEqual(["incompatible_goal_state:backend.runtime"])
  })

  it("MAC-002 denies capabilities that were not granted", () => {
    const candidate = intent({
      agentId: "agent-admin",
      requestedCapabilities: ["filesystem.write", "identity.disable"]
    })

    const result = evaluateMultiAgentPreflight({
      candidate,
      active: [],
      grantedCapabilities: baseCapabilities
    })

    expect(result.disposition).toBe("DENY")
    expect(result.deniedCapabilities).toEqual(["identity.disable"])
  })

  it("MAC-003 serializes exclusive resource ownership conflicts", () => {
    const active = intent({
      agentId: "agent-a",
      exclusiveResources: ["deployment/backend"]
    })

    const candidate = intent({
      agentId: "agent-b",
      writeResources: ["deployment/backend"]
    })

    const result = evaluateMultiAgentPreflight({
      candidate,
      active: [active],
      grantedCapabilities: baseCapabilities
    })

    expect(result.disposition).toBe("SERIALIZE")
    expect(result.resources).toEqual(["deployment/backend"])
  })

  it("MAC-004 negotiates shared mutable resource contention", () => {
    const active = intent({
      agentId: "agent-a",
      goal: { key: "backend.logging", desiredState: "structured" },
      writeResources: ["services/backend/config.json"]
    })

    const candidate = intent({
      agentId: "agent-b",
      goal: { key: "backend.metrics", desiredState: "enabled" },
      writeResources: ["services/backend/config.json"]
    })

    const result = evaluateMultiAgentPreflight({
      candidate,
      active: [active],
      grantedCapabilities: baseCapabilities
    })

    expect(result.disposition).toBe("NEGOTIATE")
    expect(result.resources).toEqual(["services/backend/config.json"])
  })

  it("MAC-005 allows disjoint compatible work", () => {
    const active = intent({
      agentId: "agent-a",
      goal: { key: "frontend.theme", desiredState: "dark" },
      writeResources: ["apps/web/theme.ts"]
    })

    const candidate = intent({
      agentId: "agent-b",
      goal: { key: "backend.metrics", desiredState: "enabled" },
      writeResources: ["services/backend/metrics.ts"]
    })

    const result = evaluateMultiAgentPreflight({
      candidate,
      active: [active],
      grantedCapabilities: baseCapabilities
    })

    expect(result.disposition).toBe("ALLOW")
  })

  it("MAC-006 does not treat correlated repetitions as independent evidence", () => {
    const signals: EvidenceSignal[] = Array.from({ length: 5 }, (_, index) => ({
      id: `same-model-${index + 1}`,
      claimKey: "migration.safe",
      position: "SUPPORT",
      sourceId: `agent-${index + 1}`,
      independenceGroup: "claude-same-prompt"
    }))

    const [assessment] = assessEvidence(signals)

    expect(assessment.rawCount).toBe(5)
    expect(assessment.independentCount).toBe(1)
    expect(assessment.evidenceIndependence).toBe(0.2)
  })

  it("MAC-007 preserves minority evidence instead of erasing it by majority", () => {
    const signals: EvidenceSignal[] = [
      {
        id: "majority-a",
        claimKey: "release.ready",
        position: "SUPPORT",
        sourceId: "agent-a",
        independenceGroup: "source-a"
      },
      {
        id: "majority-b",
        claimKey: "release.ready",
        position: "SUPPORT",
        sourceId: "agent-b",
        independenceGroup: "source-b"
      },
      {
        id: "minority-c",
        claimKey: "release.ready",
        position: "OPPOSE",
        sourceId: "agent-c",
        independenceGroup: "source-c"
      }
    ]

    const [assessment] = assessEvidence(signals)

    expect(assessment.consensusState).toBe("MAJORITY")
    expect(assessment.dissentState).toBe("PRESENT")
    expect(assessment.minorityEvidence.map((signal) => signal.id)).toEqual(["minority-c"])
  })

  it("MAC-008 marks decisive private minority evidence for escalation", () => {
    const signals: EvidenceSignal[] = [
      {
        id: "majority-a",
        claimKey: "deploy.allowed",
        position: "SUPPORT",
        sourceId: "agent-a",
        independenceGroup: "source-a"
      },
      {
        id: "majority-b",
        claimKey: "deploy.allowed",
        position: "SUPPORT",
        sourceId: "agent-b",
        independenceGroup: "source-b"
      },
      {
        id: "private-blocker",
        claimKey: "deploy.allowed",
        position: "OPPOSE",
        sourceId: "security-agent",
        independenceGroup: "security-private-log",
        privateEvidence: true,
        decisive: true
      }
    ]

    const [assessment] = assessEvidence(signals)

    expect(assessment.dissentState).toBe("DECISIVE_PRIVATE_EVIDENCE")
    expect(assessment.minorityEvidence.map((signal) => signal.id)).toEqual(["private-blocker"])
  })
})
