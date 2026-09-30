"use client";

import { FormEvent, useState } from "react";

type Repository = { name: string; branch: string; files: number };
type Message = { role: "agent" | "user"; content: string; time: string };

const repositories: Repository[] = [
  { name: "repopilot", branch: "main", files: 42 },
  { name: "atlas-dashboard", branch: "feat/filters", files: 87 },
  { name: "orbit-api", branch: "develop", files: 31 },
];

const initialMessages: Message[] = [
  { role: "agent", content: "I mapped repopilot and found a focused Next.js surface with 42 files. The app is healthy, but the agent runtime and approval layer still need to be wired. What should we investigate first?", time: "09:41" },
  { role: "user", content: "Give me a quick quality read before we start building.", time: "09:42" },
  { role: "agent", content: "Current score: 72/100. The foundation is clean and modern. I’m weighting completeness lower because there are no tests, persistence, or tool adapters yet. I can turn those gaps into an implementation plan.", time: "09:42" },
];

const activity = [["✓", "Project indexed", "42 files · 1.8s"], ["✓", "Runtime dependencies mapped", "next@16 · react@19"], ["◌", "Quality scan", "Waiting for approval"]];

export default function Home() {
  const [selectedRepository, setSelectedRepository] = useState(repositories[0]);
  const [messages, setMessages] = useState(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [activeView, setActiveView] = useState("Overview");
  const [isScanning, setIsScanning] = useState(false);
  const [changeState, setChangeState] = useState("Needs review");

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    setPrompt("");
    setMessages((current) => [...current, { role: "user", content: trimmedPrompt, time: "now" }, { role: "agent", content: "Inspecting the workspace and choosing the next tool…", time: "now" }]);
    try {
      const result = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: trimmedPrompt }) });
      const data = await result.json() as { summary?: string; steps?: string[]; evidence?: string[]; error?: string };
      const response = data.error ? data.error : `${data.summary}\n\n${data.steps?.join(" → ")}\n\nEvidence: ${data.evidence?.join(" · ")}`;
      setMessages((current) => [...current.slice(0, -1), { role: "agent", content: response, time: "now" }]);
    } catch {
      setMessages((current) => [...current.slice(0, -1), { role: "agent", content: "The local agent endpoint could not be reached. Check that the Next.js server is running.", time: "now" }]);
    }
  }

  function runScan() {
    setIsScanning(true);
    window.setTimeout(() => setIsScanning(false), 1800);
  }

  return (
    <main className="app-shell">
        <aside className="sidebar">
        <div className="brand"><span className="brand-mark">⌁</span><span>RepoPilot</span><span className="beta">BETA</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="repo-switcher" type="button" onClick={() => setSelectedRepository(repositories[(repositories.indexOf(selectedRepository) + 1) % repositories.length])}><span className="repo-icon">⌘</span><span className="repo-name">{selectedRepository.name}<small>local workspace</small></span><span className="chevron">⌄</span></button>
        <nav className="main-nav" aria-label="Workspace navigation">{[["◈", "Overview"], ["◫", "Code explorer"], ["⌁", "Agent runs"], ["◒", "Git & GitHub"]].map(([icon, label]) => <button key={label} className={`nav-item ${activeView === label ? "active" : ""}`} type="button" onClick={() => setActiveView(label)}><span>{icon}</span>{label}</button>)}</nav>
        <div className="sidebar-bottom"><div className="workspace-label">RECENT PROJECTS</div>{repositories.map((repository) => <button key={repository.name} className="recent-project" type="button" onClick={() => setSelectedRepository(repository)}><span className="project-dot" />{repository.name}<span className="project-branch">{repository.branch}</span></button>)}<button className="settings-link" type="button"><span>⚙</span>Settings</button><div className="profile"><span className="avatar">SS</span><span><strong>Srikanth</strong><small>Local developer</small></span><span className="more">•••</span></div></div>
        </aside>

        <section className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{selectedRepository.name}</strong></div><div className="top-actions"><span className="connection"><i /> Local connected</span><button className="icon-button" type="button" aria-label="Notifications">♢<sup>2</sup></button><button className="share-button" type="button">↗ Share</button></div></header>
        <div className="content-scroll">
          <div className="page-heading"><div><p className="eyebrow">PROJECT OVERVIEW</p><h1>{activeView}</h1><p className="muted">Understand, improve, and ship with an agent that works alongside your code.</p></div><button className="scan-button" type="button" onClick={runScan}>{isScanning ? <><span className="spinner" />Scanning…</> : <>Run quality scan <span>→</span></>}</button></div>
          <div className="stats-grid"><div className="stat-card score-card"><div className="stat-top"><span>PROJECT SCORE</span><span className="info">i</span></div><div className="score-row"><strong>72</strong><span>/100</span><div className="score-ring"><span>72</span></div></div><p><span className="trend">↗ 8%</span> since last analysis</p></div><div className="stat-card"><div className="stat-top"><span>FILES INDEXED</span><span className="stat-icon">⌗</span></div><strong className="big-stat">{selectedRepository.files}</strong><p className="muted">Across 6 directories</p></div><div className="stat-card"><div className="stat-top"><span>OPEN FINDINGS</span><span className="stat-icon warning">!</span></div><strong className="big-stat">04</strong><p className="muted"><span className="warning-text">2 medium</span> · 2 low priority</p></div><div className="stat-card"><div className="stat-top"><span>ACTIVE BRANCH</span><span className="stat-icon">⑂</span></div><strong className="branch-stat">{selectedRepository.branch}</strong><p className="muted">Synced just now</p></div></div>
          <div className="work-grid"><section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">AGENT ACTIVITY</p><h2>Analysis trail</h2></div><span className="live-badge"><i /> Live</span></div><div className="timeline">{activity.map(([icon, title, detail, status], index) => <div className={`timeline-item ${status}`} key={title}><span className="timeline-icon">{isScanning && index === 2 ? <span className="spinner dark" /> : icon}</span><div><strong>{isScanning && index === 2 ? "Running quality scan" : title}</strong><p>{isScanning && index === 2 ? "Checking lint, tests, and build scripts" : detail}</p></div><span className="timeline-time">{index === 0 ? "09:40" : index === 1 ? "09:41" : "now"}</span></div>)}</div><div className="next-action"><span className="action-icon">✦</span><div><strong>Next best action</strong><p>Run the quality scan to surface actionable findings.</p></div><button type="button" onClick={runScan}>Start <span>→</span></button></div></section>
            <section className="panel change-panel"><div className="panel-heading"><div><p className="eyebrow">PROPOSED CHANGE</p><h2>Agent plan</h2></div><span className={`status-pill ${changeState}`}>{changeState === "pending" ? "Needs review" : changeState}</span></div><div className="change-body"><div className="change-title"><span className="file-icon">TS</span><div><strong>Add runtime tool contract</strong><p>agent/tools/types.ts</p></div></div><p className="change-description">Define a typed boundary for repository inspection, checks, and file edits so every action can be reviewed before execution.</p><div className="diff-preview"><div><span className="removed">−</span><code>type Tool = unknown</code></div><div><span className="added">+</span><code>type Tool = RepositoryTool</code></div></div><div className="change-actions"><button className="reject-button" type="button" onClick={() => setChangeState("rejected")}>Reject</button><button className="approve-button" type="button" onClick={() => setChangeState("approved")}>{changeState === "approved" ? "Approved" : "Approve change"} <span>→</span></button></div></div></section></div>
          <section className="chat-panel panel"><div className="panel-heading chat-heading"><div><p className="eyebrow">REPO PILOT AGENT</p><h2>Ask about your project</h2></div><span className="model-label"><span className="model-dot" /> Claude Sonnet <span>⌄</span></span></div><div className="messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.time}-${index}`}><span className="message-avatar">{message.role === "agent" ? "⌁" : "SS"}</span><div className="message-content"><div className="message-meta"><strong>{message.role === "agent" ? "RepoPilot" : "You"}</strong><span>{message.time}</span></div><p>{message.content}</p></div></div>)}</div><form className="prompt-form" onSubmit={submitPrompt}><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask RepoPilot to inspect, explain, or improve your code…" aria-label="Ask RepoPilot" /><button type="submit" aria-label="Send prompt">↑</button></form><div className="prompt-hints"><span>Try asking</span><button type="button" onClick={() => setPrompt("Find the highest-risk bugs in this project")}>Find the highest-risk bugs</button><button type="button" onClick={() => setPrompt("Explain the architecture")}>Explain the architecture</button><button type="button" onClick={() => setPrompt("What should we build next?")}>What should we build next?</button></div></section>
        </div>
        </section>
    </main>
  );
}
