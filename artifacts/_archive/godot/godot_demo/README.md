# Historical OS Godot Demo v0.1

This Godot project implements the first runnable UI prototype for the alternate-history simulation OS.

## Scope

- Top Historical OS status bar.
- Default intelligence workbench layout.
- Draggable/minimizable OS-style windows.
- Intel Desk main dispatch.
- Timeline, Map, Archives, and Risk panels.
- Five action buttons with lightweight feedback.
- Historical sensitivity notice.

## Run

```bash
godot --path /Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/godot_demo
```

## Export

```bash
godot --headless --path /Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/godot_demo --export-release Web /Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/godot_demo_web/index.html
```

## Preview

```bash
python3 -m http.server 8890 --directory /Users/mahaoxuan/Desktop/黑客松/架空历史故事游戏/artifacts/godot_demo_web
```

Then open:

```text
http://127.0.0.1:8890/index.html
```

## Verification Notes

- `godot --check-only --script res://scripts/Main.gd` passed.
- Web export succeeded.
- Browser console showed only Godot/WebGL/Emscripten initialization logs.
- Button feedback was verified through a browser canvas click simulation.
- Manual mouse drag still needs direct user-side confirmation; synthetic canvas drag did not visually move the window in Chrome DevTools.
