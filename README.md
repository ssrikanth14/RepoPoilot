This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:
 # RepoPilot
 
RepoPilot is a focused project feedback tool built with Next.js, TypeScript, and the App Router. Upload a ZIP, receive a code-quality report with bugs and improvement ideas, then publish the project to GitHub when it is ready.
 
 ## Run locally
 
 ```bash
 npm install
 copy .env.example .env.local
 npm run dev
 ```
 
Open `http://localhost:3000`. Port `3001` is used automatically when `3000` is busy.
 
The app works without credentials using its local analyzer. Add `GITHUB_TOKEN` and `GITHUB_OWNER` to enable publishing uploaded projects. Add `OPENAI_API_KEY` only if you want optional model reasoning in the legacy agent route.
 
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
| `POST /api/upload` | Safely extract a ZIP project into the local workspace. |
| `POST /api/analyze` | Review source files, run an available check, and return findings and improvements. |
| `POST /api/publish` | Create a GitHub repository, commit the uploaded project, and push `main`. |

The lower-level `/api/agent`, `/api/project`, `/api/changes`, `/api/git`, and `/api/github` routes remain available for advanced integrations.
 
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
