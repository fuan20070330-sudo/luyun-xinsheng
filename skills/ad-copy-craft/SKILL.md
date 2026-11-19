---
name: ad-copy-craft
description: Generate and critique Chinese advertising slogans and brand copy grounded in supplied facts. Use for slogan variants, campaign lines, product copy, or removing generic AI-style phrasing from brand content.
---

# Ad Copy Craft

## Goal

Write advertising copy that sounds like a person made a deliberate choice, not like a model completed a template. Preserve the supplied facts and brand voice.

## Workflow

1. Read the facts first. Identify one concrete detail for each line: a year, place, ingredient, action, craft step, product form, quoted phrase, or verified honor.
2. Choose a tension or use moment. Good copy usually places the product against a real decision, occasion, or expectation instead of stacking adjectives.
3. Draft in several distinct angles: time, craft, product truth, everyday scene, interview voice, and brand stance.
4. Self-edit every line against the checks below.
5. Return only lines that survive the edit, with the fact IDs used.

## Hard Constraints

- Never invent a year, ranking, honor, founder, craft step, ingredient, sales figure, health effect, or customer quote.
- A line without a supporting fact must be labelled `待核实` and must not be presented as publishable copy.
- Do not promise medical, health, or absolute outcomes.
- Keep headlines short and concrete. Prefer one idea and one verb per line.
- Do not use identical sentence structures repeatedly.

## De-AI Checks

Reject or rewrite lines that rely on:

- 对称排比、三连口号、空泛对偶。
- `不仅……而且……`、`从……到……`、`不是……而是……` used as a default template.
- `匠心独运`、`百年传承`、`焕新升级`、`赋能`、`打造闭环`、`舌尖上的`、`不容错过`、`遥遥领先`.
- Too many abstract nouns in one sentence, such as `文化、传承、创新、品质、价值` together.
- Explaining the obvious after the line. The slogan should carry the idea by itself.
- Fake conversational openings such as `家人们谁懂啊` unless the brand already uses that voice.

## Output

For each candidate provide:

- `文案`: the line itself.
- `角度`: time, craft, product, scene, interview, or stance.
- `依据`: fact IDs and a short source phrase.
- `自检`: one sentence on why it is safe and specific.

Provide 8–12 non-duplicate candidates. Rank them by concreteness and naturalness, not by how impressive they sound.
