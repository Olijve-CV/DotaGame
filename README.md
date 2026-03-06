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

## RAG Configuration

Chat now uses a production-ready RAG pipeline with pluggable providers:

- Embedding: `OPENAI_API_KEY` + `OPENAI_EMBEDDING_MODEL` (fallback to local deterministic embedding)
- LLM: `OPENAI_API_KEY` + `OPENAI_CHAT_MODEL` (fallback to template answer generator)
- Provider URL: `OPENAI_BASE_URL` (OpenAI-compatible API base, default `https://api.openai.com/v1`)
- Vector Store: `VECTOR_STORE_PROVIDER=memory|qdrant`

Qdrant settings when `VECTOR_STORE_PROVIDER=qdrant`:

```bash
# PowerShell example
$env:VECTOR_STORE_PROVIDER="qdrant"
$env:QDRANT_URL="http://localhost:6333"
$env:QDRANT_COLLECTION="dota_knowledge"
$env:QDRANT_API_KEY=""
```

OpenAI settings:

```bash
# PowerShell example
$env:OPENAI_API_KEY="sk-..."
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
$env:OPENAI_CHAT_MODEL="gpt-4.1-mini"
```

For OpenAI-compatible providers, point `OPENAI_BASE_URL` to their API root
(for example, `https://your-provider.example.com/v1`).
