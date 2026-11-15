// 自测 · 财富自由之路 · wealth quiz
(function () {
  "use strict";
  var W = window.WEALTH;
  var root = document.getElementById("quiz-root");
  if (!W || !root) return;
  var raw = document.getElementById("quiz-data");
  var DATA;
  try { DATA = JSON.parse(raw.textContent); } catch (e) { root.textContent = "题库加载失败。"; return; }
  var QS = DATA.questions;
  var PART_NAMES = { 1: "重新定义财富自由", 2: "升级你的操作系统", 3: "选择决定命运", 4: "投资：先活下来", 5: "商业模式与成长" };
  var LETTERS = ["A", "B", "C", "D", "E"];
  var KEY = "wealth-quiz-v1";
  var state = W.read(KEY, { answers: {}, best: null });
  if (!state.answers) state.answers = {};
  var part = "all", pool = [], idx = 0, finished = false;

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function persist() { W.write(KEY, state); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function lessonHref(n) { return "zh/lesson-" + pad(n) + ".html"; }

  function buildPool() {
    pool = QS.filter(function (q) { return part === "all" || String(q.part) === String(part); });
    idx = 0; finished = false;
  }
  function answeredCount() {
    return pool.filter(function (q) { return state.answers[q.id] != null; }).length;
  }
  function correctCount() {
    return pool.filter(function (q) { return state.answers[q.id] === q.answer; }).length;
  }
  function wrongList() {
    return pool.filter(function (q) { return state.answers[q.id] != null && state.answers[q.id] !== q.answer; });
  }

  /* ---------- 侧栏 ---------- */
  var bar, card, dots, side, scoreBox;
  function scaffold() {
    root.replaceChildren();
    var layout = el("div", "quiz-layout");
    var left = el("div");
    var prog = el("div", "q-progress"); bar = el("i"); prog.appendChild(bar);
    left.appendChild(prog);
    card = el("div", "q-card");
    left.appendChild(card);
    layout.appendChild(left);

    var aside = el("aside", "panel");
    aside.style.position = "sticky"; aside.style.top = "20px";
    var head = el("div", "panel-head");
    var hw = el("div");
    hw.appendChild(el("h2", null, "答题进度"));
    hw.appendChild(el("p", null, "点方块可以跳到任意一题"));
    head.appendChild(hw);
    aside.appendChild(head);
    scoreBox = el("div"); aside.appendChild(scoreBox);
    dots = el("div", "q-dots"); aside.appendChild(dots);
    side = el("div"); side.style.marginTop = "16px"; aside.appendChild(side);
    layout.appendChild(aside);
    root.appendChild(layout);
  }

  function renderSide() {
    var done = answeredCount(), right = correctCount();
    bar.style.width = (pool.length ? done / pool.length * 100 : 0) + "%";
    scoreBox.replaceChildren();
    var kpis = el("div", "kpis");
    kpis.style.gridTemplateColumns = "1fr 1fr";
    [["已答 " + done + "/" + pool.length, "覆盖进度", W.palette.indigo],
     ["正确 " + right, "当前正确数", W.palette.jade]].forEach(function (it) {
      var k = el("div", "kpi");
      k.style.setProperty("--k", it[2]);
      k.appendChild(el("b", null, it[0]));
      k.appendChild(el("span", null, it[1]));
      kpis.appendChild(k);
    });
    scoreBox.appendChild(kpis);

    dots.replaceChildren();
    pool.forEach(function (q, i) {
      var b = el("button", "q-dot", String(i + 1));
      b.type = "button";
      b.title = "第 " + (i + 1) + " 题 · " + q.tag;
      b.setAttribute("aria-label", "跳到第 " + (i + 1) + " 题");
      var a = state.answers[q.id];
      if (a != null) b.classList.add(a === q.answer ? "ok" : "no");
      if (!finished && i === idx) b.classList.add("cur");
      b.addEventListener("click", function () { finished = false; idx = i; render(); });
      dots.appendChild(b);
    });

    side.replaceChildren();
    if (state.best) {
      var p = el("p", "mode-note", "历史最好成绩：" + state.best.score + " / " + state.best.total + "（" + state.best.date + "）");
      side.appendChild(p);
    }
    var wrong = wrongList();
    var acts = el("div", "rail-actions");
    var b1 = el("button", "btn btn-ghost", "重做本组"); b1.type = "button";
    b1.addEventListener("click", function () {
      pool.forEach(function (q) { delete state.answers[q.id]; });
      persist(); idx = 0; finished = false; render(); W.toast("本组已重置");
    });
    var b2 = el("button", "btn btn-gold", "只练错题" + (wrong.length ? "（" + wrong.length + "）" : "")); b2.type = "button";
    b2.disabled = !wrong.length;
    b2.addEventListener("click", function () {
      if (!wrong.length) return;
      var ids = {};
      wrong.forEach(function (q) { ids[q.id] = 1; delete state.answers[q.id]; });
      part = "wrong";
      pool = QS.filter(function (q) { return ids[q.id]; });
      idx = 0; finished = false;
      syncTabs("wrong");
      persist(); render(); W.toast("进入错题练习：" + pool.length + " 题");
    });
    var b3 = el("button", "btn btn-ghost wide", "导出成绩单"); b3.type = "button";
    b3.addEventListener("click", exportScore);
    acts.appendChild(b1); acts.appendChild(b2); acts.appendChild(b3);
    side.appendChild(acts);
  }

  function exportScore() {
    var lines = ["《财富自由之路》自测成绩单", "生成时间：" + new Date().toLocaleString("zh-CN"), ""];
    var right = 0;
    QS.forEach(function (q, i) {
      var a = state.answers[q.id];
      var ok = a === q.answer;
      if (ok) right += 1;
      lines.push((i + 1) + ". " + q.q);
      lines.push("   我的答案：" + (a == null ? "未作答" : LETTERS[a] + ". " + q.options[a]));
      lines.push("   正确答案：" + LETTERS[q.answer] + ". " + q.options[q.answer] + "  → " + (a == null ? "未答" : ok ? "正确" : "错误"));
      lines.push("   解析：" + q.explain);
      lines.push("   复习：第 " + pad(q.lesson) + " 课 " + lessonHref(q.lesson));
      lines.push("");
    });
    lines.splice(2, 0, "得分：" + right + " / " + QS.length, "");
    W.download("财富自由之路-自测成绩单.txt", lines.join("\n"), "text/plain;charset=utf-8");
    W.toast("成绩单已导出");
  }

  /* ---------- 题目 ---------- */
  function render() {
    renderSide();
    card.replaceChildren();
    if (finished) { renderSummary(); return; }
    if (!pool.length) { card.appendChild(el("div", "empty", "这一组没有题目。")); return; }
    var q = pool[idx];
    var chosen = state.answers[q.id];

    var meta = el("div", "q-meta");
    meta.appendChild(el("span", "q-badge", "第 " + (idx + 1) + " / " + pool.length + " 题"));
    meta.appendChild(el("span", "q-badge alt", "第" + q.part + "部分 · " + PART_NAMES[q.part]));
    meta.appendChild(el("span", "q-badge gold", q.tag));
    var link = el("a", "q-badge alt", "复习第 " + pad(q.lesson) + " 课 →");
    link.href = lessonHref(q.lesson);
    link.style.textDecoration = "none";
    meta.appendChild(link);
    card.appendChild(meta);
    card.appendChild(el("p", "q-text", q.q));

    var opts = el("div", "q-options");
    q.options.forEach(function (text, i) {
      var b = el("button", "q-opt");
      b.type = "button";
      b.appendChild(el("span", "letter", LETTERS[i]));
      b.appendChild(el("span", null, text));
      if (chosen != null) {
        b.disabled = true;
        if (i === q.answer) b.classList.add("right");
        else if (i === chosen) b.classList.add("wrong");
      } else {
        b.addEventListener("click", function () { choose(i); });
      }
      opts.appendChild(b);
    });
    card.appendChild(opts);

    if (chosen != null) {
      var ex = el("div", "q-explain");
      var ok = chosen === q.answer;
      var head = el("b", null, ok ? "答对了。" : "正确答案是 " + LETTERS[q.answer] + "。");
      ex.appendChild(head);
      ex.appendChild(document.createTextNode(" " + q.explain));
      var more = el("div");
      more.style.marginTop = "8px";
      var a = el("a", null, "回到第 " + pad(q.lesson) + " 课重读这一节 →");
      a.href = lessonHref(q.lesson);
      more.appendChild(a);
      ex.appendChild(more);
      card.appendChild(ex);
    }

    var foot = el("div", "q-foot");
    var hint = el("span", null, chosen == null ? "键盘 1–4 也可以作答" : "按 → 进入下一题");
    hint.style.fontSize = "11.5px"; hint.style.color = "var(--warm-3)";
    foot.appendChild(hint);
    var nav = el("div");
    nav.style.display = "flex"; nav.style.gap = "8px";
    var prev = el("button", "btn btn-ghost btn-sm", "← 上一题"); prev.type = "button";
    prev.disabled = idx === 0;
    prev.addEventListener("click", function () { idx = Math.max(0, idx - 1); render(); });
    var next = el("button", "btn btn-primary btn-sm", idx === pool.length - 1 ? "查看结果 →" : "下一题 →"); next.type = "button";
    next.addEventListener("click", advance);
    nav.appendChild(prev); nav.appendChild(next);
    foot.appendChild(nav);
    card.appendChild(foot);
  }

  function choose(i) {
    var q = pool[idx];
    if (state.answers[q.id] != null) return;
    state.answers[q.id] = i;
    persist();
    render();
    if (i !== q.answer) W.toast("再看看解析，这一条是全书的关键之一");
  }
  function advance() {
    if (idx < pool.length - 1) { idx += 1; render(); return; }
    finished = true;
    var right = correctCount();
    if (pool.length === QS.length && (!state.best || right > state.best.score)) {
      state.best = { score: right, total: QS.length, date: new Date().toLocaleDateString("zh-CN") };
      W.toast("刷新最好成绩：" + right + " / " + QS.length);
    }
    persist();
    render();
  }

  function ring(pct) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "150"); svg.setAttribute("height", "150"); svg.setAttribute("viewBox", "0 0 150 150");
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "正确率 " + Math.round(pct * 100) + "%");
    var bg = document.createElementNS(ns, "circle");
    bg.setAttribute("cx", "75"); bg.setAttribute("cy", "75"); bg.setAttribute("r", "64");
    bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "#e9dfcd"); bg.setAttribute("stroke-width", "13");
    var fg = document.createElementNS(ns, "circle");
    var len = 2 * Math.PI * 64;
    fg.setAttribute("cx", "75"); fg.setAttribute("cy", "75"); fg.setAttribute("r", "64");
    fg.setAttribute("fill", "none"); fg.setAttribute("stroke", "url(#qg)"); fg.setAttribute("stroke-width", "13");
    fg.setAttribute("stroke-linecap", "round");
    fg.setAttribute("stroke-dasharray", String(len));
    fg.setAttribute("stroke-dashoffset", String(len * (1 - pct)));
    fg.style.transition = "stroke-dashoffset .8s cubic-bezier(.3,.9,.3,1)";
    var defs = document.createElementNS(ns, "defs");
    var grad = document.createElementNS(ns, "linearGradient");
    grad.setAttribute("id", "qg"); grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0"); grad.setAttribute("x2", "1"); grad.setAttribute("y2", "1");
    [["0", "#dda23a"], ["1", "#c3352b"]].forEach(function (s) {
      var st = document.createElementNS(ns, "stop");
      st.setAttribute("offset", s[0]); st.setAttribute("stop-color", s[1]); grad.appendChild(st);
    });
    defs.appendChild(grad); svg.appendChild(defs); svg.appendChild(bg); svg.appendChild(fg);
    var wrap = el("div", "score-ring");
    wrap.style.position = "relative"; wrap.style.width = "150px"; wrap.style.height = "150px";
    wrap.appendChild(svg);
    var txt = el("div", "ring-txt");
    txt.appendChild(el("b", "score-big", String(Math.round(pct * 100))));
    txt.appendChild(el("span", null, "正确率 %"));
    wrap.appendChild(txt);
    return wrap;
  }

  function renderSummary() {
    var right = correctCount(), done = answeredCount(), wrong = wrongList();
    var pct = pool.length ? right / pool.length : 0;
    card.appendChild(ring(pct));
    var title = el("h2", null, pct >= .9 ? "操作系统已经装上了" : pct >= .7 ? "主干通了，细节还要回炉" : "先别急着往下走，回去重读");
    title.style.cssText = "margin:6px 0 6px;font-family:var(--display);font-size:24px;text-align:center;letter-spacing:.04em";
    card.appendChild(title);
    var sub = el("p", null, "本组共 " + pool.length + " 题，已答 " + done + " 题，答对 " + right + " 题。");
    sub.style.cssText = "margin:0 0 18px;text-align:center;color:var(--ink-3);font-size:13px";
    card.appendChild(sub);

    var byPart = {};
    pool.forEach(function (q) {
      var k = q.part;
      if (!byPart[k]) byPart[k] = { t: 0, r: 0 };
      byPart[k].t += 1;
      if (state.answers[q.id] === q.answer) byPart[k].r += 1;
    });
    var kp = el("div", "kpis");
    Object.keys(byPart).sort().forEach(function (k) {
      var colors = [W.palette.vermilion, W.palette.gold, W.palette.indigo, W.palette.jade, W.palette.plum];
      var box = el("div", "kpi");
      box.style.setProperty("--k", colors[(Number(k) - 1) % 5]);
      box.appendChild(el("b", null, byPart[k].r + "/" + byPart[k].t));
      box.appendChild(el("span", null, PART_NAMES[k]));
      kp.appendChild(box);
    });
    card.appendChild(kp);

    if (wrong.length) {
      var wh = el("h3", null, "需要回炉的 " + wrong.length + " 条");
      wh.style.cssText = "margin:20px 0 10px;font-family:var(--display);font-size:17px";
      card.appendChild(wh);
      var list = el("div", "ledger-list");
      wrong.forEach(function (q) {
        var row = el("div", "ledger-item");
        row.style.gridTemplateColumns = "10px minmax(0,1fr) auto";
        row.style.setProperty("--c", W.palette.vermilion);
        row.appendChild(el("div", "ledger-dot"));
        var name = el("div");
        var t = el("div", null, q.q);
        t.style.cssText = "font-size:13px;color:var(--ink);white-space:normal";
        var s = el("div", null, "正确：" + LETTERS[q.answer] + ". " + q.options[q.answer]);
        s.style.cssText = "font-size:11.5px;color:var(--jade);margin-top:3px;white-space:normal";
        name.appendChild(t); name.appendChild(s);
        row.appendChild(name);
        var a = el("a", "btn btn-ghost btn-sm", "第 " + pad(q.lesson) + " 课");
        a.href = lessonHref(q.lesson);
        row.appendChild(a);
        list.appendChild(row);
      });
      card.appendChild(list);
    } else {
      card.appendChild(el("div", "empty", "这一组全部答对。去下一部分，或者直接开始 30 天践行。"));
    }

    var foot = el("div", "q-foot");
    var l = el("a", "btn btn-ghost", "去 30 天践行清单 →"); l.href = "plan.html";
    var r = el("button", "btn btn-primary", "再测一遍"); r.type = "button";
    r.addEventListener("click", function () {
      pool.forEach(function (q) { delete state.answers[q.id]; });
      persist(); idx = 0; finished = false; render();
    });
    foot.appendChild(l); foot.appendChild(r);
    card.appendChild(foot);
  }

  /* ---------- 分组切换 ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  function syncTabs(name) {
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.part === String(name) ? "true" : "false"); });
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      part = t.dataset.part;
      syncTabs(part);
      buildPool();
      render();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (finished || !pool.length) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    var q = pool[idx];
    if (/^[1-4]$/.test(e.key) && state.answers[q.id] == null) { choose(Number(e.key) - 1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { advance(); e.preventDefault(); }
    else if (e.key === "ArrowLeft" && idx > 0) { idx -= 1; render(); e.preventDefault(); }
  });

  var reset = document.getElementById("quiz-reset");
  if (reset) reset.addEventListener("click", function () {
    var backup = JSON.parse(JSON.stringify(state.answers));
    state.answers = {}; persist(); idx = 0; finished = false; render();
    W.toast("全部作答记录已清空", "撤销", function () { state.answers = backup; persist(); render(); });
  });
  var exp = document.getElementById("quiz-export");
  if (exp) exp.addEventListener("click", exportScore);

  scaffold();
  syncTabs("all");
  buildPool();
  var firstUn = pool.findIndex(function (q) { return state.answers[q.id] == null; });
  idx = firstUn < 0 ? 0 : firstUn;
  render();
})();