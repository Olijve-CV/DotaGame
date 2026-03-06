import type { Language } from "@dotagame/contracts";

type IntroCopy = {
  kicker: string;
  title: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
  gameplayTitle: string;
  gameplaySteps: Array<{ phase: string; detail: string }>;
  rolesTitle: string;
  roles: Array<{ name: string; detail: string; heroes: string }>;
  skillsTitle: string;
  skills: Array<{ name: string; detail: string }>;
  heroesTitle: string;
  heroCards: Array<{ name: string; role: string; skills: string }>;
};

const copyMap: Record<Language, IntroCopy> = {
  "zh-CN": {
    kicker: "DOTA2 深度介绍",
    title: "从推塔目标到英雄技能，快速看懂一场 Dota2",
    summary:
      "Dota2 是一款 5v5 团队竞技游戏。双方分别守护远古遗迹，通过补刀发育、争夺地图资源、购买装备、组织团战，最终摧毁敌方基地核心获胜。它的核心魅力在于高信息量、高博弈深度，以及每一局都能因为阵容和决策不同而产生完全不同的节奏。",
    facts: [
      { label: "胜利条件", value: "摧毁敌方远古遗迹 Ancient" },
      { label: "地图结构", value: "三路兵线 + 野区 + 河道 + Roshan 区域" },
      { label: "关键资源", value: "金钱、经验、视野、符点与中立资源" }
    ],
    gameplayTitle: "玩法与对局节奏",
    gameplaySteps: [
      {
        phase: "对线期",
        detail:
          "前 8 到 12 分钟重点是补刀、反补、控线和换血。优势路要扩大经济，劣势路要保证经验不崩。辅助则负责拉野、做视野、保核心。"
      },
      {
        phase: "中期推进",
        detail:
          "拿到关键小件后，队伍会开始围绕防御塔、肉山和地图视野做文章。此时抓人、开雾、抢节奏是扩大优势的核心。"
      },
      {
        phase: "后期决胜",
        detail:
          "核心英雄装备成型后，买活、站位、先手与技能链决定胜负。一次高地团或 Roshan 团往往就能直接改写比赛结果。"
      }
    ],
    rolesTitle: "英雄定位",
    roles: [
      {
        name: "1 号位 核心 Carry",
        detail: "前期偏发育，后期承担持续输出与终结比赛的责任。",
        heroes: "常见英雄：Juggernaut、Phantom Assassin、Medusa"
      },
      {
        name: "2 号位 中单 Mid",
        detail: "负责节奏、爆发和地图联动，通常拥有更快的等级成长。",
        heroes: "常见英雄：Invoker、Storm Spirit、Queen of Pain"
      },
      {
        name: "3 号位 劣单 Offlane",
        detail: "承担开团、前排和压制敌方核心的任务，是中期推进关键点。",
        heroes: "常见英雄：Mars、Centaur Warrunner、Underlord"
      },
      {
        name: "4/5 号位 辅助 Support",
        detail: "提供控制、视野、保人和开团工具，让团队体系真正运转起来。",
        heroes: "常见英雄：Crystal Maiden、Lion、Shadow Shaman"
      }
    ],
    skillsTitle: "技能系统",
    skills: [
      {
        name: "主动技能",
        detail: "需要手动施放，通常消耗魔法并有冷却时间，用于伤害、控制、位移或保命。"
      },
      {
        name: "被动技能",
        detail: "不需要主动按键，会持续提供属性、机制强化或特殊触发效果。"
      },
      {
        name: "终极技能",
        detail: "大多数英雄 6 级解锁的大招，往往是团战和节奏转换的关键按钮。"
      },
      {
        name: "天赋与神杖体系",
        detail: "10/15/20/25 级可选天赋，阿哈利姆神杖和魔晶还能直接改变技能机制与玩法。"
      }
    ],
    heroesTitle: "代表英雄与技能示例",
    heroCards: [
      {
        name: "Juggernaut",
        role: "典型后期核心",
        skills: "剑刃风暴保证前期对线与保命，治疗守卫增强续航，大招无敌斩适合追击与收割。"
      },
      {
        name: "Invoker",
        role: "高上限法系中单",
        skills: "通过冰雷火三元素组合施法，龙卷风、超震声波、阳炎冲击让他拥有极强的节奏与团战上限。"
      },
      {
        name: "Crystal Maiden",
        role: "团队型辅助",
        skills: "水晶新星和冰封禁制提供控制与减速，被动奥术光环为全队回蓝，大招冰川风暴具备很强团战压制力。"
      },
      {
        name: "Pudge",
        role: "游走抓人代表",
        skills: "肉钩是最具辨识度的先手技能，腐烂持续压血，肢解则能稳定锁定目标制造击杀。"
      }
    ]
  },
  "en-US": {
    kicker: "DOTA2 Deep Dive",
    title: "Understand Dota2 through objectives, roles, heroes, and skills",
    summary:
      "Dota2 is a 5v5 competitive strategy game. Each team protects its Ancient while farming lanes, contesting map resources, buying items, and coordinating fights to eventually destroy the enemy base. Its depth comes from macro decision-making, mechanical execution, and how every draft creates a different match rhythm.",
    facts: [
      { label: "Win Condition", value: "Destroy the enemy Ancient" },
      { label: "Map Layout", value: "Three lanes, jungle camps, river, Roshan area" },
      { label: "Key Resources", value: "Gold, experience, vision, runes, neutral objectives" }
    ],
    gameplayTitle: "How Matches Flow",
    gameplaySteps: [
      {
        phase: "Laning Stage",
        detail:
          "The first 8 to 12 minutes revolve around last hits, denies, lane control, trading, pulls, and experience management. Supports stabilize lanes while cores secure farm."
      },
      {
        phase: "Mid Game Pressure",
        detail:
          "Once core items come online, teams fight for towers, smoke ganks, Roshan, and ward control. This is where tempo lineups try to snowball the map."
      },
      {
        phase: "Late Game Execution",
        detail:
          "Full teamfights become decisive. Buyback status, initiation order, positioning, and spell layering can decide the entire game in one fight."
      }
    ],
    rolesTitle: "Hero Roles",
    roles: [
      {
        name: "Position 1 Carry",
        detail: "Usually farms early and becomes the primary sustained damage source later.",
        heroes: "Common picks: Juggernaut, Phantom Assassin, Medusa"
      },
      {
        name: "Position 2 Mid",
        detail: "Controls tempo, levels quickly, and often provides burst damage or playmaking.",
        heroes: "Common picks: Invoker, Storm Spirit, Queen of Pain"
      },
      {
        name: "Position 3 Offlane",
        detail: "Brings initiation, frontline durability, and pressure against enemy cores.",
        heroes: "Common picks: Mars, Centaur Warrunner, Underlord"
      },
      {
        name: "Position 4/5 Support",
        detail: "Enables the lineup with disables, saves, vision, and lane utility.",
        heroes: "Common picks: Crystal Maiden, Lion, Shadow Shaman"
      }
    ],
    skillsTitle: "Skill System",
    skills: [
      {
        name: "Active Abilities",
        detail: "Manually cast spells with mana costs and cooldowns for damage, control, mobility, or utility."
      },
      {
        name: "Passive Abilities",
        detail: "Always-on effects that improve stats, modify attacks, or trigger special mechanics."
      },
      {
        name: "Ultimate Abilities",
        detail: "Usually unlocked at level 6 and designed to swing fights or create major timing windows."
      },
      {
        name: "Talents, Shard, and Scepter",
        detail: "Level talents and Aghanim upgrades reshape spell behavior and can redefine a hero's role."
      }
    ],
    heroesTitle: "Signature Heroes and Skill Examples",
    heroCards: [
      {
        name: "Juggernaut",
        role: "Classic hard carry",
        skills: "Blade Fury offers early lane presence and survivability, Healing Ward sustains pushes, and Omnislash punishes isolated targets."
      },
      {
        name: "Invoker",
        role: "High-ceiling spellcaster mid",
        skills: "Quas, Wex, and Exort combine into a deep spell kit. Tornado, EMP, Sun Strike, and Cataclysm create massive playmaking potential."
      },
      {
        name: "Crystal Maiden",
        role: "Team-oriented support",
        skills: "Crystal Nova and Frostbite control fights, Arcane Aura fuels allies, and Freezing Field threatens huge area damage."
      },
      {
        name: "Pudge",
        role: "Roaming pickoff specialist",
        skills: "Meat Hook is one of the most iconic initiation tools in the game, while Rot and Dismember secure pickoffs."
      }
    ]
  }
};

export function DotaIntroSection(props: { locale: Language }) {
  const copy = copyMap[props.locale];

  return (
    <section className="dota-intro panel">
      <div className="dota-intro-hero">
        <div>
          <p className="section-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p className="dota-intro-summary">{copy.summary}</p>
        </div>

        <div className="dota-intro-facts">
          {copy.facts.map((fact) => (
            <article className="dota-fact-card" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="dota-intro-grid">
        <section className="dota-intro-block">
          <h3>{copy.gameplayTitle}</h3>
          <div className="dota-timeline">
            {copy.gameplaySteps.map((step) => (
              <article className="dota-timeline-card" key={step.phase}>
                <span>{step.phase}</span>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dota-intro-block">
          <h3>{copy.rolesTitle}</h3>
          <div className="dota-role-list">
            {copy.roles.map((role) => (
              <article className="dota-role-card" key={role.name}>
                <h4>{role.name}</h4>
                <p>{role.detail}</p>
                <span>{role.heroes}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="dota-intro-grid lower">
        <section className="dota-intro-block">
          <h3>{copy.skillsTitle}</h3>
          <div className="dota-skill-list">
            {copy.skills.map((skill) => (
              <article className="dota-skill-card" key={skill.name}>
                <strong>{skill.name}</strong>
                <p>{skill.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dota-intro-block">
          <h3>{copy.heroesTitle}</h3>
          <div className="dota-hero-grid">
            {copy.heroCards.map((hero) => (
              <article className="dota-hero-card" key={hero.name}>
                <div className="dota-hero-card-head">
                  <h4>{hero.name}</h4>
                  <span>{hero.role}</span>
                </div>
                <p>{hero.skills}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
