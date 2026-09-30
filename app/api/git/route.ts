import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const workspaceRoot = process.cwd();

type GitRequest = { action?: "status" | "diff" | "commit" | "push"; message?: string; approved?: boolean };

async function runGit(args: string[]) {
  const result = await execFileAsync("git", args, { cwd: workspaceRoot, timeout: 30_000, windowsHide: true, shell: process.platform === "win32", maxBuffer: 200_000 });
  return `${result.stdout}${result.stderr}`.trim();
}

function hasApproval(request: Request, body: GitRequest) {
  return request.headers.get("x-repopilot-approval") === "approved" && body.approved === true;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GitRequest;
    if (!body.action) return NextResponse.json({ error: "A Git action is required" }, { status: 400 });
    if (body.action === "status") return NextResponse.json({ action: body.action, output: await runGit(["status", "--short", "--branch"]) });
    if (body.action === "diff") return NextResponse.json({ action: body.action, output: await runGit(["diff", "--stat", "HEAD"]) });
    if (!hasApproval(request, body)) return NextResponse.json({ error: "This Git action requires explicit approval" }, { status: 403 });
    if (body.action === "commit") {
      const message = body.message?.trim();
      if (!message || message.length < 8 || message.length > 120) return NextResponse.json({ error: "Commit messages must be between 8 and 120 characters" }, { status: 400 });
      await runGit(["add", "--all"]);
      const output = await runGit(["commit", "-m", message]);
      return NextResponse.json({ action: body.action, output });
    }
    if (body.action === "push") return NextResponse.json({ action: body.action, output: await runGit(["push", "origin", "HEAD"]) });
    return NextResponse.json({ error: "Unsupported Git action" }, { status: 400 });
  } catch (error) {
    const commandError = error as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json({ error: `${commandError.stdout ?? ""}${commandError.stderr ?? commandError.message ?? "Git action failed"}`.trim() }, { status: 400 });
  }
}
