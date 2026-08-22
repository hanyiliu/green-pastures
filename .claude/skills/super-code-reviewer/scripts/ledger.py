#!/usr/bin/env python3
"""Finding ledger for the super-code-reviewer skill.

A stable fingerprint per finding is what lets this reviewer sweep continuously
without handing the orchestrator the same three dead functions every pass: a
re-found finding updates in place instead of landing as new work. The sweep log
is how the skill knows it has gone dry rather than guessing.

  ledger.py add --kind dead-code --path src/a.ts [--line 42] --title "..."
                [--detail "..."] [--effort S|M|L] [--confidence high|med|low]
  ledger.py sweep --scope "src/**" --lens dead-code    record a completed pass
  ledger.py list [--status open] [--kind ...] [--min-confidence high]
  ledger.py set <id> --status open|handed-off|fixed|wontfix [--note "..."]
  ledger.py handoff [--max N] [--mark]   open findings, ranked, for the orchestrator
  ledger.py summary                      counts, sweep history, dry streak

Kinds: dead-code duplicate contradiction chore risk
State file: $ORCH_LEDGER, else ./review-ledger.json
"""
import hashlib, json, os, sys

STATE = os.environ.get("ORCH_LEDGER", "review-ledger.json")
KINDS = ("dead-code", "duplicate", "contradiction", "chore", "risk")
STATUSES = ("open", "handed-off", "fixed", "wontfix")
RANK = {"high": 0, "med": 1, "low": 2}
COST = {"S": 0, "M": 1, "L": 2}


def load():
    try:
        with open(STATE) as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {"findings": [], "sweeps": []}


def save(s):
    with open(STATE, "w") as f:
        json.dump(s, f, indent=1)


def kv(argv):
    d, i = {}, 0
    while i < len(argv):
        if argv[i].startswith("--"):
            nxt = argv[i + 1] if i + 1 < len(argv) else None
            val = nxt if nxt is not None and not nxt.startswith("--") else "1"
            d.setdefault(argv[i][2:], []).append(val)
            i += 2 if val is nxt else 1
        else:
            i += 1
    return d


def one(d, k, default=""):
    return d.get(k, [default])[0]


def fingerprint(kind, path, title):
    """Same defect re-found in a later sweep must hash to the same id."""
    raw = f"{kind}|{path}|{' '.join(title.lower().split())}"
    return hashlib.sha1(raw.encode()).hexdigest()[:8]


def add(s, d):
    kind, path = one(d, "kind", "chore"), one(d, "path")
    title = one(d, "title")
    if kind not in KINDS:
        sys.exit(f"kind must be one of {', '.join(KINDS)}")
    if not path or not title:
        sys.exit("--path and --title are required")
    fid = fingerprint(kind, path, title)
    row = {"id": fid, "kind": kind, "path": path, "line": one(d, "line"),
           "title": title, "detail": one(d, "detail"), "effort": one(d, "effort", "M"),
           "confidence": one(d, "confidence", "med"), "status": "open", "seen": 1}
    for f in s["findings"]:
        if f["id"] == fid:
            f["seen"] += 1
            for k in ("line", "detail", "effort", "confidence"):
                if k in d:
                    f[k] = row[k]
            return fid, False
    s["findings"].append(row)
    return fid, True


def order(f):
    return (RANK.get(f.get("confidence"), 1), COST.get(f.get("effort"), 1), f["path"])


def show(f):
    loc = f"{f['path']}:{f['line']}" if f.get("line") else f["path"]
    head = (f"[{f['id']}] {f['kind']:<13} {f['confidence']:<4} effort={f['effort']}  "
            f"{loc}\n    {f['title']}")
    return head + (f"\n    {f['detail']}" if f.get("detail") else "")


def main(argv):
    cmd = argv[0] if argv else "summary"
    rest = argv[1:]
    pos = [a for a in rest if not a.startswith("--")]
    d = kv(rest)
    s = load()

    if cmd == "add":
        fid, is_new = add(s, d)
        save(s)
        print(f"{fid} {'new' if is_new else 'already known (seen again)'}")

    elif cmd == "sweep":
        total = len(s["findings"])
        prev = s["sweeps"][-1]["total_after"] if s["sweeps"] else 0
        # a pass that adds no id the ledger hadn't already seen is a dry pass
        s["sweeps"].append({"scope": one(d, "scope", "*"), "lens": one(d, "lens", "all"),
                            "total_after": total, "new": total - prev})
        save(s)
        print(f"sweep {len(s['sweeps'])} recorded: {s['sweeps'][-1]['new']} new finding(s)")

    elif cmd == "list":
        rows = s["findings"]
        if "status" in d:
            rows = [f for f in rows if f["status"] == one(d, "status")]
        if "kind" in d:
            rows = [f for f in rows if f["kind"] in d["kind"]]
        if "min-confidence" in d:
            cap = RANK.get(one(d, "min-confidence"), 2)
            rows = [f for f in rows if RANK.get(f.get("confidence"), 1) <= cap]
        for f in sorted(rows, key=order):
            print(show(f))
        print(f"\n{len(rows)} finding(s)")

    elif cmd == "set":
        if not pos:
            sys.exit("usage: ledger.py set <id> --status <status>")
        st = one(d, "status", "open")
        if st not in STATUSES:
            sys.exit(f"status must be one of {', '.join(STATUSES)}")
        for f in s["findings"]:
            if f["id"] == pos[0]:
                f["status"] = st
                if "note" in d:
                    f["note"] = one(d, "note")
                save(s)
                print(f"{f['id']} -> {st}")
                return
        sys.exit(f"no finding with id {pos[0]}")

    elif cmd == "handoff":
        rows = sorted([f for f in s["findings"] if f["status"] == "open"], key=order)
        mx = int(one(d, "max", "0"))
        rows = rows[:mx] if mx else rows
        if not rows:
            print("no open findings")
            return
        print(f"# {len(rows)} finding(s) for the orchestrator, most actionable first\n")
        for f in rows:
            print(show(f))
            if "mark" in d:
                f["status"] = "handed-off"
        if "mark" in d:
            save(s)

    elif cmd == "summary":
        by_kind, by_status = {}, {}
        for f in s["findings"]:
            by_kind[f["kind"]] = by_kind.get(f["kind"], 0) + 1
            by_status[f["status"]] = by_status.get(f["status"], 0) + 1
        dry = 0
        for sw in reversed(s["sweeps"]):
            if sw.get("new"):
                break
            dry += 1
        print(f"findings: {len(s['findings'])}")
        print("  by kind:   " + (", ".join(f"{k}={v}" for k, v in sorted(by_kind.items())) or "—"))
        print("  by status: " + (", ".join(f"{k}={v}" for k, v in sorted(by_status.items())) or "—"))
        print(f"sweeps: {len(s['sweeps'])}  dry_streak: {dry}")
        for sw in s["sweeps"][-5:]:
            print(f"  {sw['lens']:<14} {sw['scope']:<24} +{sw.get('new', 0)}")

    else:
        sys.exit(f"unknown command: {cmd}\n{__doc__}")


if __name__ == "__main__":
    main(sys.argv[1:])
