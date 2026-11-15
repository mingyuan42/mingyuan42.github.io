// 站点交互 · 海龟交易法则 · turtle course
(function () {
  "use strict";

  var body = document.body;
  var lang = body.getAttribute("data-lang") || "zh";
  var page = body.getAttribute("data-page") || "";
  var isHome = page === "index";
  var storeKey = "turtle-progress-" + lang;
  var readKey = "turtle-read-" + lang;

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage may be unavailable */ }
  }

  /* ---------- mobile navigation ---------- */

  var toggle = document.getElementById("nav-toggle");
  var close = document.getElementById("nav-close");
  var overlay = document.getElementById("nav-overlay");

  function setNav(open) {
    body.classList.toggle("nav-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (toggle) toggle.addEventListener("click", function () { setNav(!body.classList.contains("nav-open")); });
  if (close) close.addEventListener("click", function () { setNav(false); });
  if (overlay) overlay.addEventListener("click", function () { setNav(false); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setNav(false);
  });

  /* ---------- reading progress ---------- */

  var bar = document.getElementById("read-progress");
  function progress() {
    if (!bar) return;
    var height = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = height > 0 ? window.scrollY / height : 0;
    bar.style.width = Math.min(100, Math.max(0, ratio * 100)) + "%";
  }
  window.addEventListener("scroll", progress, { passive: true });
  window.addEventListener("resize", progress);
  progress();

  /* ---------- table of contents ---------- */

  var toc = document.getElementById("toc-list");
  var article = document.querySelector(".article");
  if (toc && article) {
    var headings = Array.prototype.slice.call(article.querySelectorAll("h2, h3"));
    var used = {};
    headings.forEach(function (heading, index) {
      if (!heading.id) {
        var base = (heading.textContent || "section")
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w\u4e00-\u9fff-]/g, "")
          .slice(0, 48) || "section";
        var id = base;
        var n = 2;
        while (used[id]) { id = base + "-" + n; n += 1; }
        used[id] = true;
        heading.id = id;
      }
      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent.replace(/#$/, "").trim();
      if (heading.tagName === "H3") link.className = "sub";
      link.dataset.target = heading.id;
      toc.appendChild(link);
      heading.dataset.tocIndex = String(index);
    });

    var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
    var ticking = false;

    function spy() {
      ticking = false;
      var current = null;
      headings.forEach(function (heading) {
        if (heading.getBoundingClientRect().top <= 150) current = heading.id;
      });
      links.forEach(function (link) {
        link.classList.toggle("active", link.dataset.target === current);
      });
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(spy);
      }
    }, { passive: true });
    spy();
  }

  /* ---------- resume and visited state ---------- */

  var resume = document.getElementById("resume");

  if (isHome) {
    var saved = read(storeKey, null);
    if (resume && saved && saved.href) {
      resume.hidden = false;
      var label = resume.querySelector("span");
      if (label) label.textContent = saved.title || saved.href;
      resume.setAttribute("href", saved.href);
    }
  } else if (page) {
    var title = body.getAttribute("data-title") || document.title;
    write(storeKey, { href: page + ".html", title: title });
    var seen = read(readKey, []);
    if (seen.indexOf(page) === -1) {
      seen.push(page);
      write(readKey, seen);
    }
  }

  var seenPages = read(readKey, []);
  Array.prototype.forEach.call(document.querySelectorAll(".nav-link"), function (link) {
    var href = (link.getAttribute("href") || "").replace(/\.html$/, "");
    if (seenPages.indexOf(href) !== -1) link.classList.add("is-read");
  });
})();
