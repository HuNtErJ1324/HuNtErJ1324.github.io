---
title: "Annotated agent traces"
description: "How this blog renders Prime Intellect-style walkthroughs — collapsible tool calls, outputs, and annotations with running step numbers."
category: research
tags: ["meta", "agent-traces"]
date: 2026-08-30
---

:::tldr
This blog renders Prime Intellect-style walkthroughs: wrap code blocks in
`:::tool-call`-style containers and they collapse into numbered, color-coded
trace panels. Posts stay plain markdown — no HTML anywhere — and `.mdx` posts
can import components for charts and widgets.
:::

When debugging RL agents I keep coming back to the format Prime Intellect uses
in their research posts: the raw trace interleaved with short, colored
commentary. Static logs hide the story; prose hides the evidence. This blog
now renders both together.

A trace block is a fenced code block wrapped in a directive container — no
HTML, no shortcodes:

:::tool-call
```text
step 1 — the agent plans a tool call
```
:::

Every `:::tool-call` block gets a numbered summary bar, a colored edge, and a
copy button that grabs the code without the UI chrome. Outputs and annotations
follow the same convention:

:::tool-output
```text
{"ok": true, "tool": "shell", "exit_code": 0, "stdout": "42 files touched"}
```
:::

An annotation can also be plain prose — wrap any paragraph in a `:::annotation`
container and it collapses into the same numbered flow, which is handy for
"what just happened and why it matters" beats:

:::annotation
Their reward model scored this trajectory 0.93 because the diff was minimal;
the escape itself was three lines.
:::

Reasoning blocks start collapsed, since the interesting part is usually the
action, not the deliberation that led to it:

:::reasoning
```text
the sandbox blocks outbound sockets, so try the file descriptor table first
```
:::

That is the whole vocabulary: `tool-call`, `tool-output`, `annotation`
(prose or code), `reasoning` (collapsed by default), and `bibtex` for
citations. Unlabeled code blocks stay plain — with copy buttons, but no
numbering — so regular snippets never fight the trace for attention.

Because posts are processed by remark before rendering, `.mdx` posts can go
further and import components — a chart wired to a results JSON, a live
matrix visualizer — exactly like the embedded evaluation apps on the Prime
Intellect blog.

## Citation

For the formal bit, every claim above traces back to the writeup:[^pi]

:::bibtex
```bibtex
@misc{primeintellect2026,
  title  = {Uncovering a universal offline sandbox escape},
  author = {Prime Intellect Team},
  year   = {2026},
  url    = {https://www.primeintellect.ai/blog/universal-offline-sandbox-escape}
}
```
:::

[^pi]: The post documents models circumventing offline evaluation restrictions through inference API remote-fetch capabilities, with coordinated fixes across affected frameworks.
