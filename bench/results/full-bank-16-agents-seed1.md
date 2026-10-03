# Live Main vs baselines

{"agents":16,"workcells":4,"tasks":400,"mode":"scripted","thinkMs":1500,"seed":1}

| metric | live-main | pr-flow | push-to-branch |
|---|---|---|---|
| agents / tasks | 16 / 336 | 16 / 336 | 16 / 336 |
| landed / failed | 336 / 0 | 252 / 81 | 262 / 69 |
| wall time | 25.6 min | 79.4 min | 50.9 min |
| time to all-green | 19.8 min | never | never |
| throughput (landings/min) | 13.11 | 3.17 | 5.14 |
| agent-minutes | 312.6 | 1202.6 | 769.6 |
| wasted agent-minutes | 26.7 (9%) | 1113.0 (93%) | 708.4 (92%) |
| tokens in / out | 0 / 0 | 0 / 0 | 0 / 0 |
| rebases (conflicted files) | 0 (0) | 2215 (1894) | 2912 (2836) |
| rejected submits | impact-failed 30 | needs-rebase 1894, push-rejected 10 | needs-rebase 2836, push-rejected 2912 |
| landed on first submit | 323 (96%) | 239 (95%) | 84 (32%) |
| checkpoints | 667 | 0 | 0 |
| false-interrupt rate | 100% of 1 | n/a | n/a |
| notices interrupt / review | 156 / 0 | 0 / 0 | 0 / 0 |
| auto-merged files | 257 | 0 | 0 |
| breakages caught before landing | 30 | 0 | 0 |
| breakages that landed (regressions) | 1 | 28 | 30 |
| final CI (tests passed / failed) | 2086 / 0 | 1492 / 586 | 1562 / 524 |
