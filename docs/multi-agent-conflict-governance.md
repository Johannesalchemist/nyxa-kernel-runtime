# NYXA Multi-Agent Conflict Governance

## Status

Runtime implementation introduced on 2026-08-13.

## Purpose

NYXA must not infer that multiple agents working toward locally reasonable objectives are globally compatible. Before an agent receives execution latitude, the runtime performs a deterministic preflight over declared goal state, capabilities, and mutable resources.

The mechanism is deliberately part of the kernel runtime. It is not implemented as another autonomous safety agent, because an agent must not be able to negotiate away the policy that constrains it.

## Deterministic decision order

The preflight resolves conditions in this fixed order:

1. `DENY` when the candidate requests at least one capability that was not granted.
2. `ESCALATE` when an active agent targets the same goal key with an incompatible desired state.
3. `SERIALIZE` when exclusive resource ownership conflicts with another writer.
4. `NEGOTIATE` when agents share a mutable resource without an exclusive lock.
5. `ALLOW` when none of the previous conditions applies.

This order is normative. Later conditions never override an earlier, stronger decision.

## Goal and authority separation

An objective never grants authority by implication.

Example:

- objective: deploy a Rust backend
- possible capability: write deployment files
- not implied: terminate competing processes, disable identities, revoke SSH access, or alter another agent's scope

The runtime therefore compares every requested capability against an explicit granted capability set before considering goal or resource compatibility.

## Evidence independence

Agent agreement is not treated as independent evidence by default.

Each evidence signal contains an `independenceGroup`. The runtime reports both:

- `rawCount`
- `independentCount`
- `evidenceIndependence = independentCount / rawCount`

Five agents repeating the same model/prompt-derived conclusion may therefore count as five observations but only one independent evidence group.

## Minority evidence preservation

Evidence aggregation never deletes the minority side of a contested claim. The assessment returns the original minority signals under `minorityEvidence`.

If minority evidence is both private and marked decisive, `dissentState` becomes `DECISIVE_PRIVATE_EVIDENCE`. This is a signal for governance escalation, not an automatic truth assignment.

## Runtime commandlets

### `mac-preflight`

Reads one JSON `PreflightInput` document from stdin and emits a deterministic decision.

Example input:

```json
{
  "candidate": {
    "agentId": "agent-go",
    "goal": { "key": "backend.runtime", "desiredState": "go" },
    "writeResources": ["services/backend"],
    "requestedCapabilities": ["filesystem.write"]
  },
  "active": [
    {
      "agentId": "agent-rust",
      "goal": { "key": "backend.runtime", "desiredState": "rust" },
      "writeResources": ["services/backend"]
    }
  ],
  "grantedCapabilities": ["filesystem.write"]
}
```

Expected disposition: `ESCALATE`.

### `mac-evidence`

Reads a JSON array of evidence signals from stdin and emits claim-level independence, consensus, dissent, and minority-preservation metadata.

## MAC test pack

The runtime ships eight fixtures:

- `MAC-001`: incompatible desired state for the same goal
- `MAC-002`: ungranted capability
- `MAC-003`: exclusive resource collision
- `MAC-004`: shared mutable resource collision
- `MAC-005`: disjoint compatible work
- `MAC-006`: correlated evidence is not independent evidence
- `MAC-007`: minority evidence survives majority aggregation
- `MAC-008`: decisive private minority evidence is surfaced

Run with:

```bash
npm test
```

The normal TypeScript build remains:

```bash
npm run build
```

## Boundary with governed memory

The runtime produces epistemic metadata that can be persisted by a governed memory backend. Storage semantics are intentionally not duplicated here. A memory backend should persist the assessment as provenance rather than recomputing it with a second policy implementation.
