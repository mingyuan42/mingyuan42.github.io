// 概念词典 · 财富自由之路 · wealth glossary
(function () {
  "use strict";
  var W = window.WEALTH;
  var root = document.getElementById("glossary-root");
  if (!W || !root) return;
  var DATA;
  try { DATA = JSON.parse(document.getElementById("glossary-data").textContent); }
  catch (e) { root.textContent = "词典加载失败。"; return; }
  var ALL = DATA.concepts;
  var PARTS = DATA.parts;
  var BY_ID = {};
  ALL.forEach(function (c) { BY_ID[c.id] = c; });
  var PCOLOR = {
    1: [W.palette.vermilion, "rgba(195,53,43,.12)"],
    2: [W.palette.gold, "rgba(179,128,31,.16)"],
    3: [W.palette.indigo, "rgba(35,74,118,.12)"],
    4: [W.palette.jade, "rgba(44,122,91,.12)"],
    5: [W.palette.plum, "rgba(138,53,96,.12)"]
  };
  var state = W.read("wealth-glossary-v1", { part: "all", tag: "all", q: "", sel: ALL[0].id });
  var query = state.q || "", part = state.part || "all", tag = state.tag || "all";
  var selected = BY_ID[state.sel] ? state.sel : ALL[0].id;

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function save() { W.write("wealth-glossary-v1", { part: part, tag: tag, q: query, sel: selected }); }

  /* ---------- 骨架 ---------- */
  root.replaceChildren();
  var layout = el("div", "glossary-layout");
  var left = el("div");

  var searchWrap = el("div", "search-bar");
  var ns = "http://www.w3.org/2000/svg";
  var icon = document.createElementNS(ns, "svg");
  icon.setAttribute("width", "17"); icon.setAttribute("height", "17"); icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none"); icon.setAttribute("stroke", "currentColor"); icon.setAttribute("stroke-width", "2");
  var circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", "11"); circle.setAttribute("cy", "11"); circle.setAttribute("r", "7");
  var line = document.createElementNS(ns, "path");
  line.setAttribute("d", "M20 20l-3.6-3.6"); line.setAttribute("stroke-linecap", "round");
  icon.appendChild(circle); icon.appendChild(line);
  searchWrap.appendChild(icon);
  var input = document.createElement("input");
  input.type = "search"; input.id = "g-search"; input.value = query;
  input.placeholder = "搜索概念、英文、释义或金句…（按 / 聚焦）";
  input.setAttribute("aria-label", "搜索概念");
  searchWrap.appendChild(input);
  var clear = el("button", "icon-btn clear", "×"); clear.type = "button";
  clear.setAttribute("aria-label", "清空搜索");
  searchWrap.appendChild(clear);
  left.appendChild(searchWrap);

  var tagChips = el("div", "chips");
  tagChips.style.marginBottom = "12px";
  left.appendChild(tagChips);
  var countLine = el("p");
  countLine.style.cssText = "margin:0 0 12px;font-size:12px;color:var(--warm-3)";
  left.appendChild(countLine);
  var grid = el("div", "g-grid");
  left.appendChild(grid);
  layout.appendChild(left);

  var detail = el("aside", "g-detail");
  detail.id = "g-detail";
  layout.appendChild(detail);
  root.appendChild(layout);

  /* ---------- 筛选条 ---------- */
  function chipRow(box, items, current, onPick) {
    box.replaceChildren();
    items.forEach(function (it) {
      var b = el("button", "chip", it[1] + (it[2] != null ? " " + it[2] : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", String(current) === String(it[0]) ? "true" : "false");
      b.addEventListener("click", function () { onPick(it[0]); });
      box.appendChild(b);
    });
  }
  function renderChips() {
    var scope = ALL.filter(function (c) { return part === "all" || String(c.part) === String(part); });
    var counts = {};
    scope.forEach(function (c) { (c.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var tItems = [["all", "全部标签", scope.length]];
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b, "zh"); })
      .forEach(function (t) { tItems.push([t, t, counts[t]]); });
    chipRow(tagChips, tItems, tag, function (v) { tag = v; save(); renderChips(); renderGrid(); });
  }

  /* ---------- 列表 ---------- */
  function matches(c) {
    if (part !== "all" && String(c.part) !== String(part)) return false;
    if (tag !== "all" && (c.tags || []).indexOf(tag) < 0) return false;
    if (!query) return true;
    var q = query.toLowerCase();
    return [c.term, c.en, c.def, c.why, c.trap, c.quote, (c.tags || []).join(" ")]
      .join(" ").toLowerCase().indexOf(q) >= 0;
  }
  function highlight(node, text) {
    if (!query) { node.textContent = text; return; }
    var lower = text.toLowerCase(), q = query.toLowerCase(), i = 0, at;
    node.replaceChildren();
    while ((at = lower.indexOf(q, i)) >= 0) {
      if (at > i) node.appendChild(document.createTextNode(text.slice(i, at)));
      var m = document.createElement("mark");
      m.textContent = text.slice(at, at + q.length);
      node.appendChild(m);
      i = at + q.length;
    }
    node.appendChild(document.createTextNode(text.slice(i)));
  }
  function renderGrid() {
    var list = ALL.filter(matches);
    countLine.textContent = "共 " + ALL.length + " 个概念，当前显示 " + list.length + " 个" +
      (query ? "（搜索「" + query + "」）" : "") + "。点卡片查看完整释义。";
    grid.replaceChildren();
    if (!list.length) {
      grid.appendChild(el("div", "empty", "没有匹配的概念。试试更短的词，或切回「全部」。"));
      return;
    }
    list.forEach(function (c) {
      var card = el("button", "g-card" + (c.id === selected ? " on" : ""));
      card.type = "button";
      card.setAttribute("aria-pressed", c.id === selected ? "true" : "false");
      var b = el("b"); highlight(b, c.term); card.appendChild(b);
      card.appendChild(el("div", "g-en", c.en || ""));
      var p = el("p"); highlight(p, c.def); card.appendChild(p);
      var col = PCOLOR[c.part] || PCOLOR[1];
      var tg = el("span", "g-tag", "第" + c.part + "部分 · 第" + pad(c.lesson) + "课");
      tg.style.setProperty("--gt", col[1]); tg.style.setProperty("--gtc", col[0]);
      card.appendChild(tg);
      card.addEventListener("click", function () { select(c.id); });
      grid.appendChild(card);
    });
  }

  /* ---------- 详情 ---------- */
  function block(title, text, color) {
    if (!text) return null;
    var b = el("div", "g-block");
    var h = el("h4", null, title);
    h.style.setProperty("--bc", color);
    b.appendChild(h);
    var p = el("p"); highlight(p, text); b.appendChild(p);
    return b;
  }
  function select(id) {
    if (!BY_ID[id]) return;
    selected = id; save();
    renderGrid();
    renderDetail();
    if (window.matchMedia("(max-width: 1180px)").matches) {
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function renderDetail() {
    var c = BY_ID[selected];
    detail.replaceChildren();
    if (!c) return;
    var col = PCOLOR[c.part] || PCOLOR[1];
    var tagRow = el("div", "q-meta");
    var pt = el("span", "q-badge", "第" + c.part + "部分 · " + PARTS[c.part]);
    pt.style.background = col[0];
    tagRow.appendChild(pt);
    (c.tags || []).forEach(function (t) { tagRow.appendChild(el("span", "q-badge gold", t)); });
    detail.appendChild(tagRow);
    var h = el("h2"); highlight(h, c.term); detail.appendChild(h);
    detail.appendChild(el("div", "g-en-big", c.en || ""));
    var d = block("是什么", c.def, col[0]); if (d) detail.appendChild(d);
    var y = block("为什么重要", c.why, W.palette.jade); if (y) detail.appendChild(y);
    var t = block("常见的坑", c.trap, W.palette.vermilion); if (t) detail.appendChild(t);
    if (c.quote) {
      var q = el("blockquote", "g-quote");
      q.appendChild(el("cite", null, "原书金句 · 第 " + pad(c.lesson) + " 课对应专栏"));
      var qp = el("span"); highlight(qp, "「" + c.quote + "」"); q.appendChild(qp);
      detail.appendChild(q);
    }
    var src = el("div", "g-block");
    var sh = el("h4", null, "出处"); sh.style.setProperty("--bc", W.palette.indigo);
    src.appendChild(sh);
    var sp = el("p");
    var a = el("a", null, "第 " + pad(c.lesson) + " 课 · 完整讲解 →");
    a.href = "zh/lesson-" + pad(c.lesson) + ".html";
    sp.appendChild(a);
    src.appendChild(sp);
    detail.appendChild(src);
    var rel = (c.links || []).filter(function (x) { return BY_ID[x]; });
    if (rel.length) {
      var rb = el("div", "g-block");
      var rh = el("h4", null, "相关概念"); rh.style.setProperty("--bc", W.palette.gold);
      rb.appendChild(rh);
      var box = el("div", "g-links");
      rel.forEach(function (rid) {
        var b = el("button", "chip", BY_ID[rid].term);
        b.type = "button";
        b.addEventListener("click", function () { select(rid); });
        box.appendChild(b);
      });
      rb.appendChild(box);
      detail.appendChild(rb);
    }
    var ops = el("div", "g-block");
    var ob = el("button", "btn btn-ghost btn-sm", "复制这条释义");
    ob.type = "button";
    ob.addEventListener("click", function () {
      var text = c.term + "（" + (c.en || "") + "）\n" + c.def + "\n为什么重要：" + (c.why || "") +
        "\n常见的坑：" + (c.trap || "") + (c.quote ? "\n原书：" + c.quote : "") +
        "\n——《财富自由之路》课程词典 第" + pad(c.lesson) + "课";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { W.toast("已复制到剪贴板"); },
          function () { W.download(c.term + ".txt", text, "text/plain;charset=utf-8"); W.toast("已改为下载文本"); });
      } else {
        W.download(c.term + ".txt", text, "text/plain;charset=utf-8");
        W.toast("已下载为文本");
      }
    });
    ops.appendChild(ob);
    detail.appendChild(ops);
  }

  /* ---------- 事件 ---------- */
  var partTabs = Array.prototype.slice.call(document.querySelectorAll(".tab[data-part]"));
  function syncTabs() {
    partTabs.forEach(function (t) {
      t.setAttribute("aria-selected", t.dataset.part === String(part) ? "true" : "false");
    });
  }
  partTabs.forEach(function (t) {
    t.addEventListener("click", function () {
      part = t.dataset.part; tag = "all";
      save(); syncTabs(); renderChips(); renderGrid();
    });
  });
  var timer = 0;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { query = input.value.trim(); save(); renderGrid(); }, 110);
  });
  clear.addEventListener("click", function () { input.value = ""; query = ""; save(); renderGrid(); input.focus(); });
  document.addEventListener("keydown", function (e) {
    var tag2 = (e.target.tagName || "").toLowerCase();
    if (e.key === "/" && tag2 !== "input" && tag2 !== "textarea") { input.focus(); e.preventDefault(); }
    if (e.key === "Escape" && document.activeElement === input) { input.value = ""; query = ""; save(); renderGrid(); }
  });
  var rand = document.getElementById("glossary-random");
  if (rand) rand.addEventListener("click", function () {
    var list = ALL.filter(matches);
    if (!list.length) list = ALL;
    select(list[Math.floor(Math.random() * list.length)].id);
    W.toast("随机抽到一个概念");
  });
  var exp = document.getElementById("glossary-export");
  if (exp) exp.addEventListener("click", function () {
    var list = ALL.filter(matches);
    var lines = ["# 《财富自由之路》概念词典（当前筛选：" + list.length + " 条）", ""];
    list.forEach(function (c) {
      lines.push("## " + c.term + (c.en ? " · " + c.en : ""));
      lines.push("- 出处：第" + c.part + "部分 · 第 " + pad(c.lesson) + " 课");
      lines.push("- 是什么：" + c.def);
      if (c.why) lines.push("- 为什么重要：" + c.why);
      if (c.trap) lines.push("- 常见的坑：" + c.trap);
      if (c.quote) lines.push("- 原书：「" + c.quote + "」");
      lines.push("");
    });
    W.download("财富自由之路-概念词典.md", lines.join("\n"), "text/markdown;charset=utf-8");
    W.toast("已导出 " + list.length + " 条词条");
  });
  if (location.hash) {
    var id = location.hash.replace("#", "");
    if (BY_ID[id]) selected = id;
  }
  syncTabs();
  renderChips();
  renderGrid();
  renderDetail();
})();