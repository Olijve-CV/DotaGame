# Repository Guidelines

## Project Structure & Module Organization
This repository is an npm workspace monorepo.

- `apps/web`: React 18 + Vite frontend. Main entry points live in `src/`, with page components under `src/pages` and shared browser helpers under `src/lib`.
- `apps/api`: Express + TypeScript backend. Routes live in `src/routes`, business logic in `src/services`, static fallback content in `src/data`, and tests in `src/tests`.
- `packages/contracts`: shared TypeScript types consumed by both apps.
- `docs/plans`: design notes and implementation plans.

Keep new code inside the owning workspace. Cross-app DTOs and shared enums belong in `packages/contracts/src`.

## Build, Test, and Development Commands
- `npm install`: install all workspace dependencies.
- `npm run dev`: start all available workspace dev servers. The API serves `http://localhost:4000`; the web app runs on `http://localhost:5173`.
- `npm run build`: type-check and build every workspace.
- `npm test`: run workspace tests. Today this executes Vitest in `apps/api`; `web` and `contracts` currently print placeholder messages.
- `npm run dev --workspace @dotagame/api`: run only the backend.
- `npm run dev --workspace @dotagame/web`: run only the frontend.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode enabled via `tsconfig.base.json`. Follow the existing style:

- 2-space indentation, semicolons, and double quotes.
- `PascalCase` for React components and exported types.
- `camelCase` for functions, variables, and hooks.
- Descriptive file names by responsibility, such as `chatRoutes.ts`, `contentService.ts`, and `inMemoryStore.ts`.

No ESLint or Prettier config is checked in, so match the surrounding file style exactly.

## Testing Guidelines
Backend tests use Vitest with Supertest in `apps/api/src/tests`. Name tests `*.test.ts` and cover route behavior, status codes, and response shapes. Run `npm test` before opening a PR. If you add frontend or contracts tests, wire them into each workspace’s `test` script instead of relying on ad hoc commands.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit prefixes such as `feat:`. Keep commits short, imperative, and scoped when useful, for example `feat(api): add qdrant provider`.

PRs should include:

- a brief summary of behavior or API changes,
- linked issues or design docs when relevant,
- test evidence (`npm test`, `npm run build`),
- screenshots for visible `apps/web` changes,
- notes for new environment variables such as `OPENAI_API_KEY` or `QDRANT_URL`.

## Configuration Tips
Prefer environment variables over hard-coded secrets. Document new config in `README.md`, and provide safe local fallbacks where possible for live-source or RAG integrations.
