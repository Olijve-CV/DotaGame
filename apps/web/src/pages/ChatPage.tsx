import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  AgentKind,
  AgentMessage,
  AgentMessagePart,
  AgentSession,
  AgentSessionDetail,
  AgentSessionEvent,
  AgentSessionSummary,
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
    history: "已保存会话",
    historyHint: "登录后会自动保存并展示最近会话。",
    guestTitle: "临时对话",
    guestHint: "当前为游客模式，对话仅在本次页面停留期间可见，不会保存到账号历史。",
    newSession: "新建会话",
    placeholder: "例如：结合最近版本、比赛和通用思路，分析我 18 分钟左右 carry 节奏为什么总断。",
    submit: "发送",
    sending: "处理中...",
    noSessions: "还没有已保存会话。",
    noMessages: "发送第一条消息开始对话。",
    user: "你",
    tool: "工具",
    taskCall: "任务分派",
    toolCall: "工具调用",
    citations: "参考来源",
    status: {
      idle: "空闲",
      running: "处理中",
      completed: "已完成",
      failed: "失败"
    },
    agents: {
      orchestrator: "主 Agent",
      researcher: "Researcher",
      coach: "Coach"
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
    sending: "Running...",
    noSessions: "No saved chats yet.",
    noMessages: "Send the first message to start the conversation.",
    user: "You",
    tool: "Tool",
    taskCall: "Task",
    toolCall: "Tool",
    citations: "Sources",
    status: {
      idle: "Idle",
      running: "Running",
      completed: "Completed",
      failed: "Failed"
    },
    agents: {
      orchestrator: "Primary Agent",
      researcher: "Researcher",
      coach: "Coach"
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
    tool: string;
    taskCall: string;
    toolCall: string;
    citations: string;
    status: Record<AgentSession["status"], string>;
    agents: Record<AgentKind, string>;
  }
>;

const starterMap: Record<Language, string[]> = {
  "zh-CN": [
    "分析一下最近版本里 carry 节奏容易断的关键时间点。",
    "先让 Researcher 看版本和比赛，再让 Coach 给我一个 support 训练计划。",
    "把我的问题拆成对线、节奏和团战三个阶段分别讲。"
  ],
  "en-US": [
    "Explain which timing windows usually break carry tempo in the current patch.",
    "Have the researcher review recent patches and tournaments, then let the coach give me a support practice plan.",
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

  return copy.agents[entry.session.agent];
}

function getSpeakerTone(entry: ThreadEntry): string {
  if (entry.message.role === "user") {
    return "user";
  }
  if (entry.message.role === "tool") {
    return "tool";
  }

  return entry.session.agent;
}

function renderPartTitle(part: AgentMessagePart, locale: Language) {
  const copy = labels[locale];
  if (part.type === "task_call") {
    return `${copy.taskCall} · ${copy.agents[part.subagent]}`;
  }
  if (part.type === "tool_call") {
    return `${copy.toolCall} · ${part.tool}`;
  }
  return null;
}

export function ChatPage(props: { locale: Language; token: string | null }) {
  const copy = useMemo(() => labels[props.locale], [props.locale]);
  const starters = useMemo(() => starterMap[props.locale], [props.locale]);
  const isLoggedIn = Boolean(props.token);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const [rootSessions, setRootSessions] = useState<AgentSessionSummary[]>([]);
  const [rootDetail, setRootDetail] = useState<AgentSessionDetail | null>(null);
  const [childDetails, setChildDetails] = useState<Record<string, AgentSessionDetail>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootSession = rootDetail?.session ?? null;
  const rootSessionId = rootDetail?.session.id ?? null;
  const childIdsKey = rootDetail?.children.map((child) => child.id).join("|") ?? "";

  const threadEntries = useMemo(() => {
    if (!rootDetail) {
      return [];
    }

    const details = [
      rootDetail,
      ...rootDetail.children
        .map((child) => childDetails[child.id])
        .filter((detail): detail is AgentSessionDetail => Boolean(detail))
    ];

    return details
      .flatMap((detail) =>
        detail.messages.map((entry) => ({
          message: entry,
          session: detail.session
        }))
      )
      .sort(sortThreadEntries);
  }, [childDetails, rootDetail]);

  function replaceRoot(detail: AgentSessionDetail | null) {
    setRootDetail(detail);
    setChildDetails({});
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
    if (!rootDetail) {
      return;
    }

    const missingChildren = rootDetail.children.filter((child) => !childDetails[child.id]);
    if (missingChildren.length === 0) {
      return;
    }

    let active = true;

    Promise.all(
      missingChildren.map(async (child) => {
        try {
          const detail = await fetchAgentSession(child.id, props.token);
          return [child.id, detail] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (!active) {
        return;
      }

      setChildDetails((current) => {
        const next = { ...current };
        for (const item of results) {
          if (!item) {
            continue;
          }
          next[item[0]] = item[1];
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [childDetails, childIdsKey, props.token, rootDetail, rootSessionId]);

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
      if (detail.session.id === rootSessionId) {
        setRootDetail(detail);
        upsertRootSummary(toSummary(detail));
        return;
      }

      setChildDetails((current) => ({
        ...current,
        [detail.session.id]: detail
      }));
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
  }, [threadEntries, loading]);

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
                  const visibleParts = entry.message.parts.filter((part) => part.type !== "text");
                  const speakerTone = getSpeakerTone(entry);
                  const isUser = entry.message.role === "user";

                  return (
                    <article
                      className={`agent-chat-message${isUser ? " is-user" : ""}${
                        entry.session.kind === "subagent" ? " is-subagent" : ""
                      }`}
                      key={entry.message.id}
                    >
                      <div className="agent-chat-bubble">
                        <div className="agent-chat-meta">
                          <span className={`agent-speaker-pill tone-${speakerTone}`}>
                            {getSpeakerLabel(entry, props.locale)}
                          </span>
                          <span>{formatContentDateTime(entry.message.createdAt, props.locale)}</span>
                        </div>

                        <p className="agent-chat-content">{entry.message.content}</p>

                        {visibleParts.length > 0 ? (
                          <div className="message-part-list">
                            {visibleParts.map((part, index) => (
                              <div className={`message-part-card part-${part.type}`} key={`${entry.message.id}-${index}`}>
                                {renderPartTitle(part, props.locale) ? (
                                  <strong>{renderPartTitle(part, props.locale)}</strong>
                                ) : null}

                                {part.type === "task_call" ? (
                                  <p>{part.summary}</p>
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
