# DotaGame

A bilingual Dota2 platform featuring:

- News aggregation (tournaments, patch notes, game guides)
- Agent Chat for Dota2 Q&A and learning guidance
- Account features (favorites, reading history, chat history)
- API contracts designed for future React Native clients

## Monorepo Layout

- `apps/web`: React + Vite frontend
- `apps/api`: Express API backend
- `packages/contracts`: shared TypeScript contracts

## Quick Start

```bash
npm install
npm run dev
```

The API runs on `http://localhost:4000` and web runs on `http://localhost:5173`.

## Live Data Sources

API `v1` now loads live data (with 5-minute cache) from:

- Steam News API (official Dota2 announcements and patch notes)
- OpenDota Pro Matches API (recent tournament activity aggregation)

To disable live sources and use local fallback data only:

```bash
# PowerShell
$env:USE_LIVE_SOURCES="false"
npm run dev
```
