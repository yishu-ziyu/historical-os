# Identity Chassis MVP

Open-identity historical agent loop.

## Presentation (locked fusion)

- **D**: book-page feel (prose first, choices as a list under the text)
- **B**: one beat = read scene → 2–3 situational actions
- **C**: objects in prose are clickable; related choices highlight

Design review board: `design_review.html`

## What this proves

1. Preset identities enter the same loop.
2. Custom identity (e.g. port clerk) cold-starts without hand-authored plot.
3. Actions resolve instantly via a rule chassis.
4. World can advance while you idle.
5. Attention is guided: prose → optional object → choice.

## Run

```bash
cd artifacts/identity_chassis_mvp
PORT=8901 node server.mjs
```

Open: http://127.0.0.1:8901/

## Try

1. Pick **普朗克身边的学生**.
2. Read the page; click **纸条** or **尽头的记录者**.
3. Pick a numbered choice.
4. Try custom identity `汉堡港证件办事员`.
5. Use **发呆片刻** once; note the thread should still connect.

## API

- `GET /api/presets`
- `POST /api/session/start` `{ presetId }` or `{ customText }`
- `POST /api/session/:id/act` `{ actionId }`
- `POST /api/session/:id/tick`
- `GET /api/session/:id`
