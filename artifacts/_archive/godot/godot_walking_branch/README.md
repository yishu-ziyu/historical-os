# Walking Historical Branch

Godot 4.6 prototype for the walking historical-branch mechanic.

## Goal

This project moves the previous web/canvas prototype into a real Godot project:

- `CharacterBody2D` player.
- `Area2D` branch triggers.
- `Control`/`CanvasLayer` dossier UI.
- JSON-driven branch data.
- Compatibility renderer.

## Run

```bash
godot --path artifacts/godot_walking_branch
```

Main scene:

```text
res://scenes/Main.tscn
```

Controls:

- Arrow keys: move.
- Space: trigger the current branch when standing inside a highlighted area.

## Current Branches

- `port_exit`: arrange leaving Germany.
- `academy_stay`: stay at the Prussian Academy.
- `police_risk`: enter the serious risk/audit path.
- `press_public`: start a public newspaper campaign.

## Scope Boundary

This is not a full pixel RPG. The walking layer is a spatial choice interface over the archive OS. Branches should lead into dossier cards, newspapers, telegrams, maps, and history-audit UI.
