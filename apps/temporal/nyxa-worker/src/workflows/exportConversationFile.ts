import { proxyActivities } from "@temporalio/workflow";

const activities = proxyActivities<any>({
  startToCloseTimeout: "1 minute",
});

export async function exportConversationFile(input: any) {
  return await activities.exportConversationFile(input);
}
