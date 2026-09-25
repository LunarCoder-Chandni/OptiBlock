from flask import Flask, render_template, jsonify, request

import optimizer as opt

app = Flask(__name__)

# --- in-memory state -------------------------------------------------
# A real deployment would put this in PostgreSQL (see README, Phase 2).
# For this prototype, one process = one shared demo session, which is
# exactly what's needed for an SIH jury demo.
TRAINS = opt.build_trains()
TRAFFIC = opt.build_traffic_matrix(TRAINS)
STATE = {
    "requests": opt.base_requests(),
    "seq": 15,
}


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/meta")
def api_meta():
    """Static corridor data the frontend needs once: sections, stations,
    departments, the train timetable and the traffic-cost matrix used to
    draw the heatmap and explain scheduling decisions."""
    return jsonify(
        {
            "stations": opt.STATIONS,
            "sections": opt.SECTIONS,
            "days": opt.DAYS,
            "departments": opt.DEPARTMENTS,
            "trains": TRAINS,
            "traffic": TRAFFIC,
        }
    )


@app.route("/api/requests", methods=["GET"])
def get_requests():
    scored = [dict(r, score=opt.priority_score(r)) for r in STATE["requests"]]
    return jsonify({"requests": scored})


@app.route("/api/requests", methods=["POST"])
def add_request():
    body = request.get_json(force=True, silent=True) or {}

    dept = body.get("dept")
    section = body.get("section")
    work = (body.get("work") or "").strip()
    if dept not in opt.DEPARTMENTS or section not in opt.SECTION_IDS or not work:
        return jsonify({"error": "INVALID_REQUEST", "message": "dept, section and work are required."}), 400

    def clamp(v, lo, hi, default):
        try:
            v = int(v)
        except (TypeError, ValueError):
            return default
        return max(lo, min(hi, v))

    new_req = {
        "id": f"BR-{STATE['seq']}",
        "dept": dept,
        "section": section,
        "work": work[:120],
        "dur": clamp(body.get("dur"), 1, 6, 2),
        "urgency": clamp(body.get("urgency"), 1, 7, 4),
        "crit": clamp(body.get("crit"), 1, 10, 5),
        "safety": bool(body.get("safety")),
        "pref": body.get("pref") if body.get("pref") in ("night", "day", "any") else "night",
        "custom": True,
    }
    STATE["seq"] += 1
    STATE["requests"].append(new_req)
    return jsonify({"requests": [dict(r, score=opt.priority_score(r)) for r in STATE["requests"]]}), 201


@app.route("/api/requests/reset", methods=["POST"])
def reset_requests():
    STATE["requests"] = opt.base_requests()
    STATE["seq"] = 15
    return jsonify({"requests": [dict(r, score=opt.priority_score(r)) for r in STATE["requests"]]})


@app.route("/api/optimize", methods=["POST"])
def optimize():
    result = opt.run_full(STATE["requests"], TRAINS, TRAFFIC)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
