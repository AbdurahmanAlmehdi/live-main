# Live Main vs baselines

{"agents":8,"workcells":3,"tasks":60,"mode":"scripted","thinkMs":1500,"seed":2}

| metric | live-main | pr-flow | push-to-branch |
|---|---|---|---|
| agents / tasks | 8 / 60 | 8 / 60 | 8 / 60 |
| landed / failed | 60 / 0 | 53 / 7 | 57 / 3 |
| wall time | 3.9 min | 12.3 min | 10.7 min |
| time to all-green | 3.9 min | never | never |
| throughput (landings/min) | 15.32 | 4.31 | 5.35 |
| agent-minutes | 26.2 | 84.4 | 75.7 |
| wasted agent-minutes | 3.4 (13%) | 72.7 (86%) | 63.3 (84%) |
| tokens in / out | 0 / 0 | 0 / 0 | 0 / 0 |
| rebases (conflicted files) | 0 (0) | 200 (166) | 302 (287) |
| rejected submits | impact-failed 9 | needs-rebase 166 | needs-rebase 287, push-rejected 302 |
| landed on first submit | 57 (95%) | 47 (89%) | 24 (42%) |
| checkpoints | 147 | 0 | 0 |
| false-interrupt rate | 100% of 1 | n/a | n/a |
| notices interrupt / review | 35 / 4 | 0 / 0 | 0 / 0 |
| auto-merged files | 28 | 0 | 0 |
| breakages caught before landing | 9 | 0 | 0 |
| breakages that landed (regressions) | 0 | 4 | 6 |
| final CI (tests passed / failed) | 415 / 0 | 375 / 38 | 378 / 37 |
