# BigHorn Roofing — Website

A complete redesign of [gobighorn.com](https://gobighorn.com/): a fast, single-page static site
with a **scroll-scrubbed, bird's-eye roof-replacement timelapse** as the hero.

No build step. Open `index.html` in a browser, or serve the folder with any static host
(Netlify, Vercel, GitHub Pages, S3…).

```
index.html      — the whole site
css/style.css   — styles
js/hero.js      — bird's-eye timelapse engine + scroll scrubbing + video handoff
js/main.js      — reveals, counters, before/after slider, estimate form
assets/         — drop the AI-generated hero video here (see below)
```

## The hero: how it works

The top of the page is a 520vh scroll section. As the visitor scrolls, they scrub through a
roof replacement seen from directly overhead:

1. **Old roof** — stained, mossy, missing shingles
2. **Tear-off** — the crew strips it to the deck, debris flies into the dumpster
3. **Underlayment** — the deck gets armored
4. **New shingles** — installed row by row, eaves to ridge, then ridge caps
5. **Reveal** — finished roof + headline + CTA

Out of the box this is **drawn live on a `<canvas>`** (no video file needed), so the site is
fully functional today. The same renderer also paints the before/after drag slider further
down the page.

## Upgrading to the AI-generated video

When you have the AI-generated timelapse (e.g. from Google Gemini / Veo), the hero
**automatically switches** from the canvas animation to scrubbing the real video — no code
changes. Just add the file at:

```
assets/hero-timelapse.mp4
```

### Prompt to use in Gemini (Veo)

> Locked, static overhead drone shot — perfect top-down bird's-eye view directly above a
> two-story suburban American house. The camera never moves, tripod-locked, zero camera
> motion. Hyper-realistic construction timelapse: the roof starts old and failing — faded,
> curling gray asphalt shingles, dark water stains, patched spots and moss. A roofing crew in
> orange safety vests and hard hats swarms across the roof in fast timelapse motion, tearing
> off the old shingles section by section and tossing debris into a green dumpster in the
> driveway below, exposing clean plywood decking. The crew then rolls out gray underlayment,
> then installs crisp new architectural shingles in deep charcoal black, row by row from the
> eaves up to the ridge, until the entire roof is flawless and brand new. Sunny midday light
> with crisp shadows that slowly rotate to suggest hours passing, neat green lawn, work truck
> and stacked shingle pallets in the driveway. Photorealistic, 4K, smooth timelapse, 16:9
> landscape, no camera movement, no text, no captions, no people talking.

Generate at 16:9 / 1080p / 8 seconds. If the camera drifts, regenerate with
"static security-camera framing" added.

### Re-encode for buttery scrubbing (important)

Scroll-scrubbing seeks the video constantly, so it needs a keyframe on **every** frame.
Re-encode whatever Gemini gives you with:

```bash
ffmpeg -i gemini-output.mp4 -an -vf "scale=1920:-2" \
  -c:v libx264 -profile:v high -crf 20 -g 1 -keyint_min 1 \
  -pix_fmt yuv420p -movflags +faststart assets/hero-timelapse.mp4
```

(`-g 1` = all-keyframe encoding; `-an` strips audio, which a scrubbed hero shouldn't have.)

## Notes

- The estimate form opens a pre-filled email to `estimating@bighornroofing.net`. Swap in a
  real form backend (Netlify Forms, Formspree, HubSpot…) when ready.
- `prefers-reduced-motion` is respected: those visitors get the finished roof and static
  content instead of the scrub effect.
- All business details (phone, address, stats, testimonials, certifications, service areas)
  were carried over from the current gobighorn.com.
