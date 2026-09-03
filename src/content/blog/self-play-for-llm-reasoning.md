---
title: "Self-play for LLM reasoning, one year of follow-up work"
description: "What our self-play analysis found, and a running survey of the papers that have cited and built on it."
category: research
tags: ["llm-reasoning", "self-play", "rlvr"]
date: 2026-09-03
---

<!-- Scaffold notes (invisible in the rendered post — delete as you fill in):
  - This post follows the general anatomy: tldr → context → our findings →
    citing works → open problems → citation → footnotes.
  - The "citing works" section is meant to grow over time: add one H3 per
    follow-up paper, newest at the bottom, each with a 2-3 sentence take and
    a link. Track new citations via the Semantic Scholar page for
    https://arxiv.org/abs/2510.27072
  - TODOs are marked with TODO comments like this one. Remove them as you go.
-->

:::tldr
TODO — one to three sentences: what our self-play paper showed, and what the
follow-up literature has done with those findings since. This callout is what
shows on the blog index, so write it to be read standalone.
:::

## Context

<!-- Why self-play post-training was exciting at the time: RLVR's verifiable
     rewards inspired the idea that models could generate and solve their own
     problems — a data engine that never runs out of fuel. Keep this section
     short; the paper's own intro covers it. -->

Reinforcement learning with verifiable rewards (RLVR) made one thing clear:
reasoning improves when you can check the answer. Self-play post-training
takes the idea one step further — the model also writes the problems. In
principle that removes the human bottleneck from the data engine entirely.

## What our paper found

<!-- Summarize "Towards Understanding Self-play for LLM Reasoning" in prose
     that stands on its own for readers who have not read it. The paper
     analyzes self-play training dynamics through the Absolute Zero Reasoner
     lens, comparing against RLVR and SFT on: parameter update sparsity,
     token-distribution entropy dynamics, alternative proposer reward
     functions, and pass@k performance. -->

We analyzed the training dynamics of self-play through the lens of the
Absolute Zero Reasoner, comparing it against RLVR and supervised fine-tuning
along four axes: parameter update sparsity, entropy dynamics of the token
distribution, alternative proposer reward functions, and how all of it
connects to pass@k performance.

TODO — the two or three findings you consider the paper's actual
contribution, in plain prose. A small table or figure could work well here:

| axis | RLVR | self-play |
| --- | --- | --- |
| update sparsity | TODO | TODO |
| entropy trend | TODO | TODO |

Math renders with `$$…$$`, so you can state claims precisely:

$$
\text{entropy}(p_t) \;\to\; \text{TODO}
$$

## Works citing the paper

<!-- The living section. One H3 per citing work, newest last. For each:
     who did it, what they claim, and how it relates to (confirms, extends,
     or contradicts) our findings. Keep takes short and honest — if a paper
     misreads our result, say so politely. TODO: seed the list from
     https://www.semanticscholar.org/arxiv/2510.27072 -->

TODO — first follow-up paper. Two or three sentences on what it does and
which of our findings it leans on.[^1]

### TODO — second citing work

TODO.

## Open problems

<!-- What neither our paper nor the follow-ups have answered yet. This is
     where a research-agenda post earns its keep. -->

TODO.

## Conclusion

TODO — where you now believe self-play sits on the RLVR spectrum, and what
you would want the next generation of citing work to test.

## Citation

If you use these findings, cite the original paper:

:::bibtex
```bibtex
@misc{chae2025selfplay,
  title         = {Towards Understanding Self-play for LLM Reasoning},
  author        = {Chae, Justin Yang and others}, % TODO exact author list
  year          = {2025},
  eprint        = {2510.27072},
  archivePrefix = {arXiv},
  note          = {The 5th Workshop on Mathematical Reasoning and AI at NeurIPS 2025},
  url           = {https://arxiv.org/abs/2510.27072}
}
```
:::

[^1]: TODO — footnote for the first citing work's arXiv link.
