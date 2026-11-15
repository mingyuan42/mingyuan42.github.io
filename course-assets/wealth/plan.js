// 30 天践行清单 · 财富自由之路 · wealth plan
(function () {
  "use strict";
  var W = window.WEALTH;
  var root = document.getElementById("plan-root");
  if (!W || !root) return;
  var DATA;
  try { DATA = JSON.parse(document.getElementById("plan-data").textContent); }
  catch (e) { root.textContent = "清单加载失败。"; return; }
  var DAYS = DATA.days, PHASES = DATA.phases;
  var COLOR = { vermilion: W.palette.vermilion, gold: W.palette.gold, indigo: W.palette.indigo, jade: W.palette.jade, plum: W.palette.plum };
  var TASKS = [];
  DAYS.forEach(function (d) { d.tasks.forEach(function (t) { TASKS.push({ day: d.day, phase: d.phase, task: t }); }); });
  var TOTAL_MIN = TASKS.reduce(function (s, x) { return s + x.task.min; }, 0);
  var KEY = "wealth-plan-v1";
  var st = W.read(KEY, { done: {}, open: {} });
  if (!st.done) st.done = {};
  if (!st.open) st.open = {};
  if (!Object.keys(st.open).length) st.open["1"] = true;
  var phase = "all", hideDone = false;

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function save() { W.write(KEY, st); }
  function phaseOf(id) { return PHASES.filter(function (p) { return p.id === id; })[0] || PHASES[0]; }
  function dayDone(d) { return d.tasks.every(function (t) { return st.done[t.id]; }); }
  function doneCount() { return TASKS.filter(function (x) { return st.done[x.task.id]; }).length; }
  function doneMin() { return TASKS.reduce(function (s, x) { return s + (st.done[x.task.id] ? x.task.min : 0); }, 0); }
  function streak() {
    var n = 0;
    for (var i = 0; i < DAYS.length; i++) { if (dayDone(DAYS[i])) n += 1; else break; }
    return n;
  }
  function checkIcon() {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("width", "13"); s.setAttribute("height", "13"); s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "3.4");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(ns, "path"); p.setAttribute("d", "M5 12.5l4.5 4.5L19 7");
    s.appendChild(p);
    return s;
  }

  /* ---------- 骨架 ---------- */
  root.replaceChildren();
  var top = el("section", "panel");
  var topGrid = el("div", "plan-top");
  var ringWrap = el("div", "ring-wrap");
  var ns2 = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns2, "svg");
  svg.setAttribute("width", "128"); svg.setAttribute("height", "128"); svg.setAttribute("viewBox", "0 0 128 128");
  svg.setAttribute("role", "img");
  var bg = document.createElementNS(ns2, "circle");
  bg.setAttribute("cx", "64"); bg.setAttribute("cy", "64"); bg.setAttribute("r", "55");
  bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "#e9dfcd"); bg.setAttribute("stroke-width", "11");
  var fg = document.createElementNS(ns2, "circle");
  fg.setAttribute("cx", "64"); fg.setAttribute("cy", "64"); fg.setAttribute("r", "55");
  fg.setAttribute("fill", "none"); fg.setAttribute("stroke", "url(#pg)"); fg.setAttribute("stroke-width", "11");
  fg.setAttribute("stroke-linecap", "round");
  fg.style.transition = "stroke-dashoffset .55s cubic-bezier(.3,.9,.3,1)";
  var defs = document.createElementNS(ns2, "defs");
  var grad = document.createElementNS(ns2, "linearGradient");
  grad.setAttribute("id", "pg"); grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0"); grad.setAttribute("x2", "1"); grad.setAttribute("y2", "1");
  [["0", "#dda23a"], ["1", "#c3352b"]].forEach(function (s) {
    var stop = document.createElementNS(ns2, "stop");
    stop.setAttribute("offset", s[0]); stop.setAttribute("stop-color", s[1]); grad.appendChild(stop);
  });
  defs.appendChild(grad); svg.appendChild(defs); svg.appendChild(bg); svg.appendChild(fg);
  ringWrap.appendChild(svg);
  var ringTxt = el("div", "ring-txt");
  var ringB = el("b", null, "0%");
  ringTxt.appendChild(ringB);
  ringTxt.appendChild(el("span", null, "任务完成"));
  ringWrap.appendChild(ringTxt);
  topGrid.appendChild(ringWrap);
  var topRight = el("div");
  var kpis = el("div", "kpis");
  topRight.appendChild(kpis);
  var phaseBox = el("div", "plan-phases");
  topRight.appendChild(phaseBox);
  topGrid.appendChild(topRight);
  top.appendChild(topGrid);
  var noteLine = el("p", "mode-note");
  top.appendChild(noteLine);
  root.appendChild(top);

  var listPanel = el("section", "panel");
  var lh = el("div", "panel-head");
  var lw = el("div");
  lw.appendChild(el("h2", null, "逐日清单"));
  lw.appendChild(el("p", null, "点标题展开当天任务；勾选状态保存在你自己的浏览器里，换设备不会同步。"));
  lh.appendChild(lw);
  var tools = el("div", "tool-head-actions");
  var expandAll = el("button", "btn btn-ghost btn-sm", "全部展开"); expandAll.type = "button";
  var collapseAll = el("button", "btn btn-ghost btn-sm", "全部收起"); collapseAll.type = "button";
  var onlyTodo = el("button", "btn btn-ghost btn-sm", "只看未完成"); onlyTodo.type = "button";
  onlyTodo.setAttribute("aria-pressed", "false");
  tools.appendChild(expandAll); tools.appendChild(collapseAll); tools.appendChild(onlyTodo);
  lh.appendChild(tools);
  listPanel.appendChild(lh);
  var dayList = el("div", "day-list");
  listPanel.appendChild(dayList);
  root.appendChild(listPanel);

  /* ---------- 概览 ---------- */
  function renderTop() {
    var done = doneCount(), pct = TASKS.length ? done / TASKS.length : 0;
    var len = 2 * Math.PI * 55;
    fg.setAttribute("stroke-dasharray", String(len));
    fg.setAttribute("stroke-dashoffset", String(len * (1 - pct)));
    svg.setAttribute("aria-label", "完成度 " + Math.round(pct * 100) + "%");
    ringB.textContent = Math.round(pct * 100) + "%";
    var fullDays = DAYS.filter(dayDone).length;
    kpis.replaceChildren();
    [[fullDays + " / 30", "完成的天数", W.palette.vermilion],
     [done + " / " + TASKS.length, "完成的任务", W.palette.indigo],
     [doneMin() + " 分钟", "已投入（共 " + TOTAL_MIN + "）", W.palette.jade],
     [streak() + " 天", "从头连续完成", W.palette.gold]].forEach(function (it) {
      var k = el("div", "kpi");
      k.style.setProperty("--k", it[2]);
      k.appendChild(el("b", null, it[0]));
      k.appendChild(el("span", null, it[1]));
      kpis.appendChild(k);
    });
    phaseBox.replaceChildren();
    PHASES.forEach(function (p) {
      var ts = TASKS.filter(function (x) { return x.phase === p.id; });
      var d = ts.filter(function (x) { return st.done[x.task.id]; }).length;
      var pill = el("div", "phase-pill");
      pill.style.setProperty("--pc", COLOR[p.color] || W.palette.vermilion);
      pill.appendChild(el("b", null, p.name));
      pill.appendChild(el("span", null, "第 " + p.range[0] + "–" + p.range[1] + " 天 · " + d + "/" + ts.length));
      var track = el("i");
      var fill = el("b");
      fill.style.width = (ts.length ? d / ts.length * 100 : 0) + "%";
      track.appendChild(fill);
      pill.appendChild(track);
      pill.title = p.desc;
      phaseBox.appendChild(pill);
    });
    noteLine.textContent = fullDays === 30
      ? "三十天全部走完了。接下来不是重新开始，而是把第 26–30 天的生产动作继续做下去。"
      : "每天 " + DATA.meta.minutesPerDay + "。做完一天比做完美一天重要；漏掉一天，第二天补上，不要从头再来。";
  }

  /* ---------- 日卡 ---------- */
  function renderDays() {
    dayList.replaceChildren();
    var shown = DAYS.filter(function (d) {
      if (phase !== "all" && String(d.phase) !== String(phase)) return false;
      if (hideDone && dayDone(d)) return false;
      return true;
    });
    if (!shown.length) {
      dayList.appendChild(el("div", "empty", "这个筛选下已经没有待办的日子了。"));
      return;
    }
    shown.forEach(function (d) {
      var p = phaseOf(d.phase);
      var color = COLOR[p.color] || W.palette.vermilion;
      var card = el("div", "day-card" + (dayDone(d) ? " done" : "") + (st.open[d.day] ? " open" : ""));
      card.style.setProperty("--pc", color);
      card.dataset.day = String(d.day);

      var head = el("div", "day-head");
      head.setAttribute("role", "button");
      head.setAttribute("tabindex", "0");
      head.setAttribute("aria-expanded", st.open[d.day] ? "true" : "false");
      head.appendChild(el("div", "day-n", String(d.day)));
      var mid = el("div");
      mid.appendChild(el("div", "day-title", d.title));
      mid.appendChild(el("p", "day-why", d.why));
      head.appendChild(mid);
      var right = el("div", "day-right");
      var dcount = d.tasks.filter(function (t) { return st.done[t.id]; }).length;
      right.appendChild(el("span", "day-count", dcount + "/" + d.tasks.length + " · " +
        d.tasks.reduce(function (s, t) { return s + t.min; }, 0) + "min"));
      var chev = el("span", "day-count", st.open[d.day] ? "▾" : "▸");
      right.appendChild(chev);
      head.appendChild(right);
      function toggleOpen() {
        st.open[d.day] = !st.open[d.day];
        save();
        card.classList.toggle("open", !!st.open[d.day]);
        head.setAttribute("aria-expanded", st.open[d.day] ? "true" : "false");
        chev.textContent = st.open[d.day] ? "▾" : "▸";
      }
      head.addEventListener("click", toggleOpen);
      head.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { toggleOpen(); e.preventDefault(); }
      });
      card.appendChild(head);

      var body = el("div", "day-body");
      d.tasks.forEach(function (t) {
        var lab = el("label", "task");
        var inp = document.createElement("input");
        inp.type = "checkbox"; inp.checked = !!st.done[t.id];
        inp.id = "t-" + t.id;
        var box = el("span", "box");
        box.appendChild(checkIcon());
        var txt = el("span", "txt", t.text);
        var min = el("span", "min", t.min + " min");
        lab.appendChild(inp); lab.appendChild(box); lab.appendChild(txt); lab.appendChild(min);
        inp.addEventListener("change", function () {
          if (inp.checked) st.done[t.id] = 1; else delete st.done[t.id];
          save();
          var wasDone = card.classList.contains("done");
          var nowDone = dayDone(d);
          card.classList.toggle("done", nowDone);
          var dc = d.tasks.filter(function (x) { return st.done[x.id]; }).length;
          right.firstChild.textContent = dc + "/" + d.tasks.length + " · " +
            d.tasks.reduce(function (s, x) { return s + x.min; }, 0) + "min";
          renderTop();
          if (nowDone && !wasDone) {
            var msg = "第 " + d.day + " 天完成";
            if (DAYS.filter(dayDone).length === 30) msg = "三十天全部完成——从今天起，你是在生产，而不是在学习";
            W.toast(msg, "撤销这一天", function () {
              d.tasks.forEach(function (x) { delete st.done[x.id]; });
              save(); renderTop(); renderDays();
            });
            if (hideDone) renderDays();
          }
        });
        body.appendChild(lab);
      });
      var links = el("div", "day-links");
      var a = el("a", null, "配套课程：第 " + pad(d.lesson) + " 课 →");
      a.href = "zh/lesson-" + pad(d.lesson) + ".html";
      links.appendChild(a);
      links.appendChild(document.createTextNode(" · "));
      var b = el("a", null, "查概念词典");
      b.href = "glossary.html";
      links.appendChild(b);
      body.appendChild(links);
      card.appendChild(body);
      dayList.appendChild(card);
    });
  }

  /* ---------- 交互 ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      phase = t.dataset.phase;
      tabs.forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      renderDays();
    });
  });
  expandAll.addEventListener("click", function () {
    DAYS.forEach(function (d) { st.open[d.day] = true; }); save(); renderDays();
  });
  collapseAll.addEventListener("click", function () {
    st.open = {}; save(); renderDays();
  });
  onlyTodo.addEventListener("click", function () {
    hideDone = !hideDone;
    onlyTodo.setAttribute("aria-pressed", hideDone ? "true" : "false");
    onlyTodo.classList.toggle("btn-primary", hideDone);
    onlyTodo.classList.toggle("btn-ghost", !hideDone);
    onlyTodo.textContent = hideDone ? "显示全部" : "只看未完成";
    renderDays();
  });
  var jump = document.getElementById("plan-jump");
  if (jump) jump.addEventListener("click", function () {
    var next = DAYS.filter(function (d) { return !dayDone(d); })[0];
    if (!next) { W.toast("三十天都做完了"); return; }
    phase = "all";
    tabs.forEach(function (x) { x.setAttribute("aria-selected", x.dataset.phase === "all" ? "true" : "false"); });
    hideDone = false;
    onlyTodo.setAttribute("aria-pressed", "false");
    onlyTodo.classList.add("btn-ghost"); onlyTodo.classList.remove("btn-primary");
    onlyTodo.textContent = "只看未完成";
    st.open[next.day] = true; save(); renderDays();
    var node = dayList.querySelector('[data-day="' + next.day + '"]');
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.style.borderColor = W.palette.vermilion;
      setTimeout(function () { node.style.borderColor = ""; }, 1600);
    }
    W.toast("继续第 " + next.day + " 天");
  });
  var exp = document.getElementById("plan-export");
  if (exp) exp.addEventListener("click", function () {
    var lines = ["# 《财富自由之路》30 天践行清单", "",
      "进度：" + doneCount() + "/" + TASKS.length + " 项任务，" + DAYS.filter(dayDone).length + "/30 天，已投入 " + doneMin() + " 分钟。",
      "导出时间：" + new Date().toLocaleString("zh-CN"), ""];
    PHASES.forEach(function (p) {
      lines.push("## 阶段 " + p.id + " · " + p.name + "（第 " + p.range[0] + "–" + p.range[1] + " 天）");
      lines.push(p.desc); lines.push("");
      DAYS.filter(function (d) { return d.phase === p.id; }).forEach(function (d) {
        lines.push("### 第 " + d.day + " 天 · " + d.title);
        lines.push("> " + d.why);
        d.tasks.forEach(function (t) {
          lines.push("- [" + (st.done[t.id] ? "x" : " ") + "] " + t.text + "（" + t.min + " 分钟）");
        });
        lines.push("配套课程：第 " + pad(d.lesson) + " 课");
        lines.push("");
      });
    });
    W.download("财富自由之路-30天践行清单.md", lines.join("\n"), "text/markdown;charset=utf-8");
    W.toast("清单已导出为 Markdown");
  });
  var reset = document.getElementById("plan-reset");
  if (reset) reset.addEventListener("click", function () {
    var backup = JSON.parse(JSON.stringify(st.done));
    st.done = {}; save(); renderTop(); renderDays();
    W.toast("勾选记录已清空", "撤销", function () { st.done = backup; save(); renderTop(); renderDays(); });
  });

  renderTop();
  renderDays();
})();