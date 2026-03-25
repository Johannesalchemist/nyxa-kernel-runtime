import { Worker } from "@temporalio/worker";

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities: require("./activities"),
    taskQueue: "nyxa-room",
  });

  console.log("Nyxa Temporal Worker started on queue: nyxa-room");
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
