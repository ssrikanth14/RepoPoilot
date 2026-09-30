import path from "node:path";
import { mkdir, readdir, readFile } from "node:fs/promises";

export const uploadsRoot = path.join(process.cwd(), "uploads");

export async function ensureUploadsRoot() {
  await mkdir(uploadsRoot, { recursive: true });
}

export function projectDirectory(projectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Invalid project id");
  return path.join(uploadsRoot, projectId);
}

export async function findProjectRoot(directory: string, depth = 0): Promise<string> {
  try {
    await readFile(path.join(directory, "package.json"), "utf8");
    return directory;
  } catch {
    if (depth >= 3) return directory;
    const directories = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !["node_modules", ".next"].includes(entry.name));
    if (directories.length === 1) return findProjectRoot(path.join(directory, directories[0].name), depth + 1);
    return directory;
  }
}
