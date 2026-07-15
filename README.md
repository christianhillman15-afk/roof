# Vertical Solutions Roofing — Website

A complete redesign of [verticalsolutionsroofing.com](https://verticalsolutionsroofing.com/):
a fast, single-page static site with a **scroll-scrubbed, bird's-eye storm-to-restoration
timelapse** as the hero.

No build step. Open `index.html` in a browser, or serve the folder with any static host
(Vercel, Netlify, GitHub Pages, S3…).

```
index.html      — the whole site
css/style.css   — styles (storm-blue theme)
js/hero.js      — bird's-eye timelapse engine + scroll scrubbing + video handoff
js/main.js      — reveals, counters, before/after slider, inspection form
assets/         — the AI-generated hero video lives here
```

## The hero: how it works

The top of the page is a 560vh scroll section. As the visitor scrolls, they scrub through a
storm restoration seen from directly overhead:

1. **Before the storm** — a quiet roof on a sunny day
2. **The storm** — sky darkens, rain and hail hammer the roof, damage appears
3. **Tear-off** — the crew strips the damage to the deck, debris flies into the dumpster
4. **Dry-in** — underlayment armors the deck
5. **New shingles** — installed row by row, eaves to ridge, then ridge caps
6. **Restored** — finished roof + headline + CTA

This runs two ways:

- **AI video mode** — if `assets/hero-timelapse.mp4` exists, scrolling scrubs the video
  (generated with Higgsfield/Seedance from a Gemini reference clip: crappy roof → tear-off →
  flawless new roof).
- **Canvas mode** — with no video file, the same story is drawn live on a `<canvas>`
  (including the animated hail storm). This is also the automatic fallback if the video
  fails to load, and it powers the before/after drag slider further down the page.

## Regenerating / replacing the hero video

Scroll-scrubbing seeks the video constantly, so it must be encoded with a keyframe on
**every** frame. Re-encode any new source with:

```bash
ffmpeg -i new-video.mp4 -an -vf "scale=1920:-2" \
  -c:v libx264 -profile:v high -crf 20 -g 1 -keyint_min 1 \
  -pix_fmt yuv420p -movflags +faststart assets/hero-timelapse.mp4
```

(`-g 1` = all-keyframe encoding; `-an` strips audio, which a scrubbed hero shouldn't have.)

A good text-to-video prompt for regenerating it:

> Locked, static overhead drone shot — perfect top-down bird's-eye view directly above a
> two-story suburban American house, camera never moves. The roof starts in terrible
> condition: faded curling shingles, water stains, moss, missing shingles. Hyper-realistic
> construction timelapse: a roofing crew in orange safety vests tears off the old shingles
> into a dumpster below, exposing plywood decking, rolls out gray underlayment, then installs
> crisp new charcoal architectural shingles row by row from eaves to ridge until the roof is
> flawless. Sunny midday light, green lawn, work truck and shingle pallets in the driveway.
> Photorealistic, 4K, smooth timelapse, 16:9, no camera movement, no text, no captions.

## Notes

- The inspection form opens a pre-filled email to `info@verticalsolutionsroofing.com`.
  Swap in a real form backend (Netlify Forms, Formspree, HubSpot…) when ready.
- `prefers-reduced-motion` is respected: those visitors get the finished roof and static
  content instead of the scrub effect.
- Business details (phone, services, stats, testimonial, service areas, programs) were
  carried over from the current verticalsolutionsroofing.com.
