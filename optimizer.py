"""
OptiBlock optimization engine.

This module is the "AI / optimization" layer described in the project brief:
  - a priority/risk scoring function (criticality, deadline urgency, safety)
  - a fusion pass that merges compatible same-section works into one
    combined possession (fewer, longer blocks instead of many short ones)
  - a constraint-aware greedy scheduler that places every request in the
    lowest traffic-cost window that still meets its deadline
  - a naive "siloed" baseline scheduler that reproduces today's problem
    (each department books independently, no shared visibility) so the
    dashboard can show a before/after comparison

Everything here is plain Python with no external dependencies, by design —
see the README for why this is a deliberate Phase-1 scoping choice.
"""

import random

STATIONS = ["NDLS", "GZB", "ALJN", "TDL", "ETW", "CNB"]
SECTIONS = [
    {"id": f"S{i+1}", "from": STATIONS[i], "to": STATIONS[i + 1], "label": f"{STATIONS[i]}\u2013{STATIONS[i+1]}"}
    for i in range(len(STATIONS) - 1)
]
SECTION_IDS = [s["id"] for s in SECTIONS]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

CATEGORIES = [
    {"code": "RJDHNI", "name": "Rajdhani / Shatabdi", "weight": 10, "count": 3, "peak": True},
    {"code": "SF/EXP", "name": "Superfast / Express", "weight": 7, "count": 9, "peak": True},
    {"code": "MEMU/PASS", "name": "Passenger / MEMU", "weight": 4, "count": 7, "peak": True},
    {"code": "GOODS", "name": "Freight / Goods", "weight": 2, "count": 8, "peak": False},
]

DEPARTMENTS = {
    "TRACK": "Engineering (Track)",
    "ST": "Signal & Telecom",
    "TRD": "TRD / OHE",
    "OPS": "Traffic / Operations",
}

# which department pairs are allowed to share a single possession window
COMPATIBLE_PAIRS = {frozenset(["ST", "TRACK"]), frozenset(["TRACK", "TRD"]), frozenset(["ST", "TRD"])}


def _pick_start_hour(rng: random.Random, peak: bool) -> float:
    if peak:
        band = (7, 10) if rng.random() < 0.55 else (17, 21)
        return band[0] + rng.random() * (band[1] - band[0])
    if rng.random() < 0.75:
        return (21 + rng.random() * 8) % 24
    return rng.random() * 24


def build_trains(seed: int = 42):
    rng = random.Random(seed)
    trains = []
    n = 1
    for cat in CATEGORIES:
        for _ in range(cat["count"]):
            trains.append(
                {
                    "id": f"{cat['code']}-{100 + n}",
                    "cat": cat["code"],
                    "name": cat["name"],
                    "weight": cat["weight"],
                    "startHour": _pick_start_hour(rng, cat["peak"]),
                    "secMinutes": 22 + rng.random() * 14,
                }
            )
            n += 1
    return trains


def build_traffic_matrix(trains):
    """cost[section_index][hour] = sum of train weights occupying that
    section during that hour, on a representative weekday."""
    cost = [[0.0] * 24 for _ in SECTIONS]
    for t in trains:
        clock = t["startHour"]
        for si in range(len(SECTIONS)):
            hour_slot = int(clock) % 24
            cost[si][hour_slot] += t["weight"]
            clock += t["secMinutes"] / 60
    return cost


def weekend_factor(day: str) -> float:
    return 0.7 if day in ("Sat", "Sun") else 1.0


def base_requests():
    raw = [
        dict(dept="TRACK", section="S3", work="Rail fracture \u2014 ultrasonic re-test", dur=3, urgency=2, crit=9, safety=True, pref="night"),
        dict(dept="ST", section="S3", work="Signal cable insulation check", dur=2, urgency=3, crit=6, safety=False, pref="night"),
        dict(dept="TRACK", section="S1", work="Ballast deep screening", dur=4, urgency=6, crit=5, safety=False, pref="night"),
        dict(dept="TRD", section="S1", work="OHE wire tension check", dur=2, urgency=5, crit=6, safety=False, pref="night"),
        dict(dept="TRACK", section="S2", work="Rail renewal (fish-plated joint)", dur=4, urgency=4, crit=8, safety=True, pref="night"),
        dict(dept="ST", section="S4", work="Axle counter replacement", dur=3, urgency=2, crit=8, safety=True, pref="night"),
        dict(dept="TRD", section="S4", work="OHE insulator cleaning", dur=2, urgency=5, crit=4, safety=False, pref="night"),
        dict(dept="OPS", section="S5", work="Points & crossing renewal", dur=3, urgency=3, crit=7, safety=True, pref="any"),
        dict(dept="TRACK", section="S5", work="Track geometry correction", dur=3, urgency=7, crit=5, safety=False, pref="night"),
        dict(dept="ST", section="S2", work="Level crossing interlock test", dur=2, urgency=4, crit=7, safety=True, pref="any"),
        dict(dept="TRD", section="S3", work="Feeder cable thermography", dur=2, urgency=6, crit=4, safety=False, pref="night"),
        dict(dept="TRACK", section="S4", work="Bridge girder inspection", dur=3, urgency=3, crit=7, safety=False, pref="day"),
        dict(dept="OPS", section="S1", work="Platform edge safety audit", dur=2, urgency=5, crit=5, safety=False, pref="day"),
        dict(dept="ST", section="S5", work="Block instrument overhaul", dur=3, urgency=4, crit=6, safety=False, pref="night"),
    ]
    out = []
    for i, r in enumerate(raw):
        r = dict(r)
        r["id"] = f"BR-{i+1}"
        r["custom"] = False
        out.append(r)
    return out


def priority_score(r) -> int:
    crit = r["crit"] * 4
    urg = (10 - min(r["urgency"], 10)) * 3
    safety = 15 if r["safety"] else 0
    return round(crit + urg + safety)


def priority_breakdown(r):
    return {
        "crit": r["crit"] * 4,
        "urg": (10 - min(r["urgency"], 10)) * 3,
        "safety": 15 if r["safety"] else 0,
        "total": priority_score(r),
    }


def _compatible(a, b) -> bool:
    if a["dept"] == b["dept"]:
        return True
    return frozenset([a["dept"], b["dept"]]) in COMPATIBLE_PAIRS


def fuse_pass(requests):
    """Merge compatible same-section, same-night-preference requests into
    a single combined possession. Returns (fused_groups, remaining)."""
    used = set()
    groups = []
    by_section = {}
    for r in requests:
        by_section.setdefault(r["section"], []).append(r)

    for sec, all_in_section in by_section.items():
        night_list = [r for r in all_in_section if r["pref"] == "night"]
        for i, ri in enumerate(night_list):
            if ri["id"] in used:
                continue
            group = [ri]
            for rj in night_list[i + 1:]:
                if rj["id"] in used:
                    continue
                combined_dur = sum(x["dur"] for x in group) + rj["dur"]
                if _compatible(group[0], rj) and combined_dur <= 6:
                    group.append(rj)
            if len(group) > 1:
                for g in group:
                    used.add(g["id"])
                groups.append(group)

    fused = []
    for idx, g in enumerate(groups):
        sum_dur = sum(x["dur"] for x in g)
        fused_dur = max(x["dur"] for x in g) + 1  # shared-possession overlap
        final_dur = min(fused_dur, sum_dur)
        fused.append(
            {
                "id": f"FB-{idx+1}",
                "isFusion": True,
                "members": [m["id"] for m in g],
                "dept": "+".join(x["dept"] for x in g),
                "section": g[0]["section"],
                "work": " + ".join(x["work"] for x in g),
                "dur": final_dur,
                "urgency": min(x["urgency"] for x in g),
                "crit": max(x["crit"] for x in g),
                "safety": any(x["safety"] for x in g),
                "pref": "night",
                "savedHours": sum_dur - final_dur,
            }
        )

    remaining = [r for r in requests if r["id"] not in used]
    return fused, remaining


def _is_night_hour(h: int) -> bool:
    return h >= 22 or h < 5


def _find_best_window(req, section_idx, traffic, booked, max_day):
    best = None
    dur = req["dur"]
    for day in range(max_day):
        wf = weekend_factor(DAYS[day])
        for start in range(0, 24 - dur + 1):
            if any(booked[section_idx][day][h] for h in range(start, start + dur)):
                continue
            cost = 0.0
            night_hours = 0
            for h in range(start, start + dur):
                cost += traffic[section_idx][h] * wf
                if _is_night_hour(h):
                    night_hours += 1
            if req["pref"] == "night":
                cost += (dur - night_hours) * 25
            cost += day * 1.5
            if best is None or cost < best["cost"]:
                best = {"day": day, "start": start, "cost": cost}
    return best


def schedule_all(requests, traffic):
    booked = [[[False] * 24 for _ in range(7)] for _ in SECTIONS]
    scored = sorted((dict(r, score=priority_score(r)) for r in requests), key=lambda r: -r["score"])

    assigned, conflicts = [], []
    for r in scored:
        section_idx = SECTION_IDS.index(r["section"])
        max_day = min(7, max(1, r["urgency"]))
        win = _find_best_window(r, section_idx, traffic, booked, max_day)
        if win is None:
            c = dict(r)
            c["reason"] = f"No conflict-free {r['dur']}h window found in {r['section']} within {max_day} day(s) of its deadline."
            conflicts.append(c)
            continue
        for h in range(win["start"], win["start"] + r["dur"]):
            booked[section_idx][win["day"]][h] = True
        a = dict(r)
        a["day"] = win["day"]
        a["start"] = win["start"]
        a["trafficCost"] = round(win["cost"])
        assigned.append(a)
    return assigned, conflicts


def schedule_baseline(requests):
    """Each department books the earliest slot in its own preferred band,
    on day 0, with NO visibility into what other departments booked. This
    reproduces the BDMS 'silo' problem the brief describes."""
    assigned = []
    for r in requests:
        start = 22 if r["pref"] == "night" else (10 if r["pref"] == "day" else 14)
        if start + r["dur"] > 24:
            start = 0
        a = dict(r)
        a["day"] = 0
        a["start"] = start
        assigned.append(a)

    double_bookings = 0
    for i in range(len(assigned)):
        for j in range(i + 1, len(assigned)):
            a, b = assigned[i], assigned[j]
            if a["section"] != b["section"] or a["day"] != b["day"]:
                continue
            if a["start"] < b["start"] + b["dur"] and b["start"] < a["start"] + a["dur"]:
                double_bookings += 1
    return assigned, double_bookings


def trains_affected(trains, assigned):
    count = 0
    for t in trains:
        clock = t["startHour"]
        for si in range(len(SECTIONS)):
            hour_slot = int(clock) % 24
            hit = any(
                b["section"] == SECTION_IDS[si] and b["day"] == 0 and b["start"] <= hour_slot < b["start"] + b["dur"]
                for b in assigned
            )
            if hit:
                count += 1
                break
            clock += t["secMinutes"] / 60
    return count


def total_block_hours(assigned) -> int:
    return sum(b["dur"] for b in assigned)


def asset_availability(total_hours: float) -> float:
    capacity = len(SECTIONS) * 24 * 7
    return (1 - total_hours / capacity) * 100


def section_avg_cost(traffic, section_idx: int) -> float:
    row = traffic[section_idx]
    return sum(row) / len(row)


def run_full(requests, trains, traffic):
    """Run the whole pipeline and return a single JSON-serializable dict
    that the frontend renders directly."""
    fused, remaining = fuse_pass(requests)
    all_for_schedule = fused + remaining
    assigned, conflicts = schedule_all(all_for_schedule, traffic)

    # explainability fields
    for a in assigned:
        si = SECTION_IDS.index(a["section"])
        avg_window_cost = section_avg_cost(traffic, si) * a["dur"]
        a["avgWindowCost"] = round(avg_window_cost)
        a["pctBelowAvg"] = round((1 - a["trafficCost"] / avg_window_cost) * 100) if avg_window_cost > 0 else 0
        a["scoreBreakdown"] = priority_breakdown(a)

    base_assigned, double_bookings = schedule_baseline(requests)

    ai_hours = total_block_hours(assigned)
    base_hours = total_block_hours(base_assigned)
    ai_trains_hit = trains_affected(trains, [a for a in assigned if a["day"] == 0])
    base_trains_hit = trains_affected(trains, base_assigned)
    fusion_saved = sum(f["savedHours"] for f in fused)

    kpis = {
        "assetAvailabilityPct": round(asset_availability(ai_hours), 1),
        "aiBlockHours": ai_hours,
        "baselineBlockHours": base_hours,
        "aiTrainsAffected": ai_trains_hit,
        "baselineTrainsAffected": base_trains_hit,
        "aiConflicts": 0,
        "baselineDoubleBookings": double_bookings,
        "fusionHoursSaved": fusion_saved,
        "fusionGroups": len(fused),
        "requestCount": len(requests),
        "scheduledCount": len(assigned),
        "escalatedCount": len(conflicts),
    }

    return {
        "assigned": assigned,
        "conflicts": conflicts,
        "fusedGroups": fused,
        "baseline": {"assigned": base_assigned, "doubleBookings": double_bookings},
        "kpis": kpis,
    }
