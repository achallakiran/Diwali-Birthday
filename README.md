# Lights, Love & Birthday Wishes

A living voxel celebration for Divya, Kaushiki, Ravi and Kaustubh, for **Friday, 6 November 2026, at our home**. Divya's birthday is 4 November; Kaushiki's birthday and Diwali are 8 November.

## GitHub Pages

The finished website is built and checked in. In **Settings → Pages**, select **Deploy from a branch → main → / (root)**. The site is at **https://achallakiran.github.io/Diwali-Birthday/**.

All paths are relative. `index.html`, `style.css` and `app.js` are the complete runtime. No server, keys, CDN scripts, remote fonts or downloaded models are needed.

## Living invitation

The upper half carries large celebration text. The lower half holds the voxel family and room, with the floor available for exploring. There are no menus, buttons, character labels, instructions or selection/status messages during play.

Parallax is active by default, with a subtle idle drift. Dragging or moving the desktop mouse changes the view. The operating system's reduced-motion setting is respected. Play remains landscape-only; portrait displays the animated rotate-phone prompt and pauses the scene.

Interactions are intended to be discovered:

- Tap the cake to start the Happy Birthday melody immediately, with a candle-blowing celebration. Subsequent taps can relight the candles. Repeated taps do not stack copies of the song.
- Character taps alternate individually: select, dance, select, dance. A subtle ring marks a selection without text. Tap an open floor point to walk around the table and gifts. Dancing releases the character to resume exploring afterwards. Escape also clears the selection on desktop.
- Tap the sky for a large rainbow firework exactly at the touch point. Screen-space fireworks preserve their centre as the parallax camera moves. Ambient rockets and fireworks also colour the sky.
- Diyas sparkle and balloons wobble when touched.
- Audio unlocks with the first user gesture. Fireworks use locally generated whistles and explosions; the birthday melody is synthesized locally.

## Source and rebuild

Use Node.js 20 or later:

```sh
npm install
npm run check
npm test
npm run build
```

Commit the regenerated `app.js` and `app.js.LEGAL.txt` along with source changes. GitHub Pages serves the root files directly.

| File | Purpose |
| --- | --- |
| `index.html` | Celebration message, canvas surfaces and portrait gate |
| `style.css` | Large upper-half typography and lower-half scene layout |
| `src/main.js` | Voxel models, animation, cake interaction, audio and input |
| `src/firework-sky.js` | Large screen-space rainbow fireworks and trails |
| `src/navigation.js` | Floor navigation around room obstacles |
| `src/software-renderer.js` | Animated Canvas compatibility renderer |
| `app.js` | Bundled runtime including Three.js |
| `THREE-LICENSE.txt` | Three.js MIT license |

The primary renderer uses actual Three.js voxel geometry and articulated body parts, with warm lighting and shadows. If WebGL is disabled, a Canvas renderer draws the same room and moving characters with simpler lighting. Matching interior voxel faces are omitted, and each articulated part is batched into one mesh. Fireworks use a separate full-screen Canvas surface so bursts can span the sky independently of the lower-half scene.

No party time or street address has been invented.

## Validation

- JavaScript syntax checks and the production bundle passed.
- Navigation tests cover clear paths, detours around the cake table, and invalid targets.
- Browser checks cover desktop and 844 × 390 landscape layout, the portrait gate, absence of visible menus/buttons/status text, direct cake-triggered tune scheduling, alternating character selection, walking and touch-centred fireworks.
- The preview browser disables WebGL, so visual checks use the animated Canvas fallback. Physical-device audio output and GPU rendering still warrant a device check.
