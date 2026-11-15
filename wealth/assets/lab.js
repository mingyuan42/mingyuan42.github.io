// 财富实验室 · 复利账簿 · wealth lab
(function () {
  "use strict";
  var W = window.WEALTH;
  if (!W) return;
  var P = W.palette;
  var stage = document.getElementById("lab-stage");
  var railBox = document.getElementById("rail-controls");
  var railTitle = document.getElementById("rail-title-text");
  if (!stage || !railBox) return;

  var KEY = "wealth-lab-v1";
  var saved = W.read(KEY, {});

  /* ============ 通用控件 ============ */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function slider(o) {
    var wrap = el("div", "ctrl");
    var row = el("div", "ctrl-row");
    var lab = el("label", null, o.label);
    lab.setAttribute("for", "c-" + o.key);
    var out = el("output");
    row.appendChild(lab); row.appendChild(out);
    var inp = document.createElement("input");
    inp.type = "range"; inp.id = "c-" + o.key;
    inp.min = o.min; inp.max = o.max; inp.step = o.step; inp.value = o.value;
    wrap.appendChild(row); wrap.appendChild(inp);
    if (o.hint) wrap.appendChild(el("div", "hint", o.hint));
    function show() { out.textContent = o.fmt ? o.fmt(Number(inp.value)) : inp.value; }
    inp.addEventListener("input", function () { show(); o.on(Number(inp.value)); });
    show();
    wrap.setInput = function (v) { inp.value = v; show(); };
    return wrap;
  }
  function toggle(o) {
    var lab = el("label", "switch");
    var span = el("span", null, o.label);
    var inp = document.createElement("input");
    inp.type = "checkbox"; inp.checked = !!o.value;
    var i = el("i");
    lab.appendChild(span); lab.appendChild(inp); lab.appendChild(i);
    inp.addEventListener("change", function () { o.on(inp.checked); });
    var wrap = el("div", "ctrl");
    wrap.appendChild(lab);
    if (o.hint) wrap.appendChild(el("div", "hint", o.hint));
    wrap.setInput = function (v) { inp.checked = !!v; };
    return wrap;
  }
  function picker(o) {
    var wrap = el("div", "ctrl");
    var lab = el("label", null, o.label);
    lab.setAttribute("for", "c-" + o.key);
    var sel = document.createElement("select");
    sel.id = "c-" + o.key;
    o.options.forEach(function (op) {
      var e = document.createElement("option");
      e.value = op[0]; e.textContent = op[1];
      if (String(op[0]) === String(o.value)) e.selected = true;
      sel.appendChild(e);
    });
    wrap.appendChild(lab); wrap.appendChild(sel);
    if (o.hint) wrap.appendChild(el("div", "hint", o.hint));
    sel.addEventListener("change", function () { o.on(sel.value); });
    wrap.setInput = function (v) { sel.value = v; };
    return wrap;
  }
  function stepper(o) {
    var wrap = el("div", "ctrl");
    wrap.appendChild(el("label", null, o.label)).setAttribute("for", "c-" + o.key);
    var row = el("div", "stepper");
    var minus = el("button", null, "−"); minus.type = "button"; minus.setAttribute("aria-label", "减少");
    var inp = document.createElement("input");
    inp.type = "number"; inp.id = "c-" + o.key; inp.name = o.key;
    inp.min = o.min; inp.max = o.max; inp.value = o.value;
    var plus = el("button", null, "+"); plus.type = "button"; plus.setAttribute("aria-label", "增加");
    row.appendChild(minus); row.appendChild(inp); row.appendChild(plus);
    wrap.appendChild(row);
    if (o.hint) wrap.appendChild(el("div", "hint", o.hint));
    function commit(v) {
      v = Math.max(o.min, Math.min(o.max, Math.round(v || o.min)));
      inp.value = v; o.on(v);
    }
    minus.addEventListener("click", function () { commit(Number(inp.value) - 1); });
    plus.addEventListener("click", function () { commit(Number(inp.value) + 1); });
    inp.addEventListener("change", function () { commit(Number(inp.value)); });
    wrap.setInput = function (v) { inp.value = v; };
    return wrap;
  }
  function actions(list) {
    var box = el("div", "rail-actions");
    list.forEach(function (a) {
      var b = el("button", "btn " + (a.cls || "btn-ghost") + (a.wide ? " wide" : ""), a.label);
      b.type = "button";
      b.addEventListener("click", a.on);
      box.appendChild(b);
    });
    return box;
  }

  /* ============ 画布折线图 ============ */
  var liveCharts = [];
  function clearCharts() {
    liveCharts.forEach(function (ch) { ch.destroy(); });
    liveCharts = [];
  }
  function Chart(canvas, tip, height) {
    this.cv = canvas; this.ctx = canvas.getContext("2d"); this.tip = tip;
    this.baseH = height || 330;
    this.data = null; this.anim = 1; this.raf = 0; this.hover = -1;
    this.w = 0; this.h = 0;
    var self = this;
    function onMove(ev) {
      if (!self.data || !self.geo || self.custom) return;
      var r = self.cv.getBoundingClientRect();
      var x = ev.clientX - r.left;
      var g = self.geo;
      var n = self.data.xs.length;
      var idx = Math.round((x - g.l) / Math.max(1, g.w) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      if (idx !== self.hover) { self.hover = idx; self.paint(); }
      self.showTip(idx);
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", function () {
      self.hover = -1; self.tip.classList.remove("on"); self.paint();
    });
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(function () { if (self.resize()) self.paint(); });
      this.ro.observe(canvas.parentNode);
    } else {
      window.addEventListener("resize", function () { if (self.resize()) self.paint(); });
    }
    this.resize();
    liveCharts.push(this);
  }
  Chart.prototype.destroy = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.ro) this.ro.disconnect();
    this.cv.onpointermove = null;
    this.data = null; this.custom = null;
  };
  Chart.prototype.resize = function () {
    var box = this.cv.parentNode;
    var w = Math.max(240, box.clientWidth);
    var h = w < 520 ? Math.max(230, this.baseH - 70) : this.baseH;
    if (w === this.w && h === this.h) return false;
    this.w = w; this.h = h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = "100%"; this.cv.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  };
  Chart.prototype.set = function (data, animate) {
    this.data = data;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.anim = 1; this.resize(); this.paint(); return;
    }
    var self = this, t0 = performance.now(), dur = 620;
    this.anim = 0;
    function step(t) {
      var k = Math.min(1, (t - t0) / dur);
      self.anim = 1 - Math.pow(1 - k, 3);
      self.paint();
      if (k < 1) self.raf = requestAnimationFrame(step); else self.raf = 0;
    }
    this.resize();
    this.raf = requestAnimationFrame(step);
  };
  function niceTicks(lo, hi, want) {
    var span = hi - lo;
    if (!(span > 0)) return [lo];
    var raw = span / want;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
    var out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(v);
    return out;
  }
  Chart.prototype.paint = function () {
    if (this.custom) { this.custom(this); return; }
    var d = this.data, ctx = this.ctx;
    if (!d) return;
    var w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fffcf5"; ctx.fillRect(0, 0, w, h);
    var l = 62, r = 16, t = 16, b = 34;
    if (w < 460) { l = 50; r = 10; }
    var gw = w - l - r, gh = h - t - b;
    var xs = d.xs, n = xs.length;
    var lo = Infinity, hi = -Infinity;
    d.series.forEach(function (s) {
      if (s.hidden) return;
      s.ys.forEach(function (v) { if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } });
    });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (d.log) { lo = Math.max(lo, 1e-6); hi = Math.max(hi, lo * 1.6); }
    else { if (lo > 0) lo = 0; var pad = (hi - lo) * .1 || 1; hi += pad; }
    if (hi === lo) hi = lo + 1;
    var X = function (i) { return l + (n === 1 ? gw / 2 : i / (n - 1) * gw); };
    var Y = function (v) {
      if (d.log) {
        var a = Math.log10(Math.max(lo, 1e-6)), bb = Math.log10(hi);
        return t + gh - (Math.log10(Math.max(v, 1e-6)) - a) / (bb - a) * gh;
      }
      return t + gh - (v - lo) / (hi - lo) * gh;
    };
    this.geo = { l: l, t: t, w: gw, h: gh, X: X, Y: Y };

    // 网格
    var ticks = d.log ? (function () {
      var out = [], a = Math.floor(Math.log10(lo)), z = Math.ceil(Math.log10(hi));
      for (var e = a; e <= z; e++) { var v = Math.pow(10, e); if (v >= lo * .99 && v <= hi * 1.01) out.push(v); }
      return out.length > 1 ? out : niceTicks(lo, hi, 5);
    })() : niceTicks(lo, hi, 5);
    ctx.strokeStyle = "rgba(120,96,60,.16)"; ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", Menlo, monospace';
    ctx.fillStyle = "#8c8071"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ticks.forEach(function (v) {
      var y = Math.round(Y(v)) + .5;
      ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(l + gw, y); ctx.stroke();
      ctx.fillText(d.yFmt ? d.yFmt(v) : W.fmtMoney(v), l - 8, y);
    });
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    var every = Math.max(1, Math.ceil(n / (w < 460 ? 5 : 9)));
    for (var i = 0; i < n; i += every) {
      ctx.fillText(d.xFmt ? d.xFmt(xs[i]) : String(xs[i]), X(i), t + gh + 9);
    }
    ctx.strokeStyle = "rgba(120,96,60,.4)";
    ctx.beginPath(); ctx.moveTo(l, t); ctx.lineTo(l, t + gh); ctx.lineTo(l + gw, t + gh); ctx.stroke();

    var lim = Math.max(2, Math.round(n * this.anim));
    // 波动带（可能超出画面，裁剪到绘图区）
    if (d.band) {
      ctx.save();
      ctx.beginPath(); ctx.rect(l, t, gw, gh); ctx.clip();
      ctx.beginPath();
      for (var i2 = 0; i2 < lim; i2++) { var xx = X(i2), yy = Y(d.band.hi[i2]); i2 ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      for (var j = lim - 1; j >= 0; j--) ctx.lineTo(X(j), Y(d.band.lo[j]));
      ctx.closePath();
      ctx.fillStyle = d.band.color || "rgba(210,154,42,.16)"; ctx.fill();
      ctx.restore();
    }
    // 曲线
    d.series.forEach(function (s) {
      if (s.hidden) return;
      ctx.save();
      ctx.beginPath();
      for (var k = 0; k < lim; k++) { var px = X(k), py = Y(s.ys[k]); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      if (s.fill) {
        ctx.lineTo(X(lim - 1), t + gh); ctx.lineTo(X(0), t + gh); ctx.closePath();
        var grd = ctx.createLinearGradient(0, t, 0, t + gh);
        grd.addColorStop(0, s.fill); grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath();
        for (var k2 = 0; k2 < lim; k2++) { var qx = X(k2), qy = Y(s.ys[k2]); k2 ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); }
      }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.2;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (s.dash) ctx.setLineDash(s.dash); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    });
    // 悬停
    if (this.hover >= 0 && this.hover < n) {
      var hx = X(this.hover);
      ctx.save();
      ctx.strokeStyle = "rgba(195,53,43,.45)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, t); ctx.lineTo(hx, t + gh); ctx.stroke();
      ctx.setLineDash([]);
      d.series.forEach(function (s) {
        if (s.hidden) return;
        ctx.beginPath(); ctx.arc(hx, Y(s.ys[this.hover]), 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fffcf5"; ctx.fill();
        ctx.lineWidth = 2.4; ctx.strokeStyle = s.color; ctx.stroke();
      }, this);
      ctx.restore();
    }
  };
  Chart.prototype.showTip = function (idx) {
    var d = this.data, g = this.geo;
    this.tip.replaceChildren();
    var head = document.createElement("b");
    head.textContent = d.xFmt ? d.xFmt(d.xs[idx]) : String(d.xs[idx]);
    this.tip.appendChild(head);
    d.series.forEach(function (s) {
      if (s.hidden) return;
      var row = document.createElement("div");
      var dot = document.createElement("i");
      dot.style.cssText = "display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:5px;background:" + s.color;
      row.appendChild(dot);
      row.appendChild(document.createTextNode(s.name + " " + (d.yFmt ? d.yFmt(s.ys[idx]) : W.fmtMoney(s.ys[idx]))));
      this.tip.appendChild(row);
    }, this);
    this.tip.classList.add("on");
    this.tip.style.left = Math.max(70, Math.min(this.w - 70, g.X(idx))) + "px";
    this.tip.style.top = Math.max(46, g.t + 20) + "px";
  };

  function legend(items) {
    var box = el("div", "chart-legend");
    items.forEach(function (it) {
      var s = el("span", it.dash ? "dash" : null);
      var i = el("i"); i.style.background = it.dash ? "none" : it.color;
      if (it.dash) { i.style.borderTopColor = it.color; s.style.color = it.color; }
      s.appendChild(i);
      s.appendChild(document.createTextNode(it.name));
      box.appendChild(s);
    });
    return box;
  }
  function panel(title, sub) {
    var p = el("section", "panel");
    var head = el("div", "panel-head");
    var left = el("div");
    left.appendChild(el("h2", null, title));
    if (sub) left.appendChild(el("p", null, sub));
    head.appendChild(left);
    p.appendChild(head);
    return { root: p, head: head };
  }
  function kpiRow(items) {
    var box = el("div", "kpis");
    items.forEach(function (it) {
      var k = el("div", "kpi");
      k.style.setProperty("--k", it.color);
      k.style.setProperty("--ks", it.soft || "rgba(195,53,43,.07)");
      k.appendChild(el("b", null, it.value));
      k.appendChild(el("span", null, it.label));
      if (it.note) k.appendChild(el("small", null, it.note));
      box.appendChild(k);
    });
    return box;
  }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function gauss(rand) {
    var u = Math.max(1e-9, rand()), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ============ 模块一：复利与定投 ============ */
  var SCHEMES = {
    ledger: { main: P.vermilion, cost: P.indigo, real: P.jade, path: P.gold, band: "rgba(210,154,42,.18)", fill: "rgba(195,53,43,.22)" },
    indigo: { main: P.indigo, cost: P.plum, real: P.teal, path: P.amber, band: "rgba(22,104,196,.14)", fill: "rgba(35,74,118,.20)" },
    contrast: { main: "#111111", cost: "#0057b8", real: "#007a3d", path: "#b35c00", band: "rgba(0,0,0,.10)", fill: "rgba(0,0,0,.14)" }
  };
  var cDef = { principal: 50000, monthly: 3000, rate: 10, years: 20, stepUp: 5, inflation: 2, vol: 25, seed: 42, log: "linear", cost: true, real: true, band: true, scheme: "ledger" };
  var c = Object.assign({}, cDef, saved.compound || {});
  var cChart = null, cTable = null, cKpis = null, cNote = null;

  function simulate() {
    var months = c.years * 12;
    var rm = Math.pow(1 + c.rate / 100, 1 / 12) - 1;
    var sigma = c.vol / 100 / Math.sqrt(12);
    var rand = rng(c.seed);
    var shocks = [], i;
    for (i = 0; i < months; i++) shocks.push(gauss(rand) * sigma);
    var mean = shocks.reduce(function (a, b) { return a + b; }, 0) / months;
    for (i = 0; i < months; i++) shocks[i] -= mean;   // 漂移校正：终值一致，过程不同

    var bal = c.principal, pathBal = c.principal, invested = c.principal, pay = c.monthly;
    var xs = [0], nominal = [bal], cost = [invested], real = [bal], path = [pathBal], bandLo = [bal], bandHi = [bal];
    var peak = pathBal, maxDD = 0, crossYear = 0, majorityYear = 0;
    for (var m = 1; m <= months; m++) {
      if (m > 1 && (m - 1) % 12 === 0) pay *= (1 + c.stepUp / 100);
      bal = bal * (1 + rm) + pay;
      invested += pay;
      pathBal = pathBal * Math.exp(Math.log(1 + rm) + shocks[m - 1]) + pay;
      peak = Math.max(peak, pathBal);
      maxDD = Math.max(maxDD, (peak - pathBal) / peak);
      if (m % 12 === 0) {
        var y = m / 12;
        xs.push(y); nominal.push(bal); cost.push(invested); path.push(pathBal);
        real.push(bal / Math.pow(1 + c.inflation / 100, y));
        var sd = c.vol / 100 * Math.sqrt(y);
        bandLo.push(bal * Math.exp(-sd)); bandHi.push(bal * Math.exp(sd));
        if (!crossYear && bal >= invested * 2) crossYear = y;
        if (!majorityYear && bal > 0 && (bal - invested) / bal >= .5) majorityYear = y;
      }
    }
    return {
      xs: xs, nominal: nominal, cost: cost, real: real, path: path,
      bandLo: bandLo, bandHi: bandHi, maxDD: maxDD, crossYear: crossYear, majorityYear: majorityYear,
      final: bal, invested: invested, realFinal: bal / Math.pow(1 + c.inflation / 100, c.years)
    };
  }

  function renderCompound(animate) {
    var s = simulate();
    var sc = SCHEMES[c.scheme] || SCHEMES.ledger;
    var mult = s.invested > 0 ? s.final / s.invested : 0;
    var gain = s.final - s.invested;
    cKpis.innerHTML = "";
    cKpis.appendChild(kpiRow([
      { label: c.years + " 年后名义市值", value: "¥" + W.fmtMoney(s.final), color: sc.main, note: "含本金与累计定投" },
      { label: "累计投入", value: "¥" + W.fmtMoney(s.invested), color: sc.cost, soft: "rgba(35,74,118,.07)", note: "本金 + 每月定投合计" },
      { label: "净收益", value: "¥" + W.fmtMoney(gain), color: P.jade, soft: "rgba(44,122,91,.08)", note: "投入产出比 " + mult.toFixed(2) + " 倍" },
      { label: "通胀折算后购买力", value: "¥" + W.fmtMoney(s.realFinal), color: P.teal, soft: "rgba(21,127,127,.08)", note: "按年通胀 " + c.inflation + "% 折回今天" },
      { label: "本金翻倍所需", value: (c.rate > 0 ? (72 / c.rate).toFixed(1) : "—") + " 年", color: P.gold, soft: "rgba(210,154,42,.10)", note: "72 法则（仅对稳定年化成立）" },
      { label: "随机路径最大回撤", value: (s.maxDD * 100).toFixed(1) + "%", color: P.plum, soft: "rgba(138,53,96,.08)", note: "波动率 " + c.vol + "% · 种子 " + c.seed }
    ]));
    var series = [
      { name: "名义市值", color: sc.main, ys: s.nominal, fill: sc.fill, width: 2.6 },
      { name: "累计投入", color: sc.cost, ys: s.cost, dash: [6, 4], width: 1.8, hidden: !c.cost },
      { name: "实际购买力", color: sc.real, ys: s.real, width: 1.8, hidden: !c.real },
      { name: "随机路径", color: sc.path, ys: s.path, width: 1.3, hidden: !c.band }
    ];
    cChart.set({
      xs: s.xs, series: series, log: c.log === "log",
      band: c.band ? { lo: s.bandLo, hi: s.bandHi, color: sc.band } : null,
      xFmt: function (v) { return v + "年"; }
    }, animate);
    var note = [];
    if (s.crossYear) note.push("第 " + s.crossYear + " 年，市值首次达到累计投入的 2 倍");
    if (s.majorityYear) note.push("第 " + s.majorityYear + " 年起，账户里超过一半的钱是收益而不是本金");
    if (c.rate <= 0) note.push("年化 ≤ 0 时复利不再帮忙，时间只是把亏损摊长");
    if (c.vol >= 40) note.push("波动率 " + c.vol + "% 意味着过程中可能出现 " + (s.maxDD * 100).toFixed(0) + "% 的回撤——先问自己能否不动");
    cNote.textContent = note.join("；") + "。";

    var rows = [];
    rows.push("<tr><th>年份</th><th>累计投入</th><th>名义市值</th><th>当年增值</th><th>实际购买力</th><th>收益占比</th></tr>");
    for (var i = 1; i < s.xs.length; i++) {
      var delta = s.nominal[i] - s.nominal[i - 1] - (s.cost[i] - s.cost[i - 1]);
      var share = s.nominal[i] > 0 ? (s.nominal[i] - s.cost[i]) / s.nominal[i] * 100 : 0;
      rows.push("<tr><td>第 " + s.xs[i] + " 年</td><td>" + W.fmtMoney(s.cost[i]) + "</td><td><strong>" + W.fmtMoney(s.nominal[i]) +
        "</strong></td><td>" + W.fmtMoney(delta) + "</td><td>" + W.fmtMoney(s.real[i]) + "</td><td>" + share.toFixed(1) + "%</td></tr>");
    }
    cTable.innerHTML = rows.join("");
    stage.dataset.csv = (function () {
      var out = ["年份,累计投入,名义市值,实际购买力,随机路径"];
      for (var i = 0; i < s.xs.length; i++) out.push([s.xs[i], Math.round(s.cost[i]), Math.round(s.nominal[i]), Math.round(s.real[i]), Math.round(s.path[i])].join(","));
      return out.join("\n");
    })();
  }

  function mountCompound() {
    clearCharts();
    railTitle.textContent = "复利与定投";
    railBox.innerHTML = "";
    function add(node) { railBox.appendChild(node); return node; }
    function upd(k, v, an) { c[k] = v; save(); renderCompound(an); }
    add(slider({ key: "principal", label: "初始本金", min: 0, max: 1000000, step: 5000, value: c.principal, fmt: function (v) { return "¥" + W.fmtMoney(v); }, on: function (v) { upd("principal", v); } }));
    add(slider({ key: "monthly", label: "每月定投", min: 0, max: 30000, step: 250, value: c.monthly, fmt: function (v) { return "¥" + W.fmtNum(v); }, on: function (v) { upd("monthly", v); } }));
    add(slider({ key: "rate", label: "年化收益率", min: -5, max: 25, step: .5, value: c.rate, fmt: function (v) { return v.toFixed(1) + "%"; }, hint: "长期可持续的年化很少超过 15%，此处仅为演算。", on: function (v) { upd("rate", v); } }));
    add(slider({ key: "years", label: "投资年限", min: 1, max: 50, step: 1, value: c.years, fmt: function (v) { return v + " 年"; }, on: function (v) { upd("years", v); } }));
    add(slider({ key: "stepUp", label: "定投额年增", min: 0, max: 20, step: 1, value: c.stepUp, fmt: function (v) { return v + "%"; }, hint: "随收入成长逐年提高投入。", on: function (v) { upd("stepUp", v); } }));
    add(slider({ key: "inflation", label: "通胀率", min: 0, max: 8, step: .5, value: c.inflation, fmt: function (v) { return v.toFixed(1) + "%"; }, on: function (v) { upd("inflation", v); } }));
    add(slider({ key: "vol", label: "年化波动率", min: 0, max: 60, step: 1, value: c.vol, fmt: function (v) { return v + "%"; }, hint: "决定过程中的回撤深度，不改变终值。", on: function (v) { upd("vol", v); } }));
    add(stepper({ key: "seed", label: "随机种子", min: 1, max: 9999, value: c.seed, hint: "换一条同样终值、不同过程的路径。", on: function (v) { upd("seed", v, true); } }));
    add(picker({ key: "log", label: "纵轴", value: c.log, options: [["linear", "线性"], ["log", "对数"]], on: function (v) { upd("log", v, true); } }));
    add(picker({ key: "scheme", label: "配色", value: c.scheme, options: [["ledger", "账簿朱金"], ["indigo", "靛玉"], ["contrast", "高对比"]], on: function (v) { upd("scheme", v); } }));
    add(toggle({ label: "显示累计投入基准线", value: c.cost, on: function (v) { upd("cost", v); } }));
    add(toggle({ label: "显示通胀折算购买力", value: c.real, on: function (v) { upd("real", v); } }));
    add(toggle({ label: "显示波动区间与随机路径", value: c.band, on: function (v) { upd("band", v, true); } }));
    add(actions([
      { label: "重置", on: function () { c = Object.assign({}, cDef); save(); mountCompound(); W.toast("已恢复默认参数"); } },
      { label: "随机", cls: "btn-gold", on: function () {
          c.principal = Math.round(Math.random() * 20) * 5000;
          c.monthly = Math.round(Math.random() * 24) * 250;
          c.rate = Math.round((Math.random() * 16 + 2) * 2) / 2;
          c.years = 5 + Math.round(Math.random() * 35);
          c.vol = 10 + Math.round(Math.random() * 40);
          c.seed = 1 + Math.floor(Math.random() * 9998);
          save(); mountCompound(); W.toast("掷出一组新参数");
        } },
      { label: "导出图表 PNG", wide: true, on: function () {
          cChart.cv.toBlob(function (b) { W.download("复利模拟.png", b, "image/png"); W.toast("图表已导出"); });
        } },
      { label: "导出数据 CSV", wide: true, on: function () { W.download("复利模拟.csv", "\ufeff" + stage.dataset.csv, "text/csv;charset=utf-8"); W.toast("数据已导出"); } }
    ]));

    function buildCompoundStage() {
      stage.innerHTML = "";
      var p1 = panel("复利曲线", "同一终值、不同过程：主线是确定性复利，细线是同一种子下的随机路径。");
      cKpis = el("div"); p1.root.appendChild(cKpis);
      var box = el("div", "chart-box");
      var cv = document.createElement("canvas");
      var tip = el("div", "chart-tip");
      box.appendChild(cv); box.appendChild(tip);
      p1.root.appendChild(box);
      var sc = SCHEMES[c.scheme] || SCHEMES.ledger;
      p1.root.appendChild(legend([
        { name: "名义市值", color: sc.main }, { name: "累计投入", color: sc.cost, dash: true },
        { name: "实际购买力", color: sc.real }, { name: "随机路径 / ±1σ 区间", color: sc.path }
      ]));
      cNote = el("p", "mode-note"); p1.root.appendChild(cNote);
      stage.appendChild(p1.root);
      cChart = new Chart(cv, tip, 340);

      var p2 = panel("逐年账页", "复利的威力集中在后段——注意「收益占比」这一列什么时候超过一半。");
      cTable = el("table", "data-table");
      var scroll = el("div", "table-scroll");
      scroll.appendChild(cTable);
      p2.root.appendChild(scroll);
      stage.appendChild(p2.root);
    }
    buildCompoundStage();
    renderCompound(true);
  }

  /* ============ 模块二：注意力账本 ============ */
  var CATS = {
    growth: { name: "成长", color: P.jade },
    produce: { name: "生产", color: P.indigo },
    need: { name: "必要", color: P.gold },
    waste: { name: "消耗", color: P.vermilion }
  };
  var SEED_LEDGER = [
    { id: "s1", name: "深度工作：主线项目", min: 150, cat: "produce" },
    { id: "s2", name: "阅读与做笔记", min: 60, cat: "growth" },
    { id: "s3", name: "写作练习", min: 45, cat: "growth" },
    { id: "s4", name: "通勤", min: 70, cat: "need" },
    { id: "s5", name: "三餐与家务", min: 95, cat: "need" },
    { id: "s6", name: "刷热搜与短视频", min: 85, cat: "waste" },
    { id: "s7", name: "围观群里的争论", min: 40, cat: "waste" },
    { id: "s8", name: "会议与消息回复", min: 110, cat: "produce" },
    { id: "s9", name: "运动", min: 40, cat: "growth" },
    { id: "s10", name: "替别人的选择操心", min: 25, cat: "waste" }
  ];
  var aDef = { budget: 16, wage: 120, target: 120, filter: "all", sort: "desc", pitOnly: false };
  var a = Object.assign({}, aDef, saved.attention || {});
  var ledger = (saved.ledger || SEED_LEDGER).map(function (x) { return Object.assign({}, x); });
  var editingId = null, lastDeleted = null;
  var aRefs = {};

  function ledgerSave() { saved.ledger = ledger; saved.attention = a; W.write(KEY, saved); }
  function minutesBy(cat) { return ledger.filter(function (x) { return x.cat === cat; }).reduce(function (s, x) { return s + x.min; }, 0); }
  function renderLedger() {
    var total = ledger.reduce(function (s, x) { return s + x.min; }, 0);
    var growth = minutesBy("growth"), waste = minutesBy("waste");
    var budgetMin = a.budget * 60;
    aRefs.kpis.innerHTML = "";
    aRefs.kpis.appendChild(kpiRow([
      { label: "已记录", value: (total / 60).toFixed(1) + " h", color: P.indigo, soft: "rgba(35,74,118,.07)", note: "可支配 " + a.budget + " h" },
      { label: "成长时长", value: growth + " min", color: P.jade, soft: "rgba(44,122,91,.08)", note: growth >= a.target ? "已达成今日目标" : "距目标还差 " + (a.target - growth) + " min" },
      { label: "三大坑消耗", value: waste + " min", color: P.vermilion, note: "占已记录 " + (total ? (waste / total * 100).toFixed(0) : 0) + "%" },
      { label: "消耗的机会成本", value: "¥" + W.fmtNum(Math.round(waste / 60 * a.wage)), color: P.amber, soft: "rgba(207,122,28,.09)", note: "按时薪 ¥" + a.wage + " 折算" },
      { label: "尚未分配", value: Math.max(0, budgetMin - total) + " min", color: P.teal, soft: "rgba(21,127,127,.08)", note: total > budgetMin ? "已超出可支配时长" : "还可以安排给成长" }
    ]));
    // 堆叠条
    aRefs.bar.innerHTML = "";
    Object.keys(CATS).forEach(function (k) {
      var m = minutesBy(k);
      if (!m) return;
      var seg = el("div", "bar-seg");
      seg.style.width = (m / Math.max(budgetMin, total) * 100) + "%";
      seg.style.background = CATS[k].color;
      seg.title = CATS[k].name + " " + m + " 分钟";
      aRefs.bar.appendChild(seg);
    });
    aRefs.barNote.textContent = "一天的可支配时长 " + a.budget + " 小时；已记录 " + (total / 60).toFixed(1) + " 小时。成长目标 " + a.target + " 分钟。";
    // 列表
    var list = ledger.slice();
    if (a.filter !== "all") list = list.filter(function (x) { return x.cat === a.filter; });
    if (a.pitOnly) list = list.filter(function (x) { return x.cat === "waste"; });
    if (a.sort === "desc") list.sort(function (x, y) { return y.min - x.min; });
    if (a.sort === "asc") list.sort(function (x, y) { return x.min - y.min; });
    if (a.sort === "cat") list.sort(function (x, y) { return Object.keys(CATS).indexOf(x.cat) - Object.keys(CATS).indexOf(y.cat) || y.min - x.min; });
    aRefs.list.innerHTML = "";
    if (!list.length) {
      aRefs.list.appendChild(el("div", "empty", "没有符合条件的记录。换一个筛选，或在左侧添加一条。"));
    }
    list.forEach(function (item) {
      var row = el("div", "ledger-item");
      row.draggable = true; row.dataset.id = item.id;
      row.style.setProperty("--c", CATS[item.cat].color);
      row.appendChild(el("div", "ledger-dot"));
      var name = el("div", "ledger-name", item.name); name.title = item.name;
      row.appendChild(name);
      row.appendChild(el("div", "ledger-min", item.min + " min"));
      row.appendChild(el("div", "ledger-cat", CATS[item.cat].name));
      var ops = el("div", "ledger-ops");
      var edit = el("button", "icon-btn", "✎"); edit.type = "button"; edit.title = "编辑"; edit.setAttribute("aria-label", "编辑 " + item.name);
      edit.addEventListener("click", function () { startEdit(item); });
      var del = el("button", "icon-btn", "×"); del.type = "button"; del.title = "删除"; del.setAttribute("aria-label", "删除 " + item.name);
      del.addEventListener("click", function () { removeItem(item); });
      ops.appendChild(edit); ops.appendChild(del);
      row.appendChild(ops);
      row.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/plain", item.id); row.style.opacity = ".4"; });
      row.addEventListener("dragend", function () { row.style.opacity = ""; });
      row.addEventListener("dragover", function (e) { e.preventDefault(); row.style.borderColor = P.vermilion; });
      row.addEventListener("dragleave", function () { row.style.borderColor = ""; });
      row.addEventListener("drop", function (e) {
        e.preventDefault(); row.style.borderColor = "";
        var from = e.dataTransfer.getData("text/plain");
        if (!from || from === item.id) return;
        var i = ledger.findIndex(function (x) { return x.id === from; });
        var j = ledger.findIndex(function (x) { return x.id === item.id; });
        if (i < 0 || j < 0) return;
        ledger.splice(j, 0, ledger.splice(i, 1)[0]);
        a.sort = "manual"; ledgerSave(); renderLedger();
        if (aRefs.sortSel) aRefs.sortSel.value = "manual";
        W.toast("已调整顺序");
      });
      aRefs.list.appendChild(row);
    });
    stage.dataset.csv = "事项,分钟,分类\n" + ledger.map(function (x) { return '"' + x.name.replace(/"/g, '""') + '",' + x.min + "," + CATS[x.cat].name; }).join("\n");
  }
  function startEdit(item) {
    editingId = item.id;
    aRefs.name.value = item.name; aRefs.min.value = item.min; aRefs.cat.value = item.cat;
    aRefs.submit.textContent = "更新";
    aRefs.name.focus();
  }
  function removeItem(item) {
    var idx = ledger.findIndex(function (x) { return x.id === item.id; });
    if (idx < 0) return;
    lastDeleted = { item: item, idx: idx };
    ledger.splice(idx, 1);
    ledgerSave(); renderLedger();
    W.toast("已删除「" + item.name + "」", "撤销", function () {
      ledger.splice(lastDeleted.idx, 0, lastDeleted.item);
      ledgerSave(); renderLedger();
    });
  }
  function mountAttention() {
    clearCharts();
    railTitle.textContent = "注意力账本";
    railBox.innerHTML = "";
    function upd(k, v) { a[k] = v; ledgerSave(); renderLedger(); }
    railBox.appendChild(slider({ key: "budget", label: "每日可支配时长", min: 6, max: 24, step: 1, value: a.budget, fmt: function (v) { return v + " 小时"; }, on: function (v) { upd("budget", v); } }));
    railBox.appendChild(slider({ key: "wage", label: "你的时薪", min: 20, max: 1000, step: 10, value: a.wage, fmt: function (v) { return "¥" + v; }, hint: "用来把消耗换算成钱。", on: function (v) { upd("wage", v); } }));
    railBox.appendChild(slider({ key: "target", label: "每日成长目标", min: 0, max: 360, step: 15, value: a.target, fmt: function (v) { return v + " 分钟"; }, on: function (v) { upd("target", v); } }));
    var chips = el("div", "ctrl");
    chips.appendChild(el("label", null, "分类筛选"));
    var chipBox = el("div", "chips");
    [["all", "全部"]].concat(Object.keys(CATS).map(function (k) { return [k, CATS[k].name]; })).forEach(function (op) {
      var b = el("button", "chip", op[1]); b.type = "button";
      b.setAttribute("aria-pressed", a.filter === op[0] ? "true" : "false");
      b.addEventListener("click", function () {
        a.filter = op[0];
        Array.prototype.forEach.call(chipBox.children, function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        ledgerSave(); renderLedger();
      });
      chipBox.appendChild(b);
    });
    chips.appendChild(chipBox);
    railBox.appendChild(chips);
    aRefs.sortSel = null;
    var sortPick = picker({ key: "sort", label: "排序", value: a.sort, options: [["desc", "时长从多到少"], ["asc", "时长从少到多"], ["cat", "按分类"], ["manual", "手动拖拽顺序"]], on: function (v) { upd("sort", v); } });
    aRefs.sortSel = sortPick.querySelector("select");
    railBox.appendChild(sortPick);
    railBox.appendChild(toggle({ label: "只看三大坑", value: a.pitOnly, hint: "凑热闹 / 随大流 / 操别人的心。", on: function (v) { upd("pitOnly", v); } }));

    var form = el("div", "ctrl");
    form.appendChild(el("label", null, "添加 / 编辑一条")).setAttribute("for", "led-name");
    aRefs.name = document.createElement("input"); aRefs.name.type = "text"; aRefs.name.placeholder = "这段时间做了什么";
    aRefs.name.id = "led-name"; aRefs.name.name = "led-name"; aRefs.name.setAttribute("aria-label", "这段时间做了什么");
    aRefs.min = document.createElement("input"); aRefs.min.type = "number"; aRefs.min.min = 1; aRefs.min.max = 1440; aRefs.min.value = 30;
    aRefs.min.id = "led-min"; aRefs.min.name = "led-min"; aRefs.min.setAttribute("aria-label", "花费分钟数");
    aRefs.cat = document.createElement("select");
    aRefs.cat.id = "led-cat"; aRefs.cat.name = "led-cat"; aRefs.cat.setAttribute("aria-label", "注意力类别");
    Object.keys(CATS).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = CATS[k].name; aRefs.cat.appendChild(o); });
    aRefs.submit = el("button", "btn btn-primary btn-sm", "添加"); aRefs.submit.type = "button";
    form.appendChild(aRefs.name);
    var mini = el("div", "ledger-form");
    mini.style.gridTemplateColumns = "1fr 1fr";
    mini.appendChild(aRefs.min); mini.appendChild(aRefs.cat);
    form.appendChild(mini);
    form.appendChild(aRefs.submit);
    aRefs.submit.addEventListener("click", function () {
      var name = aRefs.name.value.trim();
      var min = Math.max(1, Math.min(1440, Number(aRefs.min.value) || 0));
      if (!name) { W.toast("先写下这段时间做了什么"); aRefs.name.focus(); return; }
      if (editingId) {
        var it = ledger.find(function (x) { return x.id === editingId; });
        if (it) { it.name = name; it.min = min; it.cat = aRefs.cat.value; }
        editingId = null; aRefs.submit.textContent = "添加";
        W.toast("已更新");
      } else {
        ledger.push({ id: "u" + Date.now().toString(36), name: name, min: min, cat: aRefs.cat.value });
        W.toast("已记入账本");
      }
      aRefs.name.value = ""; ledgerSave(); renderLedger();
    });
    aRefs.name.addEventListener("keydown", function (e) { if (e.key === "Enter") aRefs.submit.click(); });
    railBox.appendChild(form);
    railBox.appendChild(actions([
      { label: "恢复示例", on: function () { ledger = SEED_LEDGER.map(function (x) { return Object.assign({}, x); }); ledgerSave(); renderLedger(); W.toast("已恢复示例账本"); } },
      { label: "清空", on: function () {
          var backup = ledger.slice();
          ledger = []; ledgerSave(); renderLedger();
          W.toast("账本已清空", "撤销", function () { ledger = backup; ledgerSave(); renderLedger(); });
        } },
      { label: "导出 CSV", wide: true, cls: "btn-gold", on: function () { W.download("注意力账本.csv", "\ufeff" + stage.dataset.csv, "text/csv;charset=utf-8"); W.toast("账本已导出"); } }
    ]));

    stage.innerHTML = "";
    var p = panel("今天，注意力去了哪里", "先看见，才谈得上改变。拖动条目可以调整顺序。");
    aRefs.kpis = el("div"); p.root.appendChild(aRefs.kpis);
    aRefs.bar = el("div", "bar-track"); p.root.appendChild(aRefs.bar);
    aRefs.barNote = el("p", "mode-note"); p.root.appendChild(aRefs.barNote);
    p.root.appendChild(legend(Object.keys(CATS).map(function (k) { return { name: CATS[k].name, color: CATS[k].color }; })));
    aRefs.list = el("div", "ledger-list");
    p.root.appendChild(aRefs.list);
    stage.appendChild(p.root);
    renderLedger();
  }

  /* ============ 模块三：个人商业模式画布 ============ */
  var mDef = { wage: 120, hours: 8, days: 250, build: 200, price: 99, copies: 800, marginal: 8, buyHours: 200, otherWage: 60, lift: 2 };
  var m = Object.assign({}, mDef, saved.model || {});
  var mRefs = {}, mChart = null;
  function mountModel() {
    clearCharts();
    railTitle.textContent = "商业模式画布";
    railBox.innerHTML = "";
    function upd(k, v) { m[k] = v; save(); renderModel(); }
    railBox.appendChild(slider({ key: "wage", label: "你的时薪", min: 20, max: 1000, step: 10, value: m.wage, fmt: function (v) { return "¥" + v; }, on: function (v) { upd("wage", v); } }));
    railBox.appendChild(slider({ key: "hours", label: "每天可售小时", min: 1, max: 14, step: .5, value: m.hours, fmt: function (v) { return v + " h"; }, on: function (v) { upd("hours", v); } }));
    railBox.appendChild(slider({ key: "days", label: "每年工作天数", min: 100, max: 365, step: 5, value: m.days, fmt: function (v) { return v + " 天"; }, on: function (v) { upd("days", v); } }));
    railBox.appendChild(slider({ key: "build", label: "作品制作耗时", min: 10, max: 2000, step: 10, value: m.build, fmt: function (v) { return v + " h"; }, hint: "写一本书、做一门课、写一套模板的一次性投入。", on: function (v) { upd("build", v); } }));
    railBox.appendChild(slider({ key: "price", label: "作品单价", min: 0, max: 2000, step: 1, value: m.price, fmt: function (v) { return "¥" + v; }, on: function (v) { upd("price", v); } }));
    railBox.appendChild(slider({ key: "copies", label: "年销售份数", min: 0, max: 20000, step: 50, value: m.copies, fmt: function (v) { return W.fmtNum(v) + " 份"; }, on: function (v) { upd("copies", v); } }));
    railBox.appendChild(slider({ key: "marginal", label: "边际成本率", min: 0, max: 60, step: 1, value: m.marginal, fmt: function (v) { return v + "%"; }, hint: "渠道分成、印制、履约等每份都要付的成本。", on: function (v) { upd("marginal", v); } }));
    railBox.appendChild(slider({ key: "buyHours", label: "每年购买他人小时", min: 0, max: 2000, step: 20, value: m.buyHours, fmt: function (v) { return v + " h"; }, on: function (v) { upd("buyHours", v); } }));
    railBox.appendChild(slider({ key: "otherWage", label: "对方时薪", min: 20, max: 500, step: 5, value: m.otherWage, fmt: function (v) { return "¥" + v; }, on: function (v) { upd("otherWage", v); } }));
    railBox.appendChild(slider({ key: "lift", label: "释放后的产出倍数", min: 1, max: 5, step: .1, value: m.lift, fmt: function (v) { return v.toFixed(1) + "×"; }, hint: "买来的时间让你把精力放在更高价值的产出上。", on: function (v) { upd("lift", v); } }));
    railBox.appendChild(actions([
      { label: "重置", on: function () { m = Object.assign({}, mDef); save(); mountModel(); W.toast("已恢复默认参数"); } },
      { label: "随机", cls: "btn-gold", on: function () {
          m.wage = 40 + Math.round(Math.random() * 40) * 10;
          m.price = 19 + Math.round(Math.random() * 60) * 5;
          m.copies = Math.round(Math.random() * 60) * 50;
          m.build = 40 + Math.round(Math.random() * 60) * 10;
          m.buyHours = Math.round(Math.random() * 40) * 20;
          save(); mountModel(); W.toast("掷出一组新参数");
        } },
      { label: "导出对比 CSV", wide: true, on: function () { W.download("商业模式对比.csv", "\ufeff" + stage.dataset.csv, "text/csv;charset=utf-8"); W.toast("已导出"); } }
    ]));

    stage.innerHTML = "";
    var p = panel("三种个人商业模式", "收入的量级差异主要来自模式差异，而不是努力程度差异。");
    mRefs.cards = el("div", "canvas-grid"); p.root.appendChild(mRefs.cards);
    mRefs.note = el("p", "mode-note"); p.root.appendChild(mRefs.note);
    stage.appendChild(p.root);
    var p2 = panel("年收入结构对比", "柱高为年收入；模式二已扣除机会成本，模式三为净套利。");
    var box = el("div", "chart-box");
    var cv = document.createElement("canvas"); var tip = el("div", "chart-tip");
    box.appendChild(cv); box.appendChild(tip);
    p2.root.appendChild(box);
    stage.appendChild(p2.root);
    mChart = new Chart(cv, tip, 280);
    renderModel();
  }
  function renderModel() {
    var one = m.wage * m.hours * m.days;
    var grossTwo = m.price * m.copies;
    var netTwo = grossTwo * (1 - m.marginal / 100);
    var opp = m.build * m.wage;
    var profitTwo = netTwo - opp;
    var effWage = m.build > 0 ? netTwo / m.build : 0;
    var three = m.buyHours * (m.wage * m.lift - m.otherWage);
    mRefs.cards.innerHTML = "";
    var defs = [
      { t: "模式一 · 一份时间卖一次", s: "打工、按小时接单。收入 = 时薪 × 小时 × 天数。", v: one, c: P.indigo, cs: "rgba(35,74,118,.10)",
        n: "年可售 " + W.fmtNum(m.hours * m.days) + " 小时。天花板由体力与时间锁死，提高只能靠单价。" },
      { t: "模式二 · 同一份时间卖很多次", s: "写作、课程、模板、软件。一次投入，无限复制。", v: netTwo, c: P.vermilion, cs: "rgba(195,53,43,.10)",
        n: "毛收入 ¥" + W.fmtMoney(grossTwo) + "，扣边际成本后 ¥" + W.fmtMoney(netTwo) + "；减去制作机会成本 ¥" + W.fmtMoney(opp) + "，首年净 ¥" + W.fmtMoney(profitTwo) + "。等效时薪 ¥" + W.fmtNum(Math.round(effWage)) + "。" },
      { t: "模式三 · 买别人的时间", s: "花钱买回注意力，投向更高价值的产出。", v: three, c: P.jade, cs: "rgba(44,122,91,.10)",
        n: "买入 " + m.buyHours + " 小时 × (你的时薪 × " + m.lift.toFixed(1) + " − 对方时薪 ¥" + m.otherWage + ")。当括号里为负，这笔购买就是亏的。" }
    ];
    defs.forEach(function (d) {
      var card = el("div", "mode-card");
      card.style.setProperty("--m", d.c); card.style.setProperty("--ms", d.cs);
      card.appendChild(el("h3", null, d.t));
      card.appendChild(el("p", "mode-sub", d.s));
      var v = el("div", "mode-val", "¥" + W.fmtMoney(d.v));
      card.appendChild(v);
      card.appendChild(el("div", "mode-unit", d.t.indexOf("二") > 0 ? "年净收入（未扣机会成本）" : "年收入"));
      card.appendChild(el("p", "mode-note", d.n));
      mRefs.cards.appendChild(card);
    });
    var notes = [];
    if (effWage > m.wage) notes.push("作品的等效时薪已经高于你的打工时薪 " + (effWage / m.wage).toFixed(1) + " 倍——这就是杠杆");
    else notes.push("作品的等效时薪还低于打工时薪，需要提高份数或单价，而不是再多花时间");
    if (three < 0) notes.push("买时间目前为负收益：对方时薪高于你释放出来的产出价值");
    if (profitTwo < 0) notes.push("首年净额为负是正常的——作品的收益从第二年开始不再重复付制作成本");
    mRefs.note.textContent = notes.join("；") + "。";
    mChart.custom = function (ch) { paintBars(ch, [one, netTwo, profitTwo, three], [P.indigo, P.vermilion, P.gold, P.jade]); };
    mChart.resize();
    mChart.paint();
    stage.dataset.csv = "模式,年收入\n模式一," + Math.round(one) + "\n模式二(净收入)," + Math.round(netTwo) +
      "\n模式二(首年扣机会成本)," + Math.round(profitTwo) + "\n模式三," + Math.round(three);
  }
  function paintBars(chart, values, colors) {
    var ctx = chart.ctx, w = chart.w, h = chart.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fffcf5"; ctx.fillRect(0, 0, w, h);
    var l = 62, r = 16, t = 18, b = 40;
    if (w < 460) l = 50;
    var gw = w - l - r, gh = h - t - b;
    var hi = Math.max.apply(null, values.concat([1]));
    var lo = Math.min.apply(null, values.concat([0]));
    var ticks = niceTicks(lo, hi * 1.12, 4);
    hi = Math.max(hi * 1.12, ticks[ticks.length - 1] || hi);
    var Y = function (v) { return t + gh - (v - lo) / (hi - lo) * gh; };
    ctx.font = '10px "JetBrains Mono", Menlo, monospace';
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ticks.forEach(function (v) {
      var y = Math.round(Y(v)) + .5;
      ctx.strokeStyle = "rgba(120,96,60,.16)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(l + gw, y); ctx.stroke();
      ctx.fillStyle = "#8c8071"; ctx.fillText(W.fmtMoney(v), l - 8, y);
    });
    var zero = Y(0);
    ctx.strokeStyle = "rgba(120,96,60,.45)";
    ctx.beginPath(); ctx.moveTo(l, zero); ctx.lineTo(l + gw, zero); ctx.stroke();
    var slot = gw / values.length, bw = Math.min(76, slot * .56);
    var names = ["模式一", "模式二", "模式二·首年净", "模式三"];
    ctx.textAlign = "center";
    values.forEach(function (v, i) {
      var x = l + slot * i + slot / 2 - bw / 2;
      var y = Y(Math.max(v, 0)), bh = Math.abs(Y(v) - zero);
      var grd = ctx.createLinearGradient(0, y, 0, y + bh);
      grd.addColorStop(0, colors[i]); grd.addColorStop(1, colors[i] + "99");
      ctx.fillStyle = grd;
      ctx.beginPath();
      var rr = 6;
      ctx.moveTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr);
      ctx.lineTo(x + bw - rr, y); ctx.arcTo(x + bw, y, x + bw, y + rr, rr);
      ctx.lineTo(x + bw, y + bh); ctx.lineTo(x, y + bh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#414a58"; ctx.textBaseline = "bottom";
      ctx.font = '11px "JetBrains Mono", Menlo, monospace';
      ctx.fillText("¥" + W.fmtMoney(v), x + bw / 2, y - 5);
      ctx.fillStyle = "#6f7887"; ctx.textBaseline = "top";
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(names[i], x + bw / 2, t + gh + 10);
    });
    chart.cv.onpointermove = null;
    if (chart.tip) chart.tip.classList.remove("on");
  }

  /* ============ 模块四：成长率对比 ============ */
  var gDef = { you0: 10, youR: 12, other0: 40, otherR: 5, accel: 6, years: 15, third: false, thirdR: 20, log: "linear" };
  var g = Object.assign({}, gDef, saved.growth || {});
  var gChart = null, gKpis = null, gTable = null, gNote = null;
  function seriesFor(start, rate, accel, years) {
    var out = [start], v = start, r = rate;
    for (var y = 1; y <= years; y++) {
      v = v * (1 + r / 100);
      out.push(v);
      r = r * (1 + accel / 100);
    }
    return out;
  }
  function mountGrowth() {
    clearCharts();
    railTitle.textContent = "成长率对比";
    railBox.innerHTML = "";
    function upd(k, v) { g[k] = v; save(); renderGrowth(); }
    railBox.appendChild(slider({ key: "you0", label: "你的起点", min: 1, max: 100, step: 1, value: g.you0, on: function (v) { upd("you0", v); } }));
    railBox.appendChild(slider({ key: "youR", label: "你的成长率", min: 0, max: 60, step: 1, value: g.youR, fmt: function (v) { return v + "%"; }, on: function (v) { upd("youR", v); } }));
    railBox.appendChild(slider({ key: "accel", label: "成长率的加速度", min: 0, max: 20, step: 1, value: g.accel, fmt: function (v) { return v + "%"; }, hint: "成长率本身每年提高多少——这是比成长率更重要的一层。", on: function (v) { upd("accel", v); } }));
    railBox.appendChild(slider({ key: "other0", label: "对照者起点", min: 1, max: 200, step: 1, value: g.other0, on: function (v) { upd("other0", v); } }));
    railBox.appendChild(slider({ key: "otherR", label: "对照者成长率", min: 0, max: 40, step: 1, value: g.otherR, fmt: function (v) { return v + "%"; }, on: function (v) { upd("otherR", v); } }));
    railBox.appendChild(slider({ key: "years", label: "观察年限", min: 3, max: 30, step: 1, value: g.years, fmt: function (v) { return v + " 年"; }, on: function (v) { upd("years", v); } }));
    railBox.appendChild(toggle({ label: "加入第三个对照者", value: g.third, on: function (v) { upd("third", v); } }));
    railBox.appendChild(slider({ key: "thirdR", label: "第三者成长率", min: 0, max: 60, step: 1, value: g.thirdR, fmt: function (v) { return v + "%"; }, hint: "起点与你相同。", on: function (v) { upd("thirdR", v); } }));
    railBox.appendChild(picker({ key: "log", label: "纵轴", value: g.log, options: [["linear", "线性"], ["log", "对数"]], on: function (v) { upd("log", v); } }));
    railBox.appendChild(actions([
      { label: "重置", on: function () { g = Object.assign({}, gDef); save(); mountGrowth(); W.toast("已恢复默认参数"); } },
      { label: "随机", cls: "btn-gold", on: function () {
          g.youR = 4 + Math.round(Math.random() * 30); g.accel = Math.round(Math.random() * 14);
          g.otherR = 2 + Math.round(Math.random() * 14); g.other0 = 10 + Math.round(Math.random() * 90);
          save(); mountGrowth(); W.toast("掷出一组新参数");
        } },
      { label: "导出 CSV", wide: true, on: function () { W.download("成长率对比.csv", "\ufeff" + stage.dataset.csv, "text/csv;charset=utf-8"); W.toast("已导出"); } }
    ]));
    stage.innerHTML = "";
    var p = panel("斜率决定长期位置", "起点差几倍不要紧，成长率差几个点，时间会把它放大成物种差异。");
    gKpis = el("div"); p.root.appendChild(gKpis);
    var box = el("div", "chart-box");
    var cv = document.createElement("canvas"); var tip = el("div", "chart-tip");
    box.appendChild(cv); box.appendChild(tip); p.root.appendChild(box);
    p.root.appendChild(legend([{ name: "你（成长率会加速）", color: P.vermilion }, { name: "对照者（固定成长率）", color: P.indigo, dash: true }, { name: "第三者", color: P.plum }]));
    gNote = el("p", "mode-note"); p.root.appendChild(gNote);
    stage.appendChild(p.root);
    var p2 = panel("逐年数值", "注意「你 / 对照」这一列什么时候越过 1。");
    gTable = el("table", "data-table");
    var sc = el("div", "table-scroll"); sc.appendChild(gTable); p2.root.appendChild(sc);
    stage.appendChild(p2.root);
    gChart = new Chart(cv, tip, 330);
    renderGrowth();
  }
  function renderGrowth() {
    var xs = []; for (var i = 0; i <= g.years; i++) xs.push(i);
    var you = seriesFor(g.you0, g.youR, g.accel, g.years);
    var other = seriesFor(g.other0, g.otherR, 0, g.years);
    var third = seriesFor(g.you0, g.thirdR, 0, g.years);
    var cross = 0;
    for (var k = 1; k <= g.years; k++) { if (!cross && you[k] >= other[k]) cross = k; }
    var endRate = g.youR * Math.pow(1 + g.accel / 100, g.years);
    gKpis.innerHTML = "";
    gKpis.appendChild(kpiRow([
      { label: g.years + " 年后的你", value: you[g.years].toFixed(1), color: P.vermilion, note: "起点 " + g.you0 },
      { label: "同期对照者", value: other[g.years].toFixed(1), color: P.indigo, soft: "rgba(35,74,118,.07)", note: "起点 " + g.other0 },
      { label: "反超年份", value: cross ? "第 " + cross + " 年" : "尚未反超", color: P.jade, soft: "rgba(44,122,91,.08)", note: cross ? "此后差距持续扩大" : "提高成长率或加速度试试" },
      { label: "你末年的成长率", value: endRate.toFixed(1) + "%", color: P.gold, soft: "rgba(210,154,42,.10)", note: "起始 " + g.youR + "% · 加速 " + g.accel + "%" },
      { label: "领先倍数", value: (you[g.years] / other[g.years]).toFixed(2) + "×", color: P.plum, soft: "rgba(138,53,96,.08)", note: "终点比值" }
    ]));
    gChart.set({
      xs: xs, log: g.log === "log",
      series: [
        { name: "你", color: P.vermilion, ys: you, fill: "rgba(195,53,43,.18)", width: 2.6 },
        { name: "对照者", color: P.indigo, ys: other, dash: [6, 4], width: 1.9 },
        { name: "第三者", color: P.plum, ys: third, width: 1.6, hidden: !g.third }
      ],
      xFmt: function (v) { return v + "年"; },
      yFmt: function (v) { return v >= 1000 ? W.fmtMoney(v) : v.toFixed(v < 10 ? 1 : 0); }
    }, true);
    gNote.textContent = (cross
      ? "第 " + cross + " 年你追上对照者，到第 " + g.years + " 年领先 " + (you[g.years] / other[g.years]).toFixed(2) + " 倍"
      : "在 " + g.years + " 年内还没有追上——把加速度调高一点，看看时间需要多久")
      + "。成长率本身在加速时，曲线不是指数，而是比指数更陡。";
    var rows = ["<tr><th>年份</th><th>你</th><th>对照者</th><th>你 / 对照</th><th>你当年成长率</th></tr>"];
    var r = g.youR;
    for (var y = 0; y <= g.years; y++) {
      rows.push("<tr><td>第 " + y + " 年</td><td><strong>" + you[y].toFixed(2) + "</strong></td><td>" + other[y].toFixed(2) +
        "</td><td>" + (you[y] / other[y]).toFixed(2) + "×</td><td>" + (y === 0 ? "—" : r.toFixed(1) + "%") + "</td></tr>");
      r = r * (1 + g.accel / 100);
    }
    gTable.innerHTML = rows.join("");
    var csv = ["年份,你,对照者,第三者"];
    for (var z = 0; z <= g.years; z++) csv.push([z, you[z].toFixed(3), other[z].toFixed(3), third[z].toFixed(3)].join(","));
    stage.dataset.csv = csv.join("\n");
  }

  /* ============ 装载 ============ */
  function save() {
    saved.compound = c; saved.attention = a; saved.ledger = ledger; saved.model = m; saved.growth = g;
    W.write(KEY, saved);
  }
  var MOUNT = { compound: mountCompound, attention: mountAttention, model: mountModel, growth: mountGrowth };
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  function activate(name, push) {
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.mod === name ? "true" : "false"); });
    if (!MOUNT[name]) name = "compound";
    MOUNT[name]();
    saved.mod = name; W.write(KEY, saved);
    if (push && history.replaceState) history.replaceState(null, "", "#" + name);
  }
  tabs.forEach(function (t) { t.addEventListener("click", function () { activate(t.dataset.mod, true); }); });
  var initial = (location.hash || "").replace("#", "");
  activate(MOUNT[initial] ? initial : (saved.mod || "compound"), false);
  window.addEventListener("hashchange", function () {
    var n = (location.hash || "").replace("#", "");
    if (MOUNT[n]) activate(n, false);
  });
})();