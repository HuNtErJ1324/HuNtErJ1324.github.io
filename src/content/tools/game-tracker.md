---
name: Game Tracker
description: A self-hosted game tracker and stats dashboard, with a coach built on prime-agent.
repo: https://github.com/HuNtErJ1324/game-tracker
stack: [python, prime-agent, sqlite, javascript]
image: /assets/tools/game-tracker
imageAlt: "Game Tracker's overview page with demo data: the last game played, a row of game covers, and a chart of the last 14 days of play."
date: 2026-10-23
---

It runs on my gaming PC and home server. It finds every installed game across Steam, Riot, Epic, Battle.net, EA, Ubisoft, GOG and Xbox, notices what I'm playing, records each session, and pulls stats wherever a game has them.

VALORANT and CS2 are where it goes deepest, because there's so much data to work with: every round's buys, kill feed and scoreboard, where each kill and death happened on the minimap (from Riot's match data and CS2 demos), and in VALORANT, from my own key presses, when I fired, moved and used abilities. All of it feeds the coach and the improvement loop.

- **A coach built on prime-agent.** It runs in its own container with a long-term memory of me, queries the full match database, and can search the web and edit its notes from YouTube guides.
- **An improvement loop.** Habit stats from every death (dying away from the team, deaths nobody traded, shooting while moving), a Claude review of each death, and one or two focus habits tracked match by match.
- **Death screenshots.** With the NVIDIA App recording, the PC cuts six frames from the last five seconds before each death (crosshair, minimap, kill feed) and deletes the video. Claude looks at them in the death reviews, and the coach can too.
- **The rest of the library.** League of Legends and Overwatch stats and Steam achievements, and for story games the coach works out where you are from your achievements.

The tracker runs on Windows; the server and dashboard run anywhere, for example in Docker behind Tailscale. To look around without a gaming PC, run `python -m gametracker demo`: the dashboard on made-up data. The screenshot is from it.
