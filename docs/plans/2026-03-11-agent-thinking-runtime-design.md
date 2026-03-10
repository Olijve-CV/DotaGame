# Agent Thinking Runtime Design

## Goal

Align the active agent experience with the current common agent-chat pattern:

- one user turn
- one assistant turn
- visible thinking/tool activity before the result
- no user-facing step timeline

## Chosen Direction

The repo already moved from a session-tree runtime to a single-session OpenCode-style loop. The remaining mismatch was the shared message protocol and the web renderer. The backend still emitted `step_start` and `step_finish`, and the frontend rendered them directly. That exposed execution scaffolding instead of showing a coherent assistant turn.

The chosen design collapses each turn into one assistant message that evolves over time:

1. The user sends a message.
2. The backend creates one assistant message with a `thinking` part in `running` state.
3. If the model requests tools, `tool_call` parts are appended and updated in place.
4. When the model has enough evidence, the same assistant message receives the final `content`.
5. The `thinking` part is marked `completed` or `failed`.

## Contract Changes

The shared `AgentMessagePart` union is reduced to the parts the UI should actually understand:

- `text`
- `thinking`
- `tool_call`

Removed parts:

- `step_start`
- `step_finish`
- `task_call`

This makes the contract closer to the real user experience and removes dead branches from the current runtime path.

## Frontend Rendering

The chat UI now treats assistant messages as a single evolving artifact:

- user message first
- assistant thinking card
- tool activity cards
- final result block

This is intentionally different from a run debugger. Internal control flow may still iterate multiple times, but the UI no longer mirrors that implementation detail.

## Error Handling

If the model step fails:

- the session status becomes `failed`
- the existing assistant message is updated to `thinking: failed`
- the assistant content records the failure message

This preserves a single coherent assistant turn even on failure.

## Validation

- `npm test --workspace @dotagame/api`
- `npm run build`
