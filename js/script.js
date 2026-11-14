/* ===========================================================
   Expense & Budget Visualizer — script.js
   Vanilla JS. No framework. Data persisted in Local Storage.
   =========================================================== */

(function () {
  "use strict";

  /* ---------- Storage keys ---------- */
  var STORE_KEY = "ebv.transactions";
  var THEME_KEY = "ebv.theme";
  var CATEGORIES_KEY = "ebv.categories";

  /* ---------- Default categories ---------- */
  var DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];

  /* ---------- Category visual identity ----------
     Each category gets an emoji icon + a gradient background.
     Known categories are pre-mapped; custom ones cycle the palette. */
  var CATEGORY_META = {
    "Food":     { emoji: "🍔", color: "#f97316", grad: "linear-gradient(135deg,#fb923c,#f97316)" },
    "Transport": { emoji: "🚗", color: "#3b82f6", grad: "linear-gradient(135deg,#60a5fa,#3b82f6)" },
    "Fun":      { emoji: "🎉", color: "#ec4899", grad: "linear-gradient(135deg,#f472b6,#ec4899)" }
  };

  /* Fallback palette for custom categories */
  var PALETTE = [
    { color: "#a855f7", grad: "linear-gradient(135deg,#c084fc,#a855f7)" },
    { color: "#14b8a6", grad: "linear-gradient(135deg,#2dd4bf,#14b8a6)" },
    { color: "#f59e0b", grad: "linear-gradient(135deg,#fbbf24,#f59e0b)" },
    { color: "#6366f1", grad: "linear-gradient(135deg,#818cf8,#6366f1)" },
    { color: "#64748b", grad: "linear-gradient(135deg,#94a3b8,#64748b)" }
  ];

  var PALETTE_DARK = [
    { color: "#c084fc", grad: "linear-gradient(135deg,#d8b4fe,#c084fc)" },
    { color: "#2dd4bf", grad: "linear-gradient(135deg,#5eead4,#2dd4bf)" },
    { color: "#fbbf24", grad: "linear-gradient(135deg,#fcd34d,#fbbf24)" },
    { color: "#818cf8", grad: "linear-gradient(135deg,#a5b4fc,#818cf8)" },
    { color: "#94a3b8", grad: "linear-gradient(135deg,#cbd5e1,#94a3b8)" }
  ];

  /* ---------- State ---------- */
  var transactions = []; // [{ id, name, amount, category, date }]
  var categories = [];
  var chart = null;

  /* ---------- DOM refs ---------- */
  var $ = function (id) { return document.getElementById(id); };

  var form = $("expenseForm");
  var itemNameInput = $("itemName");
  var amountInput = $("amount");
  var categorySelect = $("category");
  var customCategoryField = $("customCategoryField");
  var customCategoryInput = $("customCategory");
  var formError = $("formError");
  var totalBalanceEl = $("totalBalance");
  var balanceSubEl = $("balanceSub");
  var transactionListEl = $("transactionList");
  var listEmptyEl = $("listEmpty");
  var chartEmptyEl = $("chartEmpty");
  var themeToggle = $("themeToggle");
  var sortBySelect = $("sortBy");
  var pieCanvas = $("pieChart");

  /* ===========================================================
     Persistence
     =========================================================== */

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      transactions = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Failed to parse stored transactions:", e);
      transactions = [];
    }

    try {
      var cats = localStorage.getItem(CATEGORIES_KEY);
      categories = cats ? JSON.parse(cats) : DEFAULT_CATEGORIES.slice();
    } catch (e) {
      categories = DEFAULT_CATEGORIES.slice();
    }

    // Make sure defaults always exist
    DEFAULT_CATEGORIES.forEach(function (c) {
      if (categories.indexOf(c) === -1) categories.push(c);
    });
  }

  function saveTransactions() {
    localStorage.setItem(STORE_KEY, JSON.stringify(transactions));
  }

  function saveCategories() {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }

  /* ===========================================================
     Theme
     =========================================================== */

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var prefersDark = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved || (prefersDark ? "dark" : "light");
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    // Refresh chart colors (legend/border depend on theme)
    renderChart();
  }

  function isDark() {
    return document.body.getAttribute("data-theme") === "dark";
  }

  /* ===========================================================
     Categories
     =========================================================== */

  function categoryMeta(name) {
    // Known categories have a fixed look
    if (CATEGORY_META[name]) return CATEGORY_META[name];

    // Custom categories cycle the fallback palette
    var list = isDark() ? PALETTE_DARK : PALETTE;
    var idx = categories.indexOf(name);
    if (idx === -1) idx = 0;
    // Offset so custom cats don't collide with the 3 built-in indices
    var palIdx = (idx - DEFAULT_CATEGORIES.length + list.length) % list.length;
    var entry = list[palIdx >= 0 ? palIdx : 0];
    return { emoji: "💰", color: entry.color, grad: entry.grad };
  }

  function categoryColor(name) {
    return categoryMeta(name).color;
  }

  function categoryEmoji(name) {
    return categoryMeta(name).emoji;
  }

  function renderCategoryOptions(selected) {
    // Preserve the placeholder
    categorySelect.innerHTML = '<option value="">Select…</option>';

    categories.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });

    // Custom category option
    var customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "+ Add new category…";
    categorySelect.appendChild(customOpt);

    if (selected) categorySelect.value = selected;
  }

  /* ===========================================================
     Validation + add
     =========================================================== */

  function showError(msg) {
    formError.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span></span>';
    formError.querySelector("span").textContent = msg;
    formError.classList.remove("hidden");
  }

  function clearError() {
    formError.textContent = "";
    formError.classList.add("hidden");
  }

  function clearInputErrors() {
    [itemNameInput, amountInput, categorySelect, customCategoryInput].forEach(function (el) {
      if (el) el.classList.remove("input-error");
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    clearError();
    clearInputErrors();

    var name = itemNameInput.value.trim();
    var amountStr = amountInput.value.trim();
    var category = categorySelect.value;
    var custom = customCategoryInput.value.trim();

    var hasError = false;

    if (!name) {
      itemNameInput.classList.add("input-error");
      hasError = true;
    }

    var amount = parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount < 0) {
      amountInput.classList.add("input-error");
      hasError = true;
    }

    if (!category) {
      categorySelect.classList.add("input-error");
      hasError = true;
    }

    if (category === "__custom__") {
      if (!custom) {
        customCategoryInput.classList.add("input-error");
        hasError = true;
      } else {
        // Register the new category
        if (categories.indexOf(custom) === -1) {
          categories.push(custom);
          saveCategories();
        }
        category = custom;
      }
    }

    if (hasError) {
      showError("Please fill in all fields correctly.");
      return;
    }

    // Add transaction
    var txn = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      amount: amount,
      category: category,
      date: new Date().toISOString()
    };
    transactions.push(txn);
    saveTransactions();

    // Reset form
    form.reset();
    customCategoryField.classList.add("hidden");
    renderCategoryOptions("");

    renderAll();
    itemNameInput.focus();
  }

  /* ===========================================================
     Delete (with fade-out animation)
     =========================================================== */

  function deleteTransaction(id) {
    var itemEl = transactionListEl.querySelector('[data-id="' + id + '"]');
    if (itemEl) {
      // Animate out, then remove from state and re-render
      itemEl.classList.add("removing");
      itemEl.addEventListener("animationend", function handler() {
        itemEl.removeEventListener("animationend", handler);
        transactions = transactions.filter(function (t) { return t.id !== id; });
        saveTransactions();
        renderAll();
      }, { once: true });
    } else {
      transactions = transactions.filter(function (t) { return t.id !== id; });
      saveTransactions();
      renderAll();
    }
  }

  /* ===========================================================
     Sorting
     =========================================================== */

  function getSorted() {
    var mode = sortBySelect.value;
    var copy = transactions.slice();

    switch (mode) {
      case "amount-desc":
        copy.sort(function (a, b) { return b.amount - a.amount; });
        break;
      case "amount-asc":
        copy.sort(function (a, b) { return a.amount - b.amount; });
        break;
      case "category":
        copy.sort(function (a, b) {
          return a.category.localeCompare(b.category) ||
            b.amount - a.amount;
        });
        break;
      default: // "recent" — newest first
        copy.sort(function (a, b) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }
    return copy;
  }

  /* ===========================================================
     Render: balance
     =========================================================== */

  function renderBalance() {
    var total = transactions.reduce(function (sum, t) {
      return sum + t.amount;
    }, 0);
    totalBalanceEl.textContent = formatMoney(total);
    totalBalanceEl.classList.toggle("negative", total < 0);

    var count = transactions.length;
    if (count === 0) {
      balanceSubEl.textContent = "No transactions yet";
    } else if (count === 1) {
      balanceSubEl.textContent = "1 transaction";
    } else {
      balanceSubEl.textContent = count + " transactions";
    }
  }

  function formatMoney(n) {
    return "$" + n.toFixed(2);
  }

  /* ===========================================================
     Render: list
     =========================================================== */

  function renderList() {
    transactionListEl.innerHTML = "";

    var sorted = getSorted();

    listEmptyEl.classList.toggle("hidden", sorted.length > 0);

    sorted.forEach(function (txn) {
      var li = document.createElement("li");
      li.className = "transaction-item";
      li.setAttribute("data-id", txn.id);

      var meta = categoryMeta(txn.category);

      // Build structure
      li.innerHTML =
        '<div class="cat-badge" style="background:' + meta.grad + '"></div>' +
        '<div class="txn-info">' +
          '<span class="txn-name"></span>' +
          '<span class="txn-meta"></span>' +
        '</div>' +
        '<span class="txn-amount">' + formatMoney(txn.amount) + '</span>' +
        '<button class="delete-btn" type="button" aria-label="Delete ' +
          escapeAttr(txn.name) + '">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '</button>';

      // Set text via textContent to avoid HTML injection
      li.querySelector(".cat-badge").textContent = meta.emoji;
      li.querySelector(".txn-name").textContent = txn.name;
      li.querySelector(".txn-meta").textContent = txn.category;

      var delBtn = li.querySelector(".delete-btn");
      delBtn.addEventListener("click", function () {
        deleteTransaction(txn.id);
      });

      transactionListEl.appendChild(li);
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ===========================================================
     Render: chart
     =========================================================== */

  function renderChart() {
    if (typeof Chart === "undefined") {
      // Chart.js not loaded yet — retry shortly
      window.setTimeout(renderChart, 120);
      return;
    }

    // Aggregate by category
    var totals = {};
    transactions.forEach(function (t) {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });

    var labels = Object.keys(totals);
    var data = labels.map(function (l) { return totals[l]; });
    var colors = labels.map(function (l) { return categoryColor(l); });

    var hasData = labels.length > 0;
    chartEmptyEl.classList.toggle("hidden", hasData);
    pieCanvas.style.display = hasData ? "block" : "none";

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = colors;
      chart.update();
      return;
    }

    if (!hasData) return;

    var textColor = isDark() ? "#e8eaf2" : "#1a1d28";
    var borderColor = isDark() ? "#1a1c2b" : "#ffffff";

    chart = new Chart(pieCanvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: borderColor,
          hoverBorderWidth: 4,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "55%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textColor,
              font: { size: 12, family: "Inter, sans-serif", weight: "600" },
              padding: 16,
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: "circle"
            }
          },
          tooltip: {
            backgroundColor: isDark() ? "#22243a" : "#1a1d28",
            titleColor: "#fff",
            bodyColor: "#fff",
            titleFont: { size: 13, family: "Inter, sans-serif", weight: "700" },
            bodyFont: { size: 12, family: "Inter, sans-serif" },
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: function (ctx) {
                var label = ctx.label || "";
                var value = ctx.parsed;
                var total = data.reduce(function (a, b) { return a + b; }, 0);
                var pct = total ? Math.round((value / total) * 100) : 0;
                return "  " + label + ": " + formatMoney(value) + " (" + pct + "%)";
              }
            }
          }
        }
      }
    });
  }

  /* ===========================================================
     Master render
     =========================================================== */

  function renderAll() {
    renderBalance();
    renderList();
    renderChart();
  }

  /* ===========================================================
     Event wiring
     =========================================================== */

  function bindEvents() {
    form.addEventListener("submit", handleSubmit);

    themeToggle.addEventListener("click", function () {
      var current = document.body.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });

    categorySelect.addEventListener("change", function () {
      if (categorySelect.value === "__custom__") {
        customCategoryField.classList.remove("hidden");
        customCategoryInput.focus();
      } else {
        customCategoryField.classList.add("hidden");
        customCategoryInput.value = "";
      }
    });

    sortBySelect.addEventListener("change", renderList);

    // Clear error as the user edits
    [itemNameInput, amountInput, categorySelect, customCategoryInput].forEach(function (el) {
      if (el) {
        el.addEventListener("input", function () {
          el.classList.remove("input-error");
          clearError();
        });
      }
    });

    window.addEventListener("beforeunload", saveTransactions);
  }

  /* ===========================================================
     Init
     =========================================================== */

  function init() {
    initTheme();
    loadState();
    renderCategoryOptions("");
    bindEvents();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
