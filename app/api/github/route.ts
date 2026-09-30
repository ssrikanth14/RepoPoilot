import { NextResponse } from "next/server";

type GithubRequest = {
  action?: "create-repository" | "pull-request";
  name?: string;
  description?: string;
  title?: string;
  body?: string;
  head?: string;
  base?: string;
  private?: boolean;
  approved?: boolean;
};

function getGithubConfig() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  return { token, apiUrl: process.env.GITHUB_API_URL ?? "https://api.github.com" };
}

async function githubRequest(path: string, init: RequestInit = {}) {
  const { token, apiUrl } = getGithubConfig();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...init.headers },
  });
  const data = await response.json() as { message?: string; html_url?: string; full_name?: string; number?: number };
  if (!response.ok) throw new Error(data.message ?? `GitHub request failed with ${response.status}`);
  return data;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GithubRequest;
    if (!body.action) return NextResponse.json({ error: "A GitHub action is required" }, { status: 400 });
    if (request.headers.get("x-repopilot-approval") !== "approved" || body.approved !== true) return NextResponse.json({ error: "This GitHub action requires explicit approval" }, { status: 403 });
    if (body.action === "create-repository") {
      if (!body.name?.trim()) return NextResponse.json({ error: "A repository name is required" }, { status: 400 });
      const result = await githubRequest("/user/repos", { method: "POST", body: JSON.stringify({ name: body.name.trim(), description: body.description?.trim() ?? "Created by RepoPilot", private: body.private ?? false, auto_init: false }) });
      return NextResponse.json({ action: body.action, repository: result.full_name, url: result.html_url });
    }
    if (body.action === "pull-request") {
      if (!body.title?.trim() || !body.head?.trim() || !body.base?.trim()) return NextResponse.json({ error: "Pull requests require title, head, and base" }, { status: 400 });
      const owner = process.env.GITHUB_OWNER;
      const repository = process.env.GITHUB_REPOSITORY;
      if (!owner || !repository) throw new Error("GITHUB_OWNER and GITHUB_REPOSITORY are required for pull requests");
      const result = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pulls`, { method: "POST", body: JSON.stringify({ title: body.title.trim(), body: body.body?.trim() ?? "Created by RepoPilot", head: body.head.trim(), base: body.base.trim() }) });
      return NextResponse.json({ action: body.action, number: result.number, url: result.html_url });
    }
    return NextResponse.json({ error: "Unsupported GitHub action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub action failed" }, { status: 400 });
  }
}
