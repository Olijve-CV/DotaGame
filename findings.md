# Findings

## 2026-03-06
- Repository initially contained only README.md.
- User approved plan: dual-core MVP (news + chat), bilingual, separated frontend/backend, RN-ready API contracts.
- Required skills loaded: brainstorming (already used), planning-with-files, frontend-design.
- Implemented monorepo with `apps/web`, `apps/api`, and `packages/contracts`.
- API implemented with v1 endpoints for content, auth, user personalization, and chat response with citations.
- Web implemented with bilingual pages: Home, Agent Chat, Login/Register, Profile.
- API tests pass and full workspace build passes after tsconfig fixes.
- Added live source adapters with cache:
  - Steam News API for official announcements and patch notes.
  - OpenDota Pro Matches API for recent tournament aggregation.
- Added `USE_LIVE_SOURCES=false` switch for deterministic local fallback mode.
- Upgraded chat to pluggable RAG architecture:
  - Embedding provider: OpenAI with deterministic fallback.
  - Vector store provider: Qdrant or in-memory.
  - LLM answer provider: OpenAI JSON output with fallback template generator.
- Added index lifecycle with TTL refresh and language-scoped retrieval.
- Added provider base URL compatibility via `OPENAI_BASE_URL` for both embedding and chat endpoints.
