import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const workspaceRoot = process.cwd();
const blockedDirectories = new Set([".git", "node_modules", ".next"]);

type ChangeRequest = { path?: string; content?: string; approved?: boolean };

function resolveWorkspacePath(relativePath: string) {
  const normalizedPath = path.normalize(relativePath);
  const [firstDirectory] = normalizedPath.split(path.sep);
  if (!relativePath || path.isAbsolute(relativePath) || normalizedPath.startsWith("..") || blockedDirectories.has(firstDirectory)) {
    throw new Error("Change path is outside the approved workspace");
  }
  const target = path.resolve(/*turbopackIgnore: true*/ workspaceRoot, normalizedPath);
  if (!target.startsWith(`${workspaceRoot}${path.sep}`)) throw new Error("Change path is outside the approved workspace");
  return target;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChangeRequest;
    if (request.headers.get("x-repopilot-approval") !== "approved" || body.approved !== true) {
      return NextResponse.json({ error: "This change requires explicit approval" }, { status: 403 });
    }
    if (typeof body.path !== "string" || typeof body.content !== "string") {
      return NextResponse.json({ error: "A relative path and file content are required" }, { status: 400 });
    }
    const target = resolveWorkspacePath(body.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body.content, "utf8");
    return NextResponse.json({ path: body.path, status: "applied" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Change could not be applied" }, { status: 400 });
  }
}
