# LibreOffice cross-check of the oracle

`pnpm --filter @livemain/bench oracle:libreoffice` evaluates a random sample of the numeric
oracle expectations (from `demo-repo/tests/functions`) in headless LibreOffice Calc
(`oracle/libreoffice-image`), an implementation independent of formula.js.

Latest run (seed 1, 300 sampled cases of 1004):

- **280 / 292 comparable cases agree (95.9%)**; 8 use functions LibreOffice does not
  expose under the Excel name.
- All 12 disagreements were reviewed. In each, the oracle follows Excel and LibreOffice
  differs:

| case | oracle (Excel) | LibreOffice | why |
|---|---|---|---|
| `SUM({1,"a",TRUE},2)` | 3 | 4 | Excel ignores logicals inside arrays |
| `AVERAGE({1,"a",TRUE},3)` | 2 | 1.667 | same |
| `VAR.P({1,"a",TRUE},3)` | 1 | 0.889 | same |
| `SUMX2PY2({1,TRUE,3},{1,2,3})` | 20 | 25 | same (pairs with a logical are skipped) |
| `YEAR(1)` | 1900 | 1899 | Excel's 1900 date system (serial 1 = 1900-01-01) |
| `FLOOR(-2.5,-2)` | -2 | -4 | Excel rounds toward zero for negative significance |
| `COUNTIF({...},"a*")` | 2 | 1 | LibreOffice wildcards are off by default |
| `SUMIF({1,2,3,4},">2")` | 7 | 0 | LibreOffice SUMIF over inline arrays |
| `FIND("","abc")` | 1 | #VALUE! | Excel finds the empty string at 1 |
| `NUMBERVALUE("3.5%")`, `NUMBERVALUE("")` | 0.035, 0 | #VALUE! | Excel parses percent / empty |
| `DAYS(43845.9,43845.1)` | 0 | 0.8 | Excel truncates to whole days |

Full output: `oracle/libreoffice-report.json`.
