// 站点交互 · 财富自由之路 · wealth course
(function () {
  "use strict";

  var body = document.body;
  var page = body.getAttribute("data-page") || "";
  var isHome = page === "index";
  var STORE = "wealth-progress";
  var READ = "wealth-read";

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* ---------- 移动端抽屉 ---------- */
  var toggle = document.getElementById("nav-toggle");
  var closeBtn = document.getElementById("nav-close");
  var overlay = document.getElementById("nav-overlay");

  function setNav(open) {
    body.classList.toggle("nav-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (toggle) toggle.addEventListener("click", function () { setNav(!body.classList.contains("nav-open")); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setNav(false); });
  if (overlay) overlay.addEventListener("click", function () { setNav(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  Array.prototype.forEach.call(document.querySelectorAll(".sidebar .nav-link"), function (a) {
    a.addEventListener("click", function () { setNav(false); });
  });

  /* ---------- 阅读进度 ---------- */
  var bar = document.getElementById("read-progress");
  function progress() {
    if (!bar) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var r = h > 0 ? window.scrollY / h : 0;
    bar.style.width = Math.min(100, Math.max(0, r * 100)) + "%";
  }
  window.addEventListener("scroll", progress, { passive: true });
  window.addEventListener("resize", progress);
  progress();

  /* ---------- 本页目录 ---------- */
  var toc = document.getElementById("toc-list");
  var article = document.querySelector(".article");
  if (toc && article) {
    var headings = Array.prototype.slice.call(article.querySelectorAll("h2, h3"));
    var used = {};
    headings.forEach(function (h) {
      if (!h.id) {
        var base = (h.textContent || "sec").toLowerCase()
          .replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fff-]/g, "").slice(0, 46) || "sec";
        var id = base, n = 2;
        while (used[id]) { id = base + "-" + n; n += 1; }
        used[id] = true; h.id = id;
      }
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.replace(/#$/, "").trim();
      if (h.tagName === "H3") a.className = "sub";
      a.dataset.target = h.id;
      toc.appendChild(a);
    });
    var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
    var ticking = false;
    function spy() {
      ticking = false;
      var cur = null;
      headings.forEach(function (h) { if (h.getBoundingClientRect().top <= 140) cur = h.id; });
      links.forEach(function (a) { a.classList.toggle("active", a.dataset.target === cur); });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(spy); }
    }, { passive: true });
    spy();
  }

  /* ---------- 继续上次 / 已读标记 ---------- */
  var resume = document.getElementById("resume");
  if (isHome) {
    var saved = read(STORE, null);
    if (resume && saved && saved.href) {
      resume.hidden = false;
      var label = resume.querySelector("span");
      if (label) label.textContent = saved.title || saved.href;
      resume.setAttribute("href", saved.href);
    }
  } else if (page && body.getAttribute("data-track") !== "off") {
    write(STORE, { href: "zh/" + page + ".html", title: body.getAttribute("data-title") || document.title });
    var seen0 = read(READ, []);
    if (seen0.indexOf(page) === -1) { seen0.push(page); write(READ, seen0); }
  }
  var seen = read(READ, []);
  Array.prototype.forEach.call(document.querySelectorAll(".nav-link"), function (a) {
    var href = (a.getAttribute("href") || "").split("/").pop().replace(/\.html$/, "");
    if (seen.indexOf(href) !== -1) a.classList.add("is-read");
  });
  var readCount = document.getElementById("read-count");
  if (readCount) {
    var n = seen.filter(function (s) { return /^lesson-\d\d$/.test(s); }).length;
    readCount.textContent = String(n);
  }

  /* ---------- 滚动揭示 ---------- */
  var rises = Array.prototype.slice.call(document.querySelectorAll(".rise"));
  if (rises.length) {
    if (!("IntersectionObserver" in window)) {
      rises.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var d = Number(en.target.dataset.delay || 0);
            window.setTimeout(function () { en.target.classList.add("in"); }, d);
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: .06 });
      rises.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- 共享工具 ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg, actionLabel, action) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.replaceChildren();
    var span = document.createElement("span");
    span.textContent = msg;
    toastEl.appendChild(span);
    if (actionLabel && action) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = actionLabel;
      btn.addEventListener("click", function () { action(); hideToast(); });
      toastEl.appendChild(btn);
    }
    toastEl.classList.add("on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, actionLabel ? 6500 : 2600);
  }
  function hideToast() { if (toastEl) toastEl.classList.remove("on"); }

  function download(name, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function trim(x) { return x.replace(/\.0+$/, ""); }
  function fmtMoney(v) {
    var a = Math.abs(v);
    if (a >= 1e8) return trim((v / 1e8).toFixed(2)) + " 亿";
    if (a >= 1e4) return trim((v / 1e4).toFixed(a >= 1e6 ? 0 : 1)) + " 万";
    return Math.round(v).toLocaleString("zh-CN");
  }
  function fmtNum(v, d) { return Number(v).toLocaleString("zh-CN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }

  window.WEALTH = {
    read: read, write: write, toast: toast, hideToast: hideToast,
    download: download, fmtMoney: fmtMoney, fmtNum: fmtNum,
    palette: {
      vermilion: "#c3352b", gold: "#d29a2a", jade: "#2c7a5b", indigo: "#234a76",
      electric: "#1668c4", plum: "#8a3560", amber: "#cf7a1c", teal: "#157f7f",
      ink: "#1c2028", ink3: "#6f7887", line: "rgba(120,96,60,.22)", paper: "#fffcf5"
    }
  };
})();