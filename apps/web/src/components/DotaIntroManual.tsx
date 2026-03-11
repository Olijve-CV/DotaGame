import type { Language } from "@dotagame/contracts";

type ManualCopy = {
  kicker: string;
  title: string;
  summary: string;
  overview: Array<{ label: string; value: string }>;
  loopTitle: string;
  loop: Array<{ step: string; title: string; detail: string }>;
  pillarsTitle: string;
  pillars: Array<{ title: string; detail: string }>;
  segmentsTitle: string;
  segments: Array<{ title: string; detail: string }>;
  firstGamesTitle: string;
  firstGames: Array<{ step: string; title: string; detail: string }>;
  promptsTitle: string;
  prompts: string[];
};

const copyMap: Record<Language, ManualCopy> = {
  "zh-CN": {
    kicker: "Field Primer",
    title: "先理解比赛循环，再去背英雄细节",
    summary:
      "研究文档里最重要的结论是：Dota 2 不是一个“英雄互殴游戏”，而是一个由地图控制、经济时机、目标争夺、视野信息和团战执行共同构成的策略系统。只学技能名字，永远会学得很碎。",
    overview: [
      { label: "真正目标", value: "摧毁敌方远古遗迹，而不是只看击杀数。" },
      { label: "主要难点", value: "你同时在处理对线、发育、转线、道具、视野与买活。" },
      { label: "正确起步", value: "先建立局势判断，再补英雄、道具和连招记忆。" }
    ],
    loopTitle: "一局比赛通常按这条链路推进",
    loop: [
      { step: "01", title: "选人定路线", detail: "阵容先决定前几分钟的线权、爆发、开团和后期上限。" },
      { step: "02", title: "对线抢经济", detail: "前 8 到 12 分钟的重点是补刀、经验、兵线位置和少死。" },
      { step: "03", title: "把优势换成地图", detail: "领先不是多杀几个人，而是把塔、野区入口和视野压出来。" },
      { step: "04", title: "卡强势时间点", detail: "谁更早拿到关键等级和核心道具，谁就更容易逼地图资源。" },
      { step: "05", title: "围绕目标接团", detail: "塔、防守高地、符点、Roshan 都会强迫双方做出战斗判断。" },
      { step: "06", title: "破路并终结", detail: "后期每一次死亡都可能牵动买活、传送和远古遗迹的安危。" }
    ],
    pillarsTitle: "四个必须先建立的系统支柱",
    pillars: [
      {
        title: "地图结构",
        detail: "三路、野区、高地、塔和 TP 响应共同决定哪些区域安全，哪些区域是在送机会。"
      },
      {
        title: "经济与时机",
        detail: "金钱和经验不是抽象资源，它们会在某个时间点变成关键道具与团战胜负。"
      },
      {
        title: "视野与信息差",
        detail: "侦查、反眼、开雾、消失信息和黑区站位，决定你是主动抓人还是被人抓。"
      },
      {
        title: "目标与买活",
        detail: "Roshan、外塔、高地和买活判断，才是后期最能拉开胜负的战略层。"
      }
    ],
    segmentsTitle: "这个站点主要照顾四类玩家",
    segments: [
      { title: "新手", detail: "先建立术语、地图、位置分工和目标转换意识。" },
      { title: "回归玩家", detail: "重点是快速理解现在版本和过去有什么不同。" },
      { title: "活跃排位玩家", detail: "更关心对线逻辑、强势英雄、道具应对和节奏点。" },
      { title: "赛事观众", detail: "需要把补丁、队伍故事和比赛结果串成可读的信息线。" }
    ],
    firstGamesTitle: "前五局最值得刻意练的东西",
    firstGames: [
      { step: "1", title: "先记地图与目标", detail: "先认识三路、河道、野区、塔和 Roshan，再谈复杂操作。" },
      { step: "2", title: "只盯补刀和少死", detail: "稳定收入比一两次华丽操作更能改变你的成长曲线。" },
      { step: "3", title: "开始看小地图", detail: "敌方消失、黑区没视野、边路压得过深，都是危险预警。" },
      { step: "4", title: "学会赢团后要拿什么", detail: "赢完团先想塔、眼位、Roshan 和地图推进，而不是继续追人。" },
      { step: "5", title: "复盘两次最差死亡", detail: "问自己是贪线、没视野、站位差，还是道具与时机判断错了。" }
    ],
    promptsTitle: "很适合直接交给 Agent 的问题",
    prompts: [
      "我打 1 号位经常对线崩，最先该修哪一个习惯？",
      "为什么我们明明领先，却一直上不了高地？",
      "这把我应该先出保命装还是先补输出？",
      "辅助什么时候该游走，什么时候该先补视野？",
      "这个英雄为什么在当前版本更强了？",
      "帮我用简单的话解释这场比赛是怎么输的。"
    ]
  },
  "en-US": {
    kicker: "Field Primer",
    title: "Understand the match loop before memorizing hero details",
    summary:
      "The core takeaway from the research notes is simple: Dota 2 is not just a hero brawler. It is a strategy system made from map control, economy timings, objective pressure, vision, and teamfight execution. If you only memorize spells, the game will always feel fragmented.",
    overview: [
      { label: "Real Objective", value: "Destroy the enemy Ancient instead of treating kill count as the game." },
      { label: "Why It Feels Hard", value: "You juggle lanes, farming, rotations, items, vision, and buyback at the same time." },
      { label: "Best Starting Point", value: "Build state-reading first, then add heroes, items, and combos on top." }
    ],
    loopTitle: "A standard match usually moves through this chain",
    loop: [
      { step: "01", title: "Draft shapes lanes", detail: "Hero picks define lane pressure, initiation, scaling, and how fights can start." },
      { step: "02", title: "Lanes secure economy", detail: "The first 8 to 12 minutes are about income, XP, lane state, and avoiding pointless deaths." },
      { step: "03", title: "Advantage becomes map access", detail: "A lead matters only when it turns into towers, jungle control, and better vision." },
      { step: "04", title: "Timings decide tempo", detail: "Levels and first core items create the windows where one side can force the map." },
      { step: "05", title: "Objectives create fights", detail: "Towers, Roshan, rune control, and high ground pressure all force real decisions." },
      { step: "06", title: "Base pressure ends games", detail: "Late-game deaths connect directly to buyback, teleport reach, and Ancient defense." }
    ],
    pillarsTitle: "Four system pillars you need early",
    pillars: [
      {
        title: "Map Structure",
        detail: "Three lanes, jungle entrances, towers, high ground, and teleport responses define safe and unsafe space."
      },
      {
        title: "Economy And Timings",
        detail: "Gold and XP only matter because they become item spikes and level windows that decide pressure."
      },
      {
        title: "Vision And Information",
        detail: "Observer wards, sentries, smoke, missing heroes, and dark map zones decide who gets to act first."
      },
      {
        title: "Objectives And Buyback",
        detail: "Roshan, outer towers, base defense, and buyback choices become decisive as games get longer."
      }
    ],
    segmentsTitle: "The product is mainly built for four player groups",
    segments: [
      { title: "New players", detail: "They need vocabulary, map reading, role basics, and objective logic." },
      { title: "Returning players", detail: "They mostly need a fast answer to what changed and why it matters now." },
      { title: "Active ranked players", detail: "They care about lane logic, strong heroes, item answers, and timing reads." },
      { title: "Esports followers", detail: "They need patches, team stories, and match results turned into readable context." }
    ],
    firstGamesTitle: "What to practice across your first five games",
    firstGames: [
      { step: "1", title: "Learn the map and objectives", detail: "Recognize lanes, river, jungle, towers, and Roshan before deep strategy." },
      { step: "2", title: "Focus on last hits and deaths", detail: "Stable income changes your game more than one flashy play." },
      { step: "3", title: "Read the minimap", detail: "Missing heroes, dark zones, and overextended lanes are early warning signals." },
      { step: "4", title: "Convert wins into objectives", detail: "After a good fight, think towers, wards, Roshan, and lane pressure first." },
      { step: "5", title: "Review your worst deaths", detail: "Check whether greed, no vision, bad positioning, or wrong item timing caused them." }
    ],
    promptsTitle: "Questions that fit Agent Chat well",
    prompts: [
      "I lose lane as carry a lot. Which habit should I fix first?",
      "Why can we not go high ground even when we are ahead?",
      "Should I buy survivability or damage first in this game?",
      "When should supports rotate and when should they stay for vision?",
      "Why is this hero stronger in the current patch?",
      "Explain this loss in simple terms."
    ]
  }
};

export function DotaIntroManual(props: { locale: Language }) {
  const copy = copyMap[props.locale];

  return (
    <section className="panel research-manual">
      <div className="research-manual-hero">
        <div className="research-manual-copy">
          <p className="section-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p className="dota-intro-summary">{copy.summary}</p>
        </div>

        <div className="research-overview-grid">
          {copy.overview.map((item) => (
            <article className="research-overview-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <section className="research-block" id="match-loop">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Match Loop</p>
            <h3>{copy.loopTitle}</h3>
          </div>
        </div>

        <div className="research-loop-grid">
          {copy.loop.map((item) => (
            <article className="research-loop-card" key={item.step}>
              <span>{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="research-manual-layout research-manual-layout-main">
        <section className="research-block" id="system-pillars">
          <div className="section-heading">
            <div>
              <p className="section-kicker">System Pillars</p>
              <h3>{copy.pillarsTitle}</h3>
            </div>
          </div>

          <div className="research-pillar-grid">
            {copy.pillars.map((item) => (
              <article className="research-pillar-card" key={item.title}>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="research-block" id="practice-track">
          <div className="section-heading">
            <div>
              <p className="section-kicker">First Games</p>
              <h3>{copy.firstGamesTitle}</h3>
            </div>
          </div>

          <div className="research-first-grid">
            {copy.firstGames.map((item) => (
              <article className="research-first-card" key={`${item.step}-${item.title}`}>
                <span>{item.step}</span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="research-manual-layout research-manual-layout-secondary">
        <section className="research-block" id="audience-map">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Audience</p>
              <h3>{copy.segmentsTitle}</h3>
            </div>
          </div>

          <div className="research-segment-grid">
            {copy.segments.map((item) => (
              <article className="research-segment-card" key={item.title}>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="research-block" id="agent-prompts">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Agent Prompts</p>
              <h3>{copy.promptsTitle}</h3>
            </div>
          </div>

          <div className="research-prompt-grid">
            {copy.prompts.map((prompt) => (
              <article className="research-prompt-card" key={prompt}>
                <p>{prompt}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
