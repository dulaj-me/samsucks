# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A Tizen web app on one Samsung QN90C (Tizen 9), shown full screen at a fixed 1920x1080 canvas and driven by a d-pad remote. No pointer, no touch, no other screen size.

## Users

One household of adults. The owner runs the Plex Media Server and builds the app. Other adults in the house watch on their own Plex Home profiles. No children's profiles.

They sit on a couch 2.5 to 3.5 m from a 4K Mini-LED panel, holding a Samsung SolarCell remote: arrows, OK, Back, Play/Pause, no color or number keys. Most sessions are one of two jobs: resume what they were watching, or pick something new by row, genre or search.

Nobody outside the household is a target user. The fork is public on GitHub, but no effort goes into courting other installs.

## Product Purpose

Kinescope is a Plex client for this TV that is faster and simpler than the official Plex app. It covers what the household watches (movies and shows from their own server) and leaves out the rest of Plex (music, photos, Live TV, Discover, server admin).

Success: launch to Home in about a second, resume in one press, find a title by rows, genre or search, and never wonder where focus is.

## Positioning

Speed is the product. The official Plex app on Samsung TVs is slow because of how it renders, not because of the TV or the server. Kinescope treats the TV's browser like a game engine: GPU transforms and fades only, pooled tiles, a fixed focus ring with content sliding under it, input coalesced to one action per frame, images sized to the exact pixels shown, and video straight to Samsung's hardware decoder.

The interaction model is the familiar streaming-app one (profile picker, a hero that follows focus, simple horizontal rows, minimal chrome) applied to a personal library.

## Operating Context

- Launch lands on Home as the last used profile. The profile picker is one press away through the avatar.
- Top-level screens share one nav line: Home, one entry per library, search, settings, avatar.
- Home: a hero that follows the focused tile, then hub rows. Launch focus is on Continue Watching.
- Library: a poster grid with a filter bar (Genre, Unwatched, Sort).
- Pushed screens: search, detail, player, settings.
- Hold OK on any tile opens an actions menu.
- The room is usually dim. The panel is watched in the picture mode the owner normally uses.

## Capabilities and Constraints

- Plain JavaScript ES modules in `app/`, no framework, no npm dependency, no build step. Stays that way.
- Performance rules are binding: animate only `transform` and `opacity`; no `filter`, no `backdrop-filter`, no animated `box-shadow`, no full-screen CSS gradient. Ambient color comes from a 2x2 WebGL canvas fed by Plex's UltraBlur colors.
- Layout geometry that virtualization depends on (tile sizes, row edges, grid metrics) lives in JS, in whole pixels.
- Safe margins of at least 5% on every edge.
- Fonts ship inside the package as woff2 with their licenses. Each font file costs cold-start time.
- Every function works with arrows, OK and Back. Other keys are accelerators only. No permanent key-hint text.
- Engine baseline is the TV's Chromium (expected 120 on Tizen 9, confirmed in Phase A). Desktop Chrome is newer; anything newer than the baseline needs a check on the TV.
- Out of scope: music, photos, Live TV and DVR, downloads, Discover, server admin, several plex.tv accounts, a featured billboard, autoplaying hero trailers, voice search, any other TV.

## Brand Commitments

- Name: **Kinescope**. A kinescope was the early TV picture tube, and a film recording of a live broadcast made by filming that screen: television and cinema in one word.
- The rename touches display strings and assets only: `config.xml` `<name>`, `PRODUCT` in `app/js/plex/client.js` (Plex's device list), the fallback device name in `app/js/platform/tizen.js`, the `index.html` title, the Settings footer, `app/img`, `app/icon.png`, `assets/`, README.
- Never changes: Tizen application id `SamSucks01.samsucks`, package `SamSucks01`, widget id, and the `ss.` storage prefix. The installed app upgrades in place and keeps its session.
- The SamSUCKS mascot is dropped. Identity is a wordmark plus a small symbol for the app icon and splash.
- Voice is plain and warm: short, direct labels; a little personality only in empty and error states. No insults, no jokes at anyone's expense.
- The look is the familiar streaming-app layout executed at top craft, not a themed concept. The user chose this over four concept worlds after the household found them too technical. Mood: a calm evening in front of the screen. Craft bar: the best-regarded TV apps, such as the Apple TV app and Infuse.
- Nothing borrowed from Netflix: name, logo, typeface, the red-on-black signature, profile icons, sounds. No Plex mark in the product name.
- Upstream credit ("based on SamSUCKS by rfaile313") lives in About, not in the chrome.

## Evidence on Hand

- Real library content through the preview proxy (`tools/preview.mjs`, Phase A step A1) once it lands.
- Performance numbers in the README were measured upstream on a 2022 Q60B, not on this TV. The QN90C baseline goes in `docs/perf-baseline.md` in Phase A. Do not quote Q60B numbers as this TV's.
- Existing brand assets in `assets/` and `app/img/` belong to the SamSUCKS identity. They are reference for sizes and formats only, not for look.
- The household's Plex Home makeup (number of users, PINs) is unknown until Phase B step S1.0.

## Product Principles

1. Speed outranks look. A visual idea that costs frames on the TV is dropped.
2. Resume first. From launch, the thing you were watching is one press away.
3. Focus is never in doubt, from the couch, on every screen.
4. Artwork leads and chrome recedes. The library is the content; the app frames it.
5. Arrows, OK and Back reach everything.

## Accessibility & Inclusion

- Minimum text size is whatever reads from 2.5 to 3.5 m on the real panel, judged there, not on a monitor.
- Bright focus fills on near-black bloom on Mini-LED. Focus treatments are judged on the QN90C.
- Focus visibility does not rely on color alone.
