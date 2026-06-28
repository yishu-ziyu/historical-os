# HistoricalRuntime v0.1-v0.2 implementation todo

Started: 2026-05-19 12:05 CST

## Plan

- [x] Add runtime contract tests for fallback and high-risk HistoryGuard behavior.
- [x] Stabilize `server.mjs` runtime structure, fallback path, HistoryGuard flags, audit events, and artifact normalization.
- [x] Add frontend Artifact and audit display without turning the app into chat UI.
- [x] Replace model-text `innerHTML` rendering with DOM/text rendering.
- [x] Verify syntax, API shape, browser behavior, and update handoff/log docs.

## Review

- Implemented HistoricalRuntime v0.1-v0.2 in `artifacts/web_story_loop_demo`.
- Added Node test coverage for high-risk fallback runtime shape and frontend artifact/audit contract.
- Verified with `node --check`, `node --test`, API shape call against `PORT=8893`, and Chrome manual flow.
- `PORT=8892` was occupied during verification, so live browser/API acceptance used `http://127.0.0.1:8893/`.
- Current local model call returned a provider-side 400 (`Instructions are required`), so browser verification exercised the required fallback path rather than a successful model completion.

## MiniMax Token Plan follow-up

Started: 2026-05-19 12:36 CST

- [x] Add a failing contract test for MiniMax Token Plan through the official Anthropic-compatible `/v1/messages` endpoint shape.
- [x] Add provider selection while preserving the existing Anthropic Messages API fallback path.
- [x] Default MiniMax Token Plan base URL to `https://api.minimaxi.com/anthropic` when the provider is MiniMax and no explicit base URL is supplied.
- [x] Keep OpenAI-compatible `/chat/completions` support behind `MINIMAX_API_FORMAT=openai`.
- [x] Verify both MiniMax paths with local fake model servers and run the HistoricalRuntime test suite.

## MiniMax Review

- `HISTORICAL_RUNTIME_MODEL_PROVIDER=minimax` or a non-empty `MINIMAX_API_KEY` switches model calls to MiniMax Token Plan.
- The default MiniMax Token Plan path follows the official quick-start docs: Anthropic-compatible messages at `/v1/messages`.
- Supported env keys: `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`; Token Plan aliases: `TOKEN_PLAN_API_KEY`, `TOKEN_PLAN_BASE_URL`, `TOKEN_PLAN_MODEL`.
- OpenAI-compatible chat completions can still be used explicitly with `MINIMAX_API_FORMAT=openai`.
- `process.env` overrides `~/.claude/settings.json` values, and blank values are treated as missing.
- Verification used a local fake Token Plan server, not a real Token Plan key.

## HistoricalRuntime v0.3 Agent Runtime spec

Started: 2026-05-20 CST

- [x] Run architecture grill/deep-interview for Agent-first HistoricalRuntime decisions.
- [x] Confirm AgentRun, Runtime driver, fixed task graph, structured inter-Agent communication, HistoryGuard gatekeeping, and commit semantics.
- [x] Confirm HistoricalCase as the long-lived growing game/world object.
- [x] Confirm async Job + dual-layer progress events based on `agent-progress-visibility-panel`.
- [x] Write `tasks/historical_runtime_v0.3_agent_runtime_spec.md`.
- [x] Update project TODO, handoff, and log.

## v0.3 Spec Review

- v0.3 should introduce `HistoricalCase`, `PlayerAction`, `CandidateNode`, explicit commit semantics, and async Job progress APIs.
- Job stages are fixed as `queued`, `story_weaving`, `history_review`, `briefing`, `artifact_generation`, `commit_review`, `complete`, and `failed`.
- Frontstage event copy uses Historical OS department/channel language; technical Agent names remain in `technicalEvents` and metadata.
- `/api/generate` remains as compatibility/test entry; new frontend generation should prefer `POST /api/generate/start` plus `GET /api/jobs/{jobId}`.

## HistoricalRuntime v0.3 async job/progress implementation

Started: 2026-05-20 CST

- [x] Add backend contract coverage for async Job start/status flow and dual-layer progress events.
- [x] Implement `POST /api/generate/start` and `GET /api/jobs/{jobId}`.
- [x] Emit stable Historical OS stages from the runtime pipeline.
- [x] Add frontend Agent Runtime progress panel with frontstage department copy and collapsible technical events.
- [x] Add model request timeout so slow MiniMax/Anthropic-compatible calls fall back instead of freezing the UI.
- [x] Verify syntax, automated tests, and Chrome manual click flow.

## v0.3 async job/progress Review

- `POST /api/generate/start` now creates a `job-*` record and returns `statusUrl`.
- `GET /api/jobs/{jobId}` returns `status`, `stage`, `events`, `technicalEvents`, `result`, and error metadata.
- The UI now shows `Agent Runtime` progress during story generation: `叙事分析组`, `历史审计频道`, `情报值班台`, `档案组`, `值班系统`.
- Raw Agent names remain available in technical details for debugging, while student-facing progress copy uses product-language departments.
- `MODEL_REQUEST_TIMEOUT_MS` controls model-call timeout; default is `12000`.
- Verified with `node --check`, `node --test`, and a Chrome manual flow on `http://127.0.0.1:8895/`.
