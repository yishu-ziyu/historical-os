# Project Map

> Updated: 2026-07-10 (post archive/delete pass)

## Product face

| Role | Path | Run |
|------|------|-----|
| **Active MVP** | `artifacts/identity_chassis_mvp/` | `PORT=8901 node server.mjs` → http://127.0.0.1:8901/ |
| Design board | `artifacts/identity_chassis_mvp/design_review.html` | Open file |
| Handoff | `HANDOFF.md` | — |
| Todo | `TODO.md` | — |

**Presentation:** D book-page + B one-beat + C object hotspots.  
**Chassis:** PlayableRole / Situation / Action / WorldDelta.

## Tree (artifacts)

```text
artifacts/
  identity_chassis_mvp/     # LIVE product face
  web_story_loop_demo/      # LEGACY runtime + case library + Yuba (reusable code/content)
  _archive/                 # Reusable old sources (not for daily play)
    godot/
    prototypes/
    prompts/
    README.md
```

## Legacy (keep, do not present as main)

`artifacts/web_story_loop_demo/` — HistoricalRuntime, turn cycle, tests, case-library, yuba world. See its README (LEGACY banner).

## Archive (reusable later)

See `artifacts/_archive/README.md`.

## Deleted (not reusable)

- `godot_demo_web/` (binary export; re-export from archived Godot source if needed)
- All `historical-os-demo-*.png`, `walking-branch-demo-*.png`, `style-feasibility-archive.png`
- `interaction_planning_board.html`

## Code priorities

1. Identity chassis MVP (play + chassis + motion)
2. Optional: migrate useful server pieces from legacy demo into chassis
3. Godot only if web chassis is fun for 10+ minutes
