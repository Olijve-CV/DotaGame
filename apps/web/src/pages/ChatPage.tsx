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
    historyHint: "登录后会保存聊天记录，并且可以继续在原会话上追问。",
    guestTitle: "临时会话",
    guestHint: "游客模式只在当前页面保留上下文，不会写入账号历史。",
    newSession: "新建会话",
    placeholder:
      "例如：结合最近版本、赛事和公开信息，解释为什么我玩 carry 常在 18 分钟后断节奏。",
    submit: "发送",
    sending: "正在执行...",
    noSessions: "还没有保存的会话。",
    noMessages: "发出第一条问题，开始一次完整 agent 回合。",
    user: "你",
    assistant: "Agent",
    tool: "工具",
    thinking: "思考中",
    result: "最终答复",
    citations: "参考来源",
    overview: "运行概览",
    latestQuestion: "最近问题",
    latestAnswer: "最近答复",
    noAnswer: "当前还没有生成答复。",
    messagesStat: "消息",
    toolsStat: "工具调用",
    sourcesStat: "来源",
    activeTool: "当前工具",
    activeToolIdle: "当前没有工具在执行",
    toolMix: "工具足迹",
    sessionScope: "会话状态",
    starterTitle: "可以这样开始",
    duration: "耗时",
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
    historyHint: "Signed-in sessions stay in history and can be resumed from the same thread.",
    guestTitle: "Temporary Chat",
    guestHint: "Guest conversations stay only in this page session and are not written to account history.",
    newSession: "New Chat",
    placeholder:
      "Example: Use recent patches, tournaments, and open-web context to explain why my carry tempo collapses around minute 18.",
    submit: "Send",
    sending: "Running...",
    noSessions: "No saved chats yet.",
    noMessages: "Send the first message to start a full agent turn.",
    user: "You",
    assistant: "Agent",
    tool: "Tool",
    thinking: "Thinking",
    result: "Final answer",
    citations: "Sources",
    overview: "Run Overview",
    latestQuestion: "Latest question",
    latestAnswer: "Latest answer",
    noAnswer: "No answer yet.",
    messagesStat: "Messages",
    toolsStat: "Tool calls",
    sourcesStat: "Sources",
    activeTool: "Active tool",
    activeToolIdle: "No tool is currently running",
    toolMix: "Tool footprint",
    sessionScope: "Session status",
    starterTitle: "Try one of these",
    duration: "Duration",
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
    overview: string;
    latestQuestion: string;
    latestAnswer: string;
    noAnswer: string;
    messagesStat: string;
    toolsStat: string;
    sourcesStat: string;
    activeTool: string;
    activeToolIdle: string;
    toolMix: string;
    sessionScope: string;
    starterTitle: string;
    duration: string;
    status: Record<AgentSession["status"], string>;
    agents: Record<AgentKind, string>;
  }
>;

const starterMap: Record<Language, string[]> = {
  "zh-CN": [
    "结合最近版本和比赛，说说当前 carry 为什么会在中期丢节奏。",
    "用版本、赛事和公开资料解释 support 现在最该改的三个习惯。",
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

function formatDuration(durationMs: number | null, locale: Language): string {
  if (durationMs == null) {
    return locale === "zh-CN" ? "进行中" : "Running";
  }
  if (durationMs < 1000) {
    return locale === "zh-CN" ? `${durationMs} 毫秒` : `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`;
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

function formatToolMix(summary: AgentSessionSummary): string[] {
  return summary.insight.tools.slice(0, 3).map((item) => `${formatToolName(item.tool)} x${item.count}`);
}

function getSessionPreview(summary: AgentSessionSummary, copy: (typeof labels)["en-US"]) {
  return summary.insight.lastUserMessage || summary.lastMessage || copy.noMessages;
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
  const rootInsight = rootDetail?.insight ?? null;

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
          <div className="message-part-title">
            <strong>{formatToolName(part.tool)}</strong>
            <span className="message-part-meta">
              {copy.duration}: {formatDuration(part.durationMs, props.locale)}
            </span>
          </div>
          <span className={`message-part-status is-${part.status}`}>{copy.status[part.status]}</span>
        </div>
        {part.inputSummary ? <p className="message-part-note">{part.inputSummary}</p> : null}
        {part.outputSummary ? <p>{part.outputSummary}</p> : null}
        <div className="message-tool-footnote">
          <span>
            {part.citations.length} {copy.citations}
          </span>
          {part.completedAt ? <span>{formatContentDateTime(part.completedAt, props.locale)}</span> : null}
        </div>
        {renderCitationLinks(part.citations)}
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
                rootSessions.map((session) => {
                  const toolMix = formatToolMix(session);

                  return (
                    <button
                      className={`agent-thread-card${rootDetail?.session.id === session.id ? " active" : ""}`}
                      key={session.id}
                      onClick={() => void openRootSession(session.id)}
                      type="button"
                    >
                      <div className="agent-thread-topline">
                        <span className="agent-thread-status">{copy.status[session.status]}</span>
                        <span className="agent-thread-time">
                          {formatContentDateTime(session.updatedAt, props.locale)}
                        </span>
                      </div>
                      <strong>{session.title}</strong>
                      <p>{getSessionPreview(session, copy)}</p>
                      <div className="agent-thread-metrics">
                        <span>
                          {session.insight.messageCount} {copy.messagesStat}
                        </span>
                        <span>
                          {session.insight.toolCallCount} {copy.toolsStat}
                        </span>
                        <span>
                          {session.insight.sourceCount} {copy.sourcesStat}
                        </span>
                      </div>
                      {toolMix.length > 0 ? (
                        <div className="agent-thread-tool-row">
                          {toolMix.map((item) => (
                            <span className="agent-tool-chip" key={`${session.id}-${item}`}>
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })
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

          <section className="agent-overview-panel">
            <div className="agent-overview-heading">
              <div>
                <span className="section-kicker">{copy.overview}</span>
                <h2>{rootSession?.title ?? copy.guestTitle}</h2>
              </div>
              <div className="agent-overview-badges">
                <span className="agent-session-badge">{copy.status[rootSession?.status ?? "idle"]}</span>
                {rootInsight?.activeTool ? (
                  <span className="agent-session-badge accent">
                    {copy.activeTool}: {formatToolName(rootInsight.activeTool)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="agent-overview-stats">
              <article className="agent-overview-card">
                <span>{copy.messagesStat}</span>
                <strong>{rootInsight?.messageCount ?? 0}</strong>
              </article>
              <article className="agent-overview-card">
                <span>{copy.toolsStat}</span>
                <strong>{rootInsight?.toolCallCount ?? 0}</strong>
              </article>
              <article className="agent-overview-card">
                <span>{copy.sourcesStat}</span>
                <strong>{rootInsight?.sourceCount ?? 0}</strong>
              </article>
            </div>

            <div className="agent-overview-grid">
              <article className="agent-overview-note">
                <span>{copy.latestQuestion}</span>
                <p>{rootInsight?.lastUserMessage || copy.noMessages}</p>
              </article>
              <article className="agent-overview-note">
                <span>{copy.latestAnswer}</span>
                <p>{rootInsight?.lastAnswerPreview || copy.noAnswer}</p>
              </article>
            </div>

            <div className="agent-overview-footer">
              <div className="agent-overview-tools">
                <span>{copy.toolMix}</span>
                <div className="agent-thread-tool-row">
                  {rootInsight && rootInsight.tools.length > 0 ? (
                    rootInsight.tools.slice(0, 4).map((tool) => (
                      <span className="agent-tool-chip" key={tool.tool}>
                        {formatToolName(tool.tool)} x{tool.count}
                      </span>
                    ))
                  ) : (
                    <span className="agent-overview-empty">{copy.activeToolIdle}</span>
                  )}
                </div>
              </div>
              <div className="agent-overview-tools align-end">
                <span>{copy.sessionScope}</span>
                <div className="agent-thread-tool-row">
                  <span className="agent-tool-chip subtle">
                    {rootSession ? formatContentDateTime(rootSession.updatedAt, props.locale) : copy.noMessages}
                  </span>
                </div>
              </div>
            </div>
          </section>

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
                  const messageCitations = collectMessageCitations(entry.message.parts);

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
                          {messageCitations.length > 0 ? (
                            <span className="agent-chat-meta-badge">
                              {messageCitations.length} {copy.citations}
                            </span>
                          ) : null}
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
                  {rootInsight?.activeTool ? (
                    <span className="agent-session-badge accent">{formatToolName(rootInsight.activeTool)}</span>
                  ) : null}
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
