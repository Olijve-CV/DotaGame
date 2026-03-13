import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Language } from "@dotagame/contracts";
import { DotaIntroManual } from "../components/DotaIntroManual";
import { DotaIntroSection } from "../components/DotaIntroSection";
import { fetchHeroAvatars } from "../lib/api";

type IntroAnchor = {
  href: string;
  label: string;
  title: string;
  detail: string;
};

type IntroTrack = {
  title: string;
  detail: string;
};

type IntroPageCopy = {
  kicker: string;
  title: string;
  summary: string;
  pulseTag: string;
  routeStatus: string;
  manualMode: string;
  cards: Array<{ label: string; value: string }>;
  anchorsKicker: string;
  anchorsTitle: string;
  anchors: IntroAnchor[];
  tracksKicker: string;
  tracksTitle: string;
  tracks: IntroTrack[];
  missionKicker: string;
  missionTitle: string;
  missionSummary: string;
  missionSteps: string[];
  railKicker: string;
  railTitle: string;
  railSummary: string;
  railPoints: string[];
  atlasKicker: string;
  atlasTitle: string;
  atlasSummary: string;
  actions: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
};

const copyMap: Record<Language, IntroPageCopy> = {
  "zh-CN": {
    kicker: "Field Manual",
    title: "先把比赛结构搭起来，再往里填英雄、路线和对局判断。",
    summary:
      "这一页不再把新手知识拆成几块孤立模块，而是按照真实学习顺序重排：先理解地图与目标，再抓前几局最该练的习惯，最后再去查英雄图谱和对局问答。",
    pulseTag: "学习路径已重排",
    routeStatus: "推荐阅读顺序",
    manualMode: "系统认知 -> 实战习惯 -> 英雄细节",
    cards: [
      { label: "研究快照", value: "2026-03-07" },
      { label: "英雄总量", value: "127 位英雄" },
      { label: "阅读方式", value: "系统认知 -> 练习路径 -> 英雄图谱" }
    ],
    anchorsKicker: "Guide Route",
    anchorsTitle: "按这条路径读，信息会连成一个完整模型。",
    anchors: [
      {
        href: "#systems",
        label: "01",
        title: "比赛系统",
        detail: "先认清胜利条件、经济、视野、地图和节奏。"
      },
      {
        href: "#match-loop",
        label: "02",
        title: "对局链路",
        detail: "把一局比赛从选人到终结按阶段串起来。"
      },
      {
        href: "#practice-track",
        label: "03",
        title: "前五局练习",
        detail: "只盯最关键的习惯，不让信息量把人压垮。"
      },
      {
        href: "#heroes",
        label: "04",
        title: "英雄图谱",
        detail: "最后再进入英雄池，会更容易记住差异。"
      }
    ],
    tracksKicker: "Focus Tracks",
    tracksTitle: "不同阶段需要的不是更多信息，而是更对顺序。",
    tracks: [
      {
        title: "第一次接触",
        detail: "把注意力收缩到地图、兵线、死亡原因和目标转换，不急着背复杂连招。"
      },
      {
        title: "开始打匹配",
        detail: "把自己的错误拆成可复盘的项目：对线、时机、视野、站位和出装。"
      },
      {
        title: "准备深入英雄",
        detail: "当你已经知道为什么要推进、何时要接团，再去看英雄克制和技能细节。"
      }
    ],
    missionKicker: "How To Use",
    missionTitle: "把这一页当成一张学习作战图，而不是百科全书。",
    missionSummary: "建议的使用方式很简单：先建立框架，再挑一两个可执行动作去打下一局。",
    missionSteps: [
      "先读比赛框架和系统支柱，知道一局比赛真正围绕什么转。",
      "再看前五局练习，把下一把最值得练的动作固定下来。",
      "最后按需打开英雄图谱或去智能问答，把问题问得更具体。"
    ],
    railKicker: "Agent Bridge",
    railTitle: "看完指南后，直接把问题丢给对局问答。",
    railSummary: "指南负责搭框架，Agent 更适合处理“这一把为什么输”“我该先改什么”这类局内问题。",
    railPoints: [
      "问对线为什么崩，比问这个英雄强不强更有效。",
      "问什么时候该打目标，比只看击杀数更接近 Dota 的核心。",
      "问当前局先补保命还是先补输出，能把指南知识落到实战。"
    ],
    atlasKicker: "Hero Atlas",
    atlasTitle: "框架建立之后，再进入英雄与技能细节。",
    atlasSummary: "下面的模块保留为独立英雄入口。你可以继续顺着页面往下读，也可以直接跳转到完整英雄图谱页。",
    actions: {
      primary: "从比赛系统开始",
      secondary: "打开英雄图谱",
      tertiary: "去智能问答"
    }
  },
  "en-US": {
    kicker: "Field Manual",
    title: "Build the match model first, then layer heroes, lanes, and game decisions on top.",
    summary:
      "This page no longer reads like disconnected modules. It now follows a practical learning order: understand map and objectives first, lock in the habits that matter across your first games, and only then move into hero atlas browsing or match-specific questions.",
    pulseTag: "Guide route restructured",
    routeStatus: "Recommended order",
    manualMode: "Systems -> habits -> hero detail",
    cards: [
      { label: "Research Snapshot", value: "2026-03-07" },
      { label: "Hero Pool", value: "127 heroes" },
      { label: "Reading Order", value: "Systems -> practice track -> hero atlas" }
    ],
    anchorsKicker: "Guide Route",
    anchorsTitle: "Read it in this order so the whole page behaves like one model.",
    anchors: [
      {
        href: "#systems",
        label: "01",
        title: "System layer",
        detail: "Start with win condition, economy, vision, map, and tempo."
      },
      {
        href: "#match-loop",
        label: "02",
        title: "Match chain",
        detail: "See how a game connects from draft to lane to closure."
      },
      {
        href: "#practice-track",
        label: "03",
        title: "First-game track",
        detail: "Keep attention on a few habits instead of drowning in details."
      },
      {
        href: "#heroes",
        label: "04",
        title: "Hero atlas",
        detail: "Hero differences are easier to retain once the system model is stable."
      }
    ],
    tracksKicker: "Focus Tracks",
    tracksTitle: "What matters is not more information, but the right sequence.",
    tracks: [
      {
        title: "First contact",
        detail: "Compress your focus down to map reading, lane state, deaths, and objective conversion instead of flashy execution."
      },
      {
        title: "Starting real matches",
        detail: "Turn mistakes into review buckets: lane, timing, vision, positioning, and item decisions."
      },
      {
        title: "Going deeper on heroes",
        detail: "Once you understand when to fight or push, hero matchups and skill details finally stick."
      }
    ],
    missionKicker: "How To Use",
    missionTitle: "Treat this page like a learning operations map, not an encyclopedia.",
    missionSummary: "The intended workflow is simple: build the frame first, then take one or two executable habits into your next game.",
    missionSteps: [
      "Read the match frame and system pillars so you understand what a game is actually rotating around.",
      "Use the first-five-games block to lock in the next habit worth practicing.",
      "Open the hero atlas or agent chat only after the question is specific enough."
    ],
    railKicker: "Agent Bridge",
    railTitle: "After the guide, move straight into match Q&A.",
    railSummary: "The guide builds the model. Agent Chat is better for questions like why a game was lost or which habit to fix first.",
    railPoints: [
      "Asking why your lane collapsed is more useful than asking whether a hero is strong in general.",
      "Asking when to play objectives is closer to Dota's real core than staring at kills.",
      "Asking whether to buy survivability or damage first turns the guide into an actual in-game decision."
    ],
    atlasKicker: "Hero Atlas",
    atlasTitle: "Move into hero and skill details after the structure is already clear.",
    atlasSummary: "The module below stays as the hero entry point. Keep scrolling through it here or jump directly to the dedicated hero atlas page.",
    actions: {
      primary: "Start with systems",
      secondary: "Open Hero Atlas",
      tertiary: "Ask Agent Chat"
    }
  }
};

export function DotaIntroPage(props: { locale: Language }) {
  const copy = copyMap[props.locale];
  const [heroCount, setHeroCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    fetchHeroAvatars(props.locale)
      .then((items) => {
        if (active) {
          setHeroCount(items.length);
        }
      })
      .catch(() => {
        if (active) {
          setHeroCount(null);
        }
      });

    return () => {
      active = false;
    };
  }, [props.locale]);

  const cards = useMemo(() => {
    return copy.cards.map((card) => {
      if (card.label === "英雄总量") {
        return {
          ...card,
          value: heroCount == null ? card.value : `${heroCount} 位英雄`
        };
      }

      if (card.label === "Hero Pool") {
        return {
          ...card,
          value: heroCount == null ? card.value : `${heroCount} heroes`
        };
      }

      return card;
    });
  }, [copy.cards, heroCount]);

  return (
    <section className="stack intro-guide-page">
      <section className="panel intro-command-deck">
        <div className="intro-command-main">
          <div className="intro-command-copy">
            <div className="intro-command-topline">
              <p className="section-kicker">{copy.kicker}</p>
              <span className="intro-route-pill">{copy.pulseTag}</span>
            </div>
            <h2>{copy.title}</h2>
            <p className="dota-intro-summary">{copy.summary}</p>
          </div>

          <div className="intro-page-actions">
            <a className="primary-btn" href="#systems">
              {copy.actions.primary}
            </a>
            <Link className="ghost-btn" to="/heroes">
              {copy.actions.secondary}
            </Link>
            <Link className="ghost-btn" to="/chat">
              {copy.actions.tertiary}
            </Link>
          </div>

          <div className="intro-route-strip">
            <article className="intro-route-card">
              <span>{copy.routeStatus}</span>
              <strong>{copy.manualMode}</strong>
            </article>
          </div>

          <div className="intro-page-card-grid">
            {cards.map((card) => (
              <article className="intro-page-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>
        </div>

        <aside className="intro-command-rail">
          <article className="intro-mission-card">
            <p className="section-kicker">{copy.missionKicker}</p>
            <h3>{copy.missionTitle}</h3>
            <p>{copy.missionSummary}</p>

            <ol className="intro-mission-list">
              {copy.missionSteps.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </article>

          <article className="intro-support-card">
            <p className="section-kicker">{copy.railKicker}</p>
            <h3>{copy.railTitle}</h3>
            <p>{copy.railSummary}</p>

            <div className="intro-support-points">
              {copy.railPoints.map((point) => (
                <article className="intro-support-point" key={point}>
                  <p>{point}</p>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="intro-guide-band">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{copy.anchorsKicker}</p>
            <h3>{copy.anchorsTitle}</h3>
          </div>
        </div>

        <div className="intro-anchor-grid">
          {copy.anchors.map((item) => (
            <a className="intro-anchor-card" href={item.href} key={item.href}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="panel intro-track-band">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{copy.tracksKicker}</p>
            <h3>{copy.tracksTitle}</h3>
          </div>
        </div>

        <div className="intro-track-grid">
          {copy.tracks.map((track) => (
            <article className="intro-track-card" key={track.title}>
              <h4>{track.title}</h4>
              <p>{track.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="intro-guide-layout">
        <div className="intro-page-anchor" id="systems">
          <DotaIntroManual locale={props.locale} />
        </div>

        <aside className="panel intro-side-rail">
          <div className="section-heading">
            <div>
              <p className="section-kicker">{copy.railKicker}</p>
              <h3>{copy.railTitle}</h3>
            </div>
          </div>

          <p className="intro-side-summary">{copy.railSummary}</p>

          <div className="intro-side-list">
            {copy.railPoints.map((point) => (
              <article className="intro-side-card" key={`side-${point}`}>
                <p>{point}</p>
              </article>
            ))}
          </div>

          <div className="intro-page-actions intro-side-actions">
            <Link className="primary-btn" to="/chat">
              {copy.actions.tertiary}
            </Link>
            <Link className="ghost-btn" to="/heroes">
              {copy.actions.secondary}
            </Link>
          </div>
        </aside>
      </section>

      <section className="panel intro-atlas-head" id="heroes">
        <div>
          <p className="section-kicker">{copy.atlasKicker}</p>
          <h3>{copy.atlasTitle}</h3>
          <p className="dota-intro-summary compact">{copy.atlasSummary}</p>
        </div>

        <div className="intro-page-actions intro-atlas-actions">
          <Link className="primary-btn" to="/heroes">
            {copy.actions.secondary}
          </Link>
          <Link className="ghost-btn" to="/chat">
            {copy.actions.tertiary}
          </Link>
        </div>
      </section>

      <DotaIntroSection locale={props.locale} />
    </section>
  );
}
