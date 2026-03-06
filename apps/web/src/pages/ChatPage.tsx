import { useMemo, useState } from "react";
import type { ChatResponse, Language } from "@dotagame/contracts";
import { askChat } from "../lib/api";

const labels = {
  "zh-CN": {
    title: "Agent Chat",
    quick: "快速问答",
    coach: "学习指导",
    placeholder: "例如：7.39a 版本主核英雄怎么选？",
    ask: "发送",
    confidence: "置信度",
    citations: "引用来源"
  },
  "en-US": {
    title: "Agent Chat",
    quick: "Quick Q&A",
    coach: "Coaching",
    placeholder: "Example: How should I pick carry heroes in patch 7.39a?",
    ask: "Send",
    confidence: "Confidence",
    citations: "Citations"
  }
};

export function ChatPage(props: { locale: Language; token: string | null }) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"quick" | "coach">("quick");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const text = useMemo(() => labels[props.locale], [props.locale]);

  async function submit() {
    if (question.trim().length < 2) {
      return;
    }
    setLoading(true);
    try {
      const result = await askChat(
        {
          question: question.trim(),
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

  return (
    <section className="stack">
      <div className="panel">
        <h2>{text.title}</h2>
        <div className="chat-controls">
          <select value={mode} onChange={(event) => setMode(event.target.value as "quick" | "coach")}>
            <option value="quick">{text.quick}</option>
            <option value="coach">{text.coach}</option>
          </select>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={text.placeholder}
          />
          <button disabled={loading} onClick={submit}>
            {loading ? "..." : text.ask}
          </button>
        </div>
      </div>

      {response && (
        <div className="panel">
          <p>{response.answer}</p>
          <p className="muted">
            {text.confidence}: {response.confidence}
          </p>
          <h3>{text.citations}</h3>
          {response.citations.map((citation) => (
            <a key={citation.id} href={citation.sourceUrl} className="citation" target="_blank" rel="noreferrer">
              {citation.title} · {citation.source}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
