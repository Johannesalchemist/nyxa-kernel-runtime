# Temporal Bootstrap for Nyxa Runtime

## Goal
Introduce one shared Temporal service as the durable execution backbone for Nyxa first.

## Server paths
- Nyxa runtime repo: /opt/nyxa-kernel-runtime
- Temporal service: /opt/temporal-shared

## Architecture decision
Use ONE shared Temporal service for:
- Nyxa
- Rocket.ai later
- Llama later if needed

Do NOT install separate Temporal stacks per product.

## Namespaces
- nyxa-dev
- nyxa-prod
- rocket-dev
- rocket-prod
- llama-dev
- llama-prod

## First workflows
1. send_summary_email
2. create_agent
3. export_conversation_file

## Core rule
No agent may claim an action is completed unless the workflow finished successfully.

## First coding target
apps/temporal/nyxa-worker/

Create:
- workflows/
- activities/
- lib/

## Expected deliverables
- worker bootstrap
- workflow stubs
- activity stubs
- minimal TypeScript setup
- README
