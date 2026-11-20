---
name: Kinescope
description: A Plex client for one Samsung TV. The familiar streaming layout at top craft, where the focused title's art lights the room and the chrome stays quiet.
colors:
  text: "#F5F3EF"
  on-text: "#151413"
  on-text-dim: "rgba(21, 20, 19, 0.62)"
  ink: "#0C0B0B"
  sheet: "#151413"
  soft: "rgba(245, 243, 239, 0.78)"
  mute: "rgba(245, 243, 239, 0.68)"
  line: "rgba(245, 243, 239, 0.42)"
  rail: "rgba(245, 243, 239, 0.24)"
  hair: "rgba(245, 243, 239, 0.16)"
  faint: "rgba(245, 243, 239, 0.14)"
  well: "rgba(245, 243, 239, 0.08)"
  ghost: "rgba(245, 243, 239, 0.07)"
  veil: "rgba(12, 11, 11, 0.72)"
  track: "rgba(12, 11, 11, 0.55)"
  scrim: "rgba(12, 11, 11, 0.5)"
  count: "rgba(12, 11, 11, 0.76)"
  danger: "#FF8A7A"
  avatar-copper: "#C9825B"
  avatar-ink: "#2A160C"
typography:
  display:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "96px"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 104"
  page:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "56px"
    fontWeight: 680
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  row:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "29px"
    fontWeight: 620
    lineHeight: "40px"
  meta:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "25px"
    fontWeight: 520
    lineHeight: 1.2
  body:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "24px"
    fontWeight: 440
    lineHeight: "36px"
  caption:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.2
  caption-sub:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.2
  small:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.25
  badge:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "19px"
    fontWeight: 640
    lineHeight: 1
    letterSpacing: "0.04em"
  nav:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "25px"
    fontWeight: 560
    lineHeight: 1
  button:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "26px"
    fontWeight: 620
    lineHeight: 1
  chip:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "23px"
    fontWeight: 560
    lineHeight: 1
  option:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "26px"
    fontWeight: 540
    lineHeight: 1
  setting:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1
  message:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.3
  brand:
    fontFamily: "Mona Sans, SamsungOneUI, sans-serif"
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 108"
rounded:
  bar: "3px"
  badge: "6px"
  tile: "14px"
  option: "16px"
  row: "18px"
  panel: "20px"
  pin-key: "22px"
  pill: "999px"
spacing:
  safe-x: "96px"
  safe-y: "54px"
  nav-top: "56px"
  rows-top: "616px"
  heading-to-tiles: "64px"
  caption: "16px"
  gap-wide: "36px"
  gap-poster: "32px"
  gap-grid: "30px"
  gap-search: "28px"
  focus-gap: "4px"
components:
  nav-entry:
    textColor: "{colors.mute}"
    typography: "{typography.nav}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  nav-entry-current:
    backgroundColor: "{colors.faint}"
    textColor: "{colors.text}"
  nav-entry-focus:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-text}"
  nav-icon:
    textColor: "{colors.soft}"
    rounded: "{rounded.pill}"
    size: "52px"
  avatar:
    backgroundColor: "{colors.avatar-copper}"
    textColor: "{colors.avatar-ink}"
    rounded: "{rounded.pill}"
    size: "52px"
  button:
    backgroundColor: "{colors.faint}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "68px"
  button-focus:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-text}"
  button-round:
    backgroundColor: "{colors.faint}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    size: "68px"
  chip:
    backgroundColor: "{colors.ghost}"
    textColor: "{colors.mute}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "56px"
  chip-set:
    backgroundColor: "{colors.faint}"
    textColor: "{colors.text}"
  chip-focus:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-text}"
  tile-wide:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.tile}"
    width: "432px"
    height: "243px"
  tile-poster:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.tile}"
    width: "240px"
    height: "360px"
  tile-grid:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.tile}"
    width: "220px"
    height: "330px"
  tile-search:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.tile}"
    width: "200px"
    height: "300px"
  tile-search-wide:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.tile}"
    width: "356px"
    height: "200px"
  tile-episode:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.tile}"
    width: "432px"
    height: "243px"
  caption:
    textColor: "{colors.soft}"
    typography: "{typography.caption}"
  caption-focus:
    textColor: "{colors.text}"
  format-badge:
    textColor: "{colors.soft}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "5px 9px 4px"
  count-pill:
    backgroundColor: "{colors.count}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "36px"
  sheet:
    backgroundColor: "rgba(21, 20, 19, 0.97)"
    textColor: "{colors.text}"
    padding: "96px 64px"
    width: "640px"
  sheet-option:
    textColor: "{colors.soft}"
    typography: "{typography.option}"
    rounded: "{rounded.option}"
    padding: "0 24px"
    height: "72px"
  sheet-option-focus:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-text}"
  setting-row:
    backgroundColor: "{colors.ghost}"
    textColor: "{colors.text}"
    typography: "{typography.setting}"
    rounded: "{rounded.row}"
    padding: "0 32px"
    height: "88px"
  setting-row-focus:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-text}"
  search-key:
    backgroundColor: "{colors.ghost}"
    textColor: "{colors.soft}"
    rounded: "{rounded.tile}"
    size: "80px"
  search-key-focus:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-text}"
  pin-key:
    backgroundColor: "{colors.ghost}"
    textColor: "{colors.text}"
    rounded: "{rounded.pin-key}"
    width: "136px"
    height: "96px"
  pin-key-focus:
    backgroundColor: "{colors.text}"
    textColor: "{colors.on-text}"
  toast:
    backgroundColor: "rgba(21, 20, 19, 0.94)"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 28px"
    height: "64px"
---

# Design System: Kinescope

## Overview

**Creative North Star: "The Picture Lights the Room"**

Kinescope is an evening in front of the screen. The focused title's own artwork fills the canvas and dissolves into a wash of its own colours, so moving focus changes the mood of the room. Everything the app adds sits on top of that picture in one warm off-white and a few steps of its transparency. There is no accent hue in the chrome: focus, progress and the current section are all the same lamplight white, and the only saturated colour on screen comes from the library itself.

The layout is the streaming standard executed with care: a nav line at the top, a hero that follows focus, horizontal rows below, a poster grid for whole libraries, a side sheet for choices. It is dense enough to scan from the couch and calm enough to sit with. Focus is a physical event: the tile lifts 7 percent on a soft static shadow and a white ring hugs it with a 4 px gap. Controls take a full white fill when focused. Both were judged on the household's QN90C on 2026-11-19 and passed ("looks good overall").

The household chose this world over four concept worlds they found too technical. It refuses the black page of thumbnails with a bright ring and a red accent, and borrows nothing from Netflix (name, logo, typeface, the red-on-black signature, profile icons, sounds).

**Key Characteristics:**
- Full-screen title art dissolving into a 2x2 ambience of its own UltraBlur colours, dimmed and slightly desaturated.
- One typeface, Mona Sans, in warm off-white with four transparency steps for hierarchy.
- No accent hue in chrome. White is the only signal colour.
- Focus by lift and a hugging ring on art; by a full white fill on controls.
- 14 px tile corners, pill-shaped controls.
- Motion only in transform and opacity, on a fixed 1920x1080 canvas.

## Colors

A warm near-black and a warm off-white, with every intermediate tone made by transparency over whatever art is behind it.

### Primary
- **Lamplight** (#F5F3EF): all primary text, every focus fill, the focus ring, progress fills, the scrub knob, the QR card. It is the only signal colour in the chrome.
- **Ember Ink on Lamplight** (#151413, `on-text`): text and icons inside a white focus fill. Secondary text inside a fill drops to `on-text-dim` (62 percent).

### Secondary
- **Copper** (#C9825B) with **Copper Ink** (#2A160C): the letter avatar for the signed-in profile when Plex has no picture, and the glow in the app icon. It identifies a person and never marks state. The comps' picker also shows apricot (#D9956B), sage (#9DB59A) and slate (#8FA3C8) letter avatars; real Plex avatars replace all of them.

### Tertiary
- **Soft Coral** (#FF8A7A, `danger`): error text only, today the PIN mismatch line. Never a fill, never a focus colour.

### Neutral
- **Hearth Black** (#0C0B0B, `ink`): the page, the ambience fallback floor, the 4 px gap inside avatar focus rings.
- **Ember Sheet** (#151413, `sheet`): side sheets at 97 percent, the toast at 94 percent.
- **Lamplight steps** over the art, all `rgba(245, 243, 239, a)`:
  - `soft` (78%): body copy, hero meta, tile captions at rest, sheet options at rest, chip values.
  - `mute` (68%): secondary lines, unfocused nav entries, chip labels, meta dots.
  - `line` (42%): the outline of format badges.
  - `rail` (24%): the unfilled part of the hero progress track and the player scrub.
  - `hair` (16%): chip outlines, the search field underline, dividers.
  - `faint` (14%): the current-state pill (nav, season, settings group, set chip) and resting buttons.
  - `well` (8%): a tile frame before its image decodes.
  - `ghost` (7%): skeletons, resting chips, keys, settings rows.
- **Evening Veil**, all `rgba(12, 11, 11, a)`: `veil` (72%) starts the top veil and backs the watched badge; `track` (55%) is the groove of tile progress bars; `scrim` (50%) dims the screen behind a side sheet. The player scrims (72% top, 90% bottom) and the profile picker veil (35%) use the same base.
- **Count pill** (`count`, ink at 76%): the unwatched-episode count on show tiles.

### Named Rules

**The No Accent Rule.** Chrome carries no hue. Focus, progress, the current section and selection are all Lamplight; colour on screen comes from the artwork and its ambience. A red, coral or brand-coloured ring is a regression.

**The Room Colour Rule.** The ambience is Plex's four UltraBlur corner colours painted into a 2x2 WebGL canvas that the compositor stretches to 1920x1080. Each channel becomes `(v + (avg - v) x 0.3) x 0.42`: 30 percent toward its own grey, then dimmed to 42 percent. Fallback corners are `1b1f2b`, `0f1118`, `2a1414`, `0b0d12`. Sign-in and splash use the fixed warm set `6e4a33`, `2c2b33`, `3e2c22`, `1c1d26`. Pushed screens restore the colours the screen under them last set.

### tokens.css

Every colour, radius, shadow, duration and easing lives here. Screen stylesheets reference these names and add none.

| Custom property | Value | Replaces in today's tokens.css |
| --- | --- | --- |
| `--ink` | #0C0B0B | `--bg`, `--bg-rgb` (11, 13, 18) |
| `--sheet` | #151413 | `--raised` (#181B23) for panels |
| `--text` | #F5F3EF | `--cream`, `--cream-rgb` (255, 247, 230); `--white` |
| `--text-rgb` | 245, 243, 239 | `--cream-rgb`, kept only to derive the steps below |
| `--soft` | rgba(245, 243, 239, 0.78) | `--dim` (62%) where it set body or meta |
| `--mute` | rgba(245, 243, 239, 0.68) | `--dim` where it set secondary lines |
| `--line` | rgba(245, 243, 239, 0.42) | new |
| `--rail` | rgba(245, 243, 239, 0.24) | new |
| `--hair` | rgba(245, 243, 239, 0.16) | new |
| `--faint` | rgba(245, 243, 239, 0.14) | `--faint`: same name, value rises from 10% to 14% |
| `--well` | rgba(245, 243, 239, 0.08) | `--raised` where it filled tile frames |
| `--ghost` | rgba(245, 243, 239, 0.07) | inline `rgba(var(--cream-rgb), 0.06)` on settings rows |
| `--veil-rgb` | 12, 11, 11 | `--bg-rgb` where it built overlays |
| `--veil` | rgba(12, 11, 11, 0.72) | new |
| `--track` | rgba(12, 11, 11, 0.55) | inline `rgba(var(--black-rgb), 0.6)` on tile bars |
| `--scrim` | rgba(12, 11, 11, 0.5) | new |
| `--count` | rgba(12, 11, 11, 0.76) | `--coral` on the count badge |
| `--on-text` | #151413 | `--bg` used as text on a cream fill |
| `--on-text-dim` | rgba(21, 20, 19, 0.62) | `rgba(var(--bg-rgb), 0.65)` |
| `--danger` | #FF8A7A | new |
| `--avatar-copper`, `--avatar-ink` | #C9825B, #2A160C | new |
| `--sans` | 'Mona Sans', 'SamsungOneUI', sans-serif | `--display` (Barlow Condensed) and `--body` (Inter) |
| `--r-tile` | 14px | inline 10px on `.tile-frame` |
| `--r-panel` | 20px | new |
| `--r-chip` | 6px | new (format badges) |
| `--lift` | 0 20px 44px rgba(0, 0, 0, 0.55) | coral glow `0 0 36px` on `.ring` |
| `--ease` | cubic-bezier(0.2, 0.8, 0.2, 1) | `--ease`, unchanged |
| `--t-art` | 600ms | inline 600ms (hero), 700ms (ambience) |
| `--t-slide` | 260ms | inline 260ms and 300ms on tracks |
| `--t-focus` | 200ms | inline 200ms and 220ms on the ring |
| `--t-held` | 110ms | inline 110ms under `html.fast` |

Removed with no replacement: `--coral`, `--coral-rgb`, `--black`, `--black-rgb`, `--white-rgb`, `--key-yellow`. `--hud` stays as the dev overlay colour and is not part of the look.

## Typography

**Display Font:** Mona Sans (with SamsungOneUI, then sans-serif)
**Body Font:** Mona Sans
**Label Font:** Mona Sans

**Character:** One variable grotesque does everything. Weight moves in small steps (440 to 700) to set hierarchy, and the width axis opens slightly (104 to 108 percent) only for the title fallback and the wordmark, which gives them presence without a second family.

Mona Sans ships as one self-hosted variable woff2 in `app/fonts/` under the SIL Open Font License 1.1, Latin subset, keeping the axes the comps use (weight 400 to 700, width 100 to 108). It replaces the four Inter files and two Barlow Condensed files. It counts against cold start; V1 measures it against today's six files. Width is set with `font-stretch` (104%, 108%).

### Hierarchy
- **Display** (700, 96px, 0.98, -0.025em, width 104%): the hero and detail title when a title has no clear logo. Balanced wrap.
- **Page** (680, 56px, 1.05, -0.02em): screen titles on screens without a hero: Settings, Who's watching?, Enter PIN, Sign in to Plex, the sign-in error.
- **Row** (620, 29px, 40px line): row headings, Cast, Credits, Recent searches.
- **Meta** (520, 25px, 1.2, `soft`): the facts line under a title, separated by 5 px `mute` dots.
- **Body** (440, 24px, 36px line, `soft`): summaries (two lines on Home, three on detail), message hints.
- **Caption** (600, 23px, 1.2, `soft`; full white on the focused tile): the line under a tile. Grid posters use 22px.
- **Caption sub** (500, 22px, 1.2, `mute`): the second line under a caption ("S4 E2 · 8m left", "2004 · 2h 22m").
- **Small** (500, 22px, 1.25, `mute`): helper lines such as "Scan with your phone's camera".
- **Badge** (640, 19px, tracked 0.04em, uppercase content, `soft`): format badges (4K, DOLBY VISION, HDR, ATMOS, 5.1).

Component faces: nav entries 560 25px; buttons 620 26px; chips 560 23px with a 640 value; sheet title 650 34px; sheet options 540 26px; settings rows 600 27px; messages 600 32px; the hero episode line 600 27px; the search query 650 52px; search keys 600 34px; PIN keys 600 38px; the sign-in code 700 124px at width 104%; player times 560 23px with tabular figures.

### Named Rules

**The One Family Rule.** Mona Sans for every string. Hierarchy comes from weight, size and the four Lamplight steps, never from a second face or an accent colour.

**The Couch Floor Rule.** Nothing on screen is smaller than 19 px, and 19 px is only for the tracked uppercase format badges. Every other string is 20 px or larger; second lines under tile captions are 22 px. Legibility is judged on the QN90C from 2.5 to 3.5 m, not on a monitor.

## Layout

A fixed 1920x1080 canvas, positioned absolutely in whole pixels. There is no responsive behaviour. Safe margins are 5 percent: 96 px left and right, 54 px top and bottom. The nav line sits at y 56.

Geometry that virtualization needs lives in JS (`tile.js`, `row.js`, `grid.js`, the screens) and is set inline. The numbers below are binding.

### Tile kinds

| Kind | Size | Used on | Caption | Image request |
| --- | --- | --- | --- | --- |
| `wide` | 432x243 | Home Continue Watching and On Deck | yes | 432x243 |
| `poster` | 240x360 | Home poster rows, detail More like this | no | 240x360 |
| `grid` | 220x330 | library grid | yes, 22px | 220x330 |
| `episode` | 432x243 | detail episode row | yes, plus a two-line summary | 432x243 |
| `search-poster` | 200x300 | search results | yes | 200x300 |
| `search-wide` | 356x200 | search episode results | yes | 356x200 |

Inside every tile frame: the progress groove sits 16 px in from left and right and 14 px from the bottom, 5 px tall; the count pill and the watched badge sit 12 px from the top and right.

### Rows (Home)

- `ROWS_TOP` = 616. The active row always sits there; the track slides vertically by the row pitch.
- Row pitch: 464 for a wide row, 500 for a poster row. With either, the next row's heading lands at or below y 1080, so nothing of the next row peeks.
- Heading at the row's top (40 px line), tiles 64 px below the row's top.
- Left edge (`LEFT`) 96. Gap 36 between wide tiles (step 468), 32 between posters (step 272), 36 between episode tiles (step 468), 28 in search (steps 228 and 384).
- The focused tile is anchored at x 96. Tiles to its right sit 16 px further right to clear its lift. Nothing shows left of the anchor.
- Rows above the active row are hidden (opacity 0). A row below the active row that is on screen sits at opacity 0.55.
- Captions only on wide and episode rows on Home and detail. Poster rows on Home carry none.

### Hero (Home)

- Info block at x 96, y 184, 820 wide.
- Logo box 196 tall; clear logo bottom-left aligned, at most 600x196, requested at 600x196 PNG. Without a logo, the Display title.
- Meta line 28 px below the logo box. Format badges follow the facts.
- Episode line 18 px below meta, for episodes and anything with progress: episode title (600 27px, full white), episode code (520, `mute`), a 160x6 progress track, then "8m left" (560 24px, `soft`), 18 px apart.
- Summary 12 px below, 760 wide, two lines.
- Hero art requested at 1920x1080. A 220 px top veil sits over it.

### Library grid

- Filter bar at y 148, 56 tall, chips 14 px apart, total count right-aligned at the right safe edge.
- Grid clip from y 252 to 1080 (828 tall), `overflow: hidden`. `HEAD` = 40: the first row's posters start at y 292.
- 7 columns, 220 wide, gap 30 (step 250), starting at x 96 and ending at x 1816.
- Row step 442 (poster 330 plus 112 for the caption block and gap).
- The focused row always sits in the top slot once the grid scrolls. With a 442 step the second slot's captions fall at y 1080, below the fold, so `grid.js`'s keep-focus-second rule changes to keep-focus-first.

### Focus geometry

The focused tile scales 1.07 about its centre. The lift (a separate element with the static `--lift` shadow) covers the scaled rect with radius 15 (14 x 1.07). The ring is that rect grown by 8 px on every side with a 4 px border, so a 4 px gap shows between art and ring. Ring radius 23. In whole pixels, relative to the tile's top-left at rest:

| Kind | Lifted rect | Ring box (x, y, w, h) | Caption shift when focused |
| --- | --- | --- | --- |
| `wide` / `episode` | 462x260 | -23, -17, 478, 276 | 9 px down |
| `poster` | 257x385 | -16, -21, 273, 401 | no caption |
| `grid` | 235x353 | -16, -20, 251, 369 | 12 px down |
| `search-poster` | 214x321 | -15, -18, 230, 337 | not on a comp yet |
| `search-wide` | 381x214 | -20, -15, 397, 230 | not on a comp yet |

Formula: overhang = (1.07 - 1) / 2 x size; ring offset = -(overhang + 8); ring size = size x 1.07 + 16. A focused tile's caption moves down by the bottom overhang. Round once, in JS, with `Math.round`.

### Named Rules

**The Safe Frame Rule.** 96 px left and right, 54 px top and bottom. No heading, caption or label in the bottom 54 px (below y 1026). Art may run to the edge; words may not.

**The Headroom Rule.** Every clipped list keeps at least `(1.07 - 1) / 2 x tile height + 12` px between its clip edge and its first row's tile top, so the lifted tile and its ring are never cut. That is 21 px for wide and episode tiles, 24 for grid posters, 25 for Home posters, 23 for search posters. The library ships 40.

**The No Peek Rule.** Row pitch is chosen so the next row stays below the fold. A heading half on screen at the bottom edge is a defect.

## Elevation & Depth

Depth comes from the picture, not from material. Surfaces are flat at rest; the art and the ambience carry all the light. Focus is the only thing that rises: the tile scales up on a single soft shadow that never animates. Sheets and the toast float on fixed shadows. There is no blur, no glass, no glow.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 20px 44px rgba(0, 0, 0, 0.55)`): under the focused tile and the focused profile face. Lives on its own element.
- **Sheet edge** (`box-shadow: -40px 0 80px rgba(0, 0, 0, 0.45)`): the left edge of the side sheet.
- **Float** (`box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45)`): the toast.
- **Card** (`box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5)`): the player's up-next card.
- **Knob** (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4)`): the scrub knob.

### Layers, back to front
1. Ambience: two 2x2 canvases crossfading.
2. Hero art: full screen, masked to dissolve left (transparent to 22 percent, solid from 64 percent) and bottom (transparent to 34 percent from the bottom, solid from 76 percent) with `-webkit-mask-image` and `-webkit-mask-composite: source-in`. Home and detail only.
3. Top veil: 1920x220, `veil` fading to transparent. Static.
4. Content, then nav, then scrim and sheet, then toast.

### Named Rules

**The Static Shadow Rule.** A shadow is painted once and never animates. The lift's shadow sits on a separate element that appears or fades by opacity; depth on focus comes from scale.

**The Dissolve Rule.** The hero dissolves into its own ambience through a static mask. The shipping app A/B-tested hero masks on the TV at 1344x756 at no cost. Full screen cost Home a p95 frame step on the QN90C, and a stretched raster alpha cost the same, so the masked box covers only the visible 1498x713 (x from 422, y to 713) and the art keeps its full-screen framing inside it.

## Shapes

Gently rounded art and fully round controls. Tiles, skeletons and search keys use 14 px corners; the focus lift 15 and the ring 23, so the ring follows the tile's curve at a constant gap. Everything you press is a pill (radius half the height): nav entries, buttons, chips, the count pill, the toast. Larger flat surfaces step up the radius with their height: sheet options 16, settings rows 18, the up-next card and sign-in code boxes 20, PIN keys 22, the QR card 24. Format badges are the only small-radius element (6). Avatars and cast faces are circles. Progress grooves and fills are 5 to 8 px tall with radius 3 to 4.

Outlines are rare and thin: 1.5 px `hair` on resting chips and code boxes, 1.5 px `line` on format badges, a 2 px `hair` underline under the search field.

## Components

### Focus treatments

One treatment per component type. White fills on buttons, keys, rows and chips were checked on the QN90C on 2026-11-19 and passed. If blooming shows up later on near-black, the fallback for any white-fill control is a `faint` fill, full-white text and a static 4 px `text` outline.

| Component | At rest | Focused |
| --- | --- | --- |
| Tile (row) | Frame at scale 1, caption `soft` | Scale 1.07 over 200 ms, lift shadow, 4 px ring at a 4 px gap, caption full white. The ring and lift stay fixed at the anchor; the track slides under them |
| Tile (grid) | as above | as above; the ring moves between columns by transform over 260 ms |
| Nav entry | `mute` text, no fill | White fill, `on-text` text |
| Nav icon (search, settings) | `soft` glyph, 30 px, stroke 2.6 | White fill circle, `on-text` glyph |
| Nav avatar | 2 px ring of `text` at 90% | 4 px `ink` gap plus a 4 px `text` ring outside it; the avatar stays fully visible |
| Button | `faint` pill | White fill, `on-text`; secondary text inside goes `on-text-dim` |
| Chip | `ghost` pill with a `hair` outline | White fill and white outline, `on-text` |
| Sheet option | No fill, `soft` text | White fill, `on-text` |
| Settings row | `ghost` fill | White fill, `on-text`; value and sub-line `on-text-dim` |
| Search key | `ghost`, `soft` glyph | White fill, `on-text` |
| PIN key | `ghost`, full-white digit | White fill, `on-text` |
| Profile face | Circle at scale 1, name `soft` | Scale 1.07, lift shadow, 4 px `ink` gap and 4 px `text` ring; name full white and 8 px lower |

When the nav takes focus, the row's lift and ring disappear and the tile returns to rest.

### Selected and current

**The Selected Rule.** Selected never relies on a fill step alone. A current or set item brings full-white text, usually on a `faint` pill: the current nav entry, the current season, the current settings group, a set chip (whose value also goes to 700 weight). In a sheet, the current choice carries a check at the right edge. Focus always wins over selected.

### Buttons
- **Shape:** pill, 68 px tall (`rounded.pill`), 32 px side padding, 14 px between icon and label, 28 px icons.
- **Default:** `faint` fill, full-white label. A trailing secondary text ("8m left") is 520 22px `mute`.
- **Focus:** white fill, `on-text`.
- **Round:** 68x68 for a lone glyph (play/pause).
- **Player:** "10s" skip pills (restart glyph plus "10s", the forward one mirrored) flank the round play/pause; the transport group is left-aligned at x 96, Audio and subtitles and Next episode sit right. The up-next card's buttons are 60 px tall with 23 px labels; its countdown is a full-width layer inside the focused button scaled on X.

### Chips
- **Style:** 56 px pill, `ghost` fill, 1.5 px `hair` outline, label 560 23px `mute`, value 640 `soft`, 20 px icons, 10 px gaps.
- **Set:** `faint` fill, no outline, label full white, value 700 full white. The Unwatched chip swaps its empty circle for a check.
- **Focus:** white fill and outline, `on-text`.
- Recent searches reuse the chip at rest.

### Tiles
- **Corner Style:** 14 px.
- **Background:** `well` until the image decodes; the image fills the frame with `object-fit: cover`.
- **Progress:** a 5 px `track` groove with a full-white fill scaled on X from the left.
- **Count pill:** 36 px tall, `count` fill, 650 20px number, for unwatched episodes on shows and seasons.
- **Watched badge:** 34 px `veil` circle with a 20 px check, on watched items without progress.
- **Caption:** 16 px below the frame, one line each for title and sub-line, ellipsis at the tile width.

### Nav line
- **Style:** at x 96 to 1824, y 56, 56 tall. Brand lockup (34 px mark, "kinescope" in the brand face, 12 px apart) then 48 px to the entries: Home, one per library. Search, settings and the avatar sit right; the avatar 16 px after the icons.
- **Entries:** 52 px pills with 22 px padding, 4 px apart.
- **States:** current entry `faint` pill and full-white text; focus white fill. Many libraries scroll inside a fixed clip with an edge fade toggled by class, as today.

### Format badges and meta
- 1.5 px `line` outline, radius 6, padding 5/9/4, badge type in `soft`. Order: resolution (4K), then DOLBY VISION or HDR, then ATMOS (or the channel layout on detail when there is no Atmos).
- They follow the facts on the meta line, 12 px apart, after 5 px `mute` dots between facts.

### Side sheet (actions menu and pickers)
- 640 px wide, full height, right-aligned, padding 96 top and bottom and 64 sides, Ember Sheet at 97 percent, sheet-edge shadow, over a full-screen `scrim`.
- Title 650 34px, sub-line 500 22px `mute` 8 px below, options 36 px below that. Group labels inside a sheet (Audio, Subtitles) are 600 22px `mute`.
- Options 72 px tall, 6 px apart (pitch 78), 24 px padding, 28 px icons 18 px from the label. The focus highlight is its own 512x72 element on its own layer. The list clip ends at y 1026.

### Settings
- Groups on the left (x 96, y 184, 440 wide) use the sheet option; the current group has a `faint` pill and full-white text.
- Rows on the right (x 632, 880 wide): 88 px (108 with a sub-line), 32 px padding, 12 px apart, label 600 27px, value 520 `mute`, sub-line 500 22px `mute`.
- About: the lockup at 58 px mark and 56 px type, version as meta, the upstream credit and licence in body, then a Credits list on `hair` dividers.

### Keyboard and PIN pad
- **Search keys:** 80x80, 10 px gaps, 6 columns, radius 14; Space, Delete and Clear span two columns at 26 px. Field above: 530x80 with a 2 px `hair` underline, 34 px search glyph, query 650 52px, a 3x50 caret, placeholder 520 34px `mute`.
- **PIN pad:** three columns of 136x96 keys, 16 px gaps, radius 22. Rows 1 2 3, 4 5 6, 7 8 9, then an empty slot, 0 centred under 8, Delete. Four 28 px dots with a 3 px `soft` outline fill white as digits arrive. The profile's avatar and name sit left of the pad.

### Loading, empty and error
- **Skeletons:** `ghost` shapes at the exact geometry of what they stand for, static. Home: no art, fallback ambience, a 420x72 title block (radius 14), a 360 px meta line, two summary lines (700 and 540 px), a 300x28 heading and four 432x243 tile blocks at the row positions, each with a 220 px caption line. Lines are 20 px tall, radius 10. Library: 14 poster blocks on the grid with 150 px caption lines.
- **Empty:** a message (600 32px) and a hint (440 24px `soft`) at the content's left edge, plus a way out in focus. Library: "No unwatched war movies" / "Clear the filters to see the whole library." with a focused Clear filters chip added to the filter bar and "0 movies". Search: "Nothing for "paddington"" / "Try a different spelling, or part of the title." An empty query shows Recent searches as chips.
- **Error:** sign-in: centred Page title "Can't reach plex.tv", two body lines, a focused Try again button. PIN: "That PIN didn't match. Try again." in `danger` 560 24px under the dots, which clear. Personality lives only in these lines, and never at anyone's expense.
- **Toast:** 64 px pill, Ember Sheet at 94 percent, float shadow, 560 24px, centred 72 px from the bottom. Defined in the shared stylesheet; not yet on a reviewed comp.

### Player OSD
- Two static scrims shipped as small stretched images: top 260 px (`veil` base, 72 percent to clear), bottom 420 px (clear to 90 percent).
- Show logo at x 96, y 64, at most 320x96, with the episode line under it (560 25px `soft`).
- Scrub at y 872 from x 96 to 1824: 8 px, radius 4, `rail` groove, buffered at 34 percent, played fill in Lamplight scaled on X, 28 px knob moved by `translateX`. Times at y 900, controls at y 948. Skip intro sits right at y 760. Up-next card at the bottom right, 520 wide, radius 20.

### Brand mark, wordmark and V1 assets

The mark is a rounded screen (30x21, radius 6, 3 px stroke) on a short stand with a solid dot at its centre, drawn in `currentColor` on a 34x34 grid. The wordmark is "kinescope" in lowercase Mona Sans 650 at width 108 percent, -0.01em. The lockup is the mark then the word, 12 px apart at nav size; the splash uses it at 3.25x. In the app the mark is an inline SVG string with the other icons and the word is live text, so the nav needs no raster.

Produce in V1:

| Asset | Path | Size | Format |
| --- | --- | --- | --- |
| Mark | `assets/brand/mark.svg` | 34x34 viewBox | SVG, `currentColor` |
| Lockup, light (for dark backgrounds) | `assets/brand/lockup-light.svg` | mark plus outlined wordmark | SVG, Lamplight |
| Lockup, dark (for light backgrounds) | `assets/brand/lockup-dark.svg` | same | SVG, Ember Ink |
| README lockups | `assets/brand/lockup-horizontal-light-1920x640.png`, `assets/brand/lockup-horizontal-dark-1920x640.png` | 1920x640 | PNG, transparent; same names so the README's `<picture>` keeps working |
| Wordmarks | `assets/brand/wordmark-light-1600x400.png`, `assets/brand/wordmark-dark-1600x400.png` | 1600x400 | PNG, transparent |
| App icons | `assets/icons/app-icon-512.png`, `-256.png`, `-128.png`, `-117.png` | 512, 256, 128, 117 square | PNG, rendered from `design/comps/icon.html` (and `?size=`) |
| Package icon | `app/icon.png` and `assets/tizen/icon-dev-117x117.png` | 117x117 | PNG, from `icon.html?size=117` |
| Splash | `app/img/splash.png` and `assets/splash/splash-1920x1080.png` | 1920x1080 | PNG rendered from `design/comps/splash.html`, no larger than today's 176 KB |
| Font | `app/fonts/mona-sans-latin-wdth-wght.woff2` | Latin subset, wght 400 to 700, wdth 100 to 108 | woff2 |
| Font licence | `app/fonts/LICENSE-MonaSans.txt` | | SIL OFL 1.1 text |
| Asset index | `assets/README.md` | | rewritten for Kinescope |

The icon is the mark at 270 px in Lamplight at (121, 113) on #101115 with a copper radial glow (46 percent at the centre, 16 percent at 34 percent radius, clear by 64 percent), baked into the PNG so it costs nothing at runtime.

Display strings to change: `<name>` in `app/config.xml` (today "SamSUCKS - Better Plex") to "Kinescope"; `PRODUCT` in `app/js/plex/client.js` (Plex's device list); the device-name fallback in `app/js/platform/tizen.js`; the `<title>` in `app/index.html`; the Settings footer in `app/js/screens/settings.js`, which drops "by rfaile313" because the upstream credit lives in About. Code that loads deleted images changes with them: `app/js/ui/topnav.js` (mascot and wordmark) and `app/js/screens/login.js` (mascot).

Delete: `app/img/mascot.png`, `app/img/mascot-512.png`, `app/img/wordmark.png`, the old `app/img/splash.png` (replaced), every `assets/brand/mascot-transparent-*.png`, `assets/source/mascot-master-*.png`, `assets/icons/app-icon-1024.png`, the SamSUCKS banners and 1280x720 splash in `assets/splash/`, the Seller Office files in `assets/tizen/` (the app is not published), `assets/preview/asset-preview.png`, the four Inter and two Barlow Condensed woff2 files with their licences, and the mascot step in `scripts/make-brand.py`.

Never changes: the Tizen application id `SamSucks01.samsucks`, package `SamSucks01`, the widget id, and the `ss.` storage prefix. The installed app upgrades in place and keeps its session.

### Motion

| Motion | Property | Duration | Easing |
| --- | --- | --- | --- |
| Hero art crossfade (two images) | opacity | 600 ms (`--t-art`) | ease |
| Ambience crossfade (two 2x2 canvases) | opacity | 600 ms (`--t-art`), so colour and picture land together | ease |
| Focus lift (tile scale, lift opacity, caption shift) | transform, opacity | 200 ms (`--t-focus`) | `--ease` |
| Row track, rows track, grid track, nav track, grid ring | transform | 260 ms (`--t-slide`) | `--ease` |
| Any of the above while a key is held | same | 110 ms (`--t-held`) | same |
| Side sheet in and out | translateX 80 px to 0, opacity 0 to 1 | 260 ms slide, 200 ms fade | `--ease`, ease |
| Sheet highlight or list (one per key press) | transform | 260 ms | `--ease` |
| Row dim (0.55) and hide above | opacity | 200 ms (`--t-focus`) | ease |
| Screen fade | opacity | V2 benches it; dropped if it misses the bench thresholds | ease |

**The One Mover Rule.** In one key press exactly one thing travels: the track or the highlight, never both. In rows the ring is still and the content slides under it.

## Do's and Don'ts

### Performance rules (binding)

These come from the plan's section 6.1 and decide the look as much as any colour does.

- Motion is `transform` and `opacity` only, on elements that already have their own layer.
- No `filter`, no `backdrop-filter`: no blur, no frosted glass. Separation comes from scale, static shadows, tonal steps and transparency.
- No animated `box-shadow`. Shadows are static and ride on their own elements.
- No full-screen CSS gradient that repaints. Ambient colour is the 2x2 WebGL canvas; player scrims are small stretched images; the hero dissolve is a static mask, benched at full screen.
- Progress fills, the scrub, its knob and the up-next countdown move by `scaleX` and `translateX`, never by `width` or `left`.
- Fixed sizes everywhere. Text truncates with an ellipsis at a fixed width; recycling a tile never causes layout.
- Lists are the pooled `Row` and `Grid`. Images are requested at the exact pixels shown.
- One font file. Every font file and every raster counts against cold start.
- Chromium 120 is the baseline. `:has()` near recycled tiles, View Transitions and scroll-driven animations need a TV bench first.

### Do:
- **Do** let the focused title's art and its ambience set the colour of the screen; keep chrome in Lamplight and its transparency steps.
- **Do** show focus on art by scale 1.07, the static lift shadow and a 4 px Lamplight ring at a 4 px gap; on controls by a full white fill with `on-text` (#151413) text.
- **Do** keep the row ring fixed at x 96 and slide the content under it.
- **Do** mark selected or current items with full-white text (on a `faint` pill) or a check, never with a fill step alone.
- **Do** keep 96 px side margins, the nav at y 56, and every heading, caption and label above y 1026.
- **Do** leave `(1.07 - 1) / 2 x tile height + 12` px of headroom above the first row of any clipped list.
- **Do** use row pitch 464 for wide rows and 500 for poster rows on Home, so the next row stays below the fold.
- **Do** build skeletons at the exact geometry of the content they stand for.
- **Do** keep voice plain and warm; allow a little personality in empty and error lines only.

### Don't:
- **Don't** add an accent hue to the chrome: no coral, no red, no brand colour on rings, progress, badges or the current section.
- **Don't** borrow from Netflix: its name, logo, typeface, red-on-black signature, profile icons or sounds.
- **Don't** put a Plex mark in the product name or the SamSUCKS mascot anywhere.
- **Don't** show permanent key-hint text; hints appear in context and fade.
- **Don't** let the next row's heading peek at the bottom edge.
- **Don't** use a second typeface or a system display face.
- **Don't** blur, frost or glow anything, and don't animate a shadow.
- **Don't** paint ambience or scrims with full-screen CSS gradients.
- **Don't** show the upstream credit in the chrome; it lives in About.
