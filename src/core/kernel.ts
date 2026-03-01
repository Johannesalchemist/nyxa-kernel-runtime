export interface KernelInput {
  emotionWeight: number
  boundaryIssue: number
  loopRisk: number
}

export interface KernelOutput {
  overload: number
  balance: number
}

export function runKernel(input: KernelInput): KernelOutput {
  const overload =
    (input.emotionWeight + input.boundaryIssue + input.loopRisk) / 3

  const balance = 1 - overload

  return {
    overload,
    balance
  }
}
