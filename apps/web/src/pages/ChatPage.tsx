import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type {
  AgentKind,
  AgentMessage,
  AgentMessagePart,
  AgentSession,
  AgentSessionDetail,
  AgentSessionEvent,
  AgentSessionSummary,
  AgentToolName,
  Language
} from "@dotagame/contracts";
import {
  createAgentSession,
  fetchAgentSession,
  fetchAgentSessions,
  getAgentSessionEventsUrl,
  sendAgentMessage
} from "../lib/api";
import { formatContentDateTime } from "../lib/contentFormatting";

interface ThreadEntry {
  message: AgentMessage;
  session: AgentSession;
}

const labels = {
  "zh-CN": {
    history: "会话历史",
    historyHint: "登录后会自动保存会话，并可从历史中继续查看。",
    guestTitle: "临时会话",
    guestHint: "未登录状态下，对话只保留在当前页面会话中，不会写入账号历史。",
    newSession: "新建会话",
    placeholder: "例如：结合最近补丁、赛事和通用思路，解释我为什么在 18 分钟左右 carry 节奏会断。",
    submit: "发送",
    sending: "思考中...",
    noSessions: "还没有已保存的会话。",
    noMessages: "发送第一条消息来开始对话。",
    user: "你",
    assistant: "Agent",
    tool: "工具",
    thinking: "Thinking",
    result: "结果",
    citations: "来源",
    status: {
      idle: "空闲",
      running: "思考中",
      completed: "已完成",
      failed: "失败"
    },
    agents: {
      orchestrator: "Agent",
      researcher: "Agent",
      coach: "Agent"
    } satisfies Record<AgentKind, string>
  },
  "en-US": {
    history: "Saved Chats",
    historyHint: "Signed-in sessions are saved and can be reopened from history.",
    guestTitle: "Temporary Chat",
    guestHint: "Guest conversations stay available only in this page session and are not saved to account history.",
    newSession: "New Chat",
    placeholder:
      "Example: Use recent patches, tournaments, and general context to explain why my carry tempo collapses around minute 18.",
    submit: "Send",
    sending: "Thinking...",
    noSessions: "No saved chats yet.",
    noMessages: "Send the first message to start the conversation.",
    user: "You",
    assistant: "Agent",
    tool: "Tool",
    thinking: "Thinking",
    result: "Result",
    citations: "Sources",
    status: {
      idle: "Idle",
      running: "Thinking",
      completed: "Completed",
      failed: "Failed"
    },
    agents: {
      orchestrator: "Agent",
      researcher: "Agent",
      coach: "Agent"
    } satisfies Record<AgentKind, string>
  }
} satisfies Record<
  Language,
  {
    history: string;
    historyHint: string;
    guestTitle: string;
    guestHint: string;
    newSession: string;
    placeholder: string;
    submit: string;
    sending: string;
    noSessions: string;
    noMessages: string;
    user: string;
    assistant: string;
    tool: string;
    thinking: string;
    result: string;
    citations: string;
    status: Record<AgentSession["status"], string>;
    agents: Record<AgentKind, string>;
  }
>;

const starterMap: Record<Language, string[]> = {
  "zh-CN": [
    "解释当前版本里，哪些时间窗最容易让 carry 节奏断掉。",
    "结合最近补丁和赛事，说说 support 现在最该调整什么。",
    "把我的问题拆成对线、节奏和团战三个阶段，告诉我每阶段应该复盘什么。"
  ],
  "en-US": [
    "Explain which timing windows usually break carry tempo in the current patch.",
    "Use recent patches and tournaments to explain what support players should change right now.",
    "Break my issue into lane, tempo, and teamfight phases and tell me what to review in each one."
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

function sortThreadEntries(left: ThreadEntry, right: ThreadEntry) {
  const leftTime = new Date(left.message.createdAt).getTime();
  const rightTime = new Date(right.message.createdAt).getTime();
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.message.id.localeCompare(right.message.id);
}

function getSpeakerLabel(entry: ThreadEntry, locale: Language) {
  const copy = labels[locale];
  if (entry.message.role === "user") {
    return copy.user;
  }
  if (entry.message.role === "tool") {
    return copy.tool;
  }
  return copy.assistant;
}

function getSpeakerTone(entry: ThreadEntry): string {
  if (entry.message.role === "user") {
    return "user";
  }
  if (entry.message.role === "tool") {
    return "tool";
  }
  return "orchestrator";
}

function formatToolName(tool: AgentToolName): string {
  if (tool === "knowledge_search") {
    return "Knowledge Search";
  }
  if (tool === "dota_live_search") {
    return "Dota Live Search";
  }
  return "Web Search";
}

export function ChatPage(props: { locale: Language; token: string | null }) {
  const copy = useMemo(() => labels[props.locale], [props.locale]);
  const starters = useMemo(() => starterMap[props.locale], [props.locale]);
  const isLoggedIn = Boolean(props.token);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const [rootSessions, setRootSessions] = useState<AgentSessionSummary[]>([]);
  const [rootDetail, setRootDetail] = useState<AgentSessionDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootSession = rootDetail?.session ?? null;
  const rootSessionId = rootDetail?.session.id ?? null;

  const threadEntries = useMemo(() => {
    if (!rootDetail) {
      return [];
    }

    return rootDetail.messages
      .map((entry) => ({
        message: entry,
        session: rootDetail.session
      }))
      .sort(sortThreadEntries);
  }, [rootDetail]);

  function replaceRoot(detail: AgentSessionDetail | null) {
    setRootDetail(detail);
  }

  function resetTemporaryConversation() {
    replaceRoot(null);
    setMessage("");
    setError(null);
  }

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
    if (!isLoggedIn) {
      setRootSessions([]);
      replaceRoot(null);
      return;
    }

    let active = true;

    async function load() {
      const items = await fetchAgentSessions(props.token);
      if (!active) {
        return;
      }

      setRootSessions(items);
      if (!items[0]) {
        replaceRoot(null);
        return;
      }

      const detail = await fetchAgentSession(items[0].id, props.token);
      if (!active) {
        return;
      }

      replaceRoot(detail);
    }

    load().catch(() => {
      if (!active) {
        return;
      }
      setRootSessions([]);
      replaceRoot(null);
    });

    return () => {
      active = false;
    };
  }, [isLoggedIn, props.locale, props.token]);

  useEffect(() => {
    if (!rootDetail || !rootSessionId) {
      return;
    }

    const source = new EventSource(getAgentSessionEventsUrl(rootSessionId, props.token));

    const handleEvent = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as AgentSessionEvent;
      if (!payload.detail || payload.detail.session.rootSessionId !== rootSessionId) {
        return;
      }

      const detail = payload.detail;
      if (detail.session.id !== rootSessionId) {
        return;
      }

      setRootDetail(detail);
      upsertRootSummary(toSummary(detail));
    };

    source.addEventListener("session.detail", handleEvent as EventListener);
    source.addEventListener("session.completed", handleEvent as EventListener);
    source.addEventListener("session.failed", handleEvent as EventListener);

    return () => {
      source.close();
    };
  }, [props.token, rootSessionId]);

  useEffect(() => {
    const container = feedRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
  }, [loading, rootDetail]);

  async function handleCreateSession() {
    if (!isLoggedIn) {
      resetTemporaryConversation();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await createAgentSession({ language: props.locale }, props.token);
      const detail = await fetchAgentSession(session.id, props.token);
      replaceRoot(detail);
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
      replaceRoot(detail);
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
    replaceRoot(detail);
    if (isLoggedIn) {
      upsertRootSummary(toSummary(detail));
    }
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
          language: props.locale
        },
        props.token
      );
      setRootDetail(detail);
      if (isLoggedIn) {
        upsertRootSummary(toSummary(detail));
      }
      setMessage("");
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(code);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMission();
  }

  function renderCitations(
    citations: Array<{
      id: string;
      source: string;
      sourceUrl: string;
    }>
  ) {
    if (citations.length === 0) {
      return null;
    }

    return (
      <div className="message-part-links">
        {citations.slice(0, 3).map((citation) => (
          <a href={citation.sourceUrl} key={citation.id} rel="noreferrer" target="_blank">
            {citation.source}
          </a>
        ))}
      </div>
    );
  }

  function renderMessagePart(part: AgentMessagePart, key: string): ReactNode {
    if (part.type === "text") {
      return null;
    }

    if (part.type === "thinking") {
      return (
        <div className={`message-part-card part-thinking${part.status === "running" ? " is-live" : ""}`} key={key}>
          <div className="message-part-head">
            <strong>{copy.thinking}</strong>
            <span className={`message-part-status is-${part.status}`}>{copy.status[part.status]}</span>
          </div>
          <p className="message-part-note">{part.summary}</p>
          {part.status === "running" ? (
            <div className="message-thinking-pulse" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className={`message-part-card part-${part.type}`} key={key}>
        <div className="message-part-head">
          <strong>{formatToolName(part.tool)}</strong>
          <span className={`message-part-status is-${part.status}`}>{copy.status[part.status]}</span>
        </div>
        {part.inputSummary ? <p className="message-part-note">{part.inputSummary}</p> : null}
        {part.outputSummary ? <p>{part.outputSummary}</p> : null}
        {renderCitations(part.citations)}
      </div>
    );
  }

  return (
    <section className="stack agent-page">
      <section className={`panel agent-chat-shell${isLoggedIn ? "" : " guest"}`}>
        {isLoggedIn ? (
          <aside className="agent-chat-sidebar">
            <div className="section-heading compact">
              <h3>{copy.history}</h3>
              <button
                className="ghost-btn"
                disabled={loading || rootSession?.status === "running"}
                onClick={handleCreateSession}
                type="button"
              >
                {copy.newSession}
              </button>
            </div>

            <div className="agent-history-list">
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
                    <p>{session.lastMessage || copy.noMessages}</p>
                    <span className="agent-thread-time">
                      {formatContentDateTime(session.updatedAt, props.locale)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="agent-guest-note">
                  <strong>{copy.noSessions}</strong>
                  <p>{copy.historyHint}</p>
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <div className="agent-chat-main">
          {!isLoggedIn ? (
            <section className="agent-guest-note inline">
              <strong>{copy.guestTitle}</strong>
              <p>{copy.guestHint}</p>
            </section>
          ) : null}

          <section className="agent-chat-feed" ref={feedRef}>
            {threadEntries.length > 0 ? (
              <div className="agent-message-list">
                {threadEntries.map((entry) => {
                  const isUser = entry.message.role === "user";
                  const visibleParts = entry.message.parts.filter((part) => part.type !== "text");
                  const isAssistant = entry.message.role === "assistant";
                  const hasActivity = visibleParts.length > 0;
                  const resultText = entry.message.content.trim();
                  const showPlainContent = !isAssistant || !hasActivity;
                  const showResultBlock = isAssistant && hasActivity && resultText.length > 0;
                  const isThinking = visibleParts.some(
                    (part) => part.type === "thinking" && part.status === "running"
                  );

                  return (
                    <article
                      className={`agent-chat-message${isUser ? " is-user" : ""}${isThinking ? " is-thinking" : ""}`}
                      key={entry.message.id}
                    >
                      <div className="agent-chat-bubble">
                        <div className="agent-chat-meta">
                          <span className={`agent-speaker-pill tone-${getSpeakerTone(entry)}`}>
                            {getSpeakerLabel(entry, props.locale)}
                          </span>
                          <span>{formatContentDateTime(entry.message.createdAt, props.locale)}</span>
                        </div>

                        {showPlainContent && resultText ? (
                          <p className="agent-chat-content">{resultText}</p>
                        ) : null}

                        {visibleParts.length > 0 ? (
                          <div className="message-part-list">
                            {visibleParts.map((part, index) =>
                              renderMessagePart(part, `${entry.message.id}-${index}`)
                            )}
                          </div>
                        ) : null}

                        {showResultBlock ? (
                          <div className="agent-result-block">
                            <span className="agent-result-label">{copy.result}</span>
                            <p className="agent-chat-content">{resultText}</p>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="agent-empty-state">
                <div className="agent-starter-list">
                  {starters.map((starter) => (
                    <button key={starter} onClick={() => void submitMission(starter)} type="button">
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="panel agent-compose-panel">
            {error ? <span className="agent-error-text">{error}</span> : null}

            <form className="agent-compose-form" onSubmit={handleSubmit}>
              <textarea
                className="chat-question-input"
                onChange={(event) => setMessage(event.target.value)}
                placeholder={copy.placeholder}
                rows={4}
                value={message}
              />

              <div className="agent-compose-actions">
                <div className="agent-compose-hint">
                  <span className="agent-session-badge">{copy.status[rootSession?.status ?? "idle"]}</span>
                </div>
                <button
                  className="primary-btn chat-submit"
                  disabled={loading || rootSession?.status === "running"}
                  type="submit"
                >
                  {loading ? copy.sending : copy.submit}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </section>
  );
}
