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
- Current auth flow is implemented in a single `LoginPage`, but it is missing form semantics, client-side validation, pending-state feedback, post-auth redirect behavior, and a stronger layout hierarchy.
- Existing auth API contracts are sufficient for the refinement: login requires `email` + `password`; register accepts `email` + `password` + optional `name`, and the backend already falls back to the email prefix if `name` is omitted.
- The chosen approach kept login and registration in one page to minimize routing churn while still improving UX through a split layout, form semantics, inline validation, translated error mapping, and an automatic redirect to `/profile` after successful auth.
- Hero avatars now use a shared `avatar` object on `UserProfile` instead of an implicit initial. The API fetches hero choices from OpenDota constants, normalizes them to Valve CDN portrait URLs, and falls back to a small local hero set if the live catalog is unavailable.
- Registration accepts an optional `avatarHeroId`; when it is omitted, the backend assigns a random hero avatar. Profile updates can also pass `null` to re-randomize the avatar.
- The home page can accept non-API editorial modules cleanly; a self-contained React component with locale-scoped copy was enough to add a substantial Dota2 knowledge section without touching contracts or backend routes.
- The new Dota2 introduction module is best placed directly under the content filters on `HomePage`, where it works as an onboarding explainer before users browse news, patch notes, and tournaments.
- The existing `/hero-avatars` API is reusable beyond account setup. It can provide reliable hero portraits for editorial UI modules on the home page, with local CDN fallback URLs covering curated hero cards if the fetch fails.
- A curated six-hero atlas is a better fit than a full roster on the home page: it keeps the page readable while still giving users concrete examples of carry, mid, offlane, and support archetypes.
- Splitting the Dota introduction content into `DotaIntroSection.tsx` and `DotaIntroData.ts` is a better maintenance boundary now that the atlas contains a larger bilingual hero data set.
- Paginating the curated roster at six heroes per page keeps the home page dense but still readable, while role filters naturally collapse many views to a single page without extra UI complexity.
- The Dota2 introduction module works better as its own route than as an embedded home-page section. It now fits the product IA more cleanly alongside news and chat as a peer-level navigation item.

## 2026-03-07
- A repository-level Dota 2 research document is warranted now that the product already includes news, chat, and a standalone introduction route. The codebase needs a shared domain reference, not just UI copy.
- The most durable way to describe Dota 2 for product planning is through match loop, map systems, economy, draft, and role language, rather than through hero trivia.
- OpenDota's public `heroStats` endpoint returned 127 heroes during this research pass on 2026-03-07.
- Official Dota 2 pages for `home`, `heroes`, `The New Frontiers`, and `Wandering Waters` were reachable during this research pass, which is sufficient to ground stable game/system descriptions and recent-overhaul references.
- For this project, Dota 2 knowledge should be split into two buckets: evergreen knowledge (rules, roles, map, systems, glossary) and time-sensitive knowledge (patch, meta, tournament, roster). This is the right boundary for both content modeling and agent-answer sourcing.
- The current `/intro` route is too thin as a true onboarding surface. It works better as a layered page: top half for newcomer mental models and question prompts, lower half for the existing hero atlas and role examples.
- A field-manual style onboarding page fits the repo's warm editorial visual language better than a generic dashboard layout.
- Two follow-up docs now make sense alongside the initial domain research note: one Chinese new-player guide for content reuse, and one product-facing taxonomy/data-model note for API and RAG planning.
