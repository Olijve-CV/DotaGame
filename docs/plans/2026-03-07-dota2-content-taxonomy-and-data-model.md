# Dota2 内容分类与数据结构建议

## 目标

这份文档面向当前仓库的产品和实现方向，目标是把 Dota2 领域知识拆成适合站点内容、API 合同、检索索引和 Agent 回答的结构。

当前产品方向已经比较明确：

- News：新闻、赛事、版本更新
- Intro：新手与回坑玩家的 Dota2 认知入口
- Agent Chat：问答、解释、轻量指导

因此内容模型不能只围绕“文章列表”，而要同时支持：

- 按时间更新的动态内容
- 不常变化的常青内容
- 可被聊天检索和引用的知识块

## 1. 内容层的根分类

建议先把 Dota2 内容拆成 4 大类。

### 1.1 Evergreen

相对稳定、版本变化慢的内容。

示例：

- Dota2 是什么
- 地图与胜利条件
- 1 到 5 号位解释
- 对线、控线、拉野、视野、Roshan、买活说明
- 新手和回坑玩家指南

### 1.2 Live Updates

时间敏感、需要最新数据的内容。

示例：

- Patch note
- Gameplay update
- Hero balance update
- 版本热点总结

### 1.3 Competitive

围绕赛事、队伍、选手、赛程和结果的内容。

示例：

- Tournament overview
- Match summary
- Team / roster updates
- Event standings

### 1.4 Analytical

介于常青和时效之间，用于解释变化和趋势。

示例：

- 当前版本谁强，为什么强
- 某个英雄为什么胜率上升
- 某个道具为什么流行
- 某类阵容的打法和克制逻辑

## 2. 内容类型建议

上面的分类是产品层级，真正落到数据结构时，建议用更细的 `contentType`。

建议的 `contentType`：

- `guide`
- `glossary`
- `hero_spotlight`
- `role_primer`
- `system_explainer`
- `patch_note`
- `patch_summary`
- `meta_report`
- `tournament`
- `match_recap`
- `team_update`
- `player_story`
- `qa_answer`

这样做的好处是：

- 前端可以更精确地决定展示方式
- Agent 可以按类型过滤检索
- 后台后续如果加 CMS，不需要重做分类逻辑

## 3. 推荐的共享基础字段

无论是哪类内容，建议在 `packages/contracts` 层预留一组统一基础字段。

```ts
type ContentRecordBase = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  language: "zh-CN" | "en-US";
  contentType: ContentType;
  sourceType: "official" | "community" | "editorial" | "generated";
  sourceName: string;
  sourceUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  patchVersion?: string;
  heroIds?: number[];
  heroNames?: string[];
  roleTags?: Array<"carry" | "mid" | "offlane" | "support">;
  audienceTags?: Array<"new" | "returning" | "active" | "competitive">;
  topicTags?: string[];
}
```

这些字段可以覆盖列表页、筛选器、聊天索引和引用出处四个场景。

## 4. 按内容类型扩展的结构

### 4.1 Guide / Primer

适合新手指南、回坑指南、分路指南。

```ts
type GuideRecord = ContentRecordBase & {
  contentType: "guide" | "role_primer" | "system_explainer";
  sections: Array<{
    id: string;
    heading: string;
    body: string;
  }>;
  relatedHeroes?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
}
```

### 4.2 Hero Spotlight

适合英雄资料页、技能和打法介绍。

```ts
type HeroSpotlightRecord = ContentRecordBase & {
  contentType: "hero_spotlight";
  heroId: number;
  heroName: string;
  laneOptions: string[];
  strengths: string[];
  weaknesses: string[];
  powerSpikes: string[];
  skillNotes: Array<{
    name: string;
    detail: string;
  }>;
}
```

### 4.3 Patch Summary / Meta Report

适合解释“版本变化意味着什么”。

```ts
type MetaRecord = ContentRecordBase & {
  contentType: "patch_summary" | "meta_report";
  patchVersion: string;
  keyChanges: string[];
  winners: string[];
  losers: string[];
  gameplayImpact: string[];
  recommendedQuestions?: string[];
}
```

### 4.4 Tournament / Match Recap

适合赛事聚合与快报。

```ts
type TournamentRecord = ContentRecordBase & {
  contentType: "tournament" | "match_recap";
  eventName: string;
  region?: string;
  stage?: string;
  teams?: string[];
  status?: "upcoming" | "live" | "finished";
  eventStart?: string;
  eventEnd?: string;
}
```

## 5. Agent 检索视角下的切分方式

给 Agent 做知识源时，不建议只存“大文章”。建议同时存在两个层级：

### 5.1 Document Level

整篇内容，用于列表页、全文详情和大段引用。

### 5.2 Chunk Level

将内容按段落或语义块切开，用于检索。

推荐 Chunk 字段：

```ts
type ContentChunk = {
  id: string;
  recordId: string;
  language: "zh-CN" | "en-US";
  contentType: ContentType;
  sectionTitle?: string;
  patchVersion?: string;
  heroNames?: string[];
  roleTags?: string[];
  audienceTags?: string[];
  text: string;
}
```

这样可以支持类似问题：

- “1 号位前 10 分钟该做什么”
- “为什么这版本某英雄很强”
- “帮我解释这个比赛结果”

## 6. 时效性策略

建议把内容源明确分成两类。

### 6.1 常青知识

可以人工维护，也可以缓慢更新。

示例：

- glossary
- guide
- role_primer
- system_explainer

### 6.2 时效知识

必须带时间戳、版本号或比赛时间。

示例：

- patch_note
- patch_summary
- tournament
- match_recap
- team_update

Agent 在回答时应该优先知道自己在用哪一类知识。如果用户问的是“现在”，就不该只依赖常青知识。

## 7. API 层建议

如果后续继续扩展 API，建议内容接口不要只按单一文章模型暴露。

推荐方向：

- `GET /content`
  - 支持 `contentType`
  - 支持 `language`
  - 支持 `patchVersion`
  - 支持 `hero`
  - 支持 `role`
  - 支持 `audience`

- `GET /content/:slug`
  - 返回完整记录

- `GET /guides/onboarding`
  - 返回适合首页或 `/intro` 的常青内容聚合

- `GET /heroes/:id/spotlight`
  - 返回英雄聚焦内容

- `POST /chat`
  - 内部按问题类型调用不同知识桶

## 8. 前端信息架构建议

结合当前站点，信息架构可以稳定成下面这样：

- `/`
  - 新闻流
  - 版本更新
  - 赛事动态

- `/intro`
  - 新手指南
  - 回坑指南
  - 基础术语
  - 英雄图鉴入口

- `/chat`
  - 问答
  - 引导提问模板
  - 引用来源

这样能形成清晰边界：

- 首页解决“最近发生了什么”
- Intro 解决“Dota2 到底怎么玩”
- Chat 解决“结合我的问题该怎么理解”

## 9. 当前仓库下一步最值得做的事

基于现在的代码状态，推荐优先级如下：

1. 把 `/intro` 页拆成常青内容模块，而不是只放一块通用介绍
2. 在 `contracts` 中抽象 `guide` 和 `contentType` 体系
3. 给 Agent 的检索层加 `evergreen` / `live` 分桶
4. 给新闻和赛事列表加更明确的标签和筛选维度
5. 给新手内容加入“推荐可直接提问”的问题模板

## 10. 结论

这个项目不该把 Dota2 只当成一个“新闻站”主题，而应该把它看作一个由三种知识共同组成的产品域：

- 常青规则与入门知识
- 持续变化的版本与赛事信息
- 面向具体问题的解释与建议

只要数据结构从一开始就按这三类拆分，后面的网页内容、API、RAG 和移动端复用都会顺很多。
