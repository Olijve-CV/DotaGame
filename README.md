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
