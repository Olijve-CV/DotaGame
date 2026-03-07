import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ChatResponse, Language } from "@dotagame/contracts";
import { askChat, fetchChatSessions } from "../lib/api";
import { formatContentDateTime } from "../lib/contentFormatting";

const labels = {
  "zh-CN": {
    kicker: "Agent Console",
    title: "把模糊问题整理成可执行的战术判断",
    summary:
      "适合拿来问对线、出装、版本变化、阵容思路和比赛复盘。快速问答更像情报检索，战术模式更像教练复盘。",
    quick: "快速问答",
    coach: "战术复盘",
    placeholder: "例如：7.39a 里我玩 1 号位为什么总是接不了中期团？",
    ask: "发送问题",
    asking: "分析中...",
    confidence: "置信度",
    citations: "引用来源",
    followUps: "建议继续追问",
    noResponse: "输入一个更具体的问题，结果会更有价值。",
    emptyStateTitle: "还没有生成回答",
    emptyStateDetail: "尽量把英雄、位置、时间点、对线问题或版本背景说清楚，回答会明显更准。",
    starterTitle: "常见起手问题",
    historyTitle: "最近问答",
    historyEmpty: "登录后发起问答，最近记录会出现在这里。",
    reuseQuestion: "再次提问",
    askedAt: "提问时间",
    starters: [
      "我线上总是被压，先修补刀还是先修站位？",
      "这个英雄现在强，是因为对线还是因为版本节奏？",
      "我们领先却上不了高地，最可能的问题是什么？"
    ]
  },
  "en-US": {
    kicker: "Agent Console",
    title: "Turn vague Dota questions into actionable reads",
    summary:
      "Use this for lane problems, item decisions, patch shifts, draft logic, and match review. Quick mode behaves more like retrieval; coaching mode leans into interpretation.",
    quick: "Quick Q&A",
    coach: "Coaching",
    placeholder: "Example: In 7.39a, why do I keep missing my mid-game timings as carry?",
    ask: "Send Question",
    asking: "Analyzing...",
    confidence: "Confidence",
    citations: "Sources",
    followUps: "Suggested Follow-Ups",
    noResponse: "Ask a more specific question to get a better answer.",
    emptyStateTitle: "No answer yet",
    emptyStateDetail: "Include the hero, role, timing window, lane problem, or patch context to make the response sharper.",
    starterTitle: "Reliable Opening Questions",
    historyTitle: "Recent Sessions",
    historyEmpty: "Ask something while logged in and your recent sessions will appear here.",
    reuseQuestion: "Reuse Question",
    askedAt: "Asked At",
    starters: [
      "I lose lane a lot. Should I fix last hits or positioning first?",
      "Is this hero strong because of lane pressure or because of patch tempo?",
      "We are ahead but cannot break high ground. What are we missing?"
    ]
  }
};

export function ChatPage(props: { locale: Language; token: string | null }) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"quick" | "coach">("quick");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; question: string; answer: string; createdAt: string }>>([]);
  const text = useMemo(() => labels[props.locale], [props.locale]);

  useEffect(() => {
    if (!props.token) {
      setHistory([]);
      return;
    }

    let active = true;
    fetchChatSessions(props.token)
      .then((items) => {
        if (active) {
          setHistory(items.slice(0, 5));
        }
      })
      .catch(() => {
        if (active) {
          setHistory([]);
        }
      });

    return () => {
      active = false;
    };
  }, [props.token, response]);

  async function submit(nextQuestion?: string) {
    const finalQuestion = (nextQuestion ?? question).trim();
    if (finalQuestion.length < 2) {
      return;
    }

    setLoading(true);
    if (nextQuestion) {
      setQuestion(finalQuestion);
    }

    try {
      const result = await askChat(
        {
          question: finalQuestion,
          mode,
          language: props.locale
        },
        props.token
      );
      setResponse(result);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <section className="stack chat-page">
      <section className="chat-top-grid">
        <section className="panel chat-hero">
          <div className="chat-hero-copy">
            <p className="section-kicker">{text.kicker}</p>
            <h2>{text.title}</h2>
            <p className="dota-intro-summary">{text.summary}</p>
          </div>

          <div className="chat-starter-panel">
            <p className="section-kicker">Starter</p>
            <h3>{text.starterTitle}</h3>
            <div className="chat-starter-list">
              {text.starters.map((starter) => (
                <button
                  className="chat-starter-card"
                  key={starter}
                  onClick={() => void submit(starter)}
                  type="button"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="panel chat-history-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">History</p>
              <h3>{text.historyTitle}</h3>
            </div>
          </div>

          {history.length > 0 ? (
            <div className="chat-history-list">
              {history.map((item) => (
                <article className="chat-history-card" key={item.id}>
                  <span className="chat-history-time">
                    {text.askedAt}: {formatContentDateTime(item.createdAt, props.locale)}
                  </span>
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                  <button
                    className="text-btn"
                    onClick={() => {
                      setQuestion(item.question);
                      void submit(item.question);
                    }}
                    type="button"
                  >
                    {text.reuseQuestion}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">{text.historyEmpty}</p>
          )}
        </section>
      </section>

      <section className="panel chat-console">
        <form className="chat-form" onSubmit={handleSubmit}>
          <div className="chat-mode-row">
            <button
              className={mode === "quick" ? "active" : ""}
              onClick={() => setMode("quick")}
              type="button"
            >
              {text.quick}
            </button>
            <button
              className={mode === "coach" ? "active" : ""}
              onClick={() => setMode("coach")}
              type="button"
            >
              {text.coach}
            </button>
          </div>

          <div className="chat-compose-row">
            <textarea
              className="chat-question-input"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={text.placeholder}
              rows={4}
              value={question}
            />
            <div className="chat-submit-column">
              <button className="primary-btn chat-submit" disabled={loading} type="submit">
                {loading ? text.asking : text.ask}
              </button>
              <p className="muted">{text.noResponse}</p>
            </div>
          </div>
        </form>
      </section>

      {response ? (
        <section className="panel chat-response-panel">
          <div className="chat-response-head">
            <div>
              <p className="section-kicker">Answer</p>
              <h3>{mode === "quick" ? text.quick : text.coach}</h3>
            </div>
            <div className="chat-confidence-card">
              <span>{text.confidence}</span>
              <strong>{Math.round(response.confidence * 100)}%</strong>
            </div>
          </div>

          <article className="chat-answer-card">
            <p>{response.answer}</p>
          </article>

          {response.followUps.length > 0 && (
            <section className="chat-followups">
              <h4>{text.followUps}</h4>
              <div className="chat-followup-list">
                {response.followUps.map((followUp) => (
                  <button
                    className="chat-followup-chip"
                    key={followUp}
                    onClick={() => void submit(followUp)}
                    type="button"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="chat-citation-section">
            <h4>{text.citations}</h4>
            <div className="chat-citation-grid">
              {response.citations.map((citation) => (
                <a
                  className="chat-citation-card"
                  href={citation.sourceUrl}
                  key={citation.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <strong>{citation.title}</strong>
                  <span>{citation.source}</span>
                </a>
              ))}
            </div>
          </section>
        </section>
      ) : (
        <section className="panel chat-empty-panel">
          <div className="chat-empty-card">
            <p className="section-kicker">Ready</p>
            <h3>{text.emptyStateTitle}</h3>
            <p className="muted">{text.emptyStateDetail}</p>
          </div>
        </section>
      )}
    </section>
  );
}
