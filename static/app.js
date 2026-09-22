(() => {
  "use strict";

  /* ---------- Data ---------- */
  const STATIONS = ["NDLS", "GZB", "ALJN", "TDL", "ETW", "CNB"];
  const SECTIONS = STATIONS.slice(0, -1).map((from, i) => ({
    id: `S${i + 1}`,
    from,
    to: STATIONS[i + 1],
    label: `${from}–${STATIONS[i + 1]}`
  }));
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const DEPTS = {
    TRACK: { name: "Engineering / Track", short: "Track", color: "#3479a6" },
    ST:    { name: "Signal & Telecom", short: "S&T", color: "#7658a9" },
    TRD:   { name: "TRD / OHE", short: "TRD", color: "#b9672d" },
    OPS:   { name: "Operations", short: "Ops", color: "#2e8b62" }
  };

  const baseRequests = () => [
    { id:"BR-01", dept:"TRACK", section:"S3", work:"Rail fracture — ultrasonic re-test", dur:3, urgency:2, crit:9, safety:true,  pref:"night" },
    { id:"BR-02", dept:"ST",    section:"S3", work:"Signal cable insulation check", dur:2, urgency:3, crit:6, safety:false, pref:"night" },
    { id:"BR-03", dept:"TRACK", section:"S1", work:"Ballast deep screening", dur:4, urgency:6, crit:5, safety:false, pref:"night" },
    { id:"BR-04", dept:"TRD",   section:"S1", work:"OHE wire tension check", dur:2, urgency:5, crit:6, safety:false, pref:"night" },
    { id:"BR-05", dept:"TRACK", section:"S2", work:"Rail renewal — fish-plated joint", dur:4, urgency:4, crit:8, safety:true, pref:"night" },
    { id:"BR-06", dept:"ST",    section:"S4", work:"Axle counter replacement", dur:3, urgency:2, crit:8, safety:true, pref:"night" },
    { id:"BR-07", dept:"TRD",   section:"S4", work:"OHE insulator cleaning", dur:2, urgency:5, crit:4, safety:false, pref:"night" },
    { id:"BR-08", dept:"OPS",   section:"S5", work:"Points & crossing renewal", dur:3, urgency:3, crit:7, safety:true, pref:"any" },
    { id:"BR-09", dept:"TRACK", section:"S5", work:"Track geometry correction", dur:3, urgency:7, crit:5, safety:false, pref:"night" },
    { id:"BR-10", dept:"ST",    section:"S2", work:"Level crossing interlock test", dur:2, urgency:4, crit:7, safety:true, pref:"any" },
    { id:"BR-11", dept:"TRD",   section:"S3", work:"Feeder cable thermography", dur:2, urgency:6, crit:4, safety:false, pref:"night" },
    { id:"BR-12", dept:"TRACK", section:"S4", work:"Bridge girder inspection", dur:3, urgency:3, crit:7, safety:false, pref:"day" },
    { id:"BR-13", dept:"OPS",   section:"S1", work:"Platform edge safety audit", dur:2, urgency:5, crit:5, safety:false, pref:"day" },
    { id:"BR-14", dept:"ST",    section:"S5", work:"Block instrument overhaul", dur:3, urgency:4, crit:6, safety:false, pref:"night" }
  ];

  let seed = 42;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  function buildTrains() {
    const categories = [
      { code:"EXP", weight:9, count:8, peak:true },
      { code:"MEMU", weight:5, count:7, peak:true },
      { code:"GOODS", weight:2, count:7, peak:false }
    ];
    const trains = [];
    let n = 1;
    categories.forEach(cat => {
      for (let i = 0; i < cat.count; i++) {
        let start;
        if (cat.peak) {
          const band = rand() < .55 ? [7, 10] : [17, 21];
          start = band[0] + rand() * (band[1] - band[0]);
        } else {
          start = 21 + rand() * 8;
          if (start >= 24) start -= 24;
        }
        trains.push({
          id: `${cat.code}-${100 + n++}`,
          weight: cat.weight,
          startHour: start,
          sectionMinutes: 22 + rand() * 14
        });
      }
    });
    return trains;
  }

  const trains = buildTrains();

  function trafficMatrix() {
    const matrix = SECTIONS.map(() => Array(24).fill(0));
    trains.forEach(t => {
      let clock = t.startHour;
      SECTIONS.forEach((_, i) => {
        matrix[i][Math.floor(clock) % 24] += t.weight;
        clock += t.sectionMinutes / 60;
      });
    });
    return matrix;
  }

  const traffic = trafficMatrix();

  const state = {
    requests: baseRequests(),
    result: null,
    baseline: null,
    day: 0,
    seq: 15
  };

  /* ---------- Planning logic ---------- */
  function priority(r) {
    return Math.round(r.crit * 4 + (10 - Math.min(r.urgency, 10)) * 3 + (r.safety ? 15 : 0));
  }

  function compatible(a, b) {
    if (a.dept === b.dept) return true;
    return [["ST","TRACK"],["ST","TRD"],["TRACK","TRD"]]
      .some(pair => pair.includes(a.dept) && pair.includes(b.dept));
  }

  function fuseRequests(requests) {
    const used = new Set();
    const fused = [];

    SECTIONS.forEach(section => {
      const list = requests.filter(r =>
        r.section === section.id && r.pref === "night" && !used.has(r.id)
      ).sort((a,b) => priority(b) - priority(a));

      for (let i = 0; i < list.length; i++) {
        if (used.has(list[i].id)) continue;
        const group = [list[i]];
        for (let j = i + 1; j < list.length; j++) {
          const candidate = list[j];
          const total = group.reduce((s,x) => s + x.dur, 0) + candidate.dur;
          if (!used.has(candidate.id) && compatible(group[0], candidate) && total <= 6) {
            group.push(candidate);
          }
        }
        if (group.length > 1) {
          group.forEach(x => used.add(x.id));
          const total = group.reduce((s,x) => s + x.dur, 0);
          const combined = Math.min(total, Math.max(...group.map(x => x.dur)) + 1);
          fused.push({
            id: `FB-${fused.length + 1}`,
            isFusion: true,
            members: group,
            dept: group.map(x => x.dept).join("+"),
            section: section.id,
            work: group.map(x => x.work).join(" + "),
            dur: combined,
            urgency: Math.min(...group.map(x => x.urgency)),
            crit: Math.max(...group.map(x => x.crit)),
            safety: group.some(x => x.safety),
            pref: "night",
            savedHours: total - combined
          });
        }
      }
    });

    return {
      fused,
      remaining: requests.filter(r => !used.has(r.id))
    };
  }

  function isNight(h) { return h >= 22 || h < 5; }

  function bestWindow(req, sectionIndex, booked) {
    let best = null;
    const maxDay = Math.min(7, Math.max(1, req.urgency));

    for (let day = 0; day < maxDay; day++) {
      for (let start = 0; start + req.dur <= 24; start++) {
        let clash = false;
        for (let h = start; h < start + req.dur; h++) {
          if (booked[sectionIndex][day][h]) { clash = true; break; }
        }
        if (clash) continue;

        let cost = 0;
        let nightHours = 0;
        for (let h = start; h < start + req.dur; h++) {
          cost += traffic[sectionIndex][h] * ((day >= 5) ? .7 : 1);
          if (isNight(h)) nightHours++;
        }
        if (req.pref === "night") cost += (req.dur - nightHours) * 25;
        cost += day * 1.5;

        if (!best || cost < best.cost) best = { day, start, cost };
      }
    }
    return best;
  }

  function optimize(requests) {
    const fusedResult = fuseRequests(requests);
    const all = [...fusedResult.fused, ...fusedResult.remaining];
    const booked = SECTIONS.map(() =>
      Array.from({ length: 7 }, () => Array(24).fill(false))
    );

    const conflicts = [];
    const assigned = [];

    all.map(r => ({...r, score: priority(r)}))
      .sort((a,b) => b.score - a.score)
      .forEach(req => {
        const si = SECTIONS.findIndex(s => s.id === req.section);
        const win = bestWindow(req, si, booked);

        if (!win) {
          conflicts.push({
            ...req,
            reason: `No conflict-free ${req.dur}h window found in ${req.section} before its ${req.urgency}-day deadline.`
          });
          return;
        }

        for (let h = win.start; h < win.start + req.dur; h++) {
          booked[si][win.day][h] = true;
        }
        assigned.push({...req, ...win, trafficCost: Math.round(win.cost)});
      });

    return { assigned, conflicts, fusedGroups: fusedResult.fused };
  }

  function manualBaseline(requests) {
    const assigned = requests.map(r => {
      const base = r.pref === "night" ? 22 : r.pref === "day" ? 10 : 14;
      return {...r, day: 0, start: base + r.dur > 24 ? 0 : base};
    });
    let doubleBookings = 0;
    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const a = assigned[i], b = assigned[j];
        if (a.section !== b.section || a.day !== b.day) continue;
        if (a.start < b.start + b.dur && b.start < a.start + a.dur) doubleBookings++;
      }
    }
    return { assigned, doubleBookings };
  }

  const blockHours = arr => arr.reduce((sum, x) => sum + x.dur, 0);
  const availability = hours => ((1 - hours / (SECTIONS.length * 24 * 7)) * 100);

  function trainsAffected(blocks) {
    let count = 0;
    trains.forEach(t => {
      let clock = t.startHour;
      for (let si = 0; si < SECTIONS.length; si++) {
        const hour = Math.floor(clock) % 24;
        const hit = blocks.some(b =>
          b.section === SECTIONS[si].id &&
          b.day === 0 &&
          hour >= b.start && hour < b.start + b.dur
        );
        if (hit) { count++; break; }
        clock += t.sectionMinutes / 60;
      }
    });
    return count;
  }

  /* ---------- Rendering ---------- */
  const $ = id => document.getElementById(id);

  function renderRoute() {
    const map = $("routeMap");
    const positions = STATIONS.map((_, i) => 5 + i * 18);
    let html = '<div class="route-line"></div>';

    SECTIONS.forEach((s, i) => {
      const blocks = state.result?.assigned.filter(b => b.section === s.id && b.day === state.day) || [];
      const conflict = state.result?.conflicts.some(c => c.section === s.id);
      const color = conflict ? "var(--red)" : blocks.length ? "var(--accent)" : "var(--green)";
      const left = (positions[i] + positions[i + 1]) / 2;
      html += `<div class="route-segment" style="left:${left}%;width:18%;background:${color}"></div>`;
      html += `<div class="section-label" style="left:${left}%">${s.id}${blocks.length ? ` · ${blocks.reduce((n,b)=>n+b.dur,0)}h` : ""}</div>`;
    });

    STATIONS.forEach((station, i) => {
      html += `<div class="route-station" style="left:${positions[i]}%"><span>${station}</span></div>`;
    });

    map.innerHTML = html;
    $("route-day").textContent = DAYS[state.day] + " · " + new Date().toLocaleDateString("en-IN", {day:"2-digit", month:"short"});
  }

  function renderMetrics() {
    const aiHours = blockHours(state.result.assigned);
    const manualHours = blockHours(state.baseline.assigned);
    const saved = state.result.fusedGroups.reduce((s,x) => s + x.savedHours, 0);

    $("metrics").innerHTML = [
      ["Section availability", `${availability(aiHours).toFixed(1)}%`, "weekly corridor capacity"],
      ["Planned block time", `${aiHours} h`, `${manualHours - aiHours >= 0 ? manualHours-aiHours : 0} h saved vs baseline`],
      ["Conflicts detected", `${state.result.conflicts.length}`, "sent for escalation"],
      ["Time saved by combining", `${saved} h`, `${state.result.fusedGroups.length} shared possessions`]
    ].map(([label,value,note]) => `
      <div class="metric">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
        <div class="metric-note">${note}</div>
      </div>
    `).join("");
  }

  function renderComparison() {
    const ai = blockHours(state.result.assigned);
    const manual = blockHours(state.baseline.assigned);
    const aiTrains = trainsAffected(state.result.assigned.filter(b => b.day === 0));
    const manualTrains = trainsAffected(state.baseline.assigned);

    const rows = [
      ["Block time", ai, manual],
      ["Monday train crossings", aiTrains, manualTrains],
      ["Conflicts", state.result.conflicts.length, state.baseline.doubleBookings]
    ];
    const max = Math.max(...rows.flatMap(r => [r[1], r[2]]), 1);

    $("comparison").innerHTML = rows.map(([name, aiVal, manualVal]) => `
      <div class="compare-row">
        <div class="compare-head"><span>${name} · optimized</span><span>${aiVal}</span></div>
        <div class="bar-bg"><div class="bar-fill ai" style="width:${aiVal/max*100}%"></div></div>
        <div class="compare-head"><span>manual / siloed</span><span>${manualVal}</span></div>
        <div class="bar-bg"><div class="bar-fill manual" style="width:${manualVal/max*100}%"></div></div>
      </div>
    `).join("") + `<div class="compare-foot">*Train crossings are shown for Monday only so the two approaches use the same reference day.</div>`;
  }

  function renderDepartments() {
    const totals = {};
    state.result.assigned.forEach(b => {
      b.dept.split("+").forEach(d => {
        totals[d] = (totals[d] || 0) + b.dur / b.dept.split("+").length;
      });
    });
    const max = Math.max(...Object.values(totals), 1);

    $("departmentChart").innerHTML = Object.entries(DEPTS).map(([key, d]) => {
      const value = totals[key] || 0;
      return `
        <div class="dept-row">
          <div class="dept-name">${d.name}</div>
          <div class="dept-bar"><div class="dept-fill" style="width:${value/max*100}%;background:${d.color}"></div></div>
          <div class="dept-value">${value.toFixed(1)}h</div>
        </div>
      `;
    }).join("");
  }

  function renderRequests() {
    $("requestCount").textContent = `${state.requests.length} requests`;
    $("requestTable").innerHTML = state.requests.map(r => `
      <tr>
        <td class="mono">${r.id}</td>
        <td><span class="dept-tag" style="color:${DEPTS[r.dept].color};border-color:${DEPTS[r.dept].color}">${DEPTS[r.dept].short}</span></td>
        <td class="mono">${r.section}</td>
        <td>${r.work}${r.safety ? ' <span class="safety-tag">safety</span>' : ''}</td>
        <td class="mono">${r.dur}h</td>
        <td class="mono">${r.urgency}d</td>
        <td><span class="priority-tag">${priority(r)}</span></td>
      </tr>
    `).join("");
  }

  function renderDayTabs() {
    $("dayTabs").innerHTML = DAYS.map((d, i) =>
      `<button class="day-btn ${i === state.day ? "active" : ""}" data-day="${i}">${d}</button>`
    ).join("");
    document.querySelectorAll(".day-btn").forEach(btn => {
      btn.onclick = () => {
        state.day = Number(btn.dataset.day);
        renderDayTabs();
        renderSchedule();
        renderRoute();
      };
    });
  }

  function renderSchedule() {
    const maxTraffic = Math.max(...traffic.flat(), 1);
    let html = `<div class="time-header"><div></div>${
      Array.from({length:24}, (_,h) => `<div>${h % 2 === 0 ? String(h).padStart(2,"0") : ""}</div>`).join("")
    }</div>`;

    SECTIONS.forEach((section, si) => {
      let cells = "";
      for (let h = 0; h < 24; h++) {
        const heat = Math.min(.48, traffic[si][h] / maxTraffic * .48);
        cells += `<div class="hour-cell"><div class="traffic" style="--heat:${heat}"></div></div>`;
      }

      trains.forEach(t => {
        let clock = t.startHour;
        for (let s = 0; s < SECTIONS.length; s++) {
          if (s === si) {
            const hour = Math.floor(clock) % 24;
            cells += `<i class="train-tick" style="left:${hour/24*100}%"></i>`;
            break;
          }
          clock += t.sectionMinutes / 60;
        }
      });

      const blocks = state.result.assigned.filter(b => b.section === section.id && b.day === state.day);
      blocks.forEach(b => {
        cells += `<div class="block" data-block="${b.id}" style="left:${b.start/24*100}%;width:${b.dur/24*100}%;background:${departmentColor(b.dept)}">${departmentShort(b.dept)} · ${b.dur}h</div>`;
      });

      html += `
        <div class="timeline-row">
          <div class="row-label"><b>${section.id}</b><span>${section.label}</span></div>
          <div class="hour-grid">${cells}</div>
        </div>
      `;
    });

    $("timeline").innerHTML = html;
    document.querySelectorAll(".block").forEach(el => el.onclick = () => openDrawer(el.dataset.block));
  }

  function departmentColor(key) {
    return DEPTS[key.split("+")[0]].color;
  }

  function departmentShort(key) {
    return key.split("+").map(k => DEPTS[k]?.short || k).join("+");
  }

  function renderConflicts() {
    const conflicts = state.result.conflicts;
    $("conflictBadge").textContent = conflicts.length || "";
    $("conflictCount").textContent = `${conflicts.length} open`;

    $("conflictList").innerHTML = conflicts.length ? conflicts.map(c => `
      <div class="conflict-item">
        <div class="conflict-top">
          <span class="conflict-title">${c.id} · ${DEPTS[c.dept]?.name || c.dept} · ${c.section}</span>
          <span class="conflict-id">priority ${priority(c)}</span>
        </div>
        <div class="conflict-reason">${c.reason} Review an adjacent section or relax the preferred-time constraint before approving the block.</div>
      </div>
    `).join("") : `
      <div class="empty">✓ No unresolved scheduling conflicts in the current sample.</div>
    `;

    $("baselineText").textContent =
      `In the manual baseline, each department books its request independently using a simple first-slot rule. ` +
      `${state.baseline.doubleBookings} section/time overlaps are produced in the sample, while requests are concentrated on the same day. ` +
      `The prototype instead considers all departments together before placing blocks.`;
  }

  function openDrawer(id) {
    const b = state.result.assigned.find(x => x.id === id);
    if (!b) return;

    const bd = {
      criticality: b.crit * 4,
      urgency: (10 - Math.min(b.urgency,10)) * 3,
      safety: b.safety ? 15 : 0
    };

    $("drawerContent").innerHTML = `
      <span class="eyebrow">SCHEDULED BLOCK</span>
      <h3>${b.id}</h3>
      <div class="drawer-sub">${departmentShort(b.dept)} · ${b.section}</div>

      <div class="detail-list">
        <div class="detail-row"><span>Work</span><span>${b.work}</span></div>
        <div class="detail-row"><span>Scheduled</span><span>${DAYS[b.day]} ${String(b.start).padStart(2,"0")}:00–${String(b.start+b.dur).padStart(2,"0")}:00</span></div>
        <div class="detail-row"><span>Duration</span><span>${b.dur} hours</span></div>
        <div class="detail-row"><span>Traffic cost</span><span>${b.trafficCost}</span></div>
        ${b.isFusion ? `<div class="detail-row"><span>Combined works</span><span>${b.members.length}</span></div>
        <div class="detail-row"><span>Time saved</span><span>${b.savedHours} hours</span></div>` : ""}
      </div>

      <div class="score-title">Priority score · ${priority(b)}</div>
      ${[
        ["Asset criticality", bd.criticality, 40],
        ["Deadline urgency", bd.urgency, 30],
        ["Safety-critical", bd.safety, 15]
      ].map(([label,val,max]) => `
        <div class="score-row">
          <div class="score-head"><span>${label}</span><span>${val}</span></div>
          <div class="score-bg"><div class="score-fill" style="width:${Math.min(100,val/max*100)}%"></div></div>
        </div>
      `).join("")}

      <div class="drawer-note">
        This window was selected after higher-priority requests were considered. The engine searches for a
        conflict-free slot that respects the request preference, deadline and traffic load.
      </div>
    `;

    $("drawer").classList.add("show");
    $("drawerOverlay").classList.add("show");
  }

  function closeDrawer() {
    $("drawer").classList.remove("show");
    $("drawerOverlay").classList.remove("show");
  }

  /* ---------- Optimization interaction ---------- */
  function runOptimization(showAnimation = true) {
    const btn = $("optimizeBtn");
    if (showAnimation) {
      btn.disabled = true;
      btn.textContent = "Optimizing…";
      $("resultTitle").textContent = "Planning engine is working";
      $("resultText").textContent = "Checking requests, compatible work and traffic windows…";

      setTimeout(() => {
        state.result = optimize(state.requests);
        state.baseline = manualBaseline(state.requests);
        btn.disabled = false;
        btn.innerHTML = 'Optimize week\'s plan <span>→</span>';
        $("resultTitle").textContent =
          `${state.result.assigned.length} blocks scheduled · ${state.result.conflicts.length} need attention`;
        $("resultText").textContent =
          `${state.result.fusedGroups.length} compatible work groups were combined where possible.`;
        renderAll();
      }, 850);
    } else {
      state.result = optimize(state.requests);
      state.baseline = manualBaseline(state.requests);
      renderAll();
    }
  }

  /* ---------- Events ---------- */
  document.querySelectorAll(".tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.tab).classList.add("active");
    };
  });

  $("optimizeBtn").onclick = () => runOptimization(true);

  $("addRequest").onclick = () => {
    const work = $("fWork").value.trim();
    if (!work) {
      $("fWork").focus();
      return;
    }

    state.requests.push({
      id: `BR-${String(state.seq++).padStart(2,"0")}`,
      dept: $("fDept").value,
      section: $("fSection").value,
      work,
      dur: Math.max(1, Math.min(6, Number($("fDur").value) || 2)),
      urgency: Math.max(1, Math.min(7, Number($("fUrgency").value) || 4)),
      crit: Math.max(1, Math.min(10, Number($("fCrit").value) || 5)),
      safety: $("fSafety").checked,
      pref: $("fPref").value,
      custom: true
    });

    $("fWork").value = "";
    $("fSafety").checked = false;
    runOptimization(true);
  };

  $("resetData").onclick = () => {
    state.requests = baseRequests();
    state.seq = 15;
    runOptimization(true);
  };

  $("drawerClose").onclick = closeDrawer;
  $("drawerOverlay").onclick = closeDrawer;

  $("fSection").innerHTML = SECTIONS.map(s =>
    `<option value="${s.id}">${s.id} — ${s.label}</option>`
  ).join("");

  function renderAll() {
    renderRoute();
    renderMetrics();
    renderComparison();
    renderDepartments();
    renderRequests();
    renderDayTabs();
    renderSchedule();
    renderConflicts();
  }

  function clock() {
    $("clock").textContent = new Date().toLocaleTimeString("en-IN", {hour12:false});
  }
  clock();
  setInterval(clock, 1000);

  runOptimization(false);
})();
