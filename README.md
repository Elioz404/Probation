# Probation

**You would not hand a new hire the company card on day one. Why hand it to an agent?**

Probation is an agent that earns its autonomy. Point it at a GitHub repository and it sits an exam on issues that people on the project already closed. Code grades every answer against how each issue was really closed, and the results paint a trust map: for each kind of decision and each kind of issue, may the agent only suggest, must it ask, or can it act alone?

The agent argues for promotion. You sign. Each time you overrule it, the cell drops a level.

## How it works

1. **The exam.** Recent closed issues are sampled per outcome (completed, duplicate, not planned). Only project decisions count: an issue closed by a person other than its reporter. Bot closures and people closing their own issues are skipped, since they say nothing about how the project triages. The agent sees the issue's title and body, without labels, comments or outcome.
2. **The trust map.** Answers are graded per action (accept, close as duplicate, close as not planned, apply labels) and per context (reporter familiarity, report detail). Cells show raw accuracy, but levels are earned on a conservative lower bound, so a perfect score over three issues earns nothing.
3. **The replay.** Move the bar for any action and see an estimate, per 100 past issues, of what the agent would have solved alone, got wrong with nobody watching, and asked you about.
4. **The promotion.** The agent files a request with its argument. The numbers are attached by code, and a request the evidence cannot support is refused before you see it.
5. **The job.** On a repository you choose, the map governs real calls: Solo acts, Ask waits for your approval of that exact call, Observe stays a suggestion.
6. **The correction.** Overrule it and the cell drops a level immediately, the case joins the evidence with extra weight, and a wrongly closed issue is reopened.

## One gate for every surface

Autonomy is enforced in the action itself, so it holds wherever the call comes from.

```ts
export default defineAction({
  needsApproval: async ({ probationId, workItemId }, ctx) => {
    const probation = await loadReadableProbation(probationId);
    const { level } = await loadProposedWork(probation.id, workItemId);
    return requiresApproval(level, ctx?.caller);
  },
  // ...
});
```

Decisions reserved for people (signing a promotion, moving a bar, overruling) are `uiOnly`: they are absent from the agent's and MCP's tools and refused without the app UI's signed capability. The exam actions are not offered over MCP, because an external agent brings its own web tools and could not sit it blind.

## What the numbers do and do not mean

- **The answer key is a proxy.** A project's past decision is not always the right one, so a person can strike any case from the evidence.
- **Issue text is as it stands today.** GitHub does not return the original title and body, so edits made after opening are visible to the examinee. Reporter familiarity is also their association with the project now, not when they opened the issue.
- **Replay figures are estimates.** They come from a weighted sample of recent issues, not the repository's whole history, and are only as good as that sample.
- **The accept-everything baseline** is estimated the same way: closed issues per outcome, scaled by the share of sampled ones that were project decisions.

## Run it locally

Requires Node 22.22 or newer and pnpm. On Windows, use a path without spaces.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Set `AUTH_DISABLED=true` in `.env` to skip sign-in locally, and connect a model in Settings. Building an exam needs one GitHub API read per candidate issue, so add a GitHub token under Settings: a fine-grained token limited to your work repository, with Issues read and write, also lets the agent act on that repository. A deployment can set `GITHUB_PUBLIC_READ_TOKEN` for public data instead.

```bash
pnpm typecheck
pnpm test
```

## Architecture

| Path                        | Responsibility                                             |
| --------------------------- | ---------------------------------------------------------- |
| `shared/trust/`             | Pure domain rules: levels, statistics, grading, simulation |
| `server/github/`            | GitHub adapter and credential resolution                   |
| `server/services/`          | Application logic over Postgres                            |
| `actions/`                  | The contract shared by the UI, agent, HTTP, MCP and CLI    |
| `app/components/probation/` | The interface                                              |

## Security

- Exam repositories are read only, and writes use each user's own token through the credential store.
- Probations are private by default; every read and write checks row access.
- Issue text is treated as untrusted input and is never rendered as HTML.
- The in-app agent has no SQL, web or code-execution tools, so it cannot read the answer key or look an issue up.
- The "this is the app's UI" label is a plain header, so acting on an Observe cell over HTTP requires the UI's signed capability.
- Every level change leaves a record.

## Built with

[Agent-Native](https://github.com/BuilderIO/agent-native) (MIT), starting from its Chat template. The domain model, actions, services and interface in this repository were written on top of that scaffold.
