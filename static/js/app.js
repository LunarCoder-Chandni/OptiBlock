(function () {
"use strict";

/* ================= THEME ================= */
try {
  var savedTheme = localStorage.getItem("bpc_theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
} catch (e) {}
document.getElementById("themeToggle").addEventListener("click", function () {
  var cur = document.documentElement.getAttribute("data-theme");
  var next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("bpc_theme", next); } catch (e) {}
  if (state.aiResult) { renderTrackDiagram(); renderGantt(); }
});

/* ================= CLOCK ================= */
function tickClock() {
  var el = document.getElementById("clockVal");
  if (el) el.textContent = new Date().toLocaleTimeString();
}
tickClock();
setInterval(tickClock, 1000);

/* ================= DEPT COLOR MAP ================= */
var DEPT_VAR = { TRACK: "--dept-track", ST: "--dept-st", TRD: "--dept-trd", OPS: "--dept-ops" };

/* ================= STATE ================= */
var state = { meta: null, requests: [], aiResult: null, currentDay: 0 };

/* ================= API HELPERS ================= */
function api(path, opts) {
  opts = opts || {};
  var init = { method: opts.method || "GET", headers: {} };
  if (opts.body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return fetch(path, init).then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) { var err = new Error(data.message || "Request failed"); err.data = data; throw err; }
      return data;
    });
  });
}

/* ================= HELPERS ================= */
function deptColor(deptKey) {
  var primary = deptKey.split("+")[0];
  var v = DEPT_VAR[primary] || "--text-dim";
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}
function deptShort(d) {
  var names = { TRACK: "Track", ST: "S&T", TRD: "TRD/OHE", OPS: "Ops" };
  return names[d] || d;
}
function deptLabel(deptKey) {
  return deptKey.split("+").map(deptShort).join(" + ");
}
function deptFullName(d) { return state.meta.departments[d] || d; }
function fmtHour(h) { return String(h).padStart(2, "0") + ":00"; }

/* ================= RUN OPTIMIZATION ================= */
function runOptimization(animated) {
  var logBox = document.getElementById("logBox");
  var runBtn = document.getElementById("runBtn");
  var steps = [
    "Loading corridor timetable \u2014 " + state.meta.trains.length + " trains across " + state.meta.sections.length + " block sections\u2026",
    "Scoring " + state.requests.length + " pending requests on criticality, urgency and safety risk\u2026",
    "Scanning for compatible works that can share a single possession\u2026",
    "Searching lowest-impact windows against live traffic-cost model\u2026",
    "Resolving section-level conflicts and finalizing the week's plan\u2026"
  ];

  function doFetch() {
    return api("/api/optimize", { method: "POST" }).then(function (res) {
      state.aiResult = res;
      renderAll();
    }).catch(function (err) {
      var d = document.createElement("div");
      d.className = "err";
      d.textContent = "\u2715 Optimization failed: " + err.message;
      logBox.appendChild(d);
    }).finally(function () {
      runBtn.disabled = false;
    });
  }

  if (!animated) { return doFetch(); }

  runBtn.disabled = true;
  logBox.innerHTML = "";
  logBox.classList.add("show");
  var i = 0;
  function step() {
    if (i < steps.length) {
      var d = document.createElement("div");
      d.textContent = "\u203a " + steps[i];
      logBox.appendChild(d);
      logBox.scrollTop = logBox.scrollHeight;
      i++;
      setTimeout(step, 340);
    } else {
      doFetch().then(function () {
        if (!state.aiResult) return;
        var d = document.createElement("div");
        d.className = "ok";
        d.textContent = "\u2713 Optimization complete \u2014 " + state.aiResult.assigned.length + " blocks scheduled, " + state.aiResult.conflicts.length + " conflict(s) flagged.";
        logBox.appendChild(d);
        logBox.scrollTop = logBox.scrollHeight;
      });
    }
  }
  step();
}

/* ================= RENDER: KPIs ================= */
function renderKPIs() {
  var res = state.aiResult;
  var k = res.kpis;

  var kpis = [
    { lbl: "Asset availability (AI plan)", val: k.assetAvailabilityPct.toFixed(1) + "<span>%</span>", delta: "of weekly corridor capacity", cls: "up" },
    { lbl: "Block-hours committed / week", val: k.aiBlockHours + "<span> hrs</span>", delta: (k.baselineBlockHours - k.aiBlockHours >= 0 ? "\u2212" : "+") + Math.abs(k.baselineBlockHours - k.aiBlockHours) + " hrs vs. siloed baseline", cls: "up" },
    { lbl: "Double-booking conflicts", val: "0", delta: k.baselineDoubleBookings + " in siloed baseline", cls: "up" },
    { lbl: "Disruption saved by fusion", val: k.fusionHoursSaved + "<span> hrs</span>", delta: k.fusionGroups + " combined possessions", cls: "up" }
  ];
  document.getElementById("kpiRow").innerHTML = kpis.map(function (x) {
    return '<div class="kpi"><div class="lbl">' + x.lbl + '</div><div class="val">' + x.val + '</div><div class="delta ' + x.cls + '">' + x.delta + "</div></div>";
  }).join("");

  var maxHours = Math.max(k.aiBlockHours, k.baselineBlockHours, 1);
  var maxTrains = Math.max(k.aiTrainsAffected, k.baselineTrainsAffected, 1);
  var maxConf = Math.max(0, k.baselineDoubleBookings, 1);
  var rows = [
    { lab: "Block-hours", ai: k.aiBlockHours, bas: k.baselineBlockHours, max: maxHours },
    { lab: "Trains affected*", ai: k.aiTrainsAffected, bas: k.baselineTrainsAffected, max: maxTrains },
    { lab: "Conflicts", ai: 0, bas: k.baselineDoubleBookings, max: maxConf }
  ];
  document.getElementById("compareBars").innerHTML = rows.map(function (r) {
    return '<div class="row"><div class="lab">' + r.lab + '</div><div class="track"><div class="fill ai" style="width:' + (r.ai / r.max * 100) + '%"></div></div><div class="num">' + r.ai + "</div></div>" +
           '<div class="row"><div class="lab"></div><div class="track"><div class="fill base" style="width:' + (r.bas / r.max * 100) + '%"></div></div><div class="num">' + r.bas + "</div></div>";
  }).join("") + '<div style="color:var(--text-dim); font-size:11px; margin-top:2px;">*Trains affected compares a single representative day (Monday) for both plans.</div>';

  var byDept = {};
  res.assigned.forEach(function (a) {
    var parts = a.dept.split("+");
    parts.forEach(function (d) { byDept[d] = (byDept[d] || 0) + a.dur / parts.length; });
  });
  var maxD = Math.max.apply(null, Object.keys(byDept).map(function (kk) { return byDept[kk]; }).concat([1]));
  document.getElementById("deptSplit").innerHTML = Object.keys(DEPT_VAR).map(function (d) {
    var v = byDept[d] || 0;
    return '<div class="row"><div>' + deptFullName(d) + '</div><div class="track"><div class="fill" style="width:' + (v / maxD * 100) + "%; background:var(" + DEPT_VAR[d] + ')"></div></div><div class="mono" style="text-align:right;">' + v.toFixed(1) + "h</div></div>";
  }).join("");

  document.getElementById("runNote").textContent = res.assigned.length + " blocks scheduled across the week \u00b7 " + res.conflicts.length + " flagged for escalation \u00b7 " + state.requests.length + " total requests";
}

/* ================= RENDER: TRACK DIAGRAM ================= */
function renderTrackDiagram() {
  var svg = document.getElementById("trackSvg");
  var res = state.aiResult;
  var day = state.currentDay;
  var sections = state.meta.sections;
  var stations = state.meta.stations;
  var n = stations.length;
  var w = 1000, padding = 60;
  var step = (w - padding * 2) / (n - 1);
  var y = 48;
  var parts = [];
  for (var i = 0; i < sections.length; i++) {
    var x1 = padding + i * step, x2 = padding + (i + 1) * step;
    var secBlocks = res ? res.assigned.filter(function (a) { return a.section === sections[i].id && a.day === day; }) : [];
    var hasConflict = res ? res.conflicts.some(function (c) { return c.section === sections[i].id; }) : false;
    var color = secBlocks.length ? "var(--amber)" : "var(--green)";
    if (hasConflict) color = "var(--red)";
    parts.push('<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + color + '" stroke-width="5" stroke-linecap="round" opacity="0.9"/>');
    var midx = (x1 + x2) / 2;
    var lbl = sections[i].id + (secBlocks.length ? " \u00b7 " + secBlocks.reduce(function (s, b) { return s + b.dur; }, 0) + "h" : "");
    parts.push('<text x="' + midx + '" y="' + (y - 14) + '" text-anchor="middle" font-family="IBM Plex Mono" font-size="10.5" fill="var(--text-dim)">' + lbl + "</text>");
  }
  for (var s = 0; s < n; s++) {
    var x = padding + s * step;
    parts.push('<circle cx="' + x + '" cy="' + y + '" r="6" fill="var(--panel)" stroke="var(--text-hi)" stroke-width="1.6"/>');
    parts.push('<text x="' + x + '" y="' + (y + 24) + '" text-anchor="middle" font-family="IBM Plex Mono" font-size="11.5" fill="var(--text-hi)" font-weight="600">' + stations[s] + "</text>");
  }
  svg.innerHTML = parts.join("");
  document.getElementById("corridorDayLabel").textContent = state.meta.days[day];
}

/* ================= RENDER: REQUESTS TABLE ================= */
function renderRequestsTable() {
  var tbody = document.getElementById("reqTableBody");
  document.getElementById("reqCount").textContent = "(" + state.requests.length + " total)";
  var rows = state.requests.map(function (r) {
    var dcol = "var(" + DEPT_VAR[r.dept] + ")";
    return "<tr>" +
      '<td class="mono">' + r.id + "</td>" +
      '<td><span class="dept-tag" style="color:' + dcol + "; border-color:" + dcol + '">' + deptFullName(r.dept) + "</span></td>" +
      '<td class="mono">' + r.section + "</td>" +
      "<td>" + r.work + (r.custom ? ' <span class="badge">custom</span>' : "") + "</td>" +
      '<td class="mono">' + r.dur + "h</td>" +
      '<td class="mono">' + r.urgency + "d</td>" +
      '<td class="mono">' + r.crit + "/10" + (r.safety ? ' <span class="badge safety">safety</span>' : "") + "</td>" +
      '<td class="mono">' + r.pref + "</td>" +
      '<td class="mono score-pill">' + r.score + "</td>" +
    "</tr>";
  }).join("");
  tbody.innerHTML = rows || '<tr><td colspan="9" class="loading-row">No requests yet.</td></tr>';
}

function populateSectionSelect() {
  var sel = document.getElementById("fSection");
  sel.innerHTML = state.meta.sections.map(function (s) {
    return '<option value="' + s.id + '">' + s.id + " \u2014 " + s.label + "</option>";
  }).join("");
}

/* ================= RENDER: GANTT ================= */
function renderDayTabs() {
  document.getElementById("dayTabs").innerHTML = state.meta.days.map(function (d, i) {
    return '<button class="day-btn' + (i === state.currentDay ? " active" : "") + '" data-day="' + i + '">' + d + "</button>";
  }).join("");
  Array.prototype.forEach.call(document.querySelectorAll(".day-btn"), function (btn) {
    btn.addEventListener("click", function () {
      state.currentDay = parseInt(btn.getAttribute("data-day"), 10);
      renderDayTabs();
      if (state.aiResult) { renderGantt(); renderTrackDiagram(); }
    });
  });
}

function maxTraffic() {
  var m = 0;
  state.meta.traffic.forEach(function (row) { row.forEach(function (v) { if (v > m) m = v; }); });
  return m || 1;
}

function renderGantt() {
  var res = state.aiResult;
  var day = state.currentDay;
  var mx = maxTraffic();
  var sections = state.meta.sections;
  var traffic = state.meta.traffic;
  var trains = state.meta.trains;
  var wf = (state.meta.days[day] === "Sat" || state.meta.days[day] === "Sun") ? 0.7 : 1.0;

  var html = '<div class="gantt-hours">' + Array.from({ length: 24 }).map(function (_, h) {
    return h % 2 === 0 ? "<span>" + fmtHour(h) + "</span>" : "<span></span>";
  }).join("") + "</div>";

  sections.forEach(function (sec, si) {
    var heat = "";
    for (var h = 0; h < 24; h++) {
      var v = traffic[si][h] * wf;
      var alpha = Math.min(0.55, (v / mx) * 0.55);
      heat += '<div class="heat-cell"><div class="fillbg" style="background:var(--amber); opacity:' + alpha.toFixed(2) + '"></div></div>';
    }
    var ticks = "";
    trains.forEach(function (t) {
      var clock = t.startHour;
      for (var s2 = 0; s2 < sections.length; s2++) {
        var hourSlot = Math.floor(clock) % 24;
        if (s2 === si) {
          var left = (hourSlot / 24 * 100);
          var col = t.cat === "GOODS" ? "var(--text-dim)" : "var(--text-mid)";
          ticks += '<div class="tick" style="left:' + left + "%; background:" + col + '" title="' + t.id + '"></div>';
          break;
        }
        clock += t.secMinutes / 60;
      }
    });
    var blocks = "";
    var secBlocks = res.assigned.filter(function (a) { return a.section === sec.id && a.day === day; });
    secBlocks.forEach(function (a) {
      var left = a.start / 24 * 100, width = a.dur / 24 * 100;
      var col = deptColor(a.dept);
      blocks += '<div class="blockrect" data-id="' + a.id + '" style="left:' + left + "%; width:" + width + "%; background:" + col + '">' + deptLabel(a.dept) + "</div>";
    });
    html += '<div class="gantt-row"><div class="gantt-rowlabel"><b>' + sec.id + "</b>" + sec.label + '</div><div class="gantt-track">' + heat + ticks + blocks + "</div></div>";
  });
  document.getElementById("ganttBody").innerHTML = html;

  var legend = Object.keys(DEPT_VAR).map(function (d) {
    return '<span><i style="background:var(' + DEPT_VAR[d] + ')"></i>' + deptFullName(d) + "</span>";
  }).join("") + '<span><i style="background:var(--text-dim); border-radius:50%;"></i>Train crossing (tick)</span><span><i style="background:var(--amber); opacity:.4"></i>Traffic intensity</span>';
  document.getElementById("ganttLegend").innerHTML = legend;

  Array.prototype.forEach.call(document.querySelectorAll(".blockrect"), function (el) {
    el.addEventListener("click", function () { openDrawer(el.getAttribute("data-id")); });
  });
}

/* ================= RENDER: CONFLICTS ================= */
function renderConflicts() {
  var res = state.aiResult;
  document.getElementById("conflictCount").textContent = "(" + res.conflicts.length + " open)";
  var list = document.getElementById("conflictList");
  if (!res.conflicts.length) {
    list.innerHTML = '<div class="empty-state"><div class="big">\u2713</div>All requests were placed within their deadlines \u2014 nothing needs escalation this week.</div>';
  } else {
    list.innerHTML = res.conflicts.map(function (c) {
      return '<div class="conflict-item"><div class="top"><span class="title">' + c.id + " \u00b7 " + deptFullName(c.dept) + " \u00b7 " + c.section + '</span><span class="id">score ' + c.score + '</span></div><div class="reason">' + c.reason + " Recommend borrowing spare corridor time from an adjacent low-traffic section or relaxing the preferred-window constraint.</div></div>";
    }).join("");
  }
  document.getElementById("baselineNote").textContent =
    "Booking each request independently, first-available-slot, with no cross-department visibility produces " + res.baseline.doubleBookings +
    " section/time double-bookings and concentrates almost all work on day one \u2014 exactly the coordination gap this system removes.";
}

/* ================= EXPLAINABILITY DRAWER ================= */
function openDrawer(id) {
  var res = state.aiResult;
  var a = res.assigned.find(function (x) { return x.id === id; });
  if (!a) return;
  var bd = a.scoreBreakdown;

  var html = "<h4>" + a.id + "</h4>" + '<div class="sub">' + deptLabel(a.dept) + " \u00b7 " + a.section + "</div>";
  html += '<div class="drawer-row"><span class="k">Work</span><span class="v">' + a.work + "</span></div>";
  html += '<div class="drawer-row"><span class="k">Scheduled</span><span class="v">' + state.meta.days[a.day] + " " + fmtHour(a.start) + "\u2013" + fmtHour(a.start + a.dur) + "</span></div>";
  html += '<div class="drawer-row"><span class="k">Duration</span><span class="v">' + a.dur + " hrs</span></div>";
  html += '<div class="drawer-row"><span class="k">Traffic cost of window</span><span class="v">' + a.trafficCost + (a.pctBelowAvg > 0 ? " (" + a.pctBelowAvg + "% below section avg.)" : "") + "</span></div>";
  if (a.isFusion) {
    html += '<div class="drawer-row"><span class="k">Fused works</span><span class="v">' + a.members.length + "</span></div>";
    html += '<div class="drawer-row"><span class="k">Disruption hours saved</span><span class="v">' + a.savedHours + " hrs</span></div>";
  }
  html += '<div class="score-bar-item"><div class="row"><span>Priority score</span><span class="mono">' + bd.total + "</span></div></div>";
  [["Asset criticality", bd.crit, 40], ["Deadline urgency", bd.urg, 30], ["Safety-critical bonus", bd.safety, 15]].forEach(function (row) {
    html += '<div class="score-bar-item"><div class="row"><span>' + row[0] + '</span><span class="mono">' + row[1] + '</span></div><div class="track"><div class="fill" style="width:' + (row[1] / row[2] * 100) + '%"></div></div></div>';
  });
  html += '<div class="drawer-note">Placed here because it is the lowest-traffic-cost window in ' + a.section + ' that (a) satisfies its "' + a.pref + '" preference and (b) falls before its deadline, after all higher-priority requests were placed first.</div>';
  document.getElementById("drawerContent").innerHTML = html;
  document.getElementById("drawer").classList.add("show");
  document.getElementById("drawerOverlay").classList.add("show");
}
document.getElementById("drawerClose").addEventListener("click", closeDrawer);
document.getElementById("drawerOverlay").addEventListener("click", closeDrawer);
function closeDrawer() {
  document.getElementById("drawer").classList.remove("show");
  document.getElementById("drawerOverlay").classList.remove("show");
}

/* ================= TABS ================= */
Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function (btn) {
  btn.addEventListener("click", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".tab-btn"), function (b) { b.classList.remove("active"); });
    Array.prototype.forEach.call(document.querySelectorAll(".tab-panel"), function (p) { p.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("panel-" + btn.getAttribute("data-tab")).classList.add("active");
  });
});

/* ================= FORM EVENTS ================= */
document.getElementById("runBtn").addEventListener("click", function () { runOptimization(true); });

document.getElementById("addReqBtn").addEventListener("click", function () {
  var msg = document.getElementById("formMsg");
  msg.textContent = "";
  var work = document.getElementById("fWork").value.trim();
  if (!work) { msg.textContent = "Please describe the work."; document.getElementById("fWork").focus(); return; }
  var body = {
    dept: document.getElementById("fDept").value,
    section: document.getElementById("fSection").value,
    work: work,
    dur: parseInt(document.getElementById("fDur").value, 10),
    urgency: parseInt(document.getElementById("fUrgency").value, 10),
    crit: parseInt(document.getElementById("fCrit").value, 10),
    safety: document.getElementById("fSafety").checked,
    pref: document.getElementById("fPref").value
  };
  api("/api/requests", { method: "POST", body: body }).then(function (data) {
    state.requests = data.requests;
    document.getElementById("fWork").value = "";
    renderRequestsTable();
    runOptimization(true);
  }).catch(function (err) {
    msg.textContent = err.message || "Could not add request.";
  });
});

document.getElementById("resetBtn").addEventListener("click", function () {
  api("/api/requests/reset", { method: "POST" }).then(function (data) {
    state.requests = data.requests;
    renderRequestsTable();
    runOptimization(true);
  });
});

/* ================= INIT ================= */
function renderAll() {
  renderKPIs();
  renderTrackDiagram();
  renderGantt();
  renderConflicts();
}

Promise.all([api("/api/meta"), api("/api/requests")]).then(function (results) {
  state.meta = results[0];
  state.requests = results[1].requests;
  populateSectionSelect();
  renderDayTabs();
  renderRequestsTable();
  renderTrackDiagram();
  return runOptimization(false);
}).catch(function (err) {
  document.getElementById("runNote").textContent = "Failed to load: " + err.message;
});

})();
