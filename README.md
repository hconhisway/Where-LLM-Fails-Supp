# Where LLMs Fail with Visualization DSLs — Interactive Supplement

Interactive supplement for the paper *Where LLMs Fail with Visualization DSLs*
(Chang Han, Andrew M. McNutt, Katherine E. Isaacs). It lets readers browse every
generated specification, its rendered chart, and its post-audit rubric review, and
see how the failures break down into the paper's four failure patterns.

Live site: https://llmgrammar.netlify.app

## The study in one paragraph

41 chart-generation tasks × 10 JSON-style visualization DSLs × 3 LLMs (GPT-5,
Qwen 3.5 Plus, Gemini 3.1 Pro) = 1230 trials. Each output was checked for JSON
validity and rendered headlessly; each rendered chart was scored pass/fail on an
11-item rubric by a vision-language model (Claude Opus 4.7) and then audited by a
human reviewer. Failures were coded qualitatively into four patterns: Missed Renderer
Defaults, Failed Workaround, Layout Arithmetic Failure, and Encoding Mismatch.

| Stage | Count |
|---|---|
| Trials | 1230 (7 Gemini trials returned no result) |
| Valid JSON | 1222 (99.3% of 1230) |
| Rendered | 964 (78.4% of 1230) |
| Passed all 11 rubric items | 416 (43.2% of rendered) |
| Failed at least one item | 548 (56.8% of rendered), 791 failed items in total |

## Pages

| Tab | What it shows |
|---|---|
| Results | Grid of all results for the selected model run, with filters; click a card for the prompt, raw response, extracted spec, and rendered image. |
| Summary | JSON-validity and render-success rates by model, DSL, and task. |
| Grammar Axes | The 10 DSLs positioned on McNutt (2022)'s design axes. |
| Error Categories | How the 791 failed rubric items split across the four failure patterns, pipeline issues, and uncoded errors; a Pareto chart of the codes; breakdowns by model and DSL; and the full codebook with links to every case. |
| Reviewer | Case-by-case view of each rendered chart with its rubric scores and reviewer notes. Edits made here are kept only in your browser. |

Use the **Run** menu in the header to switch between models.

## Repository layout

```
index.html, src/                React + Vite + Tailwind application
  src/pages/                    one file per tab
  src/lib/rubric.js             the 11-item rubric (structure, encoding, fidelity, style)
public/                         static data served with the site
  benchmark/tasks.json          the 41 task definitions
  results/experiment/index.json list of model runs
  results/experiment/<run>/
    viewer-data.json            per trial: prompt (incl. dataset), raw model response,
                                extracted spec, JSON/render outcome, render error
    reviews.jsonl               post-audit rubric review, one per rendered case
    images/                     rendered chart for every rendered case
  results/error-categories.json data for the Error Categories tab (generated)
analysis/
  coding/codebook.csv           qualitative codes: failure pattern, axial category,
                                description, and the failed rubric items each code explains
  build_error_categories.py     regenerates public/results/error-categories.json
  compute_headline_stats.py     recomputes the counts in the table above
```

Run folders map to models as follows: `gpt5-full-matrix-v1` = GPT-5,
`qwen35-plus-full-matrix-v1` = Qwen 3.5 Plus, `gemini-vegalite-smoke` = Gemini 3.1 Pro
(the Gemini folder name is historical; it is a full run).

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build and deploy

```bash
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
```

`dist/` is a static single-page app. On Netlify use build command `npm run build` and
publish directory `dist`; `public/_redirects` routes all paths to `index.html`. Other
static hosts need an equivalent fallback to `index.html`.

## Regenerating the analysis

Python 3 (standard library only):

```bash
python3 analysis/compute_headline_stats.py     # headline counts
python3 analysis/build_error_categories.py     # rewrites public/results/error-categories.json
```

How errors are counted in the Error Categories tab: one error is one failed rubric
item on a rendered case. Each error is assigned to exactly one code; codes in the four
failure patterns take precedence over pipeline codes, and ties go to the code that
explains more errors. Errors that no code explains are reported as uncoded. Trials that
were never rubric-reviewed (ChartML parse failures, other JSON/render failures, and
trials with no result) are reported separately and not coded.
