import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  AgentMessage,
  AgentMessagePart,
  AgentSession,
  AgentSessionControlAction,
  AgentSessionDetail,
  AgentSessionEvent,
  AgentSessionSummary,
  ChatMode,
  Language
} from "@dotagame/contracts";
import {
  controlAgentSession,
  createAgentSession,
  fetchAgentSession,
  fetchAgentSessions,
  getAgentSessionEventsUrl,
  sendAgentMessage
} from "../lib/api";
import { formatContentDateTime } from "../lib/contentFormatting";

const labels = {
  "zh-CN": {
    kicker: "Session Tree",
    title: "更接近 OpenCode 的 Agent Chat",
    summary:
      "主会话负责和用户交互，并把任务拆给 Researcher 和 Coach 子会话。每个子会话都能独立执行工具并把结果回传到根会话。",
    roots: "根会话",
    newSession: "新建会话",
    tree: "会话树",
    messages: "消息流",
    composer: "发送任务",
    quick: "快速分析",
    coach: "教练模式",
    placeholder: "例如：结合最近版本、赛事和通用网页信息，解释我为什么 18 分钟左右 carry 节奏总断。",
    submit: "发送给主 Agent",
    sending: "执行中...",
    starters: "建议任务",
    noSessions: "还没有根会话。你可以先创建一个会话，或直接发送任务。",
    noMessages: "当前会话还没有消息。",
    rootReadonly: "子会话是只读的。请回到根会话继续输入。",
    user: "你",
    assistant: "Agent",
    tool: "Tool",
    taskCall: "Task",
    toolCall: "Tool",
    openChild: "打开子会话",
    parent: "返回根会话",
    controls: "控制",
    abort: "暂停",
    resume: "继续",
    retry: "重试",
    status: {
      idle: "空闲",
      running: "运行中",
      paused: "已暂停",
      completed: "已完成",
      failed: "失败"
    }
  },
  "en-US": {
    kicker: "Session Tree",
    title: "A multi-agent session tree closer to OpenCode",
    summary:
      "The primary session talks to the user and dispatches work. Researcher and Coach run inside their own child sessions with independent tool execution and result synthesis.",
    roots: "Root Sessions",
    newSession: "New Session",
    tree: "Session Tree",
    messages: "Message Feed",
    composer: "Send Mission",
    quick: "Quick Analysis",
    coach: "Coach Mode",
    placeholder:
      "Example: Use recent patches, tournaments, and general web context to explain why I keep losing carry tempo around minute 18.",
    submit: "Send to Primary Agent",
    sending: "Running...",
    starters: "Suggested Missions",
    noSessions: "No root sessions yet. Create one or send a mission to start.",
    noMessages: "This session has no messages yet.",
    rootReadonly: "Subagent sessions are read-only. Return to the primary session to continue.",
    user: "You",
    assistant: "Agent",
    tool: "Tool",
    taskCall: "Task",
    toolCall: "Tool",
    openChild: "Open Child Session",
    parent: "Back to Root",
    controls: "Controls",
    abort: "Abort",
    resume: "Resume",
    retry: "Retry",
    status: {
      idle: "Idle",
      running: "Running",
      paused: "Paused",
      completed: "Completed",
      failed: "Failed"
    }
  }
} satisfies Record<
  Language,
  {
    kicker: string;
    title: string;
    summary: string;
    roots: string;
    newSession: string;
    tree: string;
    messages: string;
    composer: string;
    quick: string;
    coach: string;
    placeholder: string;
    submit: string;
    sending: string;
    starters: string;
    noSessions: string;
    noMessages: string;
    rootReadonly: string;
    user: string;
    assistant: string;
    tool: string;
    taskCall: string;
    toolCall: string;
    openChild: string;
    parent: string;
    controls: string;
    abort: string;
    resume: string;
    retry: string;
    status: Record<AgentSession["status"], string>;
  }
>;

const starterMap: Record<Language, string[]> = {
  "zh-CN": [
    "解释为什么当前版本里 carry 容易在中期断节奏。",
    "让 Researcher 先看最近赛事和版本变化，再让 Coach 给我一份 support 训练计划。",
    "把我的问题拆成对线、节奏点和团战三段，并告诉我怎么复盘。"
  ],
  "en-US": [
    "Explain why carry players lose tempo in the current patch.",
    "Have the researcher review recent tournaments and patch notes, then let the coach give me a support training plan.",
    "Break my issue into lane, timing, and teamfight phases and tell me how to review each one."
  ]
};

function toSummary(detail: AgentSessionDetail): AgentSessionSummary {
  return {
    id: detail.session.id,
    title: detail.session.title,
    language: detail.session.language,
    agent: detail.session.agent,
    kind: detail.session.kind,
    parentSessionId: detail.session.parentSessionId,
    createdAt: detail.session.createdAt,
    updatedAt: detail.session.updatedAt,
    status: detail.session.status,
    lastMessage: detail.messages[detail.messages.length - 1]?.content ?? "",
    childCount: detail.children.length
  };
}

function getRoleLabel(message: AgentMessage, locale: Language) {
  const copy = labels[locale];
  if (message.role === "user") {
    return copy.user;
  }
  if (message.role === "tool") {
    return copy.tool;
  }
  return copy.assistant;
}

function renderPartTitle(part: AgentMessagePart, locale: Language) {
  const copy = labels[locale];
  if (part.type === "task_call") {
    return `${copy.taskCall}: ${part.subagent}`;
  }
  if (part.type === "tool_call") {
    return `${copy.toolCall}: ${part.tool}`;
  }
  return null;
}

export function ChatPage(props: { locale: Language; token: string | null }) {
  const copy = useMemo(() => labels[props.locale], [props.locale]);
  const starters = useMemo(() => starterMap[props.locale], [props.locale]);
  const [rootSessions, setRootSessions] = useState<AgentSessionSummary[]>([]);
  const [rootDetail, setRootDetail] = useState<AgentSessionDetail | null>(null);
  const [activeDetail, setActiveDetail] = useState<AgentSessionDetail | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ChatMode>("coach");
  const [loading, setLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState<AgentSessionControlAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rootSession = rootDetail?.session ?? null;
  const activeSession = activeDetail?.session ?? null;
  const visibleTree = rootDetail?.children ?? [];
  const canAbort = rootSession?.status === "running";
  const canResume = rootSession?.status === "paused" || rootSession?.status === "failed";
  const canRetry = Boolean(rootSession && rootSession.status !== "running");

  function upsertRootSummary(summary: AgentSessionSummary) {
    setRootSessions((current) => {
      const existing = current.find((item) => item.id === summary.id);
      if (!existing) {
        return [summary, ...current];
      }

      return current
        .map((item) => (item.id === summary.id ? summary : item))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    });
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const items = await fetchAgentSessions(props.token);
      if (!active) {
        return;
      }

      setRootSessions(items);
      if (!items[0]) {
        setRootDetail(null);
        setActiveDetail(null);
        return;
      }

      const detail = await fetchAgentSession(items[0].id, props.token);
      if (!active) {
        return;
      }

      setRootDetail(detail);
      setActiveDetail(detail);
    }

    load().catch(() => {
      if (!active) {
        return;
      }
      setRootSessions([]);
      setRootDetail(null);
      setActiveDetail(null);
    });

    return () => {
      active = false;
    };
  }, [props.locale, props.token]);

  useEffect(() => {
    if (!rootDetail) {
      return;
    }

    const source = new EventSource(getAgentSessionEventsUrl(rootDetail.session.id, props.token));

    const handleEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as AgentSessionEvent;
      if (!payload.detail) {
        return;
      }
      const detail = payload.detail;

      if (detail.session.id === rootDetail.session.id) {
        setRootDetail(detail);
        upsertRootSummary(toSummary(detail));
      }

      setActiveDetail((current) => {
        if (!current) {
          return current;
        }

        return current.session.id === detail.session.id ? detail : current;
      });
    };

    source.addEventListener("session.detail", handleEvent as EventListener);
    source.addEventListener("session.completed", handleEvent as EventListener);
    source.addEventListener("session.failed", handleEvent as EventListener);

    return () => {
      source.close();
    };
  }, [props.token, rootDetail?.session.id]);

  async function handleCreateSession() {
    setLoading(true);
    setError(null);
    try {
      const session = await createAgentSession({ language: props.locale }, props.token);
      const detail = await fetchAgentSession(session.id, props.token);
      setRootDetail(detail);
      setActiveDetail(detail);
      upsertRootSummary(toSummary(detail));
      setMessage("");
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(code);
    } finally {
      setLoading(false);
    }
  }

  async function openRootSession(sessionId: string) {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchAgentSession(sessionId, props.token);
      setRootDetail(detail);
      setActiveDetail(detail);
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(code);
    } finally {
      setLoading(false);
    }
  }

  async function openChildSession(sessionId: string) {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchAgentSession(sessionId, props.token);
      setActiveDetail(detail);
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(code);
    } finally {
      setLoading(false);
    }
  }

  async function ensureRootSession(): Promise<AgentSession> {
    if (rootDetail) {
      return rootDetail.session;
    }

    const session = await createAgentSession({ language: props.locale }, props.token);
    const detail = await fetchAgentSession(session.id, props.token);
    setRootDetail(detail);
    setActiveDetail(detail);
    upsertRootSummary(toSummary(detail));
    return session;
  }

  async function submitMission(nextMessage?: string) {
    const finalMessage = (nextMessage ?? message).trim();
    if (finalMessage.length < 2) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const root = await ensureRootSession();
      const detail = await sendAgentMessage(
        root.id,
        {
          message: finalMessage,
          mode,
          language: props.locale
        },
        props.token
      );
      setRootDetail(detail);
      setActiveDetail(detail);
      upsertRootSummary(toSummary(detail));
      setMessage("");
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(code);
    } finally {
      setLoading(false);
    }
  }

  async function handleSessionControl(action: AgentSessionControlAction) {
    if (!rootSession) {
      return;
    }

    setControlLoading(action);
    setError(null);
    try {
      const detail = await controlAgentSession(rootSession.id, action, props.token);
      setRootDetail(detail);
      setActiveDetail(detail);
      upsertRootSummary(toSummary(detail));
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(code);
    } finally {
      setControlLoading(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMission();
  }

  return (
    <section className="stack agent-page opencode-page">
      <section className="panel agent-hero opencode-hero">
        <div className="agent-hero-copy">
          <p className="section-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p className="dota-intro-summary">{copy.summary}</p>
        </div>

        <div className="agent-control-grid">
          <section className="agent-control-card">
            <p className="section-kicker">Mode</p>
            <div className="agent-toggle-row">
              <button
                className={mode === "quick" ? "active" : ""}
                onClick={() => setMode("quick")}
                type="button"
              >
                {copy.quick}
              </button>
              <button
                className={mode === "coach" ? "active" : ""}
                onClick={() => setMode("coach")}
                type="button"
              >
                {copy.coach}
              </button>
            </div>
          </section>

          {rootSession ? (
            <section className="agent-control-card">
              <p className="section-kicker">{copy.controls}</p>
              <div className="agent-toggle-row">
                <button
                  disabled={!canAbort || Boolean(controlLoading)}
                  onClick={() => void handleSessionControl("abort")}
                  type="button"
                >
                  {controlLoading === "abort" ? copy.sending : copy.abort}
                </button>
                <button
                  disabled={!canResume || Boolean(controlLoading)}
                  onClick={() => void handleSessionControl("resume")}
                  type="button"
                >
                  {controlLoading === "resume" ? copy.sending : copy.resume}
                </button>
                <button
                  disabled={!canRetry || Boolean(controlLoading)}
                  onClick={() => void handleSessionControl("retry")}
                  type="button"
                >
                  {controlLoading === "retry" ? copy.sending : copy.retry}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      <section className="agent-workspace opencode-workspace">
        <aside className="panel agent-thread-rail">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Roots</p>
              <h3>{copy.roots}</h3>
            </div>
            <button className="ghost-btn" onClick={handleCreateSession} type="button">
              {copy.newSession}
            </button>
          </div>

          <div className="agent-thread-list">
            {rootSessions.length > 0 ? (
              rootSessions.map((session) => (
                <button
                  className={`agent-thread-card${rootDetail?.session.id === session.id ? " active" : ""}`}
                  key={session.id}
                  onClick={() => void openRootSession(session.id)}
                  type="button"
                >
                  <span className="agent-thread-status">{copy.status[session.status]}</span>
                  <strong>{session.title}</strong>
                  <p>{session.lastMessage || copy.noSessions}</p>
                  <span className="agent-thread-time">
                    {formatContentDateTime(session.updatedAt, props.locale)}
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">{copy.noSessions}</p>
            )}
          </div>

          <section className="agent-starter-card">
            <p className="section-kicker">Starter</p>
            <h4>{copy.starters}</h4>
            <div className="agent-starter-list">
              {starters.map((starter) => (
                <button key={starter} onClick={() => void submitMission(starter)} type="button">
                  {starter}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="agent-main-stack">
          <section className="panel opencode-tree-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Tree</p>
                <h3>{copy.tree}</h3>
              </div>
            </div>

            {rootDetail ? (
              <div className="session-tree">
                <button
                  className={`session-node root${activeSession?.id === rootDetail.session.id ? " active" : ""}`}
                  onClick={() => setActiveDetail(rootDetail)}
                  type="button"
                >
                  <span>{rootDetail.session.agent}</span>
                  <strong>{rootDetail.session.title}</strong>
                  <small>{copy.status[rootDetail.session.status]}</small>
                </button>
                <div className="session-children">
                  {visibleTree.map((child) => (
                    <button
                      className={`session-node child${activeSession?.id === child.id ? " active" : ""}`}
                      key={child.id}
                      onClick={() => void openChildSession(child.id)}
                      type="button"
                    >
                      <span>{child.agent}</span>
                      <strong>{child.title}</strong>
                      <small>{copy.status[child.status]}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">{copy.noSessions}</p>
            )}
          </section>

          <section className="panel agent-message-panel opencode-message-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Session</p>
                <h3>{copy.messages}</h3>
              </div>
              {activeSession ? (
                <div className="opencode-breadcrumb">
                  {activeSession.parentSessionId ? (
                    <button className="text-btn" onClick={() => setActiveDetail(rootDetail)} type="button">
                      {copy.parent}
                    </button>
                  ) : null}
                  <span className="agent-thread-time">
                    {copy.status[activeSession.status]} |{" "}
                    {formatContentDateTime(activeSession.updatedAt, props.locale)}
                  </span>
                </div>
              ) : null}
            </div>

            {activeDetail?.messages.length ? (
              <div className="agent-message-list">
                {activeDetail.messages.map((entry) => (
                  <article className={`agent-message-bubble agent-message-${entry.role}`} key={entry.id}>
                    <span className="agent-message-role">{getRoleLabel(entry, props.locale)}</span>
                    <p>{entry.content}</p>
                    {entry.parts.length > 0 ? (
                      <div className="message-part-list">
                        {entry.parts.map((part, index) => (
                          <div className={`message-part-card part-${part.type}`} key={`${entry.id}-${index}`}>
                            {renderPartTitle(part, props.locale) ? (
                              <strong>{renderPartTitle(part, props.locale)}</strong>
                            ) : null}
                            {part.type === "text" ? <p>{part.text}</p> : null}
                            {part.type === "task_call" ? (
                              <>
                                <p>{part.summary}</p>
                                <button
                                  className="text-btn"
                                  onClick={() => void openChildSession(part.childSessionId)}
                                  type="button"
                                >
                                  {copy.openChild}
                                </button>
                              </>
                            ) : null}
                            {part.type === "tool_call" ? (
                              <>
                                <p>{part.outputSummary}</p>
                                {part.citations.length > 0 ? (
                                  <div className="message-part-links">
                                    {part.citations.slice(0, 3).map((citation) => (
                                      <a
                                        href={citation.sourceUrl}
                                        key={citation.id}
                                        rel="noreferrer"
                                        target="_blank"
                                      >
                                        {citation.source}
                                      </a>
                                    ))}
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">{copy.noMessages}</p>
            )}
          </section>

          <section className="panel agent-compose-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Compose</p>
                <h3>{copy.composer}</h3>
              </div>
              {error ? <span className="agent-error-text">{error}</span> : null}
            </div>

            {activeSession && activeSession.kind === "subagent" ? (
              <p className="muted">{copy.rootReadonly}</p>
            ) : (
              <form className="agent-compose-form" onSubmit={handleSubmit}>
                <textarea
                  className="chat-question-input"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={copy.placeholder}
                  rows={5}
                  value={message}
                />
                <div className="agent-compose-actions">
                  <p className="muted">
                    {rootSession ? copy.status[rootSession.status] : copy.status.idle}
                  </p>
                  <button
                    className="primary-btn chat-submit"
                    disabled={loading || rootSession?.status === "running"}
                    type="submit"
                  >
                    {loading ? copy.sending : copy.submit}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </section>
    </section>
  );
}
