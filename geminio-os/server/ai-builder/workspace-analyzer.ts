/**
 * Workspace analysis over Live Builder files (not the server filesystem).
 * Pure: takes {path, content}[] and returns structured findings.
 */
export type WorkspaceFile = { path: string; content: string | null; isSecret?: boolean };

export type WorkspaceAnalysis = {
  fileCount: number;
  byKind: Record<string, number>;
  screens: string[];
  routes: string[];
  dependencies: string[];
  hasTests: boolean;
  hasPackageJson: boolean;
  findings: { severity: "error" | "warning" | "info"; path: string | null; message: string }[];
};

export function analyzeWorkspace(files: WorkspaceFile[]): WorkspaceAnalysis {
  const findings: WorkspaceAnalysis["findings"] = [];
  const byKind: Record<string, number> = {};
  const screens: string[] = [];
  const routes: string[] = [];
  let dependencies: string[] = [];
  let hasTests = false;
  let hasPackageJson = false;

  for (const f of files) {
    const ext = f.path.includes(".") ? f.path.split(".").pop()!.toLowerCase() : "none";
    byKind[ext] = (byKind[ext] ?? 0) + 1;
    if (/\.(test|spec)\.[tj]sx?$/.test(f.path)) hasTests = true;
    if (/^app\/.+\.tsx$/.test(f.path)) screens.push(f.path);
    if (f.isSecret || f.content === null) continue;
    if (f.path === "package.json") {
      hasPackageJson = true;
      try {
        const pkg = JSON.parse(f.content) as { dependencies?: Record<string, string> };
        dependencies = Object.keys(pkg.dependencies ?? {}).sort();
      } catch {
        findings.push({ severity: "error", path: f.path, message: "package.json is not valid JSON." });
      }
    }
    if (f.path.endsWith(".json")) {
      try { JSON.parse(f.content); } catch { findings.push({ severity: "error", path: f.path, message: "Invalid JSON." }); }
    }
    for (const m of f.content.matchAll(/\b(?:app|router)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) {
      routes.push(`${m[1].toUpperCase()} ${m[2]}`);
    }
    if (/\b(TODO|FIXME|XXX)\b/.test(f.content)) findings.push({ severity: "warning", path: f.path, message: "Contains TODO/FIXME markers." });
    if (/\bconsole\.log\(/.test(f.content) && !/\.(test|spec)\./.test(f.path)) findings.push({ severity: "info", path: f.path, message: "Contains console.log." });
    if (/(?:api[-_]?key|secret|password|access[-_]?token)\s*[:=]\s*["'][^"'$]{8,}/i.test(f.content)) {
      findings.push({ severity: "error", path: f.path, message: "Possible hard-coded credential." });
    }
    if (/\.(tsx?|jsx?)$/.test(f.path)) {
      const opens = (f.content.match(/[{(\[]/g) ?? []).length;
      const closes = (f.content.match(/[})\]]/g) ?? []).length;
      if (opens !== closes) findings.push({ severity: "error", path: f.path, message: `Unbalanced brackets (${opens} open, ${closes} close).` });
    }
  }
  if (files.length > 0 && !hasTests) findings.push({ severity: "warning", path: null, message: "Workspace has no test files." });
  return { fileCount: files.length, byKind, screens: screens.sort(), routes: routes.sort(), dependencies, hasTests, hasPackageJson, findings };
}
