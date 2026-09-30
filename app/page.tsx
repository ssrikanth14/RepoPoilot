"use client";

import { ChangeEvent, useState } from "react";

type Finding = { title: string; detail: string; severity: "high" | "medium" | "low" };
type Analysis = { score: number; files: number; check: string; findings: Finding[]; improvements: string[] };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [repositoryName, setRepositoryName] = useState("");
  const [message, setMessage] = useState("Upload a ZIP file to begin.");
  const [busy, setBusy] = useState(false);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setAnalysis(null);
    setMessage(event.target.files?.[0] ? "Ready to analyze." : "Upload a ZIP file to begin.");
  }

  async function uploadAndAnalyze() {
    if (!file) return;
    setBusy(true);
    setMessage("Uploading and analyzing your project…");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await fetch("/api/upload", { method: "POST", body: formData });
      const upload = await uploadResult.json() as { projectId?: string; name?: string; error?: string };
      if (!uploadResult.ok || !upload.projectId) throw new Error(upload.error ?? "Upload failed");
      setProjectId(upload.projectId);
      setProjectName(upload.name ?? file.name.replace(/\.zip$/i, ""));
      const analysisResult = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: upload.projectId }) });
      const result = await analysisResult.json() as Analysis & { error?: string };
      if (!analysisResult.ok) throw new Error(result.error ?? "Analysis failed");
      setAnalysis(result);
      setRepositoryName(upload.name?.replace(/[^a-zA-Z0-9._-]/g, "-") ?? "my-project");
      setMessage("Analysis complete. Review the feedback below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function publishProject() {
    if (!projectId || !repositoryName.trim()) return;
    setBusy(true);
    setMessage("Creating the GitHub repository and pushing your project…");
    try {
      const result = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json", "x-repopilot-approval": "approved" }, body: JSON.stringify({ projectId, repositoryName, approved: true }) });
      const data = await result.json() as { url?: string; error?: string };
      if (!result.ok) throw new Error(data.error ?? "Publish failed");
      setMessage(`Published successfully: ${data.url}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="simple-shell">
      <header className="simple-header"><div className="simple-brand"><span>⌁</span> RepoPilot</div><span className="simple-tag">PROJECT FEEDBACK</span></header>
      <section className="hero"><p className="eyebrow">YOUR CODE, REVIEWED</p><h1>Upload your project.<br /><em>Get a clear path forward.</em></h1><p className="hero-copy">RepoPilot checks your code, explains the biggest problems, and helps you publish the improved project to GitHub.</p></section>
      <section className="steps"><div className={`step ${file ? "done" : "active"}`}><b>01</b><span>Upload</span></div><div className={`step ${analysis ? "done" : ""}`}><b>02</b><span>Review feedback</span></div><div className="step"><b>03</b><span>Publish</span></div></section>
      <section className="workspace-card">
        <div className="upload-area"><input id="project-file" type="file" accept=".zip,application/zip" onChange={chooseFile} /><label htmlFor="project-file"><span className="upload-icon">↑</span><strong>{file ? file.name : "Choose your project ZIP"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : "Maximum 25 MB"}</small></label><button className="primary-button" type="button" disabled={!file || busy} onClick={uploadAndAnalyze}>{busy ? "Working…" : analysis ? "Analyze again" : "Analyze project"}<span>→</span></button></div>
        {analysis && <div className="feedback"><div className="feedback-header"><div><p className="eyebrow">FEEDBACK FOR {projectName.toUpperCase()}</p><h2>Your project report</h2></div><div className="score"><strong>{analysis.score}</strong><span>/100</span></div></div><div className="report-meta"><span>{analysis.files} source files reviewed</span><span className={analysis.check.includes("failed") ? "bad" : "good"}>{analysis.check}</span></div><div className="feedback-grid"><div><h3>Problems to review</h3>{analysis.findings.length ? analysis.findings.map((finding) => <article className="finding" key={finding.title}><span className={`severity ${finding.severity}`} /> <div><strong>{finding.title}</strong><p>{finding.detail}</p></div></article>) : <p className="empty-copy">No obvious problems found in the first pass.</p>}</div><div><h3>Suggested improvements</h3>{analysis.improvements.map((improvement) => <p className="improvement" key={improvement}>+ {improvement}</p>)}</div></div></div>}
        {analysis && <div className="publish"><div><p className="eyebrow">READY TO SHIP?</p><h2>Push this project to GitHub</h2><p>RepoPilot will create a repository, commit the uploaded files, and push the main branch.</p></div><div className="publish-form"><input value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} placeholder="repository-name" aria-label="GitHub repository name" /><button className="primary-button" type="button" disabled={!repositoryName.trim() || busy} onClick={publishProject}>{busy ? "Publishing…" : "Publish to GitHub"}<span>↗</span></button></div></div>}
      </section>
      <p className="status-message">{message}</p><p className="privacy-note">Your ZIP is analyzed in this local workspace. Secrets such as `.env` files are excluded before publishing.</p>
    </main>
  );
}
