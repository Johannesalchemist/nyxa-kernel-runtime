import { readFileSync } from "node:fs"
import {
  assessEvidence,
  evaluateMultiAgentPreflight,
  type EvidenceSignal,
  type PreflightInput
} from "../core/multiAgentGovernance"

export const KERNEL_VERSION = "1.0.0"
export const CONTRACT_VERSION = "1.0"
export const CAPABILITIES = ["validate", "version", "mac-preflight", "mac-evidence"]

export function runCli(): void {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command) {
    outputError("missing command", 2)
  }

  switch (command) {
    case "validate":
      handleValidate()
      break

    case "version":
      outputJson({
        contract: CONTRACT_VERSION,
        version: KERNEL_VERSION
      })
      process.exit(0)
      break

    case "mac-preflight":
      handleMacPreflight()
      break

    case "mac-evidence":
      handleMacEvidence()
      break

    default:
      outputError("unknown command", 2)
  }
}

function handleValidate(): void {
  outputJson({
    contract: CONTRACT_VERSION,
    version: KERNEL_VERSION,
    capabilities: CAPABILITIES,
    status: "valid"
  })

  process.exit(0)
}

function handleMacPreflight(): void {
  try {
    const input = readJsonFromStdin<PreflightInput>()
    const decision = evaluateMultiAgentPreflight(input)
    outputJson({
      contract: CONTRACT_VERSION,
      version: KERNEL_VERSION,
      status: "valid",
      decision
    })
    process.exit(0)
  } catch {
    outputError("invalid mac-preflight input", 2)
  }
}

function handleMacEvidence(): void {
  try {
    const signals = readJsonFromStdin<EvidenceSignal[]>()
    if (!Array.isArray(signals)) {
      outputError("invalid mac-evidence input", 2)
    }

    const assessment = assessEvidence(signals)
    outputJson({
      contract: CONTRACT_VERSION,
      version: KERNEL_VERSION,
      status: "valid",
      assessment
    })
    process.exit(0)
  } catch {
    outputError("invalid mac-evidence input", 2)
  }
}

function readJsonFromStdin<T>(): T {
  const raw = readFileSync(0, "utf8").trim()
  if (!raw) {
    throw new Error("empty stdin")
  }

  return JSON.parse(raw) as T
}

function outputJson(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload))
}

function outputError(reason: string, exitCode: number): never {
  process.stderr.write(
    JSON.stringify({
      contract: CONTRACT_VERSION,
      version: KERNEL_VERSION,
      status: "invalid",
      reason
    })
  )

  process.exit(exitCode)
}
