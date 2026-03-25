import { proxyActivities } from "@temporalio/workflow";

const activities = proxyActivities<any>({
  startToCloseTimeout: "1 minute",
});

export async function createAgent(input: any) {
  return await activities.createAgent(input);
}
