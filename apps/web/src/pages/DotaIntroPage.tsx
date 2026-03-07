import type { Language } from "@dotagame/contracts";
import { DotaIntroManual } from "../components/DotaIntroManual";
import { DotaIntroSection } from "../components/DotaIntroSection";

const copyMap = {
  "zh-CN": {
    kicker: "Research-Driven Intro",
    title: "把 Dota 2 解释成一张能被读懂的战略地图",
    summary:
      "这一页按照仓库内 2026-03-07 的领域研究文档重构。重点不再是堆英雄名词，而是先把胜利条件、比赛循环、系统支柱和玩家学习路径讲清楚。",
    cards: [
      { label: "研究快照", value: "2026-03-07" },
      { label: "英雄规模", value: "127 位英雄" },
      { label: "知识分层", value: "常识系统 + 实时版本" }
    ]
  },
  "en-US": {
    kicker: "Research-Driven Intro",
    title: "Read Dota 2 as a strategic map instead of a pile of hero trivia",
    summary:
      "This page is rebuilt from the repository research notes dated March 7, 2026. The emphasis is now on win condition, match loop, system pillars, and learning paths before hero-specific details.",
    cards: [
      { label: "Research Snapshot", value: "2026-03-07" },
      { label: "Hero Pool", value: "127 heroes" },
      { label: "Knowledge Layers", value: "Evergreen systems + live patch context" }
    ]
  }
} satisfies Record<
  Language,
  {
    kicker: string;
    title: string;
    summary: string;
    cards: Array<{ label: string; value: string }>;
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
        </div>

        <div className="intro-page-card-grid">
          {copy.cards.map((card) => (
            <article className="intro-page-card" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <DotaIntroManual locale={props.locale} />

      <div id="hero-atlas">
        <DotaIntroSection locale={props.locale} />
      </div>
    </section>
  );
}
