/* 定投改变命运 · 工具页交互（练习册 / 卡片 / 复习计划）
 * 从独立站点 site.js 抽出工具相关逻辑，自包含，使用独立 localStorage 键。
 * 课程外壳的进度、导航、目录高亮由 Astro CourseRuntime 负责，此处不重复。 */
(function () {
  "use strict";

  var doc = document;
  var KEY = "dca:tools";
  var CARD_TOTAL = 42;
  var DAY_TOTAL = 21;

  var state = {
    cards: {},
    marks: {},
    exam: {},
    rubric: [0, 0, 0, 0],
    days: []
  };

  try {
    var raw = window.localStorage.getItem(KEY);
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        ["cards", "marks", "exam"].forEach(function (k) {
          if (saved[k] && typeof saved[k] === "object") state[k] = saved[k];
        });
        if (Array.isArray(saved.rubric)) state.rubric = saved.rubric.slice(0, 4);
        if (Array.isArray(saved.days)) state.days = saved.days;
      }
    }
  } catch (error) { /* 隐私模式下仍可阅读 */ }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) {}
  }
  function all(selector, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(selector)); }
  function inList(list, value) { return list.indexOf(value) !== -1; }
  function knownCards() { return Object.keys(state.cards).filter(function (id) { return state.cards[id] === "known"; }).length; }
  function againCards() { return Object.keys(state.cards).filter(function (id) { return state.cards[id] === "again"; }).length; }
  function examScore() { return Object.keys(state.exam).filter(function (id) { return state.exam[id]; }).length * 5; }

  /* ---------- 练习册：模块自测自评 ---------- */
  function paintModuleCounts() {
    all("[data-module-count]").forEach(function (el) {
      var prefix = el.getAttribute("data-module-count");
      var total = Number(el.getAttribute("data-module-total") || 6);
      var count = 0;
      for (var i = 1; i <= total; i++) if (state.marks[prefix + "-" + i]) count++;
      el.textContent = "答对 " + count + " / " + total;
    });
  }
  all(".mark-btn[data-mark]").forEach(function (button) {
    var id = button.getAttribute("data-mark");
    function paint() {
      var on = !!state.marks[id];
      button.setAttribute("aria-pressed", String(on));
      button.textContent = on ? "✓ 答对了" : "我答对了";
      var card = button.closest(".q-card");
      if (card) card.classList.toggle("is-right", on);
    }
    button.addEventListener("click", function () {
      if (state.marks[id]) delete state.marks[id]; else state.marks[id] = true;
      save(); paint(); paintModuleCounts();
    });
    paint();
  });
  paintModuleCounts();

  /* ---------- 综合测验计分 ---------- */
  var examScoreEl = doc.getElementById("exam-score");
  var examVerdictEl = doc.getElementById("exam-verdict");
  function verdictFor(score) {
    if (score >= 90) return "已经讲得通透：挑一课讲给同事听，检验是否真懂。";
    if (score >= 75) return "基本掌握：把错题重做一遍，再讲给别人听。";
    if (score >= 60) return "还不够稳：回到讲义，重读每课的「核心结论」。";
    return "先别急着测验：把 21 课复盘一遍，每天 10 分钟。";
  }
  function paintExam() {
    if (!examScoreEl) return;
    var score = examScore();
    examScoreEl.textContent = String(score);
    if (examVerdictEl) examVerdictEl.textContent = verdictFor(score);
  }
  all(".mark-btn[data-exam]").forEach(function (button) {
    var id = button.getAttribute("data-exam");
    function paint() {
      var on = !!state.exam[id];
      button.setAttribute("aria-pressed", String(on));
      button.textContent = on ? "✓ 这题拿到了 5 分" : "这题我答对了";
      var card = button.closest(".q-card");
      if (card) card.classList.toggle("is-right", on);
    }
    button.addEventListener("click", function () {
      if (state.exam[id]) delete state.exam[id]; else state.exam[id] = true;
      save(); paint(); paintExam();
    });
    paint();
  });
  var examReset = doc.getElementById("exam-reset");
  if (examReset) {
    examReset.addEventListener("click", function () {
      state.exam = {}; save();
      all(".mark-btn[data-exam]").forEach(function (button) {
        button.setAttribute("aria-pressed", "false");
        button.textContent = "这题我答对了";
        var card = button.closest(".q-card");
        if (card) card.classList.remove("is-right");
      });
      paintExam();
    });
  }
  paintExam();

  /* ---------- 讲给同事听评分表 ---------- */
  var rubricTotal = doc.getElementById("rubric-total");
  var rubricVerdict = doc.getElementById("rubric-verdict");
  function paintRubric() {
    if (!rubricTotal) return;
    var total = state.rubric.reduce(function (sum, value) { return sum + (Number(value) || 0); }, 0);
    rubricTotal.textContent = String(total);
    if (rubricVerdict) {
      rubricVerdict.textContent = total >= 16 ? "可以当「讲得通透」了。"
        : (total >= 12 ? "基本掌握，再复述一遍。" : "回到讲义，把「核心结论」重读，再讲一次。");
    }
  }
  all("select[data-rubric]").forEach(function (select) {
    var index = Number(select.getAttribute("data-rubric"));
    select.value = String(state.rubric[index] || 0);
    select.addEventListener("change", function () {
      state.rubric[index] = Number(select.value) || 0;
      save(); paintRubric();
    });
  });
  paintRubric();

  /* ---------- 知识卡片 ---------- */
  var grid = doc.getElementById("cards-grid");
  var cardCount = doc.getElementById("card-count");
  var cardEmpty = doc.getElementById("card-empty");
  var cardFilter = "all";
  function setFlip(flip, on) {
    flip.classList.toggle("is-flipped", on);
    var front = flip.querySelector(".flip-front");
    var back = flip.querySelector(".flip-back");
    if (front) { front.setAttribute("aria-expanded", String(on)); front.tabIndex = on ? -1 : 0; }
    if (back) {
      back.setAttribute("aria-hidden", String(!on));
      all("button", back).forEach(function (button) { button.tabIndex = on ? 0 : -1; });
    }
  }
  function paintCard(flip) {
    var id = flip.getAttribute("data-card");
    var mark = state.cards[id];
    flip.classList.toggle("is-known", mark === "known");
    flip.classList.toggle("is-again", mark === "again");
    var hint = flip.querySelector(".flip-hint");
    if (hint) {
      hint.textContent = mark === "known" ? "已掌握 · 点按再复习一次"
        : (mark === "again" ? "还要练 · 点按看解释" : "点按翻开，看一句话解释");
    }
    all("[data-card-mark]", flip).forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-value") === mark));
    });
  }
  function applyFilter() {
    if (!grid) return;
    var shown = 0;
    all(".flip", grid).forEach(function (flip) {
      var mark = state.cards[flip.getAttribute("data-card")];
      var show = cardFilter === "all"
        || (cardFilter === "known" && mark === "known")
        || (cardFilter === "again" && mark === "again")
        || (cardFilter === "new" && !mark);
      flip.hidden = !show;
      if (show) shown++;
      if (!show) setFlip(flip, false);
    });
    if (cardEmpty) cardEmpty.hidden = shown !== 0;
    if (cardCount) {
      var knownEl = cardCount.querySelector("[data-known]");
      var againEl = cardCount.querySelector("[data-again]");
      var shownEl = cardCount.querySelector("[data-shown]");
      if (knownEl) knownEl.textContent = String(knownCards());
      if (againEl) againEl.textContent = String(againCards());
      if (shownEl) shownEl.textContent = String(shown);
    }
  }
  if (grid) {
    all(".flip", grid).forEach(function (flip) {
      var id = flip.getAttribute("data-card");
      var front = flip.querySelector(".flip-front");
      var back = flip.querySelector(".flip-back");
      if (front) front.addEventListener("click", function () { setFlip(flip, true); });
      var backButton = flip.querySelector(".flip-unflip");
      if (backButton) backButton.addEventListener("click", function () { setFlip(flip, false); });
      all("[data-card-mark]", flip).forEach(function (button) {
        button.addEventListener("click", function () {
          var value = button.getAttribute("data-value");
          if (state.cards[id] === value) delete state.cards[id]; else state.cards[id] = value;
          save(); paintCard(flip); applyFilter();
        });
      });
      setFlip(flip, false);
      paintCard(flip);
      if (back) back.setAttribute("aria-hidden", "true");
    });
    all("[data-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        cardFilter = chip.getAttribute("data-filter");
        all("[data-filter]").forEach(function (other) { other.setAttribute("aria-pressed", String(other === chip)); });
        applyFilter();
      });
    });
    var shuffle = doc.getElementById("card-shuffle");
    if (shuffle) {
      shuffle.addEventListener("click", function () {
        var items = all(".flip", grid);
        for (var i = items.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = items[i]; items[i] = items[j]; items[j] = temp;
        }
        items.forEach(function (item) { setFlip(item, false); grid.appendChild(item); });
        applyFilter();
      });
    }
    applyFilter();
  }

  /* ---------- 21 天复习计划 ---------- */
  var reviewCount = doc.getElementById("review-count");
  function paintDays() {
    if (reviewCount) reviewCount.textContent = state.days.length + " / " + DAY_TOTAL + " 天";
    var meter = doc.querySelector('.meter[data-meter="days"]');
    if (meter) {
      meter.setAttribute("aria-valuenow", String(state.days.length));
      var fill = meter.querySelector("i");
      if (fill) fill.style.width = Math.round(state.days.length / DAY_TOTAL * 100) + "%";
    }
  }
  all("input.tick[data-day]").forEach(function (input) {
    var day = Number(input.getAttribute("data-day"));
    input.checked = inList(state.days, day);
    input.addEventListener("change", function () {
      if (input.checked && !inList(state.days, day)) state.days.push(day);
      if (!input.checked) {
        var index = state.days.indexOf(day);
        if (index !== -1) state.days.splice(index, 1);
      }
      save(); paintDays();
    });
  });
  paintDays();

  /* ---------- 打印这一页 ---------- */
  var printButton = doc.getElementById("print-page");
  if (printButton) {
    printButton.addEventListener("click", function () {
      all("details").forEach(function (item) { item.open = true; });
      window.print();
    });
  }
})();
