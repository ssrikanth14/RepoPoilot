import { appendFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { findProjectRoot, projectDirectory } from "@/lib/projects";

const execFileAsync = promisify(execFile);

async function runGit(directory: string, args: string[], extraArgs: string[] = []) {
  return execFileAsync("git", [...extraArgs, ...args], { cwd: directory, windowsHide: true, timeout: 60_000, maxBuffer: 200_000 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { projectId?: string; repositoryName?: string; repositoryUrl?: string; approved?: boolean; private?: boolean };
    if (request.headers.get("x-repopilot-approval") !== "approved" || body.approved !== true) return NextResponse.json({ error: "Publishing requires explicit approval" }, { status: 403 });
    if (!body.projectId || (!body.repositoryName?.trim() && !body.repositoryUrl?.trim())) return NextResponse.json({ error: "Project id and a GitHub repository URL or name are required" }, { status: 400 });
    const token = process.env.GITHUB_TOKEN;
    if (!token) return NextResponse.json({ error: "Configure GITHUB_TOKEN before publishing" }, { status: 400 });
    let repositoryName = body.repositoryName?.trim().replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) ?? "";
    let repositoryUrl = body.repositoryUrl?.trim() ?? "";
    if (repositoryUrl) {
      let parsedUrl: URL;
      try { parsedUrl = new URL(repositoryUrl); } catch { return NextResponse.json({ error: "Enter a valid GitHub repository URL" }, { status: 400 }); }
      if (parsedUrl.hostname !== "github.com") return NextResponse.json({ error: "Repository URL must use github.com" }, { status: 400 });
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return NextResponse.json({ error: "Use a URL like https://github.com/owner/repository" }, { status: 400 });
      repositoryName = segments[1].replace(/\.git$/, "");
      repositoryUrl = `https://github.com/${segments[0]}/${repositoryName}.git`;
    } else {
      const owner = process.env.GITHUB_OWNER;
      if (!owner) return NextResponse.json({ error: "Configure GITHUB_OWNER or enter a GitHub repository URL" }, { status: 400 });
      const apiResponse = await fetch("https://api.github.com/user/repos", { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, body: JSON.stringify({ name: repositoryName, private: body.private ?? false, description: "Published by RepoPilot" }) });
      const repository = await apiResponse.json() as { html_url?: string; clone_url?: string; message?: string };
      if (!apiResponse.ok || !repository.clone_url) throw new Error(repository.message ?? "GitHub repository creation failed");
      repositoryUrl = repository.clone_url;
    }
    const directory = await findProjectRoot(projectDirectory(body.projectId));
    await mkdir(directory, { recursive: true });
    await appendFile(`${directory}/.gitignore`, "\n.env\n.env.*\nnode_modules\n.next\ndist\nbuild\n", "utf8");
    await runGit(directory, ["init"]);
    await runGit(directory, ["add", "--all"]);
    await runGit(directory, ["commit", "-m", "chore: publish project with RepoPilot"]);
    await runGit(directory, ["branch", "-M", "main"]);
    await runGit(directory, ["remote", "remove", "origin"]).catch(() => undefined);
    await runGit(directory, ["remote", "add", "origin", repositoryUrl]);
    const auth = Buffer.from(`x-access-token:${token}`).toString("base64");
    await runGit(directory, ["push", "-u", "origin", "main"], ["-c", `http.extraheader=AUTHORIZATION: basic ${auth}`]);
    return NextResponse.json({ repository: repositoryUrl, url: `https://github.com/${repositoryUrl.split("/").slice(-2).join("/").replace(/\.git$/, "")}` });
  } catch (error) {
    const commandError = error as { stdout?: string; stderr?: string };
    const details = `${commandError.stdout ?? ""}${commandError.stderr ?? ""}`.trim();
    if (/403|permission to .* denied|authentication failed/i.test(details)) return NextResponse.json({ error: "GitHub rejected the push. Revoke the exposed token, create a replacement with write access to this repository, and try again." }, { status: 403 });
    return NextResponse.json({ error: details || "Project publish failed" }, { status: 400 });
  }
}
