This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:
 # RepoPilot
 
 RepoPilot is a local-project AI coding assistant built with Next.js, TypeScript, and the App Router. It indexes a workspace, explains source files, runs declared checks, proposes changes, applies only explicitly approved mutations, and supports Git/GitHub workflows.
 
 ## Run locally
 
 ```bash
 npm install
 copy .env.example .env.local
 npm run dev
 ```
 
 Open `http://localhost:3000`. Port `3001` is used automatically when `3000` is busy.
 
 The app works without credentials using its local planner and project tools. Add `OPENAI_API_KEY` to enable model reasoning. Add `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPOSITORY` to enable repository creation and pull requests.
 
 ## Validation
 
 ```bash
 npm run lint
 npm run typecheck
 npm run build
 # or run all three
 npm run check
 ```
 
 ## Agent surfaces
 
 | Route | Purpose |
 | --- | --- |
 | `POST /api/agent` | Inspect the workspace, inspect Git, run lint/build/test, and optionally ask a model for reasoning. |
 | `GET /api/project` | Return an indexed, source-focused workspace tree. |
 | `POST /api/project` | Read one workspace file through a path-checked request. |
 | `POST /api/changes` | Apply a file change only with explicit approval headers. |
 | `POST /api/git` | Read status/diff or perform approved commit and push operations. |
 | `POST /api/github` | Perform approved repository creation and pull-request operations. |
 
 ## Safety boundaries
 
 - File mutations require both an approval payload and `x-repopilot-approval: approved`.
 - Git commits and pushes require the same approval contract.
 - Workspace file reads reject absolute paths and traversal outside the project.
 - GitHub credentials are read only on the server and are never sent to the browser.
 - The model is instructed not to claim edits unless a mutation tool has actually run.
 
 ## Architecture
 
 The dashboard is the client interaction layer. Route handlers under `app/api` are the local tool layer. The agent route gathers evidence and chooses checks before optional model reasoning; mutation, Git, and GitHub routes are separate approval boundaries so future model providers can call them without bypassing user control.
The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
