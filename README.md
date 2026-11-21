# Kung Fu Pigeon & The Bulldog — A Storybook Adventure

A Mario-style side-scrolling action platformer built in pure HTML5 Canvas, with
zero dependencies and zero game assets (everything is drawn with code and tiny
rects). Runs anywhere, offline, on any phone browser — and ships with an
Android APK wrapper you can build on-device.

## The story hook

Someone tore the pages out of your books and scattered them across three
worlds. Play as the **Kung Fu Pigeon** or the trusty **Bulldog**, kick cats off
ledges, bounce on crows, and recover the **story pages**. Every level's pages
are yours to find — 8, 10, then 12, plus hidden corn seeds for score.

## Characters

| | Kung Fu Pigeon | Bulldog |
|---|---|---|
| Speed | Fast | Steady |
| Jump | High, can glide while holding jump | Lower, heavier |
| Special | Breaks bricks by head-bumping from below | Headbutt smashes bricks from the side |
| Feels like | A ninja bird | A wrecking ball |

## Levels (side-scroller with camera)

1. **Moonlit Meadow** — warm-up: pits, cats, first pages
2. **Rooftop Run** — dusk rooftops: crows dive at you, spike traps, springs
3. **Secret Temple** — the dark gauntlet: rats, crows, broken bridges

Every level has a **checkpoint flag** at the midpoint and a **gong** at the end.

## Controls

- Touch (Android): bottom-left arrows to move, bottom-right **A** = jump/glide, **K** = attack. Tap anywhere on menus.
- Keyboard: `←/→` or `A/D` move, `Z`/`Space`/`↑` jump & glide, `X`/`K`/`Enter` attack, Enter on menus.
- Wrap-around stomp: land on enemies to squash them; or attack on the ground.
- Pigeon: hold jump while falling to glide.

## Project layout

```
kung-fu-pigeon/
├── game/               the entire game (runs standalone in any browser)
│   ├── index.html
│   └── js/game.js      engine, level generator, all art & sound in code
├── android/            WebView APK wrapper (no AndroidX, no permissions)
│   ├── app/src/main/AndroidManifest.xml
│   ├── app/src/main/java/.../MainActivity.java
│   └── app/src/main/assets/www/   ← game copied here by tools/sync-assets.sh
├── tools/sync-assets.sh
├── test/smoke.js       headless runtime tests (node test/smoke.js)
└── docs/BUILD_ANDROID.md   build the APK from Ubuntu in proot
```

The Android wrapper is intentionally tiny: one activity, one WebView, no
permissions, fullscreen immersive, landscape, keeps screen on. Build docs live
in **docs/BUILD_ANDROID.md**.

## Verifying changes

```bash
node --check game/js/game.js
node test/smoke.js
```

The smoke test boots the whole engine headlessly (stubbed canvas/DOM), simulates
menu → character select → 1300 frames of play, and validates that all three
generated levels are well-formed (pages, gong, checkpoint, safe spawn).
