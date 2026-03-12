import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type {
  AgentKind,
  AgentMessage,
  AgentMessagePart,
  AgentSession,
  AgentSessionDetail,
  AgentSessionEvent,
  AgentSessionSummary,
  ChatCitation,
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
    historyHint: "登录后，问答会自动落到账号里，之后可以从同一条会话继续追问。",
    workspaceTitle: "对局问答工作台",
    workspaceHint: "保留最终回答和引用来源，把过程折叠掉，让复盘更聚焦。",
    loginRequiredTitle: "登录后才能使用智能问答",
    loginRequiredHint: "问答记录会写入你的账号历史，便于后续继续追问和复盘。",
    loginAction: "前往登录",
    loginPreviewTitle: "登录后你可以直接这样问",
    newSession: "新建会话",
    placeholder: "例如：结合最近版本和比赛，解释我玩 carry 为什么总在 18 分钟后断节奏。",
    submit: "发送",
    sending: "正在执行...",
    noSessions: "还没有保存过会话。",
    noMessages: "发出第一条问题，开始一次新的分析。",
    user: "你",
    assistant: "Agent",
    result: "最终答复",
    citations: "参考来源",
    messagesStat: "消息",
    sourcesStat: "来源",
    starterTitle: "可以这样开始",
    thinking: "正在整理证据和结论",
    thinkingFailed: "本轮执行失败",
    statusLabel: "会话状态",
    status: {
      idle: "空闲",
      running: "执行中",
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
    historyHint: "Signed-in chats stay attached to your account so you can continue the same thread later.",
    workspaceTitle: "Match Review Workspace",
    workspaceHint: "Keep the final answer and sources visible while the tool process stays out of the way.",
    loginRequiredTitle: "Sign in to use Agent Chat",
    loginRequiredHint: "Chat runs are saved to your account so you can return to the same review thread later.",
    loginAction: "Go to login",
    loginPreviewTitle: "After signing in, try prompts like these",
    newSession: "New Chat",
    placeholder: "Example: Use recent patches and tournaments to explain why my carry tempo collapses around minute 18.",
    submit: "Send",
    sending: "Running...",
    noSessions: "No saved chats yet.",
    noMessages: "Send the first message to start a new review.",
    user: "You",
    assistant: "Agent",
    result: "Final answer",
    citations: "Sources",
    messagesStat: "Messages",
    sourcesStat: "Sources",
    starterTitle: "Try one of these",
    thinking: "Working through the question",
    thinkingFailed: "This run failed",
    statusLabel: "Session status",
    status: {
      idle: "Idle",
      running: "Running",
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
    workspaceTitle: string;
    workspaceHint: string;
    loginRequiredTitle: string;
    loginRequiredHint: string;
    loginAction: string;
    loginPreviewTitle: string;
    newSession: string;
    placeholder: string;
    submit: string;
    sending: string;
    noSessions: string;
    noMessages: string;
    user: string;
    assistant: string;
    result: string;
    citations: string;
    messagesStat: string;
    sourcesStat: string;
    starterTitle: string;
    thinking: string;
    thinkingFailed: string;
    statusLabel: string;
    status: Record<AgentSession["status"], string>;
    agents: Record<AgentKind, string>;
  }
>;

const starterMap: Record<Language, string[]> = {
  "zh-CN": [
    "结合最近版本和比赛，说说当前 carry 为什么会在中期丢节奏。",
    "用版本和公开信息解释 support 现在最该改的三个习惯。",
    "把我的问题拆成对线、节奏、团战三个阶段，各给我一个复盘框架。"
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
    childCount: detail.children.length,
    insight: detail.insight
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
  return entry.message.role === "user" ? labels[locale].user : labels[locale].assistant;
}

function getSpeakerTone(entry: ThreadEntry): string {
  return entry.message.role === "user" ? "user" : "orchestrator";
}

function collectMessageCitations(parts: AgentMessagePart[]): ChatCitation[] {
  const seen = new Set<string>();
  const citations: ChatCitation[] = [];

  for (const part of parts) {
    if (part.type !== "tool_call") {
      continue;
    }

    for (const citation of part.citations) {
      const key = `${citation.sourceUrl}:${citation.title}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      citations.push(citation);
    }
  }

  return citations;
}

function getSessionPreview(
  summary: AgentSessionSummary,
  copy: (typeof labels)["en-US"]
) {
  return summary.insight.lastUserMessage || summary.insight.lastAnswerPreview || summary.lastMessage || copy.noMessages;
}

function getThinkingPart(parts: AgentMessagePart[]) {
  return parts.find(
    (part): part is Extract<AgentMessagePart, { type: "thinking" }> => part.type === "thinking"
  );
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
  }, [isLoggedIn, props.token]);

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
    if (!props.token) {
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
    if (!props.token) {
      throw new Error("UNAUTHORIZED");
    }

    const session = await createAgentSession({ language: props.locale }, props.token);
    const detail = await fetchAgentSession(session.id, props.token);
    replaceRoot(detail);
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
          language: props.locale
        },
        props.token
      );
      setRootDetail(detail);
      upsertRootSummary(toSummary(detail));
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

  function renderCitationLinks(citations: ChatCitation[]) {
    if (citations.length === 0) {
      return null;
    }

    return (
      <div className="message-part-links">
        {citations.slice(0, 4).map((citation) => (
          <a href={citation.sourceUrl} key={`${citation.id}-${citation.sourceUrl}`} rel="noreferrer" target="_blank">
            <span>{citation.source}</span>
            <strong>{citation.title}</strong>
          </a>
        ))}
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <section className="stack agent-page">
        <section className="panel agent-login-gate">
          <div className="agent-login-copy">
            <span className="section-kicker">{copy.workspaceTitle}</span>
            <h2>{copy.loginRequiredTitle}</h2>
            <p>{copy.loginRequiredHint}</p>
            <Link className="primary-btn" to="/login">
              {copy.loginAction}
            </Link>
          </div>

          <div className="agent-login-preview">
            <span className="agent-result-label">{copy.loginPreviewTitle}</span>
            <div className="agent-starter-list">
              {starters.map((starter) => (
                <div className="agent-preview-card" key={starter}>
                  {starter}
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="stack agent-page">
      <section className="panel agent-chat-shell">
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

          <p className="agent-sidebar-note">{copy.historyHint}</p>

          <div className="agent-history-list">
            {rootSessions.length > 0 ? (
              rootSessions.map((session) => (
                <button
                  className={`agent-thread-card${rootDetail?.session.id === session.id ? " active" : ""}`}
                  key={session.id}
                  onClick={() => void openRootSession(session.id)}
                  type="button"
                >
                  <div className="agent-thread-topline">
                    <span className="agent-thread-status">{copy.status[session.status]}</span>
                    <span className="agent-thread-time">{formatContentDateTime(session.updatedAt, props.locale)}</span>
                  </div>
                  <strong>{session.title}</strong>
                  <p>{getSessionPreview(session, copy)}</p>
                  <div className="agent-thread-metrics">
                    <span>
                      {session.insight.messageCount} {copy.messagesStat}
                    </span>
                    <span>
                      {session.insight.sourceCount} {copy.sourcesStat}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="agent-empty-note">
                <strong>{copy.noSessions}</strong>
                <p>{copy.historyHint}</p>
              </div>
            )}
          </div>
        </aside>

        <div className="agent-chat-main">
          <section className="agent-chat-hero">
            <div className="agent-chat-hero-copy">
              <span className="section-kicker">{copy.workspaceTitle}</span>
              <h2>{rootSession?.title ?? copy.workspaceTitle}</h2>
              <p>{copy.workspaceHint}</p>
            </div>
            <div className="agent-chat-hero-badges">
              <span className="agent-session-badge">
                {copy.statusLabel}: {copy.status[rootSession?.status ?? "idle"]}
              </span>
              {rootDetail ? (
                <span className="agent-session-badge">
                  {rootDetail.insight.sourceCount} {copy.sourcesStat}
                </span>
              ) : null}
            </div>
          </section>

          <section className="agent-chat-feed" ref={feedRef}>
            {threadEntries.length > 0 ? (
              <div className="agent-message-list">
                {threadEntries.map((entry) => {
                  const isUser = entry.message.role === "user";
                  const isAssistant = entry.message.role === "assistant";
                  const resultText = entry.message.content.trim();
                  const thinkingPart = getThinkingPart(entry.message.parts);
                  const showThinking = isAssistant && thinkingPart && thinkingPart.status !== "completed";
                  const messageCitations = collectMessageCitations(entry.message.parts);

                  return (
                    <article
                      className={`agent-chat-message${isUser ? " is-user" : ""}${
                        thinkingPart?.status === "running" ? " is-thinking" : ""
                      }`}
                      key={entry.message.id}
                    >
                      <div className="agent-chat-bubble">
                        <div className="agent-chat-meta">
                          <span className={`agent-speaker-pill tone-${getSpeakerTone(entry)}`}>
                            {getSpeakerLabel(entry, props.locale)}
                          </span>
                          <span>{formatContentDateTime(entry.message.createdAt, props.locale)}</span>
                        </div>

                        {showThinking ? (
                          <div
                            className={`agent-thinking-inline${
                              thinkingPart.status === "failed" ? " is-failed" : ""
                            }`}
                          >
                            <div className="message-part-head">
                              <strong>
                                {thinkingPart.status === "failed" ? copy.thinkingFailed : copy.thinking}
                              </strong>
                              <span className={`message-part-status is-${thinkingPart.status}`}>
                                {copy.status[thinkingPart.status]}
                              </span>
                            </div>
                            <p className="message-part-note">{thinkingPart.summary}</p>
                            {thinkingPart.status === "running" ? (
                              <div className="message-thinking-pulse" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {resultText ? (
                          isAssistant ? (
                            <div className="agent-result-block">
                              <span className="agent-result-label">{copy.result}</span>
                              <p className="agent-chat-content">{resultText}</p>
                            </div>
                          ) : (
                            <p className="agent-chat-content">{resultText}</p>
                          )
                        ) : null}

                        {isAssistant && messageCitations.length > 0 ? (
                          <div className="agent-source-strip">
                            <span className="agent-result-label">{copy.citations}</span>
                            {renderCitationLinks(messageCitations)}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="agent-empty-state">
                <div className="agent-empty-copy">
                  <span className="section-kicker">{copy.starterTitle}</span>
                  <h3>{copy.noMessages}</h3>
                </div>
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
