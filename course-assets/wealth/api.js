/**
 * 财富工具页共享 API（从旧 site.js 抽出，不含顶栏/侧栏/进度逻辑）
 * 工具脚本统一通过 window.WEALTH 取用。
 */
(function () {
	"use strict";

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
			return true;
		} catch (e) {
			return false;
		}
	}

	var toastEl = null;
	var toastTimer = null;
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
			btn.addEventListener("click", function () {
				action();
				hideToast();
			});
			toastEl.appendChild(btn);
		}
		toastEl.classList.add("on");
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(hideToast, actionLabel ? 6500 : 2600);
	}
	function hideToast() {
		if (toastEl) toastEl.classList.remove("on");
	}

	function download(name, content, mime) {
		var blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
		var url = URL.createObjectURL(blob);
		var a = document.createElement("a");
		a.href = url;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.setTimeout(function () {
			URL.revokeObjectURL(url);
		}, 1500);
	}

	function trim(x) {
		return x.replace(/\.0+$/, "");
	}
	function fmtMoney(v) {
		var a = Math.abs(v);
		if (a >= 1e8) return trim((v / 1e8).toFixed(2)) + " 亿";
		if (a >= 1e4) return trim((v / 1e4).toFixed(a >= 1e6 ? 0 : 1)) + " 万";
		return Math.round(v).toLocaleString("zh-CN");
	}
	function fmtNum(v, d) {
		return Number(v).toLocaleString("zh-CN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
	}

	window.WEALTH = {
		read: read,
		write: write,
		toast: toast,
		hideToast: hideToast,
		download: download,
		fmtMoney: fmtMoney,
		fmtNum: fmtNum,
		palette: {
			vermilion: "#c3352b",
			gold: "#d29a2a",
			jade: "#2c7a5b",
			indigo: "#234a76",
			electric: "#1668c4",
			plum: "#8a3560",
			amber: "#cf7a1c",
			teal: "#157f7f",
			ink: "#1c2028",
			ink3: "#6f7887",
			line: "rgba(120,96,60,.22)",
			paper: "#fffcf5",
		},
	};
})();
