import { Link } from "react-router-dom";
import type { Language } from "@dotagame/contracts";
import { DotaIntroManual } from "../components/DotaIntroManual";
import { DotaIntroSection } from "../components/DotaIntroSection";

const copyMap = {
  "zh-CN": {
    kicker: "Research-Driven Intro",
    title: "先把 Dota 2 当成一张战略地图，再去记英雄细节",
    summary:
      "这一页把研究笔记重排成更适合入门的阅读顺序。先理解胜利条件、比赛循环和系统支柱，再进入定位、英雄与图谱细节，信息会更容易连成一体。",
    cards: [
      { label: "研究快照", value: "2026-03-07" },
      { label: "英雄总量", value: "127 位英雄" },
      { label: "知识层", value: "常驻系统认知 + 版本上下文" }
    ],
    outlineKicker: "Page Map",
    outlineTitle: "按系统到英雄的顺序阅读，这一页会更容易吸收。",
    actions: {
      primary: "先看系统导览",
      secondary: "跳到英雄图谱"
    },
    outline: [
      {
        step: "01",
        title: "先建立比赛框架",
        detail: "先理解地图、经济、视野与目标物如何串成一局比赛。"
      },
      {
        step: "02",
        title: "再看新手练习路径",
        detail: "把前几局该练什么、为什么练什么先固定下来。"
      },
      {
        step: "03",
        title: "最后进入英雄图谱",
        detail: "等框架稳定后，再按定位和英雄差异去记忆会更轻松。"
      }
    ]
  },
  "en-US": {
    kicker: "Research-Driven Intro",
    title: "Read Dota 2 as a strategic map instead of a pile of hero trivia",
    summary:
      "This page is rebuilt into a cleaner reading path. Start with win condition, match loop, and system pillars first, then move into roles, onboarding habits, and hero-level details once the model is stable.",
    cards: [
      { label: "Research Snapshot", value: "2026-03-07" },
      { label: "Hero Pool", value: "127 heroes" },
      { label: "Knowledge Layers", value: "Evergreen systems + live patch context" }
    ],
    outlineKicker: "Page Map",
    outlineTitle: "Move from systems to heroes in this order so the page reads as one coherent model.",
    actions: {
      primary: "Start with field primer",
      secondary: "Jump to hero atlas"
    },
    outline: [
      {
        step: "01",
        title: "Build the match model first",
        detail: "Start with map control, economy, vision, and objectives before memorizing hero specifics."
      },
      {
        step: "02",
        title: "Use the first-game practice track",
        detail: "Turn the concepts into simple habits you can test across your next few matches."
      },
      {
        step: "03",
        title: "Then drill into the hero atlas",
        detail: "Role filters and hero spotlights make more sense once the system layer is already clear."
      }
    ]
  }
} satisfies Record<
  Language,
  {
    kicker: string;
    title: string;
    summary: string;
    cards: Array<{ label: string; value: string }>;
    outlineKicker: string;
    outlineTitle: string;
    actions: {
      primary: string;
      secondary: string;
    };
    outline: Array<{
      step: string;
      title: string;
      detail: string;
    }>;
  }
>;

export function DotaIntroPage(props: { locale: Language }) {
  const copy = copyMap[props.locale];

  return (
    <section className="stack intro-page">
      <section className="panel intro-page-hero">
        <div className="intro-page-copy">
          <p className="section-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p className="dota-intro-summary">{copy.summary}</p>

          <div className="intro-page-actions">
            <a className="primary-btn" href="#research-manual">
              {copy.actions.primary}
            </a>
            <Link className="ghost-btn" to="/heroes">
              {copy.actions.secondary}
            </Link>
          </div>
        </div>

        <aside className="intro-page-side-panel">
          <div className="intro-page-side-copy">
            <p className="section-kicker">{copy.outlineKicker}</p>
            <p className="intro-page-side-summary">{copy.outlineTitle}</p>
          </div>

          <div className="intro-page-card-grid">
            {copy.cards.map((card) => (
              <article className="intro-page-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel intro-page-outline">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{copy.outlineKicker}</p>
            <h3>{copy.outlineTitle}</h3>
          </div>
        </div>

        <div className="intro-page-outline-grid">
          {copy.outline.map((item) => (
            <article className="intro-page-outline-card" key={item.step}>
              <span>{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="intro-page-anchor" id="research-manual">
        <DotaIntroManual locale={props.locale} />
      </div>

      <DotaIntroSection locale={props.locale} />
    </section>
  );
}
