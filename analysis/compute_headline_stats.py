"""Recompute the headline counts reported in the Results section of the paper.

Usage: python3 scripts/compute_paper_stats.py   (run from the repository root)

Rules:
- Trials = 41 tasks x 10 DSLs x 3 models = 1230.
- JSON-valid / rendered counts come from each run's viewer-data.json records.
- Only rendered cases are rubric-reviewed. A case "passes all rubric items" when
  none of its 11 items is scored "fail" (n/a counts as not failed).
- Some cases have several review records in reviews.jsonl; the record with the
  latest timestamp is used ("most recent review").
"""
import json, collections

RUNS = {"GPT-5": "gpt5-full-matrix-v1",
        "Qwen": "qwen35-plus-full-matrix-v1",
        "Gemini": "gemini-vegalite-smoke"}
TRIALS = 41 * 10 * 3

def pct(a, b):
    return f"{100 * a / b:.1f}%"

tot = collections.Counter()
for label, run in RUNS.items():
    base = f"public/results/experiment/{run}"
    res = json.load(open(f"{base}/viewer-data.json"))["results"]
    rendered = {(r["grammarId"], r["taskId"]) for r in res if r["renderSuccess"]}
    reviews = collections.defaultdict(list)
    for line in open(f"{base}/reviews.jsonl"):
        if line.strip():
            rv = json.loads(line)
            reviews[(rv["grammarId"], rv["taskId"])].append(rv)
    assert set(reviews) == rendered, f"{run}: reviewed set != rendered set"
    latest = {k: max(v, key=lambda r: r["timestamp"]) for k, v in reviews.items()}
    allpass = sum(1 for rv in latest.values()
                  if not any(x.get("score") == "fail" for x in rv["ratings"].values()))
    row = dict(completed=len(res), json=sum(r["jsonValid"] for r in res),
               rendered=len(rendered), allpass=allpass, anyfail=len(rendered) - allpass,
               dup_reviewed=sum(len(v) > 1 for v in reviews.values()))
    print(label, row, f"all-pass {allpass}/{len(rendered)} = {pct(allpass, len(rendered))}")
    tot.update(row)

print("\nTOTAL", dict(tot))
print(f"no result     : {TRIALS - tot['completed']}")
print(f"JSON valid    : {tot['json']}/{TRIALS} = {pct(tot['json'], TRIALS)}")
print(f"rendered      : {tot['rendered']}/{TRIALS} = {pct(tot['rendered'], TRIALS)}")
print(f"all-pass      : {tot['allpass']}/{tot['rendered']} rendered = {pct(tot['allpass'], tot['rendered'])}"
      f"  ({pct(tot['allpass'], TRIALS)} of all trials)")
print(f">=1 rubric fail: {tot['anyfail']}/{tot['rendered']} rendered = {pct(tot['anyfail'], tot['rendered'])}")
