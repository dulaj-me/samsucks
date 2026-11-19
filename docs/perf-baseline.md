# Performance baseline

Frame times on the TV for a fixed set of scenarios. Later builds are compared against
these numbers with the thresholds at the end. Always compare a dev build with a dev build.

## Device

| | |
| --- | --- |
| Model | QE65QN90CATXXN (QN90C) |
| Firmware | T-PTMCDEUC-0090-2220.4 |
| Tizen | 9.0 |
| User agent | Mozilla/5.0 (SMART-TV; LINUX; Tizen 9.0) AppleWebKit/537.36 (KHTML, like Gecko) 120.0.6099.5/9.0 TV Safari/537.36 |
| Chromium | 120. This version is the ceiling for JS and CSS features. |
| Build | `850a436` (main plus bench tooling), recorded 2026-11-19 |

## How to record

```sh
node tools/devserver.mjs          # keep running; logs land in build/tv.log
./scripts/deploy.sh --dev         # dev build, launches on the TV
tools/bench.sh info               # model, firmware, Tizen version, user agent
tools/bench.sh                    # every scenario, 3 runs each, plus medians
tools/bench.sh cold               # after the app has reached Home once since the deploy
```

Record the medians. Each scenario restarts Home first, so the runs start from the same state.

| Scenario | What it does |
| --- | --- |
| `home-h` | Home, first row: Right 10 times, then Left 10 times, 250 ms apart |
| `home-v` | Home: Down 6 times, then Up 6 times, 350 ms apart |
| `home-hold` | Home, first row: Right held for 3 s, key repeat every 50 ms |
| `lib-v` | First library (or `BENCH_LIBRARY=<title>`): Down 10 times, then Up 10 times, 300 ms apart |
| `lib-hold` | First library (or `BENCH_LIBRARY=<title>`): Down held for 3 s |
| `detail` | Home: OK then Back, three times, 1.2 s apart, opening and closing the detail page |
| `cold` | Page reload until Home logs "home rows ready" (painted from its cache), 5 runs |

## Baseline (medians)

| Scenario | fps | p50 ms | p95 ms | worst ms |
| --- | --- | --- | --- | --- |
| `home-h` | 51 | 17 | 33 | 50 |
| `home-v` | 52 | 17 | 33 | 50 |
| `home-hold` | 57 | 17 | 33 | 33 |
| `lib-v` | 50 | 17 | 33 | 33 |
| `lib-hold` | 57 | 17 | 33 | 33 |
| `detail` | 49 | 17 | 33 | 300 |

Home rows ready at cold start: 216 ms.

`lib-hold` was added after the first recording and measured on `56a7d08`, which leaves the
grid unchanged. `detail` has a 300 ms frame on every open, already present before Phase A.

## Thresholds

Frame times on the TV come in steps of one 16.7 ms frame, so the thresholds count frames.

| Metric | Threshold |
| --- | --- |
| fps, per scenario | no lower than baseline minus 3 |
| p50 frame | stays at one frame (17 ms) |
| p95 frame | no step up from the scenario's baseline |
| worst frame | at most one frame above the scenario's baseline |
| worst frame of the first `home-h` run after a reload | no higher than baseline |
| `cold`: home rows ready | no higher than baseline plus 100 ms |
| `tools/perf-lint.sh` | zero violations |
