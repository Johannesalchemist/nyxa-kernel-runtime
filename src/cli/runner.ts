export const KERNEL_VERSION = "1.0.0";
export const CONTRACT_VERSION = "1.0";

export function runCli(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    outputError("missing command", 2);
    return;
  }

  switch (command) {
    case "validate":
      handleValidate();
      break;

    case "version":
      outputJson({
        contract: CONTRACT_VERSION,
        version: KERNEL_VERSION
      });
      process.exit(0);
      break;

    default:
      outputError("unknown command", 2);
  }
}

function handleValidate(): void {
  outputJson({
    contract: CONTRACT_VERSION,
    version: KERNEL_VERSION,
    status: "valid"
  });

  process.exit(0);
}

function outputJson(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload));
}

function outputError(reason: string, exitCode: number): void {
  process.stderr.write(
    JSON.stringify({
      contract: CONTRACT_VERSION,
      version: KERNEL_VERSION,
      status: "invalid",
      reason
    })
  );

  process.exit(exitCode);
}