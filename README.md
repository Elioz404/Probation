# Probation

**You would not hand a new hire the company card on day one. Why hand it to an agent?**

Probation is an agent that earns its autonomy. Point it at a GitHub repository and it sits an exam on the issues your maintainers already closed. Code grades every answer against what really happened, and the results paint a trust map: for each kind of decision and each kind of issue, may the agent only suggest, must it ask, or can it act alone?

The agent argues for promotion. You sign. The moment you overrule it, it loses the level.

## How it works

1. **The exam.** Closed issues are sampled per outcome. The agent sees each one as it looked when opened. The real outcome is the answer key, and it stays out of reach of every tool the agent has.
2. **The trust map.** Decisions are graded per action (accept, close as duplicate, close as not planned, apply labels) and per context (reporter familiarity, report detail). Cells show raw accuracy, but levels are earned on a conservative lower bound, so a perfect score over three issues earns nothing.
3. **The replay.** Move the bar for any action and see, per 100 past issues, what the agent would have solved alone, got wrong with nobody watching, and asked you about.
4. **The promotion.** The agent files a request with its argument. The numbers are attached by code, and a request the evidence cannot support is refused before you see it.
5. **The job.** On a repository you choose, the map governs real calls: Solo acts, Ask waits for your approval of that exact call, Observe stays a suggestion.
6. **The correction.** Overrule it and the cell drops a level immediately, the case joins the exam with extra weight, and a wrongly closed issue is reopened.

## One gate for every surface

Autonomy is enforced in the action itself, so it holds wherever the call comes from: the in-app agent, MCP, A2A, HTTP or the CLI.

```ts
export default defineAction({
  needsApproval: async ({ probationId, workItemId }) => {
    const probation = await loadReadableProbation(probationId);
    const { level } = await loadProposedWork(probation.id, workItemId);
    return level === "ask";
  },
  // ...
});
```

Decisions reserved for people (signing a promotion, moving a bar, overruling) are `uiOnly`: no agent on any surface can reach them.

## Run it locally

Requires Node 22.22 or newer and pnpm. On Windows, use a path without spaces.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Set `AUTH_DISABLED=true` in `.env` to skip sign-in locally. Add an LLM key in Settings or through `ANTHROPIC_API_KEY`. To let the agent act on a repository, add a fine-grained GitHub token limited to that repository under Settings.

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
| `actions/`                  | The contract shared by UI, agent, HTTP, MCP, A2A and CLI   |
| `app/components/probation/` | The interface                                              |

## Security

- Exam repositories are read only, and writes use each user's own token through the credential store.
- Probations are private by default; every read and write checks row access.
- Issue text is treated as untrusted input and is never rendered as HTML.
- The agent has no SQL or web tools, so it cannot read the answer key or look an issue up.
- Every level change leaves a record.

## Built with

[Agent-Native](https://github.com/BuilderIO/agent-native) (MIT), starting from its Chat template. The domain model, actions, services and interface in this repository were written on top of that scaffold.
