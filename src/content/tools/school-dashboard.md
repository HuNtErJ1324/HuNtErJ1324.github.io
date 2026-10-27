---
name: School Dashboard
description: A self-hosted school dashboard with a planner and tutor built on prime-agent, and an Excalidraw canvas for working problems by hand.
repo: https://github.com/HuNtErJ1324/school-dash
stack: [python, fastapi, sqlite, react, typescript, excalidraw, katex, prime-agent, claude, docker, tailscale]
image: /assets/tools/school-dashboard
imageAlt: "The school dashboard's board with demo data: today's plan of three tasks, a countdown to the next deadline, and what's due over the coming days."
date: 2026-10-27
---

It runs on my home server and puts everything that's due on one page I can open on my laptop or phone over Tailscale: Canvas (its calendar feed, and its API through a browser session), Gradescope, and the CSE course sites' calendars. The same homework listed on three sites shows up once, with the most informative status and the exact due time.

- **A planner and tutor built on prime-agent.** It runs Claude in its own container and reads every course's slides, specs and PDFs (scanned handwritten notes too, page by page). Each morning it makes a plan sized to the hours I have, writes briefs for upcoming assignments, and tutors in four modes: ask, explain, quiz me and exam review. It follows the Allen School's "AI as a Reference Tool" policy, so it explains and points to where the course covers something, and never does graded work.
- **A canvas shared with the tutor.** An Excalidraw whiteboard: name a problem and the tutor pins its statement from the course documents, I write my work with a stylus, and Help sends it a snapshot. It answers with notes, arrows and circles next to the step in question: hints, never the next step. Math in the chat renders with KaTeX.
- **Tutoring that's measured.** The tutoring guidance follows Allen AI's TutorMoments paper: scaffold when I'm stuck, push for rigor when I'm getting it right. On the paper's own replay benchmark it does as well as the paper's best prompt, and far better than a plain tutor at not doing the student's thinking.
- **Grades.** Scores from Gradescope and Canvas, weighted by each syllabus's categories into a running estimate.

The backend is FastAPI on SQLite and the frontend is React and TypeScript, served from Docker behind Tailscale with no open ports. To look around without any accounts, run `python -m app.demo` in `backend/`: the dashboard on made-up courses, with a day's plan, a tutoring session and a canvas. The screenshot is from it.
