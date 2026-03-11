# Agent Runtime Optimization Design

## Goal

Use current 2026 agent implementation patterns to tighten this repo's active agent runtime and make the web chat workspace feel closer to a production operator surface.

## Research Summary

Primary-source review across OpenAI, Anthropic, LangGraph, and Gemini points to the same practical pattern:

- one durable conversation/session
- one assistant turn that can interleave thinking and tool calls
- explicit tool policies instead of hidden heuristics
- traces and inspectable runtime state as first-class production needs
- human-readable tool provenance in the UI

That means this repo does not need to swing back to a heavier subagent tree as the default path. The current single-session loop is the correct base. The bigger gaps were session metadata, turn observability, duplicate tool churn, and frontend information hierarchy.

## Chosen Changes

### Backend

- Extend agent contracts with `insight` metadata on both session summary and detail responses.
- Derive session insight from message history:
  - latest user request
  - latest assistant answer preview
  - message count
  - assistant turn count
  - tool-call count
  - source count
  - active running tool
  - tool usage mix
- Extend `tool_call` parts with `startedAt`, `completedAt`, and `durationMs`.
- Stabilize session titles so they stay anchored to the first user prompt instead of changing every turn.
- Add same-turn tool result reuse keyed by normalized `tool + input` to suppress repeated identical calls.

### Frontend

- Rebuild the chat workspace around three layers:
  - session history rail
  - run overview panel
  - message feed with stronger activity/result/source separation
- Upgrade session cards to show:
  - latest user intent
  - message/tool/source counts
  - tool footprint chips
- Upgrade assistant turns to show:
  - thinking card
  - tool cards with duration and completion time
  - final answer block
  - deduplicated source strip

## Validation

- `npm test --workspace @dotagame/api`
- `npm run build`
