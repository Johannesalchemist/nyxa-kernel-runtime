#!/usr/bin/env node

const CONTRACT = "1.0";
const VERSION = "1.0.0";
const CAPABILITIES = ["validate"];

function validate() {
  const output = {
    contract: CONTRACT,
    version: VERSION,
    capabilities: CAPABILITIES,
    status: "valid"
  };

  console.log(JSON.stringify(output));
  process.exit(0);
}

const command = process.argv[2];

if (command === "validate") {
  validate();
} else {
  console.error("Unknown command");
  process.exit(1);
}