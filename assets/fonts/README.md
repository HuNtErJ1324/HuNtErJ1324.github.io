# Webfonts

All fonts are self-hosted (OFL 1.1). Most faces are subsets built with
`fontTools.subset` (`--flavor=woff2`); Departure Mono is the official webfont.
Nothing loads from Google Fonts — Cloudflare Fonts rewrites Google Fonts links
into inline `<style>` blocks that the site's CSP blocks.

- `CommitMonoNF-*.woff2` — **CommitMono Nerd Font** (CommitMono by Eigil
  Nikolajsen, patched by the Nerd Fonts project), [OFL 1.1](https://github.com/eigilnikolajsen/commit-mono/blob/main/LICENSE).
  Subset to Basic Latin, Latin-1, General Punctuation, Arrows (U+2190–21FF),
  Box Drawing (U+2500–257F), Geometric Shapes (U+25A0–25FF), Powerline (U+E0A0–E0D7).
- `DepartureMono-Regular.woff2` — **Departure Mono** by Helena Zhang,
  [OFL 1.1](https://github.com/rektdeckard/departure-mono/blob/main/public/assets/LICENSE).
  Official v1.500 webfont (self-hosted). Pixel-perfect at 11px increments.
- `NanumGothicCoding-name.woff2` — **Nanum Gothic Coding** (NAVER), OFL 1.1.
  Subset to ONLY the three glyphs 채정인 (U+CC44, U+C815, U+C778). Re-subset
  with wider `--unicodes` before adding any other Korean text to the site.


