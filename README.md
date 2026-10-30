# Lights, Love & Birthday Wishes

A living voxel celebration for Divya, Kaushiki, Ravi and Kaustubh. Made for **Friday, 6 November 2026, at our home**, celebrating Divya's birthday on 4 November and Kaushiki's birthday and Diwali on 8 November.

## GitHub Pages

The finished website is already built and checked in. No Actions workflow, server, API key or install is required to host it.

1. Open this repository's **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select **main** and **/ (root)**, then save.
4. After GitHub finishes publishing, open **https://achallakiran.github.io/Diwali-Birthday/**.

All asset paths are relative, so the repository subpath works. There are no CDN scripts, remote models, web fonts, analytics or runtime network requests. `index.html`, `style.css`, and the bundled `app.js` form the complete runtime; they can also be downloaded together and opened locally.

## Explore the world

- The family walks, waves, dances and plays independently. Tap a person to select them; a turquoise ring marks the selection. Tap an open floor point to walk there, following a route around the cake table and gifts. Tap the same person again to dance, or **Done** to release them.
- Tap any point in the night sky for an immediate multicolour firework centred at the touch. The sky also has regular ambient fireworks, layered colour and floating lanterns.
- Tap the cake or **Make a wish**. Divya and Kaushiki lean forward; the candles go out, followed by confetti and fireworks. **Wish again** relights the candles.
- Tap lantern-side diyas for sparkles or balloons to make them wobble.
- Move the mouse or drag the world to explore its parallax depth.
- Drag on touchscreens or move the desktop mouse for parallax. There are no arrow, orbit or tilt-mode controls.
- The first tap unlocks sound. **♫** mutes/unmutes rocket whistles, explosion noise and the birthday tune. **Birthday tune** plays the melody; completing the cake wish also starts it. All audio is synthesized locally.
- **?** opens keyboard-accessible character actions and the gentle-motion toggle. The operating system's reduced-motion preference is respected.

## Rendering

The primary renderer uses Three.js, with actual 3D voxel geometry, articulated character parts, warm room lighting and shadows. Geometry is batched by articulated part; hidden matching interior voxel faces are omitted.

If WebGL is disabled, an automatic Canvas renderer draws the same geometry and animations. This mode retains movement, parallax, cake interactions and fireworks, with simpler lighting and a lower frame rate. The page displays a retry message only if both renderers fail.

Play is landscape-only. In portrait, an animated phone asks the visitor to rotate; the scene pauses and its controls are inaccessible until landscape returns. On landscape phones, invitation text occupies a separate area beside the larger scene, while transient messages use the free sky space. Characters explore automatically until selected for point-and-click movement.

## Edit and rebuild

Use Node.js 20 or later:

```sh
npm install
npm run check
npm test
npm run build
```

Commit the regenerated `app.js` and `app.js.LEGAL.txt` along with your source changes. GitHub Pages serves the root files directly.

| File | Purpose |
| --- | --- |
| `index.html` | Invitation text, dates, controls and accessible interaction buttons |
| `style.css` | Responsive typography, invitation framing and controls |
| `src/main.js` | Voxel models, scene, animation, effects, audio and input |
| `src/software-renderer.js` | Animated Canvas compatibility renderer |
| `src/navigation.js` | Ground-plane path finding and room obstacle boundaries |
| `app.js` | Bundled local runtime including Three.js |
| `THREE-LICENSE.txt` | Three.js MIT license |

No party time or street address has been invented. Add those to the invitation when available.

## Validation

- JavaScript syntax checks and production bundling passed.
- Browser checks covered the animated Canvas fallback, desktop play, the 390 × 844 portrait gate, 844 × 390 landscape layout, exact-touch fireworks, Web Audio activation and tune scheduling, selected-character path following, cake interactions and drag parallax.
- Navigation tests verify direct walking, obstacle detours, and rejected blocked/out-of-room targets.
- The preview browser disables WebGL, so the GPU renderer could not be visually checked there. Physical iPhone audio output should also be checked on a device.
A unique birthday 
