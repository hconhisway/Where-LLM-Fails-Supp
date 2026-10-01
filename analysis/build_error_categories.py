"""Build public/results/error-categories.json for the "Error Categories" tab.

Run from the repository root:  python3 analysis/build_error_categories.py

Inputs
  public/results/experiment/<run>/viewer-data.json   generated specs + JSON/render outcome
  public/results/experiment/<run>/reviews.jsonl      post-audit rubric review (one per case)
  analysis/coding/codebook.csv                        qualitative codes, each listing the
                                                      failed rubric items it explains
Unit of analysis
  One "error" = one failed rubric item on a rendered case (11 items per case).
  Each error is assigned to exactly one code: codes from the four failure patterns
  win over pipeline codes; ties go to the code that explains more errors overall.
  Errors no code explains are reported as "uncoded".
"""
import collections
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXP = ROOT / "public" / "results" / "experiment"
OUT = ROOT / "public" / "results" / "error-categories.json"
CODEBOOK = ROOT / "analysis" / "coding" / "codebook.csv"

RUNS = {  # codebook model key -> (run id, display name)
    "gpt5": ("gpt5-full-matrix-v1", "GPT-5"),
    "qwen": ("qwen35-plus-full-matrix-v1", "Qwen 3.5 Plus"),
    "gemini": ("gemini-vegalite-smoke", "Gemini 3.1 Pro"),
}
CATEGORIES = [
    ("missed-renderer-defaults", "Missed Renderer Defaults",
     "Omitted settings or renderer conventions (defaults, accepted-but-reinterpreted data shapes, silently dropped keys, chart-type name collisions) change the chart."),
    ("failed-workaround", "Failed Workaround",
     "The DSL lacks the requested chart or composition, and the substitute chart or hand-built workaround does not preserve the requested semantics."),
    ("layout-arithmetic", "Layout Arithmetic Failure",
     "Spacing, sizing, margins, or panel geometry are not coordinated, so titles, legends, axes, or panels collide, clip, or overflow."),
    ("encoding-mismatch", "Encoding Mismatch",
     "The right data field is used, but placed in a part of the spec that does not drive the requested encoding (color, legend, position)."),
    ("pipeline", "Rendering pipeline (out of scope)",
     "Caused by our rendering setup rather than the model or DSL, e.g. an optional chart module or plugin that the harness did not load."),
    ("uncoded", "Uncoded",
     "Failed rubric items that no code in the codebook explains."),
]
PATTERNS = {"missed-renderer-defaults", "failed-workaround", "layout-arithmetic", "encoding-mismatch"}
RUBRIC = ["S1", "S2", "S3", "E1", "E2", "E3", "F1", "F2", "Y1", "Y2", "Y3"]


def parse_cases(text):
    for token in filter(None, (t.strip() for t in text.split(";"))):
        model, rest = token.split(":", 1)
        grammar_task, items = rest.rsplit(":", 1)
        grammar, task = grammar_task.split("/")
        for item in items.split(","):
            yield (model, grammar, task, item)


def main():
    # ---- outcomes -------------------------------------------------------
    failed = {}            # (model, grammar, task) -> [items]
    index_of = {}          # (model, grammar, task) -> position in viewer-data results
    flow = collections.Counter()
    excluded = collections.Counter()
    for key, (run, _) in RUNS.items():
        results = json.load(open(EXP / run / "viewer-data.json"))["results"]
        flow["completed"] += len(results)
        for i, r in enumerate(results):
            case = (key, r["grammarId"], r["taskId"])
            index_of[case] = i
            if r["jsonValid"]:
                flow["jsonValid"] += 1
            if r["renderSuccess"]:
                flow["rendered"] += 1
            elif r["grammarId"] == "chartml":
                excluded["chartml"] += 1
            else:
                excluded["renderFailure"] += 1
        for line in open(EXP / run / "reviews.jsonl"):
            if not line.strip():
                continue
            rv = json.loads(line)
            items = [k for k in RUBRIC if rv["ratings"].get(k, {}).get("score") == "fail"]
            if items:
                failed[(key, rv["grammarId"], rv["taskId"])] = items
    flow["trials"] = 41 * 10 * 3
    flow["noResponse"] = flow["trials"] - flow["completed"]
    flow["failingCases"] = len(failed)
    flow["passingCases"] = flow["rendered"] - len(failed)

    # ---- codebook -------------------------------------------------------
    codes = list(csv.DictReader(open(CODEBOOK)))
    candidates = collections.defaultdict(list)   # error -> [code idx]
    errors = {(c + (i,)) for c, items in failed.items() for i in items}
    for idx, code in enumerate(codes):
        for err in parse_cases(code["cases"]):
            if err in errors:
                candidates[err].append(idx)
    raw_size = collections.Counter(i for idxs in candidates.values() for i in idxs)

    def rank(idx):
        in_pattern = codes[idx]["category"] in PATTERNS
        return (not in_pattern, -raw_size[idx], codes[idx]["code"])

    assigned = {}
    for err in errors:
        idxs = candidates.get(err)
        assigned[err] = min(idxs, key=rank) if idxs else None

    # ---- aggregate ------------------------------------------------------
    def cat_of(err):
        idx = assigned[err]
        return "uncoded" if idx is None else codes[idx]["category"]

    cat_items = collections.Counter()
    cat_cases = collections.defaultdict(set)
    cat_model = collections.defaultdict(collections.Counter)
    cat_grammar = collections.defaultdict(collections.Counter)
    code_items = collections.Counter()
    code_cases = collections.defaultdict(lambda: collections.defaultdict(list))
    for err in sorted(errors):
        model, grammar, task, item = err
        cat = cat_of(err)
        cat_items[cat] += 1
        cat_cases[cat].add((model, grammar, task))
        cat_model[cat][model] += 1
        cat_grammar[cat][grammar] += 1
        if assigned[err] is not None:
            code_items[assigned[err]] += 1
            code_cases[assigned[err]][(model, grammar, task)].append(item)

    case_kind = collections.Counter()
    for case, items in failed.items():
        cats = {cat_of(case + (i,)) for i in items}
        if cats & PATTERNS:
            case_kind["withPattern"] += 1
        elif "pipeline" in cats:
            case_kind["pipelineOnly"] += 1
        else:
            case_kind["uncodedOnly"] += 1

    def case_ref(case, items):
        model, grammar, task = case
        return {"model": model, "runId": RUNS[model][0], "grammar": grammar, "task": task,
                "items": sorted(items, key=RUBRIC.index), "index": index_of.get(case)}

    code_list = []
    for idx, n in code_items.most_common():
        c = codes[idx]
        cases = code_cases[idx]
        code_list.append({
            "code": c["code"], "category": c["category"], "axial": c["axial_category"],
            "notes": c["notes"], "errors": n,
            "byModel": {m: sum(len(v) for k, v in cases.items() if k[0] == m) for m in RUNS},
            "grammars": sorted({k[1] for k in cases}),
            "cases": [case_ref(k, v) for k, v in sorted(cases.items())],
        })
    code_list.sort(key=lambda c: (-c["errors"], c["code"]))

    out = {
        "unit": "failed rubric item on a rendered case",
        "models": {k: v[1] for k, v in RUNS.items()},
        "flow": dict(flow),
        "excluded": dict(excluded),
        "totalErrors": len(errors),
        "caseKinds": dict(case_kind),
        "categories": [
            {"id": cid, "label": label, "description": desc, "isPattern": cid in PATTERNS,
             "errors": cat_items[cid], "cases": len(cat_cases[cid]),
             "byModel": {m: cat_model[cid][m] for m in RUNS},
             "byGrammar": dict(sorted(cat_grammar[cid].items()))}
            for cid, label, desc in CATEGORIES
        ],
        "codes": code_list,
    }
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")

    pattern_errors = sum(cat_items[c] for c in PATTERNS)
    print(f"errors {len(errors)} in {len(failed)} failing cases")
    for cid, label, _ in CATEGORIES:
        print(f"  {label:36s} {cat_items[cid]:4d}  {100 * cat_items[cid] / len(errors):5.1f}%")
    in_scope = len(errors) - cat_items["pipeline"]
    print(f"four patterns: {pattern_errors} ({100 * pattern_errors / len(errors):.1f}%); "
          f"excluding pipeline {100 * pattern_errors / in_scope:.1f}% of {in_scope}")
    print(f"codes used: {len(code_list)}; case kinds {dict(case_kind)}; wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
