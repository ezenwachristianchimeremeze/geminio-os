import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("android test build configuration and secret hygiene", () => {
  it("eas.json defines an internal APK preview profile and embeds no secrets", () => {
    const eas = JSON.parse(read("eas.json"));
    expect(eas.build.preview.distribution).toBe("internal");
    expect(eas.build.preview.android.buildType).toBe("apk");
    expect(JSON.stringify(eas)).not.toMatch(/secret|password|token|mysql:\/\/|keystore/i);
  });
  it("app config keeps a stable android package and expo-router entry", () => {
    expect(read("app.config.ts")).toContain('rawBundleId = "com.app.geminioos"');
    expect(JSON.parse(read("package.json")).main).toBe("expo-router/entry");
  });
  it("the platform secret file .project-config.json is not shipped and is git-ignored (DEF-017)", () => {
    expect(existsSync(join(process.cwd(), ".project-config.json"))).toBe(false);
    expect(read(".gitignore")).toMatch(/^\.project-config\.json$/m);
    expect(read(".gitignore")).toMatch(/^\.env$/m);
  });
  it("no top-level file embeds a credentialed database URL or cloud key", () => {
    const bad: string[] = [];
    for (const f of readdirSync(process.cwd())) {
      const p = join(process.cwd(), f);
      if (!statSync(p).isFile() || /\.(zip|png|jpg|lock|yaml)$/.test(f)) continue;
      const t = readFileSync(p, "utf8");
      if (/mysql:\/\/[^\s<>:]+:(?!<)[^\s<>@]{6,}@[a-z0-9.-]+\.[a-z]/i.test(t) || /(AKIA|ASIA)[A-Z0-9]{12,}/.test(t) || /"secret_access_key"\s*:\s*"[^<]/.test(t)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});
