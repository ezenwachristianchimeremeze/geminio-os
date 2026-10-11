import { aiCoreRequestSchema } from "../../shared/geminio-contracts";
import { listCapabilities } from "./capabilities";
import { cancelAiRun, executeQueuedJob, retryAiRun, runAiWorkerOnce, submitAiRequest, type SubmitOptions } from "./orchestrator";
import { getOrchestrationRun, getOrchestrationRunByTaskId, listAiJobsForRun, listOrchestrationRuns, listProviderAttemptsForRun, listTaskCheckpointsForRun, listTaskEvents, recoverExpiredAiJobLeases } from "./persistence";

export async function submitGatewayRequest(userId: number, input: unknown, options?: SubmitOptions) {
  return submitAiRequest(userId, aiCoreRequestSchema.parse(input), options);
}

export async function getGatewayRun(userId: number, runId: string) {
  return getOrchestrationRun(userId, runId);
}

export async function getGatewayEvents(userId: number, runId: string) {
  const run = await getOrchestrationRun(userId, runId);
  if (!run?.taskId) return [];
  return listTaskEvents(run.taskId);
}

export async function listGatewayRuns(userId: number, limit?: number) {
  return listOrchestrationRuns(userId, limit);
}

export async function getGatewayRunDetails(userId: number, runId: string) {
  const run = await getOrchestrationRun(userId, runId);
  if (!run) return null;
  const [jobs, checkpoints, providerAttempts, events] = await Promise.all([
    listAiJobsForRun(userId, runId),
    listTaskCheckpointsForRun(userId, runId),
    listProviderAttemptsForRun(userId, runId),
    run.taskId ? listTaskEvents(run.taskId) : [],
  ]);
  return { run, jobs, checkpoints, providerAttempts, events };
}

export async function cancelGatewayRun(userId: number, runId: string) {
  return cancelAiRun(userId, runId);
}

export async function retryGatewayRun(userId: number, runId: string) {
  return retryAiRun(userId, runId);
}

export async function listGatewayDeadLetters(userId: number, limit = 30) {
  const runs = await listOrchestrationRuns(userId, Math.min(limit, 100));
  const jobGroups = await Promise.all(runs.map(async (run) => ({
    runId: run.id,
    taskId: run.taskId,
    jobs: await listAiJobsForRun(userId, run.id),
  })));
  return jobGroups.flatMap(({ runId, taskId, jobs }) => jobs
    .filter((job) => job.status === "dead_letter")
    .map((job) => ({ ...job, runId, taskId })));
}

export async function recoverGatewayExpiredLeases(userId: number) {
  await recoverExpiredAiJobLeases();
  return { recoverySweepRequested: true as const, requestedBy: userId };
}

export async function getGatewayRunForTask(userId: number, taskId: string) {
  return getOrchestrationRunByTaskId(userId, taskId);
}

export function getGatewayCapabilities() {
  return listCapabilities();
}

export async function tickGatewayWorker() {
  return runAiWorkerOnce();
}

export { executeQueuedJob };
