import { appendFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { projectDirectory } from "@/lib/projects";

const execFileAsync = promisify(execFile);

async function runGit(directory: string, args: string[], extraArgs: string[] = []) {
  return execFileAsync("git", [...extraArgs, ...args], { cwd: directory, shell: process.platform === "win32", windowsHide: true, timeout: 60_000, maxBuffer: 200_000 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { projectId?: string; repositoryName?: string; approved?: boolean; private?: boolean };
    if (request.headers.get("x-repopilot-approval") !== "approved" || body.approved !== true) return NextResponse.json({ error: "Publishing requires explicit approval" }, { status: 403 });
    if (!body.projectId || !body.repositoryName?.trim()) return NextResponse.json({ error: "Project id and repository name are required" }, { status: 400 });
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    if (!token || !owner) return NextResponse.json({ error: "Configure GITHUB_TOKEN and GITHUB_OWNER before publishing" }, { status: 400 });
    const repositoryName = body.repositoryName.trim().replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
    const apiResponse = await fetch("https://api.github.com/user/repos", { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, body: JSON.stringify({ name: repositoryName, private: body.private ?? false, description: "Published by RepoPilot" }) });
    const repository = await apiResponse.json() as { html_url?: string; clone_url?: string; message?: string };
    if (!apiResponse.ok || !repository.clone_url) throw new Error(repository.message ?? "GitHub repository creation failed");
    const directory = projectDirectory(body.projectId);
    await mkdir(directory, { recursive: true });
    await appendFile(`${directory}/.gitignore`, "\n.env\n.env.*\nnode_modules\n.next\ndist\nbuild\n", "utf8");
    await runGit(directory, ["init"]);
    await runGit(directory, ["add", "--all"]);
    await runGit(directory, ["commit", "-m", "chore: publish project with RepoPilot"]);
    await runGit(directory, ["branch", "-M", "main"]);
    await runGit(directory, ["remote", "remove", "origin"]).catch(() => undefined);
    await runGit(directory, ["remote", "add", "origin", repository.clone_url]);
    const auth = Buffer.from(`x-access-token:${token}`).toString("base64");
    await runGit(directory, ["push", "-u", "origin", "main"], ["-c", `http.extraheader=AUTHORIZATION: basic ${auth}`]);
    return NextResponse.json({ repository: `${owner}/${repositoryName}`, url: repository.html_url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project publish failed" }, { status: 400 });
  }
}
