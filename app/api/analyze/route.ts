import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { projectDirectory } from "@/lib/projects";

const execFileAsync = promisify(execFile);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".rb", ".php", ".css"]);

type Finding = { title: string; detail: string; severity: "high" | "medium" | "low" };

async function collectFiles(directory: string, relativeDirectory = "", result: string[] = []) {
  if (result.length >= 200) return result;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["node_modules", ".next", "dist", "build"].includes(entry.name)) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) await collectFiles(path.join(directory, entry.name), relativePath, result);
    else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) result.push(relativePath);
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json() as { projectId?: string };
    if (!projectId) return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    const root = projectDirectory(projectId);
    const files = await collectFiles(root);
    const findings: Finding[] = [];
    let todoCount = 0;
    let consoleCount = 0;
    for (const file of files) {
      const content = await readFile(path.join(root, file), "utf8");
      todoCount += (content.match(/TODO|FIXME/g) ?? []).length;
      consoleCount += (content.match(/console\.log\(/g) ?? []).length;
    }
    if (todoCount) findings.push({ title: "Unfinished work markers found", detail: `${todoCount} TODO or FIXME marker${todoCount === 1 ? "" : "s"} need review.`, severity: "medium" });
    if (consoleCount) findings.push({ title: "Debug logging in source", detail: `${consoleCount} console.log call${consoleCount === 1 ? "" : "s"} found. Remove or replace before production.`, severity: "low" });
    if (!files.length) findings.push({ title: "No supported source files found", detail: "The ZIP may contain a nested project folder or unsupported file types.", severity: "high" });
    let check = "No package scripts detected";
    try {
      const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
      const scripts = Object.keys(packageJson.scripts ?? {});
      const script = scripts.includes("lint") ? "lint" : scripts.includes("test") ? "test" : scripts.includes("build") ? "build" : "";
      if (script) {
        try {
          await execFileAsync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], { cwd: root, shell: process.platform === "win32", timeout: 30_000, windowsHide: true, maxBuffer: 100_000 });
          check = `${script} passed`;
        } catch {
          check = `${script} failed and needs review`;
          findings.push({ title: `${script} check failed`, detail: "Run the project check locally to inspect the full output.", severity: "high" });
        }
      }
    } catch {
      check = "No package.json found";
    }
    const score = Math.max(0, 100 - findings.reduce((total, finding) => total + (finding.severity === "high" ? 25 : finding.severity === "medium" ? 12 : 5), 0));
    return NextResponse.json({ score, files: files.length, check, findings, improvements: ["Add or strengthen automated tests", "Document how to run the project", "Review the highest-severity findings first"] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project analysis failed" }, { status: 400 });
  }
}
