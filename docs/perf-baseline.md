# Performance baseline

Frame times on the TV for a fixed set of scenarios. Later builds are compared against
these numbers with the thresholds at the end. Nothing is recorded yet: the first run
happens at TV gate 1, on the build from the commit that added `tools/bench.sh`.

## Device

| | |
| --- | --- |
| Model | QN90C |
| Firmware | not recorded yet |
| Tizen | not recorded yet |
| User agent | not recorded yet |
| Chromium | not recorded yet. This version is the ceiling for JS and CSS features. |
| Build | not recorded yet (commit) |

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
| `detail` | Home: OK then Back, three times, 1.2 s apart, opening and closing the detail page |
| `cold` | Page reload until Home logs "home rows ready" (painted from its cache), 5 runs |

## Baseline (medians)

| Scenario | fps | p50 ms | p95 ms | worst ms |
| --- | --- | --- | --- | --- |
| `home-h` | | | | |
| `home-v` | | | | |
| `home-hold` | | | | |
| `lib-v` | | | | |
| `detail` | | | | |

Home rows ready at cold start: not recorded yet.

## Thresholds

| Metric | Threshold |
| --- | --- |
| fps in each scenario | no lower than baseline minus 3 |
| p95 frame time | no higher than baseline plus 4 ms |
| worst frame | no higher than the larger of 1.5x baseline and 50 ms |
| home rows ready at cold start | no higher than baseline plus 100 ms |
