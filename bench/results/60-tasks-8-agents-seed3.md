# Live Main vs baselines

{"agents":8,"workcells":3,"tasks":60,"mode":"scripted","thinkMs":1500,"seed":3}

| metric | live-main | pr-flow | push-to-branch |
|---|---|---|---|
| agents / tasks | 8 / 60 | 8 / 60 | 8 / 60 |
| landed / failed | 60 / 0 | 53 / 7 | 57 / 3 |
| wall time | 4.6 min | 12.5 min | 10.5 min |
| time to all-green | 3.7 min | never | never |
| throughput (landings/min) | 13.13 | 4.24 | 5.42 |
| agent-minutes | 26.8 | 86.5 | 76.2 |
| wasted agent-minutes | 4.1 (15%) | 73.7 (85%) | 63.8 (84%) |
| tokens in / out | 0 / 0 | 0 / 0 | 0 / 0 |
| rebases (conflicted files) | 0 (0) | 209 (168) | 305 (293) |
| rejected submits | impact-failed 11 | needs-rebase 168, push-rejected 1 | needs-rebase 293, push-rejected 305 |
| landed on first submit | 57 (95%) | 47 (89%) | 27 (47%) |
| checkpoints | 161 | 0 | 0 |
| false-interrupt rate | n/a | n/a | n/a |
| notices interrupt / review | 29 / 0 | 0 / 0 | 0 / 0 |
| auto-merged files | 29 | 0 | 0 |
| breakages caught before landing | 11 | 0 | 0 |
| breakages that landed (regressions) | 0 | 4 | 6 |
| final CI (tests passed / failed) | 415 / 0 | 375 / 38 | 378 / 37 |
