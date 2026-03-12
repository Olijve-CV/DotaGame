# Task Plan

## Goal
Implement a full MVP for Dota2 news + Agent Chat platform with separated web and API, bilingual support, auth, personalization, and extensible contracts for future mobile app.

## Phases
| Phase | Status | Notes |
|---|---|---|
| 1. Scaffold monorepo and shared contracts | complete | Workspace, shared package, root scripts ready |
| 2. Build API services (content/auth/chat) | complete | Content/auth/chat routes + tests done |
| 3. Build web UI (news/chat/profile) | complete | News/Chat/Profile/Login pages done |
| 4. Validate with tests and docs | complete | Build + test passed at workspace level |
| 5. Refine auth UX (login/register interactions) | complete | Added client-side validation, loading feedback, redirect flow, and a dedicated responsive auth layout |
| 6. Add hero avatar selection flow | complete | Added roster-based avatars, random default assignment, profile avatar updates, and shared avatar rendering |
| 7. Add Dota2 introduction module | complete | Added a bilingual home-page module with gameplay flow, hero roles, skill systems, and a paginated API-backed hero atlas with full skill breakdowns |
| 8. Research Dota2 domain and document it | complete | Added a repository research note covering game loop, roles, systems, user segments, and product implications |
| 9. Expand Dota2 onboarding docs and `/intro` experience | complete | Added a Chinese beginner guide, a content taxonomy note, and a stronger intro landing section above the existing hero atlas; verified with web build |
| 10. Replace one-shot chat with multi-agent runtime | complete | Added OpenCode-inspired thread/run/tool/approval flow with orchestrator/researcher/coach runtime, live search gating, and a new agent workspace UI |
| 11. Rework agent chat into session tree runtime | complete | Replaced thread/run timeline with root session + Task-spawned child sessions, session tree navigation, and child-session tool execution closer to OpenCode |
| 12. Add resumable SSE agent execution controls | complete | Added in-memory execution state, iterative replanning, abort/resume/retry controls, and root-session SSE control handling |
| 13. Simplify backend agent loop to OpenCode-style single-session execution | complete | Replaced planner/subagent loop with a single assistant/tool/result loop modeled after anomalyco/opencode; removed coach/research runtime from the active backend path and updated tests accordingly |
| 14. Rework agent UX from step timeline to thinking-first runtime | complete | Removed step/task message parts, collapsed each turn into one assistant message with thinking + tool activity + final result, and updated the web chat surface to present modern agent behavior |
| 15. Research 2026 agent patterns and optimize runtime + frontend | complete | Added research-backed runtime/session metadata, tool execution timing + duplicate-call reuse, a redesigned chat workspace, new tests, and a design note |
| 16. Clear TODO backlog item-by-item | complete | Completed all TODO items sequentially with validation and incremental commits, including intro relayout and timed homepage refresh |
| 17. Persist auth/account data in a database | complete | Replaced in-memory account + agent stores with a DB-backed layer supporting local SQLite and production PostgreSQL through environment config |
| 18. Persist source-backed hero and content data in a database | complete | Added DB-backed source tables and sync-state tracking so hero/avatar, news, patch-note, and tournament endpoints now sync into DB and read from DB as primary |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| `npm install` timed out at 120s | 1 | Install actually completed; verified by subsequent build/test |
| Web build TS6059 rootDir error | 1 | Removed restrictive `rootDir` from `apps/web/tsconfig.json` |
| Web build TS2835 extension error | 1 | Switched web tsconfig to `moduleResolution: Bundler` |
| Async DB migration briefly broke auth follow-up requests in tests | 1 | Added missing `await` to the register -> login handoff and re-ran API/workspace validation |
