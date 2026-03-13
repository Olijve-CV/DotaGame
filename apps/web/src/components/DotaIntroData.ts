import type { Language } from "@dotagame/contracts";

export type RoleKey = "all" | "carry" | "mid" | "offlane" | "support";

export type IntroHero = {
  name: string;
  role: Exclude<RoleKey, "all">;
  roleLabel: string;
  difficulty: string;
  lane: string;
  specialty: string;
  timing: string;
  overview: string;
  accent: string;
  skills: Array<{ name: string; detail: string }>;
};

export type IntroCopy = {
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
  atlasTitle: string;
  atlasSubtitle: string;
  atlasLoading: string;
  atlasHeroesLabel: string;
  atlasPageLabel: string;
  atlasPrevLabel: string;
  atlasNextLabel: string;
  roleFilters: Array<{ key: RoleKey; label: string }>;
  laneLabel: string;
  difficultyLabel: string;
  specialtyLabel: string;
  timingLabel: string;
  overviewLabel: string;
  skillsLabel: string;
  heroSpotlights: IntroHero[];
};

export const HEROES_PER_PAGE = 6;

export const HERO_IMAGE_FALLBACKS: Record<string, string> = {
  "Anti-Mage":
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png",
  Axe: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png",
  "Crystal Maiden":
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/crystal_maiden.png",
  Juggernaut:
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/juggernaut.png",
  Pudge: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/pudge.png",
  Sniper: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/sniper.png",
  "Phantom Assassin":
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/phantom_assassin.png",
  "Nature's Prophet":
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/furion.png",
  Invoker:
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/invoker.png",
  Rubick: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/rubick.png",
  "Monkey King":
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/monkey_king.png",
  Muerta: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/muerta.png"
};

export const copyMap: Record<Language, IntroCopy> = {
  "zh-CN": {
    kicker: "DOTA2 深度介绍",
    title: "从目标、节奏、英雄定位到技能链，完整看懂 Dota2",
    summary:
      "Dota2 是一款 5v5 团队竞技策略游戏。双方围绕三路兵线、野区、河道与 Roshan 资源展开长期博弈，通过补刀发育、装备选择、视野控制、抓人开团和高地推进，最终摧毁敌方远古遗迹获胜。它的魅力不只来自操作，还来自阵容搭配、地图理解和每一分钟的决策质量。",
    facts: [
      { label: "胜利条件", value: "摧毁敌方 Ancient 远古遗迹" },
      { label: "地图重点", value: "三路兵线、野区、赏金符、神符、Roshan" },
      { label: "核心资源", value: "金钱、经验、视野、装备时间点、买活" }
    ],
    gameplayTitle: "玩法与对局节奏",
    gameplaySteps: [
      {
        phase: "对线期",
        detail:
          "前 8 到 12 分钟围绕补刀、反补、控线、拉野和消耗展开。核心英雄争取经济曲线，辅助负责视野、保护和创造线优。"
      },
      {
        phase: "中期争夺",
        detail:
          "关键小件成型后，队伍会开始围绕防御塔、野区入口和 Roshan 区域打架。烟雾抓人、抱团推进和反蹲决定节奏归属。"
      },
      {
        phase: "后期决胜",
        detail:
          "高地团、买活管理、先手顺序和技能衔接会成为胜负手。一波处理失误，常常就会直接丢掉 Roshan 或基地。"
      }
    ],
    rolesTitle: "英雄定位",
    roles: [
      {
        name: "1 号位 Carry",
        detail: "前期优先发育，后期承担持续输出与残局收割责任。",
        heroes: "常见英雄：Anti-Mage、Juggernaut、Phantom Assassin、Muerta"
      },
      {
        name: "2 号位 Mid",
        detail: "等级成长快，负责带动节奏、制造击杀和抢地图主动权。",
        heroes: "常见英雄：Invoker、Sniper、Monkey King"
      },
      {
        name: "3 号位 Offlane",
        detail: "承担前排、先手与打乱敌方核心发育的任务，是中期推进支点。",
        heroes: "常见英雄：Axe、Nature's Prophet"
      },
      {
        name: "4/5 号位 Support",
        detail: "提供控制、保人、开视野和技能链，让整套阵容真正运转起来。",
        heroes: "常见英雄：Crystal Maiden、Pudge、Rubick"
      }
    ],
    skillsTitle: "技能系统",
    skills: [
      {
        name: "主动技能",
        detail: "需要手动释放，通常消耗魔法并有冷却时间，用于伤害、控制、位移、治疗或保命。"
      },
      {
        name: "被动技能",
        detail: "不需要主动按键，会持续强化英雄属性、攻击机制或触发特殊效果。"
      },
      {
        name: "终极技能",
        detail: "通常在 6 级解锁，是影响团战和地图节奏的关键按钮，经常决定一轮进攻是否成立。"
      },
      {
        name: "天赋、魔晶与神杖",
        detail: "等级天赋与阿哈利姆升级会直接改变技能效果，让同一英雄衍生出不同玩法和职责。"
      }
    ],
    atlasTitle: "英雄图鉴",
    atlasSubtitle: "英雄图谱现已拆分为独立页面，可按主属性浏览完整英雄池，并查看每位英雄的核心技能与定位信息。",
    atlasLoading: "正在载入英雄头像...",
    atlasHeroesLabel: "当前英雄数",
    atlasPageLabel: "页码",
    atlasPrevLabel: "上一页",
    atlasNextLabel: "下一页",
    roleFilters: [
      { key: "all", label: "全部" },
      { key: "carry", label: "Carry" },
      { key: "mid", label: "Mid" },
      { key: "offlane", label: "Offlane" },
      { key: "support", label: "Support" }
    ],
    laneLabel: "常见位置",
    difficultyLabel: "上手难度",
    specialtyLabel: "核心特点",
    timingLabel: "强势阶段",
    overviewLabel: "玩法解读",
    skillsLabel: "4 个关键技能",
    heroSpotlights: [
      {
        name: "Anti-Mage",
        role: "carry",
        roleLabel: "刷钱核心",
        difficulty: "中等偏高",
        lane: "安全路 1 号位",
        specialty: "高机动、拆法系、后期分推",
        timing: "狂战成型后到 3 件套",
        overview:
          "Anti-Mage 是典型的发育型 Carry。前期偏弱，但一旦经济曲线顺起来，就能靠机动性和法力压制迅速把地图撕开，逼迫对手分兵防守。",
        accent: "#6a54c7",
        skills: [
          { name: "Mana Break", detail: "普攻附带烧蓝效果，是 Anti-Mage 克制法系英雄的基础机制。" },
          { name: "Blink", detail: "高机动位移技能，既能追击也能逃生，是他刷图和分推的核心。" },
          { name: "Counterspell", detail: "提供魔抗并能反弹定向法术，让他在对抗法系阵容时更难处理。" },
          { name: "Mana Void", detail: "根据目标已损失法力造成爆发伤害，后期团战收尾能力极强。" }
        ]
      },
      {
        name: "Juggernaut",
        role: "carry",
        roleLabel: "稳定核心",
        difficulty: "中等",
        lane: "安全路 1 号位",
        specialty: "对线稳、推进稳、残局收割强",
        timing: "对线结束到两件套",
        overview:
          "Juggernaut 是最适合新玩家理解 Carry 节奏的英雄之一。剑刃风暴让他在线上既能压人也能保命，治疗守卫则让队伍在推进和拉扯中更耐打。",
        accent: "#c1462f",
        skills: [
          { name: "Blade Fury", detail: "前期压制近战英雄，也能躲开部分控制和伤害。" },
          { name: "Healing Ward", detail: "提供强续航，能让推进和 Roshan 战更稳。" },
          { name: "Blade Dance", detail: "被动暴击提高持续输出，让他在中后期更具威胁。" },
          { name: "Omnislash", detail: "锁定单体目标爆发收割，特别适合抓落单英雄。" }
        ]
      },
      {
        name: "Phantom Assassin",
        role: "carry",
        roleLabel: "高爆发核心",
        difficulty: "中等偏高",
        lane: "安全路 1 号位",
        specialty: "暴击爆发、切后排、滚雪球",
        timing: "狂战或黯灭后到 BKB 成型",
        overview:
          "Phantom Assassin 的价值在于瞬间击杀关键目标。她需要更扎实的刷钱和进场判断，但一旦拿到装备节点，就能在几秒内改写团战结果。",
        accent: "#7b2738",
        skills: [
          { name: "Stifling Dagger", detail: "远程补刀、消耗和留人能力都很出色。" },
          { name: "Phantom Strike", detail: "快速切入后排，配合被动暴击制造爆发。" },
          { name: "Blur", detail: "提供闪避和隐匿接近能力，帮助她寻找更好的切入路径。" },
          { name: "Coup de Grace", detail: "高额暴击让她具备极强的终结能力。" }
        ]
      },
      {
        name: "Muerta",
        role: "carry",
        roleLabel: "法物混伤核心",
        difficulty: "中等",
        lane: "安全路 1 号位",
        specialty: "中远程压制、持续输出、后期穿透",
        timing: "魔晶或输出装成型后",
        overview:
          "Muerta 兼具远程消耗与后期站桩输出。她的技能和大招让她能在团战中稳定压低血线，并在关键时刻切换成高威胁的灵体火力。",
        accent: "#2f7a62",
        skills: [
          { name: "Dead Shot", detail: "弹射伤害与恐惧结合，适合对线消耗和团战打乱站位。" },
          { name: "The Calling", detail: "召唤幽魂区域，降低敌人输出并限制移动空间。" },
          { name: "Gunslinger", detail: "被动概率追加射击，是她持续输出的重要来源。" },
          { name: "Pierce the Veil", detail: "大招期间转为高额魔法火力，能在后期团战快速融化前排和后排。" }
        ]
      },
      {
        name: "Invoker",
        role: "mid",
        roleLabel: "高上限中单",
        difficulty: "高",
        lane: "中路 2 号位",
        specialty: "法术组合、支援联动、团战上限",
        timing: "等级领先后到中后期团战",
        overview:
          "Invoker 的门槛高，但也是 Dota2 最具代表性的技能型英雄之一。冰雷火三球组合让他拥有极高的操作上限和局面适应能力。",
        accent: "#3b4b8a",
        skills: [
          { name: "Quas", detail: "偏向续航与控制强化，是许多冷却和回复体系的基础。" },
          { name: "Wex", detail: "强化机动性与节奏，让 Invoker 更适合游走和打乱敌方施法。" },
          { name: "Exort", detail: "提供更高爆发与推进伤害，强化 Sun Strike 等输出技能。" },
          { name: "Invoke", detail: "把元素组合转化为具体法术，是 Invoker 整套体系的核心。" }
        ]
      },
      {
        name: "Sniper",
        role: "mid",
        roleLabel: "远程炮台",
        difficulty: "低到中等",
        lane: "中路 2 号位",
        specialty: "超远射程、持续消耗、守高地",
        timing: "中期输出装成型后",
        overview:
          "Sniper 的强项是距离压制。他不靠复杂连招取胜，而是靠射程、走位和持续输出把敌人挡在安全距离之外。",
        accent: "#7c5b2a",
        skills: [
          { name: "Shrapnel", detail: "视野、减速和持续伤害兼备，能控制坡道和推进路径。" },
          { name: "Headshot", detail: "普攻附带击退与额外伤害，持续风筝能力很强。" },
          { name: "Take Aim", detail: "显著增加攻击距离，让 Sniper 拥有标志性的远程压制。" },
          { name: "Assassinate", detail: "远距离收割技能，用于补伤害、逼退或终结残血目标。" }
        ]
      },
      {
        name: "Monkey King",
        role: "mid",
        roleLabel: "节奏战士",
        difficulty: "中等偏高",
        lane: "中路 2 号位",
        specialty: "爆发换血、机动游走、区域团战",
        timing: "线优到第一波团战",
        overview:
          "Monkey King 在中路拥有非常强的换血能力。只要线上打出优势，他就能用树上机动和团战大招不断制造局部人数差。",
        accent: "#b26a17",
        skills: [
          { name: "Boundless Strike", detail: "范围控制加暴击，是先手、收割和补控制的重要技能。" },
          { name: "Tree Dance", detail: "提供高机动转点能力，让他可以从意想不到的位置切入。" },
          { name: "Jingu Mastery", detail: "积累层数后获得高额吸血和伤害，决定他对线压制力。" },
          { name: "Wukong's Command", detail: "制造一大片分身领域，在狭窄地形和阵地战中极强。" }
        ]
      },
      {
        name: "Axe",
        role: "offlane",
        roleLabel: "开团前排",
        difficulty: "中等",
        lane: "劣势路 3 号位",
        specialty: "先手强开、拉扯吸伤、滚动推进",
        timing: "跳刀成型后",
        overview:
          "Axe 是最典型的先手 Offlane。只要跳刀和刃甲到位，他就能强行把团战节奏拉到自己手里，让敌方后排没有舒服输出空间。",
        accent: "#9b4a23",
        skills: [
          { name: "Berserker's Call", detail: "强制嘲讽周围敌人，是开团的标志性技能。" },
          { name: "Battle Hunger", detail: "提供对线消耗和追击压力，让敌人更难舒服补刀。" },
          { name: "Counter Helix", detail: "被动反击伤害让他在线上和团战都很能打。" },
          { name: "Culling Blade", detail: "斩杀后还能给队友加速，适合连续追击。" }
        ]
      },
      {
        name: "Nature's Prophet",
        role: "offlane",
        roleLabel: "全球牵制",
        difficulty: "中等偏高",
        lane: "劣势路 3 号位",
        specialty: "全球支援、分推带线、资源控制",
        timing: "对线结束后到中期拉扯",
        overview:
          "Nature's Prophet 最强的地方不是正面硬拼，而是把地图切成很多片同时去打。全图传送让他能快速响应小规模战斗并持续施压边线。",
        accent: "#496b2f",
        skills: [
          { name: "Sprout", detail: "制造树圈限制走位，既能先手也能断路。" },
          { name: "Teleportation", detail: "全图传送是他进行支援、分推和偷资源的核心能力。" },
          { name: "Nature's Call", detail: "召唤树人推进或拉野，让他在边线和野区都能创造额外资源。" },
          { name: "Wrath of Nature", detail: "全图弹射伤害，可补刀、推线，也能在团战前压低血量。" }
        ]
      },
      {
        name: "Crystal Maiden",
        role: "support",
        roleLabel: "团队辅助",
        difficulty: "低到中等",
        lane: "4/5 号位",
        specialty: "控场、回蓝、反打支援",
        timing: "前中期技能团",
        overview:
          "Crystal Maiden 让新玩家最容易理解辅助的价值。她不靠经济吃饭，却能用控制、减速和团队回蓝把整支队伍的节奏抬起来。",
        accent: "#0a7b7a",
        skills: [
          { name: "Crystal Nova", detail: "范围减速与消耗，适合开团前铺伤害。" },
          { name: "Frostbite", detail: "稳定单体控制，抓人和保人都很实用。" },
          { name: "Arcane Aura", detail: "让全队技能释放更从容，是团队收益型被动。" },
          { name: "Freezing Field", detail: "大范围持续爆发，敌方一旦处理不好就会被直接融化。" }
        ]
      },
      {
        name: "Pudge",
        role: "support",
        roleLabel: "游走抓人",
        difficulty: "中等",
        lane: "4 号位游走",
        specialty: "强先手、心理压制、局部多打少",
        timing: "中前期抓人节奏",
        overview:
          "Pudge 的存在感来自肉钩威慑。只要站位和视野配合得当，他就能把原本平稳的地图形势变成高风险的抓人局，迫使对手时刻提防阴影区域。",
        accent: "#5f5a54",
        skills: [
          { name: "Meat Hook", detail: "高收益先手技能，命中后常常直接形成击杀。" },
          { name: "Rot", detail: "持续减速与伤害，近身缠斗能力很强。" },
          { name: "Flesh Heap", detail: "提供额外力量成长，让他越打越肉，越往后越难处理。" },
          { name: "Dismember", detail: "稳定压制单体目标，便于队友补足伤害。" }
        ]
      },
      {
        name: "Rubick",
        role: "support",
        roleLabel: "技能型辅助",
        difficulty: "高",
        lane: "4 号位辅助",
        specialty: "反手控制、位移拉扯、偷技能上限",
        timing: "中期团战和反打",
        overview:
          "Rubick 是非常典型的高上限辅助。基础技能已经很强，而偷取对方关键技能后，他往往能把团战价值直接提升一个层级。",
        accent: "#2f8a67",
        skills: [
          { name: "Telekinesis", detail: "抬起并投掷目标，适合先手、断技能和救队友。" },
          { name: "Fade Bolt", detail: "弹射伤害并降低敌人攻击，兼顾消耗与保护。" },
          { name: "Arcane Supremacy", detail: "提升施法距离和法术强度，让 Rubick 的技能交换更赚。" },
          { name: "Spell Steal", detail: "偷取敌方技能并据为己用，是 Rubick 的核心招牌机制。" }
        ]
      }
    ]
  },
  "en-US": {
    kicker: "DOTA2 Deep Dive",
    title: "Understand Dota2 through objectives, pacing, hero roles, and spell chains",
    summary:
      "Dota2 is a 5v5 strategy game built around long-form map control. Teams fight over lanes, jungle access, vision, runes, Roshan, item timings, and buyback economy before one side finally destroys the enemy Ancient. The game is difficult because mechanics matter, but decisions matter even more.",
    facts: [
      { label: "Win Condition", value: "Destroy the enemy Ancient" },
      { label: "Map Priorities", value: "Lanes, jungle, runes, Roshan, vision zones" },
      { label: "Core Resources", value: "Gold, XP, map control, item timings, buyback" }
    ],
    gameplayTitle: "How Matches Flow",
    gameplaySteps: [
      {
        phase: "Laning Stage",
        detail:
          "The opening 8 to 12 minutes revolve around last hits, denies, pull camps, lane equilibrium, and harass patterns. Cores protect their economy while supports create structure."
      },
      {
        phase: "Mid Game Contests",
        detail:
          "Once first major items appear, teams start fighting over towers, jungle entrances, smoke paths, and Roshan. This is where map pressure and tempo become visible."
      },
      {
        phase: "Late Game Execution",
        detail:
          "High-ground fights, buyback planning, initiation order, and spell layering decide everything. One bad fight can instantly cost Roshan, barracks, or the game itself."
      }
    ],
    rolesTitle: "Hero Roles",
    roles: [
      {
        name: "Position 1 Carry",
        detail: "Prioritizes farm early and becomes the main sustained damage source later.",
        heroes: "Common picks: Anti-Mage, Juggernaut, Phantom Assassin, Muerta"
      },
      {
        name: "Position 2 Mid",
        detail: "Levels quickly and drives tempo with burst, mobility, and rotations.",
        heroes: "Common picks: Invoker, Sniper, Monkey King"
      },
      {
        name: "Position 3 Offlane",
        detail: "Provides initiation, frontline presence, and pressure against enemy cores.",
        heroes: "Common picks: Axe, Nature's Prophet"
      },
      {
        name: "Position 4/5 Support",
        detail: "Supplies control, saves, vision, and structure for the whole lineup.",
        heroes: "Common picks: Crystal Maiden, Pudge, Rubick"
      }
    ],
    skillsTitle: "Skill System",
    skills: [
      {
        name: "Active Abilities",
        detail: "Manual spells with cooldowns and mana costs that provide damage, control, mobility, saves, or utility."
      },
      {
        name: "Passive Abilities",
        detail: "Always-on effects that improve attacks, stats, survivability, or conditional triggers."
      },
      {
        name: "Ultimate Abilities",
        detail: "Usually unlocked at level 6 and often define whether a team can fight, push, or punish."
      },
      {
        name: "Talents, Shard, and Scepter",
        detail: "Hero upgrades can reshape spell behavior and shift a hero into a different job within the draft."
      }
    ],
    atlasTitle: "Hero Atlas",
    atlasSubtitle: "The hero atlas now lives on its own page, where you can browse the full roster by primary attribute and inspect each hero's core skills and role identity.",
    atlasLoading: "Loading hero portraits...",
    atlasHeroesLabel: "Heroes",
    atlasPageLabel: "Page",
    atlasPrevLabel: "Prev",
    atlasNextLabel: "Next",
    roleFilters: [
      { key: "all", label: "All" },
      { key: "carry", label: "Carry" },
      { key: "mid", label: "Mid" },
      { key: "offlane", label: "Offlane" },
      { key: "support", label: "Support" }
    ],
    laneLabel: "Typical Lane",
    difficultyLabel: "Difficulty",
    specialtyLabel: "Identity",
    timingLabel: "Power Window",
    overviewLabel: "Read on the Hero",
    skillsLabel: "Four Key Skills",
    heroSpotlights: [
      {
        name: "Anti-Mage",
        role: "carry",
        roleLabel: "Farm-heavy carry",
        difficulty: "Medium-High",
        lane: "Safe lane position 1",
        specialty: "Mobility, anti-caster pressure, split push scaling",
        timing: "Battle Fury onward into three-item timing",
        overview:
          "Anti-Mage is a classic economy-first carry. His early game can look passive, but once the farm curve stabilizes he starts shredding map structure through mobility, split pushing, and mana pressure.",
        accent: "#6a54c7",
        skills: [
          { name: "Mana Break", detail: "Burns enemy mana on hit and forms the base of his anti-caster identity." },
          { name: "Blink", detail: "High-frequency repositioning spell used for farming, chasing, and escaping." },
          { name: "Counterspell", detail: "Adds magic resistance and can reflect targeted spells back at enemies." },
          { name: "Mana Void", detail: "Converts missing mana into explosive fight-ending damage." }
        ]
      },
      {
        name: "Juggernaut",
        role: "carry",
        roleLabel: "Reliable carry",
        difficulty: "Medium",
        lane: "Safe lane position 1",
        specialty: "Stable lane, stable push, strong cleanup",
        timing: "Post-laning into two-item timing",
        overview:
          "Juggernaut is one of the clearest heroes for understanding carry fundamentals. Blade Fury stabilizes lanes, Healing Ward extends pressure, and his ultimate punishes isolated targets.",
        accent: "#c1462f",
        skills: [
          { name: "Blade Fury", detail: "Strong early damage and useful protection against many threats." },
          { name: "Healing Ward", detail: "Sustain tool that improves pushes, Roshan fights, and resets." },
          { name: "Blade Dance", detail: "Critical strike passive that gives him reliable scaling in longer fights." },
          { name: "Omnislash", detail: "Single-target punish tool that cleans up fragile heroes fast." }
        ]
      },
      {
        name: "Phantom Assassin",
        role: "carry",
        roleLabel: "Burst carry",
        difficulty: "Medium-High",
        lane: "Safe lane position 1",
        specialty: "Critical burst, backline access, snowball kills",
        timing: "Battle Fury or Desolator into BKB",
        overview:
          "Phantom Assassin thrives on target selection and timing windows. She needs cleaner farming and better discipline than Juggernaut, but her payoff is explosive fight-ending damage.",
        accent: "#7b2738",
        skills: [
          { name: "Stifling Dagger", detail: "Enables ranged harass, safer last hitting, and chase potential." },
          { name: "Phantom Strike", detail: "Gap close tool that lets her instantly reach vulnerable targets." },
          { name: "Blur", detail: "Provides evasion and lets her approach fights from harder-to-read angles." },
          { name: "Coup de Grace", detail: "The crit engine that gives her terrifying burst potential." }
        ]
      },
      {
        name: "Muerta",
        role: "carry",
        roleLabel: "Hybrid damage carry",
        difficulty: "Medium",
        lane: "Safe lane position 1",
        specialty: "Ranged pressure, sustained DPS, late-game conversion",
        timing: "Shard or damage-item timing onward",
        overview:
          "Muerta blends lane pressure with scaling teamfight output. Her toolkit softens targets over time, then her ultimate flips her into a far more dangerous magical damage carry state.",
        accent: "#2f7a62",
        skills: [
          { name: "Dead Shot", detail: "Bouncing projectile that damages and fears, ideal for lane pressure and chaos." },
          { name: "The Calling", detail: "Creates a ghost field that limits enemy movement and output." },
          { name: "Gunslinger", detail: "Chance-based extra shot that fuels her sustained damage profile." },
          { name: "Pierce the Veil", detail: "Ultimate form that turns her into a high-threat magical damage dealer." }
        ]
      },
      {
        name: "Invoker",
        role: "mid",
        roleLabel: "High-ceiling mid",
        difficulty: "High",
        lane: "Mid lane position 2",
        specialty: "Spell combinations, global reach, teamfight ceiling",
        timing: "Level advantage into mid and late fights",
        overview:
          "Invoker is one of Dota2's signature complexity heroes. Quas, Wex, and Exort create a broad toolkit that rewards execution, planning, and constant adaptation to the game state.",
        accent: "#3b4b8a",
        skills: [
          { name: "Quas", detail: "Supports sustain and control-oriented spell patterns." },
          { name: "Wex", detail: "Adds mobility and tempo, making rotations and disruption stronger." },
          { name: "Exort", detail: "Increases spell burst and pushing pressure through heavier damage." },
          { name: "Invoke", detail: "Converts elemental combinations into the actual spells that define the hero." }
        ]
      },
      {
        name: "Sniper",
        role: "mid",
        roleLabel: "Long-range battery",
        difficulty: "Low-Medium",
        lane: "Mid lane position 2",
        specialty: "Range pressure, siege defense, continuous chip damage",
        timing: "Mid-game damage items onward",
        overview:
          "Sniper wins by making distance matter. He rarely overwhelms fights with flashy mechanics, but his range, positioning, and steady output can suffocate enemy approaches.",
        accent: "#7c5b2a",
        skills: [
          { name: "Shrapnel", detail: "Area control spell that grants vision, slow, and persistent damage." },
          { name: "Headshot", detail: "Adds extra attack impact and pushback pressure over time." },
          { name: "Take Aim", detail: "Extends his threat radius and defines the way enemies must approach him." },
          { name: "Assassinate", detail: "Long-range finisher for secure kills, pressure, or forced disengage." }
        ]
      },
      {
        name: "Monkey King",
        role: "mid",
        roleLabel: "Tempo fighter",
        difficulty: "Medium-High",
        lane: "Mid lane position 2",
        specialty: "Explosive trades, tree mobility, area teamfighting",
        timing: "Lane advantage into early skirmishes",
        overview:
          "Monkey King is oppressive when he controls lane trades. Once ahead, his tree mobility and teamfight ultimate let him move from isolated pressure to full map tempo very quickly.",
        accent: "#b26a17",
        skills: [
          { name: "Boundless Strike", detail: "AoE stun and crit tool used for catch, burst, and follow-up control." },
          { name: "Tree Dance", detail: "Enables rapid repositioning and unexpected initiation angles." },
          { name: "Jingu Mastery", detail: "Stack-based sustain and damage spike that defines his lane dominance." },
          { name: "Wukong's Command", detail: "Creates a massive fighting zone that is brutal in narrow terrain." }
        ]
      },
      {
        name: "Axe",
        role: "offlane",
        roleLabel: "Initiating frontliner",
        difficulty: "Medium",
        lane: "Offlane position 3",
        specialty: "Force fights, tank pressure, collapse lanes",
        timing: "Blink Dagger timing onward",
        overview:
          "Axe is the classic initiation offlaner. Once Blink Dagger and Blade Mail are online, he can force engagements on command and break open the map for his team.",
        accent: "#9b4a23",
        skills: [
          { name: "Berserker's Call", detail: "AoE taunt that drags enemies into a bad fight immediately." },
          { name: "Battle Hunger", detail: "Applies lane pressure and punishes enemies who cannot quickly secure a kill." },
          { name: "Counter Helix", detail: "Passive spin damage that makes him dangerous in close combat." },
          { name: "Culling Blade", detail: "Execution spell that also helps his team continue chasing." }
        ]
      },
      {
        name: "Nature's Prophet",
        role: "offlane",
        roleLabel: "Global pressure offlaner",
        difficulty: "Medium-High",
        lane: "Offlane position 3",
        specialty: "Global response, split push, map stretching",
        timing: "Post-laning into map-wide skirmishes",
        overview:
          "Nature's Prophet does not need every fight to be front-to-back. His strength is turning the map into multiple simultaneous problems through global teleports and relentless side-lane pressure.",
        accent: "#496b2f",
        skills: [
          { name: "Sprout", detail: "Creates terrain to trap movement, cut routes, or set up follow-up." },
          { name: "Teleportation", detail: "Global mobility tool that powers his pressure and response game." },
          { name: "Nature's Call", detail: "Summons treants for pushing, farming, and side-lane control." },
          { name: "Wrath of Nature", detail: "Global bouncing damage that pushes lanes and softens fights from afar." }
        ]
      },
      {
        name: "Crystal Maiden",
        role: "support",
        roleLabel: "Team support",
        difficulty: "Low-Medium",
        lane: "Position 4 or 5",
        specialty: "Control, mana sustain, defensive responses",
        timing: "Early and mid-game spell fights",
        overview:
          "Crystal Maiden is one of the cleanest examples of support value in Dota2. Even without farm, she contributes slows, roots, mana sustain, and fight control that lift the whole lineup.",
        accent: "#0a7b7a",
        skills: [
          { name: "Crystal Nova", detail: "AoE slow and poke tool that helps shape early skirmishes." },
          { name: "Frostbite", detail: "Reliable single-target disable for catch or peel." },
          { name: "Arcane Aura", detail: "Teamwide mana sustain that smooths out every allied hero." },
          { name: "Freezing Field", detail: "Large-area channel that can devastate fights if not interrupted." }
        ]
      },
      {
        name: "Pudge",
        role: "support",
        roleLabel: "Roaming pickoff",
        difficulty: "Medium",
        lane: "Roaming position 4",
        specialty: "High-threat initiation, fear factor, pickoff pressure",
        timing: "Early and mid-game rotations",
        overview:
          "Pudge changes the map through threat alone. Good hooks and hidden positioning force the enemy team to respect fog, vision gaps, and every narrow movement path.",
        accent: "#5f5a54",
        skills: [
          { name: "Meat Hook", detail: "One of the highest-impact pickoff tools in the game." },
          { name: "Rot", detail: "Persistent slow and damage that makes close fights messy." },
          { name: "Flesh Heap", detail: "Adds scaling bulk and turns him into a harder frontliner over time." },
          { name: "Dismember", detail: "Reliable single-target lockdown that secures kills." }
        ]
      },
      {
        name: "Rubick",
        role: "support",
        roleLabel: "Spell support",
        difficulty: "High",
        lane: "Position 4 support",
        specialty: "Counter-initiation, displacement, stolen-spell ceiling",
        timing: "Mid-game skirmishes and reactive fights",
        overview:
          "Rubick is a classic high-ceiling support. His base toolkit is already disruptive, and the moment he steals the right enemy spell his impact can jump from useful to game-defining.",
        accent: "#2f8a67",
        skills: [
          { name: "Telekinesis", detail: "Lift-and-drop control tool for catch, interruption, or saves." },
          { name: "Fade Bolt", detail: "Bouncing damage spell that also weakens enemy right-click trades." },
          { name: "Arcane Supremacy", detail: "Improves cast range and spell output, making every trade more efficient." },
          { name: "Spell Steal", detail: "Copies enemy spells and turns matchup knowledge into direct value." }
        ]
      }
    ]
  }
};
