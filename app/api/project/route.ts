import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const workspaceRoot = process.cwd();
const ignoredDirectories = new Set([".git", ".next", "node_modules"]);
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".md", ".yml", ".yaml"]);

async function collectFiles(directory: string, relativeDirectory = "", results: string[] = []) {
  if (results.length >= 300) return results;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) await collectFiles(path.join(directory, entry.name), relativePath, results);
    else if (allowedExtensions.has(path.extname(entry.name).toLowerCase())) results.push(relativePath.replaceAll(path.sep, "/"));
  }
  return results;
}

function resolveFile(relativePath: string) {
  const normalized = path.normalize(relativePath);
  const target = path.resolve(/*turbopackIgnore: true*/ workspaceRoot, normalized);
  if (!relativePath || path.isAbsolute(relativePath) || normalized.startsWith("..") || !target.startsWith(`${workspaceRoot}${path.sep}`)) throw new Error("File is outside the approved workspace");
  return target;
}

export async function GET() {
  try {
    const files = await collectFiles(workspaceRoot);
    return NextResponse.json({ files, truncated: files.length >= 300 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project index failed" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string };
    const target = resolveFile(body.path ?? "");
    const content = await readFile(target, "utf8");
    return NextResponse.json({ path: body.path, content: content.slice(0, 120_000), truncated: content.length > 120_000 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "File read failed" }, { status: 400 });
  }
}
