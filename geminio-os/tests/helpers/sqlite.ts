/**
 * Loads node:sqlite through createRequire so Vite/Vitest never tries to resolve it. `node:sqlite` is a
 * prefix-only builtin that is not listed in `module.builtinModules`, which some Vite/Vitest versions fail to
 * externalize ("Failed to load url node:sqlite"). Requires Node >= 22.5 (see docs/VERIFICATION.md).
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
export const { DatabaseSync } = req("node:sqlite") as typeof import("node:sqlite");
