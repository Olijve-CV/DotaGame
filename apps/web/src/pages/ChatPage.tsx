import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  AgentApprovalPolicy,
  AgentApprovalRequest,
  AgentRun,
  AgentThread,
  AgentThreadDetail,
  AgentThreadSummary,
  ChatMode,
  Language
} from "@dotagame/contracts";
import {
  createAgentThread,
  fetchAgentThread,
  fetchAgentThreads,
  resolveAgentApproval,
  startAgentRun
} from "../lib/api";
import { formatContentDateTime } from "../lib/contentFormatting";

const labels = {
  "zh-CN": {
    kicker: "Agent Workspace",
    title: "把普通聊天改成真正可运行的多智能体工作台",
    summary:
      "Orchestrator 负责拆解任务，Researcher 负责检索知识和联网信息，Coach 负责输出结论。遇到联网动作时，你可以把它拦下来做人工确认。",
    newThread: "新建线程",
    localOnly: "未登录时只保留当前本地线程。",
    threadTitle: "任务线程",
    emptyThreads: "还没有线程。发送第一条任务后会自动创建。",
    noThreadSelected: "先创建一个线程，再让 agent 开始执行。",
    modeTitle: "运行模式",
    quick: "快速分析",
    coach: "教练模式",
    approvalTitle: "联网审批",
    approvalAlways: "每次确认",
    approvalAuto: "自动联网",
    starterTitle: "推荐起手任务",
    starters: [
      "帮我分析当前版本里 carry 什么时候会丢中期节奏。",
      "检索最近赛事和补丁，解释四号位为什么更强调开图和换线。",
      "把我的问题拆成对线、节奏、团战三个诊断步骤。"
    ],
    composeTitle: "给 Agent 一个任务",
    placeholder: "例如：结合最近补丁和赛事，帮我判断为什么我玩 carry 总是在 18 分钟前后掉节奏。",
    submit: "开始执行",
    running: "运行中...",
    messages: "消息流",
    timeline: "当前 Run",
    noTimeline: "提交任务后，这里会显示 orchestrator、subagent、tool 和 approval 的执行轨迹。",
    sources: "来源",
    pendingApproval: "等待人工确认",
    approve: "批准联网",
    reject: "拒绝联网",
    status: "状态",
    askAt: "更新时间",
    errorPrefix: "请求失败",
    emptyMessages: "还没有消息。先从左侧示例或下方输入框开始。",
    user: "你",
    assistant: "Agent",
    latestRun: "最新运行",
    threadStatus: {
      idle: "空闲",
      running: "执行中",
      waiting_approval: "待审批",
      completed: "已完成",
      failed: "失败"
    }
  },
  "en-US": {
    kicker: "Agent Workspace",
    title: "Replace one-shot chat with a real multi-agent console",
    summary:
      "The orchestrator breaks down the task, the researcher gathers knowledge and live web context, and the coach produces the final answer. Networked steps can stop for explicit human approval.",
    newThread: "New Thread",
    localOnly: "Anonymous usage keeps only the current local thread.",
    threadTitle: "Task Threads",
    emptyThreads: "No threads yet. Your first run will create one automatically.",
    noThreadSelected: "Create a thread first, then send a task to the agent.",
    modeTitle: "Run Mode",
    quick: "Quick Analysis",
    coach: "Coach Mode",
    approvalTitle: "Web Approval",
    approvalAlways: "Ask Every Time",
    approvalAuto: "Auto Allow",
    starterTitle: "Suggested Missions",
    starters: [
      "Explain why carry players lose their mid-game timing in the current patch.",
      "Search recent tournaments and patch notes, then explain why roaming support priorities changed.",
      "Break my issue into lane, timing, and teamfight diagnosis steps."
    ],
    composeTitle: "Give the agent a mission",
    placeholder:
      "Example: Use the latest patch and tournament context to explain why I keep stalling as carry around minute 18.",
    submit: "Run Agent",
    running: "Running...",
    messages: "Message Feed",
    timeline: "Current Run",
    noTimeline:
      "After you submit a mission, this panel will show the orchestrator, subagents, tools, and approvals used during the run.",
    sources: "Sources",
    pendingApproval: "Human Approval Needed",
    approve: "Approve Web Search",
    reject: "Reject Web Search",
    status: "Status",
    askAt: "Updated",
    errorPrefix: "Request failed",
    emptyMessages: "No messages yet. Start with a starter task or the composer below.",
    user: "You",
    assistant: "Agent",
    latestRun: "Latest Run",
    threadStatus: {
      idle: "Idle",
      running: "Running",
      waiting_approval: "Waiting Approval",
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
    newThread: string;
    localOnly: string;
    threadTitle: string;
    emptyThreads: string;
    noThreadSelected: string;
    modeTitle: string;
    quick: string;
    coach: string;
    approvalTitle: string;
    approvalAlways: string;
    approvalAuto: string;
    starterTitle: string;
    starters: string[];
    composeTitle: string;
    placeholder: string;
    submit: string;
    running: string;
    messages: string;
    timeline: string;
    noTimeline: string;
    sources: string;
    pendingApproval: string;
    approve: string;
    reject: string;
    status: string;
    askAt: string;
    errorPrefix: string;
    emptyMessages: string;
    user: string;
    assistant: string;
    latestRun: string;
    threadStatus: Record<"idle" | AgentRun["status"], string>;
  }
>;

function getLatestRun(detail: AgentThreadDetail | null): AgentRun | null {
  return detail?.runs[0] ?? null;
}

function getPendingApproval(run: AgentRun | null): AgentApprovalRequest | null {
  return run?.approvals.find((approval) => approval.status === "pending") ?? null;
}

function getThreadStatus(
  summary: AgentThreadSummary,
  copy: (typeof labels)["en-US"]
): string {
  return copy.threadStatus[summary.status];
}

export function ChatPage(props: { locale: Language; token: string | null }) {
  const [threadSummaries, setThreadSummaries] = useState<AgentThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<AgentThreadDetail | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ChatMode>("coach");
  const [approvalPolicy, setApprovalPolicy] = useState<AgentApprovalPolicy>("always");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = useMemo(() => labels[props.locale], [props.locale]);
  const latestRun = getLatestRun(activeThread);
  const pendingApproval = getPendingApproval(latestRun);

  useEffect(() => {
    let active = true;

    if (!props.token) {
      setThreadSummaries([]);
      setActiveThread(null);
      return;
    }

    fetchAgentThreads(props.token)
      .then(async (items) => {
        if (!active) {
          return;
        }

        setThreadSummaries(items);
        if (items[0]) {
          const detail = await fetchAgentThread(items[0].id, props.token);
          if (active) {
            setActiveThread(detail);
          }
        } else {
          setActiveThread(null);
        }
      })
      .catch(() => {
        if (active) {
          setThreadSummaries([]);
          setActiveThread(null);
        }
      });

    return () => {
      active = false;
    };
  }, [props.locale, props.token]);

  async function refreshThreads(selectedThreadId?: string) {
    if (!props.token) {
      return;
    }

    const items = await fetchAgentThreads(props.token);
    setThreadSummaries(items);

    const threadId = selectedThreadId ?? activeThread?.thread.id ?? items[0]?.id;
    if (!threadId) {
      setActiveThread(null);
      return;
    }

    setActiveThread(await fetchAgentThread(threadId, props.token));
  }

  async function ensureThread(): Promise<AgentThread> {
    if (activeThread) {
      return activeThread.thread;
    }

    const thread = await createAgentThread(
      {
        language: props.locale
      },
      props.token
    );
    const detail = await fetchAgentThread(thread.id, props.token);
    setActiveThread(detail);
    if (props.token) {
      await refreshThreads(thread.id);
    }
    return thread;
  }

  async function selectThread(threadId: string) {
    setLoading(true);
    setError(null);

    try {
      const detail = await fetchAgentThread(threadId, props.token);
      setActiveThread(detail);
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(`${copy.errorPrefix}: ${code}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateThread() {
    setLoading(true);
    setError(null);

    try {
      const thread = await createAgentThread(
        {
          language: props.locale
        },
        props.token
      );
      const detail = await fetchAgentThread(thread.id, props.token);
      setActiveThread(detail);
      setMessage("");
      if (props.token) {
        await refreshThreads(thread.id);
      }
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(`${copy.errorPrefix}: ${code}`);
    } finally {
      setLoading(false);
    }
  }

  async function runMission(nextMessage?: string) {
    const finalMessage = (nextMessage ?? message).trim();
    if (finalMessage.length < 2) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const thread = await ensureThread();
      const detail = await startAgentRun(
        thread.id,
        {
          message: finalMessage,
          mode,
          language: props.locale,
          approvalPolicy
        },
        props.token
      );
      setActiveThread(detail);
      setMessage("");
      if (props.token) {
        await refreshThreads(thread.id);
      }
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(`${copy.errorPrefix}: ${code}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveApproval(decision: "approve" | "reject") {
    if (!latestRun || !pendingApproval) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const detail = await resolveAgentApproval(
        latestRun.id,
        pendingApproval,
        decision,
        props.token
      );
      setActiveThread(detail);
      if (props.token) {
        await refreshThreads(detail.thread.id);
      }
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : "REQUEST_FAILED";
      setError(`${copy.errorPrefix}: ${code}`);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runMission();
  }

  return (
    <section className="stack agent-page">
      <section className="panel agent-hero">
        <div className="agent-hero-copy">
          <p className="section-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p className="dota-intro-summary">{copy.summary}</p>
        </div>

        <div className="agent-control-grid">
          <section className="agent-control-card">
            <p className="section-kicker">{copy.modeTitle}</p>
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

          <section className="agent-control-card">
            <p className="section-kicker">{copy.approvalTitle}</p>
            <div className="agent-toggle-row">
              <button
                className={approvalPolicy === "always" ? "active" : ""}
                onClick={() => setApprovalPolicy("always")}
                type="button"
              >
                {copy.approvalAlways}
              </button>
              <button
                className={approvalPolicy === "auto" ? "active" : ""}
                onClick={() => setApprovalPolicy("auto")}
                type="button"
              >
                {copy.approvalAuto}
              </button>
            </div>
          </section>
        </div>
      </section>

      <section className="agent-workspace">
        <aside className="panel agent-thread-rail">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Threads</p>
              <h3>{copy.threadTitle}</h3>
            </div>
            <button className="ghost-btn" onClick={handleCreateThread} type="button">
              {copy.newThread}
            </button>
          </div>

          <p className="muted agent-rail-note">{props.token ? copy.threadTitle : copy.localOnly}</p>

          <div className="agent-thread-list">
            {threadSummaries.length > 0 ? (
              threadSummaries.map((thread) => (
                <button
                  className={`agent-thread-card${
                    activeThread?.thread.id === thread.id ? " active" : ""
                  }`}
                  key={thread.id}
                  onClick={() => void selectThread(thread.id)}
                  type="button"
                >
                  <span className="agent-thread-status">{getThreadStatus(thread, copy)}</span>
                  <strong>{thread.title}</strong>
                  <p>{thread.lastMessage || copy.emptyThreads}</p>
                  <span className="agent-thread-time">
                    {formatContentDateTime(thread.updatedAt, props.locale)}
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">{copy.emptyThreads}</p>
            )}
          </div>

          <section className="agent-starter-card">
            <p className="section-kicker">Starter</p>
            <h4>{copy.starterTitle}</h4>
            <div className="agent-starter-list">
              {copy.starters.map((starter) => (
                <button key={starter} onClick={() => void runMission(starter)} type="button">
                  {starter}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="agent-main-stack">
          <section className="panel agent-message-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Feed</p>
                <h3>{copy.messages}</h3>
              </div>
              {activeThread ? (
                <span className="agent-thread-time">
                  {copy.askAt}: {formatContentDateTime(activeThread.thread.updatedAt, props.locale)}
                </span>
              ) : null}
            </div>

            {activeThread?.messages.length ? (
              <div className="agent-message-list">
                {activeThread.messages.map((entry) => (
                  <article
                    className={`agent-message-bubble agent-message-${entry.role}`}
                    key={entry.id}
                  >
                    <span className="agent-message-role">
                      {entry.role === "user" ? copy.user : copy.assistant}
                    </span>
                    <p>{entry.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">{copy.emptyMessages}</p>
            )}
          </section>

          <section className="panel agent-run-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Run</p>
                <h3>{copy.timeline}</h3>
              </div>
              {latestRun ? (
                <span className={`agent-run-status status-${latestRun.status}`}>
                  {copy.threadStatus[latestRun.status]}
                </span>
              ) : null}
            </div>

            {latestRun ? (
              <>
                <div className="agent-run-summary">
                  <p className="section-kicker">{copy.latestRun}</p>
                  <strong>{latestRun.summary}</strong>
                </div>

                <div className="agent-step-list">
                  {latestRun.steps.map((step) => (
                    <article className={`agent-step-card step-${step.status}`} key={step.id}>
                      <div className="agent-step-head">
                        <strong>{step.title}</strong>
                        <span>{step.agent}</span>
                      </div>
                      <p>{step.detail}</p>
                    </article>
                  ))}
                </div>

                {pendingApproval ? (
                  <section className="agent-approval-card">
                    <p className="section-kicker">{copy.pendingApproval}</p>
                    <h4>{pendingApproval.reason}</h4>
                    <p className="muted">{pendingApproval.inputSummary}</p>
                    <div className="agent-approval-actions">
                      <button
                        className="primary-btn"
                        disabled={loading}
                        onClick={() => void handleResolveApproval("approve")}
                        type="button"
                      >
                        {copy.approve}
                      </button>
                      <button
                        className="ghost-btn"
                        disabled={loading}
                        onClick={() => void handleResolveApproval("reject")}
                        type="button"
                      >
                        {copy.reject}
                      </button>
                    </div>
                  </section>
                ) : null}

                {latestRun.citations.length > 0 ? (
                  <section className="agent-source-grid">
                    <p className="section-kicker">Sources</p>
                    <div className="chat-citation-grid">
                      {latestRun.citations.map((citation) => (
                        <a
                          className="chat-citation-card"
                          href={citation.sourceUrl}
                          key={`${latestRun.id}-${citation.id}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <strong>{citation.title}</strong>
                          <span>{citation.source}</span>
                        </a>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="agent-empty-state">
                <p className="muted">
                  {activeThread ? copy.noTimeline : copy.noThreadSelected}
                </p>
              </div>
            )}
          </section>

          <section className="panel agent-compose-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Compose</p>
                <h3>{copy.composeTitle}</h3>
              </div>
              {error ? <span className="agent-error-text">{error}</span> : null}
            </div>

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
                  {copy.status}:{" "}
                  {latestRun ? copy.threadStatus[latestRun.status] : copy.threadStatus.idle}
                </p>
                <button className="primary-btn chat-submit" disabled={loading} type="submit">
                  {loading ? copy.running : copy.submit}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </section>
  );
}
