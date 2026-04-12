import json
import math
import re
from datetime import datetime


def main(filename="agent-workflow.document.example.json"):
    """
    Load agent workflow bundle JSON (same directory as cwd), return a compact dict
    for LLM context (short keys, truncated strings, UUID/date compression).
    """
    with open(filename, encoding="utf-8") as fp:
        doc = json.load(fp)

    def norm_txt(s):
        if not isinstance(s, str) or not s:
            return s
        return re.sub(r"\s+", " ", s.strip())

    def uuid_short(u):
        if not isinstance(u, str):
            return u
        if re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            u,
            re.I,
        ):
            return u[:8]
        return u

    def dt_short(iso):
        if not isinstance(iso, str) or not iso:
            return None
        try:
            s = iso.replace("Z", "+00:00")
            return datetime.fromisoformat(s).date().isoformat()
        except ValueError:
            m = re.match(r"^(\d{4}-\d{2}-\d{2})", iso)
            return m.group(1) if m else iso[:10]

    def shrink_cfg(cfg, max_str=72):
        if not isinstance(cfg, dict) or not cfg:
            return {}
        out = {}
        for k, v in cfg.items():
            if isinstance(v, str):
                v = norm_txt(v)
                if len(v) > max_str:
                    v = v[: max_str - 3] + "..."
                out[k] = v
            elif isinstance(v, dict):
                out[k] = shrink_cfg(v, max_str=max_str // 2)
            else:
                out[k] = v
        return out

    def summarize_analysis(obj, max_keys=12):
        if obj is None:
            return None
        if not isinstance(obj, dict):
            return obj
        summary = {}
        for i, (k, v) in enumerate(obj.items()):
            if i >= max_keys:
                summary["_more_keys"] = len(obj) - max_keys
                break
            if isinstance(v, list):
                summary[k] = {"_n": len(v)}
            elif isinstance(v, dict):
                summary[k] = {"_n": len(v)}
            elif isinstance(v, str):
                t = norm_txt(v)
                summary[k] = t[:80] + ("..." if len(t) > 80 else "")
            else:
                summary[k] = v
        return summary

    wd = doc.get("workflow_definition") or {}
    steps = wd.get("steps") or []
    steps_c = []
    for s in sorted(steps, key=lambda x: (x.get("order") is None, x.get("order", 0))):
        steps_c.append(
            {
                "o": s.get("order"),
                "t": s.get("step_type"),
                "n": norm_txt(s.get("name") or "")[:64],
                "c": shrink_cfg(s.get("config") or {}),
            }
        )

    wr = doc.get("workflow_run")
    run_c = None
    if isinstance(wr, dict) and wr:
        ex = wr.get("step_executions") or []
        ex_c = []
        for e in sorted(ex, key=lambda x: (x.get("step_order") is None, x.get("step_order", 0))):
            err = e.get("error_message")
            if isinstance(err, str):
                err = norm_txt(err)[:96]
            ex_c.append(
                {
                    "o": e.get("step_order"),
                    "n": norm_txt(e.get("step_name") or "")[:48],
                    "s": e.get("status"),
                    "e": err or None,
                }
            )
        n_st = len(steps_c)
        n_ex = len(ex_c)
        run_c = {
            "id": uuid_short(wr.get("id")),
            "st": wr.get("status"),
            "co": wr.get("current_step_order"),
            "wf": uuid_short(wr.get("workflow_definition")),
            "ar": summarize_analysis(wr.get("analysis_result")),
            "ct": len(wr.get("created_tasks") or []),
            "err": norm_txt(wr.get("error_message") or "")[:96] or None,
            "ex": ex_c,
            "sz": round(math.hypot(float(max(n_st, 1)), float(max(n_ex, 1))), 2),
        }

    out = {
        "fv": doc.get("format_version"),
        "wf": {
            "id": uuid_short(wd.get("id")),
            "n": norm_txt(wd.get("name") or "")[:80],
            "st": wd.get("status"),
            "ca": dt_short(wd.get("created_at")),
            "ua": dt_short(wd.get("updated_at")),
            "steps": steps_c,
        },
        "run": run_c,
    }
    return out
