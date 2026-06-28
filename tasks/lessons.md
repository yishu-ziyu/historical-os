# Lessons

## 2026-05-18 UI language and first-impression quality

- Interactive narrative / simulation OS demos for this project should default to Chinese unless the handoff explicitly says the target user is English-first.
- Primary action buttons must use the user's working language; keep English as an optional toggle, not as the first-run default.
- First screen must communicate the actual product fantasy within seconds. For the historical game, that means visible Chinese OS identity, anomaly alert, case number, timeline drift, and intelligence-workbench language before any interaction.
- SVG placeholder aesthetics are not an acceptable target quality bar. Use stronger layout, typography, generated art, or supplied assets instead of convenience placeholders when visual quality is being evaluated.

## 2026-05-18 Godot UI animation language

- Do not treat UI animation as one-off decoration. Build small reusable tween scripts or helper functions for buttons, containers, value changes, and visibility transitions.
- Animate state changes, not just entrances: when something appears, disappears, changes value, receives focus, or becomes actionable, it should have a restrained motion response.
- Buttons should have hover and unhover feedback. For this project, prefer restrained intelligence-OS motion over cartoon bounce: tiny scale, subtle glow/border shift, and short easing are safer than large rotation.
- If rotation or scale is reused across different button sizes, scale the animation intensity by element size. Long buttons should rotate and scale less than compact buttons.
- Container children should animate with alpha/position/scale, not by toggling visibility before layout. Hiding children with `visible = false` can cause containers to recalculate layout and create unwanted jumps.
- Stagger container child animations with small overlapping delays. Avoid making every panel/button start at the same exact frame, but keep the UI responsive immediately.
- UI animation must never block input. Users should be able to click or navigate as soon as controls enter, even if decorative motion has not finished.
- For changing labels or numbers, use reusable property-change reactions: subtle scale/color/tween on update, and count-up/count-down when the value is numeric.
- For retrofitting animation into an existing Godot UI, prefer adding reusable auto-ease child nodes or helper scripts to existing nodes instead of rewriting every caller.
- Consistency matters more than quantity. Reusing the same small set of easing curves, durations, color pulses, and focus reactions makes the game feel coherent.
- For the Historical OS demo specifically, the animation language should feel like a serious intelligence workstation: quick, precise, low-amplitude, layered, and responsive. Avoid exaggerated cartoon squeeze unless the product direction changes.

## 2026-05-19 visual direction feasibility

- Do not treat "archive sketch", "minimal pixel strategy map", and "paper wargame map" as equal main art directions. For this project, archive sketch / intelligence dossier should be the primary product surface.
- Minimal pixel and paper wargame visuals should be used only as local visual languages inside the archive OS: small map markers, event icons, movement arrows, counters, or timeline symbols. Do not push them as standalone full-screen styles unless high-quality art direction is available.
- Avoid building the MVP as a pixel RPG with characters walking around maps. The content pressure is historical data, event evolution, characters, dossiers, and evidence management, not character movement.
- A rough CSS or placeholder demo can make a viable style look cheap. When evaluating visual direction, separate "style feasibility" from "current renderer quality" and do not accept low-effort placeholders as the target aesthetic.
- Godot is the development editor and runtime pipeline, not merely a web page. Web previews are useful for fast review, but production work should eventually live in a Godot project with scenes, Control UI, GDScript, resources, and export presets.
- A Slay-the-Spire-like deck or event structure is feasible in Godot because it is mostly UI, cards, state, and scene transitions. For this project, the analogous structure is dossier cards, event cards, intelligence actions, and history-state updates.

## 2026-05-19 walking branch prototype

- A controllable character can be useful if it turns abstract historical choices into spatially legible actions, but it should remain a traversal layer over the archive OS, not become a full RPG.
- For the Einstein first case, location triggers can map cleanly to branch types: port/exit, academy/stay, police-risk/capture, press/public-opinion. Each trigger should produce dossier, newspaper, map, or audit follow-up rather than a generic cutscene.
- Do not use cute farm assets as the actual historical art direction without re-skinning. The mechanic is transferable; the pastoral Sprout Lands mood is not the product mood.
- Treat any real-person death or persecution branch as a serious historical risk/audit path. Do not stage it as spectacle or a reward animation.
- Godot implementation shape for this mechanic: `CharacterBody2D` player, `Area2D` trigger zones, `Control` dossier overlay, data-driven branch definitions, and scene/UI transitions.
- Character idle animation must be stable. Do not cycle generated sprite-sheet frames while the player is standing still, and do not add perpetual bobbing unless the art direction explicitly calls for it. Generated concept-sheet frames are often not pixel-aligned, so idle frame cycling reads as jitter.
