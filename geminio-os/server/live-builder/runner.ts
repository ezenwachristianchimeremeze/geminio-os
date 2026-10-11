import type { LiveBuilderRuntimeDiagnostic, LiveBuilderRuntimeStartInput } from "../../shared/geminio-contracts";
import { ContainerProvider, DevelopmentProvider, MicroVMProvider, defaultRunnerControlPlane, type ExecutionProvider } from "./control-plane";

export type RunnerResult = {
  status: "ready" | "unavailable" | "failed";
  isolation: "controlled_canvas" | "external_sandbox" | "unavailable";
  outputMode: "declarative" | "executable" | "unavailable";
  url: string | null;
  message: string;
  diagnostics: LiveBuilderRuntimeDiagnostic[];
};

export interface IsolatedProjectRunner {
  start(input: LiveBuilderRuntimeStartInput): Promise<RunnerResult>;
}

function providerFor(input: LiveBuilderRuntimeStartInput): ExecutionProvider {
  if (input.engine === "controlled_canvas") return new DevelopmentProvider();
  const requested = process.env.GEMINIO_RUNNER_PROVIDER;
  if (requested === "microvm") return new MicroVMProvider();
  return new ContainerProvider();
}

function unavailableDiagnostic(message: string, code: string): LiveBuilderRuntimeDiagnostic {
  return { severity: "warning", source: "sandbox", message, code, filePath: null, line: null, column: null };
}

/**
 * Control-plane backed adapter. The main application only creates a job and
 * requests a provider operation; it never evaluates generated project code.
 */
export class ControlPlaneProjectRunner implements IsolatedProjectRunner {
  async start(input: LiveBuilderRuntimeStartInput): Promise<RunnerResult> {
    const provider = providerFor(input);
    const job = defaultRunnerControlPlane.createJob({ userId: 0, projectId: input.workspaceId, versionId: input.versionId ?? null });
    defaultRunnerControlPlane.queue(job.id);
    defaultRunnerControlPlane.start(job.id, provider.name);
    defaultRunnerControlPlane.prepare(job.id);
    defaultRunnerControlPlane.build(job.id);
    const result = await provider.start(defaultRunnerControlPlane.get(job.id), defaultRunnerControlPlane.policySnapshot());

    if (result.status === "ready") {
      defaultRunnerControlPlane.mark(job.id, "running");
      defaultRunnerControlPlane.ready(job.id);
      defaultRunnerControlPlane.mark(job.id, "completed");
      defaultRunnerControlPlane.cleanup(job.id);
      return {
        status: "ready",
        isolation: input.engine === "controlled_canvas" ? "controlled_canvas" : "external_sandbox",
        outputMode: input.engine === "controlled_canvas" ? "declarative" : "executable",
        url: null,
        message: result.message,
        diagnostics: [],
      };
    }

    const message = `${result.message} No project source was executed and the persisted project remains unchanged.`;
    defaultRunnerControlPlane.mark(job.id, "failed", message);
    defaultRunnerControlPlane.cleanup(job.id);
    return {
      status: result.status,
      isolation: "unavailable",
      outputMode: "unavailable",
      url: null,
      message,
      diagnostics: [unavailableDiagnostic(message, input.engine === "external_runner" ? "EXTERNAL_RUNNER_UNAVAILABLE" : "RUNNER_START_FAILED")],
    };
  }
}

export class ControlledCanvasRunner extends ControlPlaneProjectRunner {}
export class UnavailableExternalRunner extends ControlPlaneProjectRunner {}

export function createProjectRunner(_engine: LiveBuilderRuntimeStartInput["engine"]): IsolatedProjectRunner {
  return new ControlPlaneProjectRunner();
}

/**
 * Start a runner without ever leaving the caller hanging or the session "starting" forever: a provider that throws
 * (network error, adapter bug) is reported as a failed start with an honest message, exactly like an unavailable one.
 */
export async function startRunnerSafely(runner: IsolatedProjectRunner, input: LiveBuilderRuntimeStartInput): Promise<RunnerResult> {
  try {
    return await runner.start(input);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    const message = `The runner failed to start (${detail.slice(0, 300)}). No project source was executed and the persisted project remains unchanged.`;
    return { status: "failed", isolation: "unavailable", outputMode: "unavailable", url: null, message, diagnostics: [unavailableDiagnostic(message, "RUNNER_START_FAILED")] };
  }
}
