# CodeComply Build Spec

Multi-agent implementation guide for CodeComply. Each agent section is self-contained and can run in parallel where dependencies allow.

## Agent index

| Agent | Spec | Dependency |
|---|---|---|
| 1 — Supabase schema + auth | Completed in [PR #1](https://github.com/kiromoussa/CADAI/pull/1) | None |
| 2 — APS integration | [agent-2-aps.md](./agent-2-aps.md) | Agent 1 |
| 3 — Code database + Claude analysis | [agent-3-codes.md](./agent-3-codes.md) | None |
| 4 — Forge Viewer + overlays | Original prompt (Agent 4) | Agent 2 |
| 5 — Frontend UI | Original prompt (Agent 5) | Agents 1 + 3 |
| 6 — Types + wiring | Original prompt (Agent 6) | All |

## Research integrations (June 2025)

These updates supersede parts of the original build prompt:

| Finding | Agent | Doc |
|---|---|---|
| [aps-toolkit](https://github.com/chuongmep/aps-toolkit) for fast property extraction | Agent 2 | [agent-2-aps.md](./agent-2-aps.md) |
| IDS + IfcTester for machine-readable rules | Agent 3 | [agent-3-codes.md](./agent-3-codes.md) |
| ICC Code Connect API (license, don't scrape) | Agent 3 | [agent-3-codes.md](./agent-3-codes.md) |
| svf-utils / forge-convert-utils offline parsing | Agent 2 appendix | [appendix-offline-parsing.md](./appendix-offline-parsing.md) |

## Parallel execution order

```
Agent 1 ──┬──► Agent 2 ──► Agent 4
          │
Agent 3 ──┼──► Agent 5 ──► Agent 6
          │
          └── (Agent 3 parallel with 1, 2, 4)
```

## Original full prompt

The complete original multi-agent prompt is archived at upload time. Agent 4–6 sections remain unchanged from the original; refer to the uploaded `cursor_prompt_codecomply.md` for those sections until they are split into separate docs.
