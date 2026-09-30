import path from "node:path";
import { mkdir } from "node:fs/promises";

export const uploadsRoot = path.join(process.cwd(), "uploads");

export async function ensureUploadsRoot() {
  await mkdir(uploadsRoot, { recursive: true });
}

export function projectDirectory(projectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Invalid project id");
  return path.join(uploadsRoot, projectId);
}
