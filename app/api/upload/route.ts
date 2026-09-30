import AdmZip from "adm-zip";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ensureUploadsRoot, projectDirectory } from "@/lib/projects";

export const runtime = "nodejs";
const maxUploadBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let projectDirectoryPath = "";
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    if (!(uploadedFile instanceof File)) return NextResponse.json({ error: "Choose a ZIP file first" }, { status: 400 });
    if (!uploadedFile.name.toLowerCase().endsWith(".zip")) return NextResponse.json({ error: "Only .zip project files are supported" }, { status: 400 });
    if (uploadedFile.size > maxUploadBytes) return NextResponse.json({ error: "ZIP files must be smaller than 25 MB" }, { status: 413 });

    await ensureUploadsRoot();
    const projectId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    projectDirectoryPath = projectDirectory(projectId);
    await mkdir(projectDirectoryPath, { recursive: true });
    const zip = new AdmZip(Buffer.from(await uploadedFile.arrayBuffer()));
    for (const entry of zip.getEntries()) {
      const entryPath = path.normalize(entry.entryName);
      const targetPath = path.resolve(projectDirectoryPath, entryPath);
      if (entryPath.startsWith("..") || path.isAbsolute(entry.entryName) || !targetPath.startsWith(`${projectDirectoryPath}${path.sep}`)) throw new Error("The ZIP contains an unsafe path");
      if (!entry.isDirectory) {
        await mkdir(path.dirname(targetPath), { recursive: true });
        await import("node:fs/promises").then(({ writeFile }) => writeFile(targetPath, entry.getData()));
      }
    }
    return NextResponse.json({ projectId, name: uploadedFile.name.replace(/\.zip$/i, ""), files: zip.getEntries().filter((entry) => !entry.isDirectory).length });
  } catch (error) {
    if (projectDirectoryPath) await rm(projectDirectoryPath, { recursive: true, force: true });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project upload failed" }, { status: 400 });
  }
}
