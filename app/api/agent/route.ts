import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const workspaceRoot = process.cwd();
const allowedChecks = new Set(["lint", "build", "test"]);

type AgentRequest = { prompt?: string; check?: string };
type AgentResponse = { summary: string; steps: string[]; evidence: string[]; status: "ready" | "needs-approval" | "failed"; model?: string };

async function inspectWorkspace() {
  const entries = await readdir(workspaceRoot, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const directories = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules").map((entry) => entry.name);
  let scripts: string[] = [];
  try {
    const packageJson = JSON.parse(await readFile(path.join(workspaceRoot, "package.json"), "utf8"));
    scripts = Object.keys(packageJson.scripts ?? {});
  } catch {
    scripts = [];
  }
  return { files, directories, scripts };
}

async function runCheck(check: string) {
  if (!allowedChecks.has(check)) throw new Error(`Unsupported check: ${check}`);
  try {
    const result = await execFileAsync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", check], { cwd: workspaceRoot, timeout: 30_000, windowsHide: true, shell: process.platform === "win32", maxBuffer: 200_000 });
    return { passed: true, output: `${result.stdout}${result.stderr}`.trim().slice(-1200) };
  } catch (error) {
    const commandError = error as { stdout?: string; stderr?: string; message?: string };
    return { passed: false, output: `${commandError.stdout ?? ""}${commandError.stderr ?? commandError.message ?? ""}`.trim().slice(-1200) };
  }
}

async function inspectGit() {
  try {
    const result = await execFileAsync("git", ["status", "--short", "--branch"], { cwd: workspaceRoot, timeout: 10_000, windowsHide: true, shell: process.platform === "win32" });
    return result.stdout.trim() || "Git working tree is clean";
  } catch {
    return "Git metadata unavailable";
  }
}

async function askModel(prompt: string, evidence: string[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const result = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "system", content: "You are RepoPilot, a cautious coding agent. Use the supplied evidence, explain what you know, and never claim to have edited files unless an approved mutation tool ran." }, { role: "user", content: `${prompt}\n\nWorkspace evidence:\n${evidence.join("\n")}` }] }),
  });
  if (!result.ok) throw new Error(`Model request failed with ${result.status}`);
  const data = await result.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { model, content: data.choices?.[0]?.message?.content?.trim() ?? "The model returned no text." };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentRequest;
    const prompt = body.prompt?.trim() ?? "";
    const workspace = await inspectWorkspace();
    const gitStatus = await inspectGit();
    const wantsCheck = body.check && allowedChecks.has(body.check) ? body.check : prompt.toLowerCase().includes("build") ? "build" : prompt.toLowerCase().includes("lint") || prompt.toLowerCase().includes("bug") ? "lint" : undefined;
    const response: AgentResponse = {
      summary: prompt.toLowerCase().includes("bug") ? "I inspected the workspace and selected a lint pass as the first evidence-gathering tool." : "I inspected the workspace and prepared the next agent step.",
      steps: ["Inspect repository structure", wantsCheck ? `Run npm run ${wantsCheck}` : "Read the relevant source files", "Return evidence before proposing edits"],
      evidence: [`Top-level files: ${workspace.files.length}`, `Directories: ${workspace.directories.join(", ") || "none"}`, `Available checks: ${workspace.scripts.filter((script) => allowedChecks.has(script)).join(", ") || "none"}`, `Git: ${gitStatus}`],
      status: wantsCheck ? "needs-approval" : "ready",
    };
    if (wantsCheck) {
      const result = await runCheck(wantsCheck);
      response.status = result.passed ? "ready" : "failed";
      response.evidence.push(`${wantsCheck}: ${result.passed ? "passed" : "failed"}`);
      if (result.output) response.evidence.push(result.output);
    }
    const modelResult = await askModel(prompt, response.evidence);
    if (modelResult) {
      response.summary = modelResult.content;
      response.model = modelResult.model;
    }
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent request failed" }, { status: 400 });
  }
}
