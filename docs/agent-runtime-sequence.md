# Agent Runtime Sequence

## Scope

This document describes the current agent runtime behavior in the repository as of March 10, 2026.

It reflects the implementation that exists today:

- A single root session
- A primary `orchestrator`
- Tool execution inside the same session
- SSE session-detail updates to the frontend

It does not describe a future multi-subagent architecture.

## Current Runtime Summary

The current agent flow is not a true multi-agent workflow.

The runtime behaves like this:

1. The frontend creates or reuses one root session.
2. The user sends a message to that root session.
3. The backend stores the user message and marks the session as `running`.
4. The backend asynchronously starts an orchestrator loop.
5. The orchestrator either answers directly or issues tool calls.
6. Tool results are written back into the same assistant message as structured `tool_call` parts.
7. The backend publishes full session snapshots through SSE.
8. The frontend replaces local session detail state with each new snapshot.

## End-to-End Sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant W as Web ChatPage
    participant A as API agentRoutes
    participant R as agentRuntimeService
    participant S as agentStore
    participant E as agentEventBus/SSE
    participant O as OpenAI Chat
    participant T as Agent Tools
    participant K as knowledge_search
    participant D as dota_live_search
    participant G as web_search

    U->>W: Enter message and submit

    alt No root session exists yet
        W->>A: POST /api/v1/agent/sessions
        A->>R: createSession()
        R->>S: createAgentSession(primary, orchestrator)
        S-->>R: session
        R-->>A: session
        A-->>W: 201 session
        W->>A: GET /api/v1/agent/sessions/:id
        A->>R: getSessionDetail()
        R->>S: buildAgentSessionDetail()
        S-->>R: detail
        R-->>A: detail
        A-->>W: session detail
    end

    W->>E: EventSource /agent/sessions/:id/events
    E->>W: session.detail(current snapshot)

    W->>A: POST /api/v1/agent/sessions/:id/messages
    A->>R: sendMessageToSession()

    R->>S: Validate session / not busy / primary only
    R->>S: Update session status = running
    R->>S: Add user message
    R->>E: publishRoot(session.detail)
    E-->>W: session.detail(user message stored)

    R->>R: startSessionTurn() asynchronously
    R-->>A: 202 Accepted + current detail
    A-->>W: current detail

    loop step 1..N (default max 6)
        R->>S: Add assistant message(step_start)
        R->>E: publishRoot(session.detail)
        E-->>W: session.detail(step_start)

        R->>R: buildConversationSeed()

        alt OpenAI available
            R->>O: chat/completions + tools
            O-->>R: content or tool_calls
        else OpenAI unavailable or failed
            R->>R: runFallbackStep()
        end

        alt No tool_calls in this step
            R->>S: Update assistant(step_finish=completed, final answer)
            R->>S: Update session status = completed
            R->>E: publishRoot(session.detail)
            E-->>W: session.detail(final answer)
            R->>E: publish session.completed
            E-->>W: session.completed
        else tool_calls exist
            R->>S: Update assistant(tool_call status=running)
            R->>E: publishRoot(session.detail)
            E-->>W: session.detail(tool running)

            loop Each tool executes serially
                R->>T: executeTool(tool, input)

                alt knowledge_search
                    T->>K: retrieveRagContext()
                    K-->>T: summary + citations
                else dota_live_search
                    T->>D: listArticles/listPatchNotes/listTournaments
                    D-->>T: summary + citations
                else web_search
                    T->>G: OpenAI Responses web_search
                    G-->>T: summary + citations
                end

                T-->>R: tool result
                R->>S: Update assistant(tool_call=completed or failed)
                R->>E: publishRoot(session.detail)
                E-->>W: session.detail(tool result)
            end

            R->>S: Update assistant(step_finish=tool_calls)
            R->>E: publishRoot(session.detail)
            E-->>W: session.detail(step end)
        end
    end

    alt Max step limit reached
        R->>S: Add assistant(step_finish=max_steps)
        R->>S: Update session status = completed
        R->>E: publishRoot(session.detail)
        E-->>W: session.detail(max_steps)
        R->>E: publish session.completed
        E-->>W: session.completed
    else Runtime error
        R->>S: Update session status = failed
        R->>S: Add assistant(step_finish=failed)
        R->>E: publishRoot(session.detail)
        E-->>W: session.detail(failed)
        R->>E: publish session.failed
        E-->>W: session.failed
    end
```

## Simplified Flow

```mermaid
flowchart TD
    A[Frontend submits message] --> B[POST /agent/sessions/:id/messages]
    B --> C[Store user message and set session running]
    C --> D[Start runSessionTurn asynchronously]
    D --> E[Create assistant step_start]
    E --> F{Model decision}
    F -->|Answer directly| G[Write final answer]
    F -->|Call tools| H[knowledge_search or dota_live_search or web_search]
    H --> I[Write tool results into current assistant message]
    I --> E
    G --> J[Set session completed]
    J --> K[Push session.detail or completed over SSE]
```

## Current Behavior Notes

- The active runtime is single-session and single-orchestrator.
- `task_call`, `researcher`, `coach`, and child sessions exist in contracts and UI rendering paths, but they are not part of the live execution path today.
- Tool execution is serial, not parallel.
- The frontend receives whole-session snapshots, not token streaming.
- Session and message state are stored in in-memory maps, so agent state is not durable across server restarts.

## Main Code Locations

- API mount: `apps/api/src/app.ts`
- Agent routes: `apps/api/src/routes/agentRoutes.ts`
- Runtime loop: `apps/api/src/services/agent/agentRuntimeService.ts`
- Tool implementations: `apps/api/src/services/agent/agentTools.ts`
- OpenAI web search wrapper: `apps/api/src/services/agent/openAiWebSearchService.ts`
- Event bus: `apps/api/src/services/agent/agentEventBus.ts`
- In-memory session store: `apps/api/src/repo/agentStore.ts`
- Frontend API client: `apps/web/src/lib/api.ts`
- Frontend chat page: `apps/web/src/pages/ChatPage.tsx`
- Shared contracts: `packages/contracts/src/index.ts`
