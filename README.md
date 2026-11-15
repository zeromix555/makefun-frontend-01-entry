# makefun-frontend-01-entry

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/zeromix555/makefun-frontend-01-entry/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/zeromix555/makefun-frontend-01-entry/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, read-only make.fun frontend in static files: the live bounty board with each bounty's live pot, entry fee, time left and entries; a bounty's page with its rules and live rewards table; its leaderboard; and an account's public profile — each reachable by a link and by its own URL. No sign-in, no writes, no build step, no third-party code: one stylesheet, five small ES modules, system fonts only, and an ETag-aware API cache so a view costs one request.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — `#/` is the board, `#/bounty/<slug>` a bounty, `#/bounty/<slug>/leaderboard` its leaderboard, `#/u/<handle>` a profile.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `vendor/makefun-frontend.ts` library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=jwef5djp&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
