# Dota2 Domain Research

## Purpose

This document records a product-oriented understanding of Dota 2 for this repository. It is intended to support content modeling, onboarding copy, chat-agent knowledge boundaries, and future feature planning.

Research date: 2026-03-07

## 1. What Dota 2 Is

Dota 2 is a 5v5 competitive MOBA built around asymmetric hero kits, lane economy, map control, itemization, and teamfight execution. A standard match is won by destroying the enemy Ancient, not by kill count alone.

For product work, the important point is that Dota 2 is not just a "hero fighting game." It is a layered strategy game where:

- micro matters: spell usage, last-hitting, positioning, combos
- macro matters: lane equilibrium, rotations, objectives, vision, Roshan control
- economy matters: gold, XP, item timings, buyback management
- draft matters: counters, lane matchups, win conditions

This combination is why the game is both hard to learn and highly sticky for long-term players.

## 2. Core Match Loop

The stable core match loop can be described as:

1. Draft heroes around lanes, scaling, initiation, damage type, and control.
2. Play lanes to secure early XP and gold while limiting the enemy's farm.
3. Convert lane advantage into towers, map control, jungle access, and vision.
4. Hit item and level timings earlier than the opponent.
5. Force favorable fights around towers, power runes, Roshan, or high ground.
6. Break base and destroy the Ancient.

The game regularly shifts between farming, information gathering, skirmishing, and objective pressure. This is why good Dota content must explain "what to do next" rather than only describe isolated hero abilities.

## 3. Map and System Pillars

The most important systems for understanding Dota 2 are:

- Three lanes plus jungle: lane assignment shapes the first 8-12 minutes, but strong teams rotate early.
- Towers and high ground: structures define safe zones, TP response windows, and siege pacing.
- Roshan: a central objective that creates forced conflict through Aegis and later rewards.
- Vision and detection: wards, sentries, smoke, invisibility detection, and information denial are core strategy layers.
- Day/night and rune control: map states and rune timing heavily affect tempo, especially mid lane and support movement.
- Buyback and teleportation: late-game decision-making depends on death cost, map reach, and objective tradeoffs.

These mechanics make Dota 2 especially suitable for explainers, alerts, and "state interpretation" features.

## 4. Hero and Role Model

As of 2026-03-07, OpenDota's `heroStats` endpoint returns 127 heroes. In actual player language, heroes are usually discussed through both lane role and farm priority:

- Position 1: carry
- Position 2: mid
- Position 3: offlane
- Position 4: soft support
- Position 5: hard support

The important product implication is that users rarely ask only by formal role taxonomy. They ask in mixed language such as:

- "safe lane carry"
- "tempo mid"
- "teamfight offlaner"
- "greedy 4"
- "lane dominator"
- "high ground defender"

Any future knowledge base, filters, or chat prompts should support both formal role labels and player shorthand.

## 5. Why Dota 2 Is Hard

The game's difficulty comes from stacked decision layers, not raw controls alone:

- Large hero roster with matchup knowledge requirements
- Item system with situational counters instead of fixed builds
- High punishment for bad map movement
- Long consequence chains from draft to late game
- Team coordination burden and communication variance
- Constant tension between greed and fighting

For this project, that means educational content should be tiered. New players need vocabulary and match-loop explanations. Returning and active players need timing, matchup, and patch-context interpretation.

## 6. Why Players Stay

The retention drivers are different from lighter competitive games:

- every match can branch differently from draft, lanes, and itemization
- hero mastery has a very long tail
- comeback potential keeps matches dramatic
- teamfight execution creates memorable peaks
- esports and patch cycles continually refresh the metagame

This suggests the product should not only publish "news." It should help users convert change into understanding:

- what changed
- who benefits
- what it means in pubs
- what it means for pro play
- what players should try next

## 7. Product-Facing User Segments

The most relevant user segments for this repository appear to be:

- New players: need glossary, role primers, objective explanations, and hero recommendations with low execution burden.
- Returning players: need patch catch-up, map/system change summaries, and "what is different now" guidance.
- Active ranked players: need matchup, meta, itemization, and timing interpretation.
- Esports/news followers: need patch notes, tournament context, roster storylines, and quick summaries.

This segmentation maps cleanly onto the current repo direction of news plus agent chat.

## 8. Content Taxonomy Recommended For This Repo

If the project continues expanding, the Dota 2 domain should be modeled around these content types:

- Patch notes and gameplay updates
- Hero guides and hero spotlights
- Role primers and lane fundamentals
- Meta explainers
- Tournament coverage
- Roster and player stories
- Glossary and system explainers
- New/returning player onboarding tracks

Recommended metadata dimensions:

- language
- patch or version
- hero
- role / position
- skill level
- content type
- source type
- pro play relevance

## 9. Chat Agent Implications

A useful Dota 2 chat agent should be optimized for interpretation, not only retrieval. The highest-value question shapes are likely:

- "What should I do in this lane?"
- "Why is this hero strong now?"
- "What changed in this patch?"
- "What item solves this problem?"
- "Who pairs well with this draft?"
- "Explain this tournament result quickly."

The agent should also respect clear knowledge boundaries:

- stable knowledge: map, roles, systems, terminology
- time-sensitive knowledge: current patch, meta, tournaments, roster changes

Anything time-sensitive should be sourced from live or recent data rather than frozen copy.

## 10. Current-State Notes Verified During Research

The following points were verified during this research pass on 2026-03-07:

- Official Dota 2 site still positions the game around a huge hero roster and high strategic variety.
- The official large-scale map/gameplay overhaul page `The New Frontiers` is live.
- The official gameplay update page `Wandering Waters` is live.
- OpenDota currently reports 127 heroes via the public `heroStats` endpoint.

Inference: the product should treat Dota 2 as a live-service knowledge domain where evergreen primers and fast-changing patch/meta interpretation must coexist.

## 11. Sources

Primary and near-primary sources used for this document:

- https://www.dota2.com/home
- https://www.dota2.com/heroes
- https://www.dota2.com/newfrontiers?v=2
- https://www.dota2.com/wanderingwaters
- https://api.opendota.com/api/heroStats

Search support used to confirm page discovery and current availability:

- official Dota 2 search results surfaced through web search on 2026-03-07
