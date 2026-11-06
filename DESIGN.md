# Visual Design Contract

Probation is a personnel file for an agent. It should read as a record someone
is accountable for: sober, numeric, and easy to audit at a glance.

## Product mode

- Mode: `operate`
- Audience and cadence: maintainers deciding how far to trust an agent, returning
  when it asks for more or gets something wrong.
- Primary workflow: read the trust map, weigh a promotion request, sign or decline.

## Visual direction

- Direction name: The file on the desk
- Palette family: the scaffold's neutral ink. Color is earned: hatched neutral for
  Observe, amber for Ask, green for Solo. Red only for mistakes.
- Type treatment: dense sans-serif labels with tabular numerals for all evidence.
- Composition: the trust map is the page. The replay rail sits beside it so moving
  a bar visibly changes both. Requests appear above the map only while waiting.
- Shape language: quiet borders and flat cells; dashed outlines mean evidence
  supports more than has been granted.
- Anti-references: dashboards of decorative charts, a chat box as the main surface,
  confidence scores with no sample size, and celebratory motion on a promotion.

## Guardrails

- Never show an accuracy without letting the user see how many cases back it.
- Keep semantic tokens: `--level-ask` and `--level-solo` in `app/global.css`.
- Agent-written and issue-written text is rendered as plain text, never HTML.
- Use the AgentSidebar for AI work; do not add a second prompt box.
