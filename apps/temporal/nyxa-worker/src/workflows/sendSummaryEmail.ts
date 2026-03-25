import { proxyActivities } from "@temporalio/workflow";

const activities = proxyActivities<any>({
  startToCloseTimeout: "1 minute",
});

export async function sendSummaryEmail(input: any) {
  return await activities.sendSummaryEmail(input);
}
