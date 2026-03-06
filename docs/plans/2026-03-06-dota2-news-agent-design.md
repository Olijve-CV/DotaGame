# Dota2 News + Agent Chat Design

## Goal
Deliver a bilingual (Chinese + English) Dota2 platform with two first-class capabilities:

- News hub: tournaments, patch notes, and onboarding guides
- Agent Chat: quick Q&A and lightweight coaching guidance

The architecture is web-first with API contracts reusable by future React Native clients.

## Architecture

- Frontend (`apps/web`): React + Vite SPA
- Backend (`apps/api`): Express REST API
- Shared contracts (`packages/contracts`): API interface and domain types

The system is designed as service-oriented modules inside the API:

- `content`: list/filter/query news-like resources
- `chat`: RAG-style retrieval + answer generation with citations
- `user`: auth, favorites, chat history

## Data and Contracts

Primary data entities:

- `Article` (category, title, source, language, tags)
- `PatchNote` (versioned updates)
- `Tournament` (region, timeline, status)
- `ChatSessionRecord`, `FavoriteRecord`, `UserProfile`

Public chat contract (`v1`) includes:

- Input: `question`, `mode`, `language`, optional player context
- Output: `answer`, `citations`, `confidence`, `followUps`

Contract expansion is additive to preserve compatibility for future mobile clients.

## Delivery Notes

- Start with curated in-memory data sources (official + whitelist simulation)
- Keep source attribution visible in content cards and chat citations
- Persist user-facing behavior through API-level tests
