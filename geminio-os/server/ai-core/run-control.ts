import { TRPCError } from "@trpc/server";
import { runStateErrorToTrpcCode } from "./run-guard";

/** Wrap a user-triggered run control so an invalid state is a 4xx the UI can explain, not an INTERNAL_SERVER_ERROR. Unknown errors still propagate. */
export async function runControlCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = runStateErrorToTrpcCode(e);
    if (code) throw new TRPCError({ code, message: (e as Error).message });
    throw e;
  }
}
