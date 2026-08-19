/* ジョブログ分析ツール｜月単位比較（アプリ本体） */
(function () {
  "use strict";

  var DEFAULT_SAKU = [
    "会議・MTG（情報共有・報告）",
    "会議・MTG（その他）",
    "申請・手続き・事務対応",
    "クライアント対応",
    "業務進行",
    "情報探索・問い合わせ",
    "その他"
  ];
  var DEFAULT_SOU = [
    "データ集計・分析・考察・思考",
    "資料作成・確認",
    "会議・MTG（問題解決）",
    "会議・MTG（意思決定）",
    "会議・MTG（1オン1・相談）"
  ];
  var COLOR_SAKU = "#2a5db0";
  var COLOR_SOU = "#c9591f";
  var STORE_KEY = "joblog-classification-v1";

  var rawRows = [];
  var classification = new Map();
  var unknownCategories = new Set();

  var $ = function (id) {
    return document.getElementById(id);
  };

  /* ---------- utils ---------- */
  function parseDateFlexible(str) {
    if (!str) return null;
    var m = String(str).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    return m ? new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)) : null;
  }
  function monthKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function monthLabel(mk) {
    var p = mk.split("-");
    return p[0] + "年" + parseInt(p[1], 10) + "月";
  }
  function prevMonthKey(mk) {
    var p = mk.split("-").map(Number);
    var y = p[1] === 1 ? p[0] - 1 : p[0];
    var m = p[1] === 1 ? 12 : p[1] - 1;
    return y + "-" + String(m).padStart(2, "0");
  }
  function round1(n) {
    return Math.round(n * 10) / 10;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- ファイル読み込み ---------- */
  var dropzone = $("dropzone");
  var fileInput = $("fileInput");

  function showFileError(msg) {
    var el = $("fileError");
    el.textContent = msg;
    el.classList.remove("hidden");
  }
  function clearFileError() {
    $("fileError").classList.add("hidden");
  }

  dropzone.addEventListener("click", function (e) {
    if (e.target.closest("button") || e.target.closest("#fileError")) return;
    fileInput.click();
  });
  dropzone.addEventListener("keydown", function (e) {
    if (e.target !== dropzone) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
  dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("drag");
  });
  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropzone.classList.remove("drag");
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });
  $("pickBtn").addEventListener("click", function () {
    fileInput.click();
  });
  fileInput.addEventListener("change", function (e) {
    if (e.target.files.length) loadFile(e.target.files[0]);
  });
  $("demoBtn").addEventListener("click", function () {
    fetch("./sample/sample_joblog.csv")
      .then(function (r) {
        if (!r.ok) throw new Error("sample not found");
        return r.text();
      })
      .then(function (text) {
        var parsed = window.JobCsv.parseText(text);
        handleParsedCsv(parsed.data, parsed.fields);
      })
      .catch(function () {
        showFileError("サンプルデータの読み込みに失敗しました。sample/sample_joblog.csv を確認してください。");
      });
  });

  function loadFile(file) {
    clearFileError();
    window.JobCsv.parseFile(file)
      .then(function (parsed) {
        handleParsedCsv(parsed.data, parsed.fields);
      })
      .catch(function (err) {
        showFileError("CSVの読み込みに失敗しました：" + err.message);
      });
  }

  function handleParsedCsv(data, fields) {
    var required = ["日付", "登録者名", "業務区分", "時間"];
    var missing = required.filter(function (c) {
      return fields.indexOf(c) === -1;
    });
    if (missing.length) {
      showFileError(
        "必須列が見つかりません（" + missing.join("、") + "）。検出された列：" + fields.join("／")
      );
      return;
    }
    var rows = [];
    data.forEach(function (r) {
      var d = parseDateFlexible(r["日付"]);
      var person = String(r["登録者名"] || "").trim();
      var category = String(r["業務区分"] || "").trim();
      var hours = parseFloat(String(r["時間"]).replace(/,/g, ""));
      if (!d || !person || !category || isNaN(hours)) return;
      rows.push({ dateObj: d, monthKey: monthKey(d), person: person, category: category, hours: hours });
    });
    if (rows.length === 0) {
      showFileError("有効な行が見つかりませんでした。日付・登録者名・業務区分・時間の値を確認してください。");
      return;
    }
    clearFileError();
    rawRows = rows;
    initClassification();
    initApp();
  }

  /* ---------- 分類区分 ---------- */
  function loadOverrides() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveOverride(cat, type) {
    var o = loadOverrides();
    o[cat] = type;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(o));
    } catch (e) {}
  }

  function initClassification() {
    classification = new Map();
    unknownCategories = new Set();
    var overrides = loadOverrides();
    var cats = Array.from(new Set(rawRows.map(function (r) {
      return r.category;
    }))).sort();
    cats.forEach(function (c) {
      if (DEFAULT_SAKU.indexOf(c) !== -1) classification.set(c, "作");
      else if (DEFAULT_SOU.indexOf(c) !== -1) classification.set(c, "創");
      else {
        classification.set(c, "作");
        unknownCategories.add(c);
      }
      if (overrides[c] === "作" || overrides[c] === "創") classification.set(c, overrides[c]);
    });
  }

  function categoryHours(cat) {
    return round1(
      rawRows.reduce(function (a, r) {
        return r.category === cat ? a + r.hours : a;
      }, 0)
    );
  }

  function renderClassificationEditor() {
    var cats = Array.from(classification.keys()).sort(function (a, b) {
      var rank = function (c) {
        return unknownCategories.has(c) ? 2 : DEFAULT_SOU.indexOf(c) !== -1 ? 1 : 0;
      };
      return rank(a) - rank(b) || a.localeCompare(b, "ja");
    });
    $("categoryEditor").innerHTML = cats
      .map(function (c) {
        var cur = classification.get(c);
        var badge = unknownCategories.has(c)
          ? '<span class="unknown-badge">未知の区分・初期値「作」</span>'
          : "";
        return (
          '<div class="cat-row">' +
          '<div class="cat-name">' +
          escapeHtml(c) +
          badge +
          '<span class="cat-hours">全期間 ' +
          categoryHours(c) +
          "h</span></div>" +
          '<div class="seg" role="group" aria-label="' +
          escapeHtml(c) +
          ' の分類">' +
          '<button type="button" data-cat="' +
          escapeHtml(c) +
          '" data-type="作" class="' +
          (cur === "作" ? "active-saku" : "") +
          '" aria-pressed="' +
          (cur === "作") +
          '">作</button>' +
          '<button type="button" data-cat="' +
          escapeHtml(c) +
          '" data-type="創" class="' +
          (cur === "創" ? "active-sou" : "") +
          '" aria-pressed="' +
          (cur === "創") +
          '">創</button>' +
          "</div></div>"
        );
      })
      .join("");

    var note = $("unknownCategoryNote");
    if (unknownCategories.size) {
      note.classList.remove("hidden");
      note.textContent =
        "未登録の業務区分が" +
        unknownCategories.size +
        "件あります（初期値は「作」）。実態に応じて切り替えてください：" +
        Array.from(unknownCategories).join("、");
    } else {
      note.classList.add("hidden");
    }
  }

  $("categoryEditor").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-cat]");
    if (!btn) return;
    classification.set(btn.getAttribute("data-cat"), btn.getAttribute("data-type"));
    saveOverride(btn.getAttribute("data-cat"), btn.getAttribute("data-type"));
    renderClassificationEditor();
    renderResult();
  });

  $("resetClassBtn").addEventListener("click", function () {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (e) {}
    initClassification();
    renderClassificationEditor();
    renderResult();
  });

  /* ---------- 初期化 ---------- */
  function initApp() {
    $("appRoot").hidden = false;
    renderClassificationEditor();
    populateMonthSelect();
    renderResult();
  }

  function populateMonthSelect() {
    var months = Array.from(new Set(rawRows.map(function (r) {
      return r.monthKey;
    }))).sort();
    var sel = $("monthSelect");
    sel.innerHTML = months
      .map(function (mk) {
        var rows = rawRows.filter(function (r) {
          return r.monthKey === mk;
        });
        var people = new Set(rows.map(function (r) {
          return r.person;
        })).size;
        return (
          '<option value="' + mk + '">' + monthLabel(mk) + "（登録" + rows.length + "件・" + people + "名）</option>"
        );
      })
      .join("");
    sel.value = months[months.length - 1];
    sel.onchange = renderResult;
  }

  /* ---------- 集計 ---------- */
  function computeMonthStats(mk) {
    var rows = rawRows.filter(function (r) {
      return r.monthKey === mk;
    });
    if (rows.length === 0) return null;
    var total = 0,
      saku = 0,
      sou = 0;
    rows.forEach(function (r) {
      var type = classification.get(r.category) || "作";
      total += r.hours;
      if (type === "創") sou += r.hours;
      else saku += r.hours;
    });
    return {
      monthKey: mk,
      label: monthLabel(mk),
      totalHours: total,
      sakuHours: saku,
      souHours: sou,
      sakuPct: total > 0 ? (saku / total) * 100 : null,
      souPct: total > 0 ? (sou / total) * 100 : null,
      peopleCount: new Set(rows.map(function (r) {
        return r.person;
      })).size
    };
  }

  function monthRow(m) {
    return (
      "<tr><td>" +
      m.label +
      '</td><td class="num">' +
      m.peopleCount +
      '名</td><td class="num">' +
      round1(m.totalHours) +
      '</td><td class="num">' +
      round1(m.sakuHours) +
      '</td><td class="num">' +
      round1(m.souHours) +
      '</td><td class="num">' +
      (m.sakuPct !== null ? round1(m.sakuPct) + "%" : "—") +
      '</td><td class="num">' +
      (m.souPct !== null ? round1(m.souPct) + "%" : "—") +
      "</td></tr>"
    );
  }

  function deltaText(cur, prev) {
    if (cur === null || prev === null) return '<td class="num">—</td>';
    var d = round1(cur - prev);
    var sign = d > 0 ? "+" : d < 0 ? "" : "±";
    return '<td class="num delta">' + sign + d + "pt</td>";
  }

  /* ---------- 描画 ---------- */
  var lastPair = null;

  function renderResult() {
    var mk = $("monthSelect").value;
    if (!mk) return;
    var pmk = prevMonthKey(mk);
    var cur = computeMonthStats(mk);
    var prev = computeMonthStats(pmk);
    var box = $("resultSection");
    lastPair = { cur: cur, prev: prev };

    var stamp =
      "生成日時：" +
      new Date().toLocaleString("ja-JP") +
      "｜分類基準は「業務区分」ベースの簡易分類（画面上部で編集可能）";

    if (!prev) {
      box.innerHTML =
        '<section class="card"><h2>' +
        monthLabel(pmk) +
        "（前月）のデータがありません</h2>" +
        '<p class="desc">比較対象がないため、' +
        cur.label +
        '単体の集計のみ表示します。</p><div class="table-scroll"><table><thead><tr><th>月</th><th class="num">登録者数</th><th class="num">総工数(h)</th><th class="num">作(h)</th><th class="num">創(h)</th><th class="num">作%</th><th class="num">創%</th></tr></thead><tbody>' +
        monthRow(cur) +
        "</tbody></table></div></section>";
      $("footerNote").textContent = stamp;
      return;
    }

    box.innerHTML =
      '<section class="card">' +
      "<h2>事業部全体｜作／創 構成比の比較（棒グラフ）</h2>" +
      '<p class="desc">' +
      prev.label +
      "と" +
      cur.label +
      'を、それぞれの総工数を100%とした「作」「創」の割合(%)で比較します（絶対数の時間は棒の中に数値で表示）。</p>' +
      '<div class="legend"><span><i style="background:' +
      COLOR_SAKU +
      '"></i>作</span><span><i style="background:' +
      COLOR_SOU +
      '"></i>創</span></div>' +
      '<div class="chart-box"><canvas id="barChart"></canvas></div></section>' +
      '<section class="card">' +
      "<h2>事業部全体｜作／創 比率の推移（折れ線）</h2>" +
      '<p class="desc">' +
      prev.label +
      "→" +
      cur.label +
      'で構成比(%)がどう動いたかを2点の折れ線で表示します。</p>' +
      '<div class="legend"><span><i style="background:' +
      COLOR_SAKU +
      '"></i>作</span><span><i style="background:' +
      COLOR_SOU +
      '"></i>創</span></div>' +
      '<div class="chart-box"><canvas id="lineChart"></canvas></div></section>' +
      '<section class="card"><h2>集計表</h2>' +
      '<div class="table-scroll"><table><thead><tr><th>月</th><th class="num">登録者数</th><th class="num">総工数(h)</th><th class="num">作(h)</th><th class="num">創(h)</th><th class="num">作%</th><th class="num">創%</th></tr></thead><tbody>' +
      monthRow(prev) +
      monthRow(cur) +
      "<tr><td>差分（" +
      cur.label +
      "－" +
      prev.label +
      '）</td><td class="num">' +
      (cur.peopleCount - prev.peopleCount > 0 ? "+" : "") +
      (cur.peopleCount - prev.peopleCount) +
      '名</td><td class="num">' +
      (cur.totalHours - prev.totalHours > 0 ? "+" : "") +
      round1(cur.totalHours - prev.totalHours) +
      '</td><td class="num">' +
      (cur.sakuHours - prev.sakuHours > 0 ? "+" : "") +
      round1(cur.sakuHours - prev.sakuHours) +
      '</td><td class="num">' +
      (cur.souHours - prev.souHours > 0 ? "+" : "") +
      round1(cur.souHours - prev.souHours) +
      "</td>" +
      deltaText(cur.sakuPct, prev.sakuPct) +
      deltaText(cur.souPct, prev.souPct) +
      "</tr></tbody></table></div>" +
      (prev.peopleCount !== cur.peopleCount
        ? '<p class="caveat">登録者数が' +
          prev.label +
          "(" +
          prev.peopleCount +
          "名)と" +
          cur.label +
          "(" +
          cur.peopleCount +
          "名)で異なります。総工数は人数差の影響を受けている可能性がある点にご留意ください。</p>"
        : "") +
      "</section>";

    drawCharts();
    $("footerNote").textContent = stamp;
  }

  function drawCharts() {
    if (!lastPair || !lastPair.prev) return;
    var prev = lastPair.prev,
      cur = lastPair.cur;
    var bar = $("barChart");
    var line = $("lineChart");
    if (!bar || !line) return;

    window.JobCharts.drawStackedBar(bar, [
      {
        label: prev.label,
        sublabel: "総工数 " + round1(prev.totalHours) + "h",
        segments: [
          { name: "作", value: prev.sakuPct || 0, hours: round1(prev.sakuHours), color: COLOR_SAKU },
          { name: "創", value: prev.souPct || 0, hours: round1(prev.souHours), color: COLOR_SOU }
        ]
      },
      {
        label: cur.label,
        sublabel: "総工数 " + round1(cur.totalHours) + "h",
        segments: [
          { name: "作", value: cur.sakuPct || 0, hours: round1(cur.sakuHours), color: COLOR_SAKU },
          { name: "創", value: cur.souPct || 0, hours: round1(cur.souHours), color: COLOR_SOU }
        ]
      }
    ]);

    window.JobCharts.drawLine(line, [prev.label, cur.label], [
      { name: "作", color: COLOR_SAKU, values: [prev.sakuPct || 0, cur.sakuPct || 0] },
      { name: "創", color: COLOR_SOU, values: [prev.souPct || 0, cur.souPct || 0] }
    ]);
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCharts, 150);
  });

  /* ---------- CSV書き出し ---------- */
  $("exportBtn").addEventListener("click", function () {
    if (!lastPair || !lastPair.cur) return;
    var rows = [["月", "登録者数", "総工数(h)", "作(h)", "創(h)", "作%", "創%"]];
    [lastPair.prev, lastPair.cur].forEach(function (m) {
      if (!m) return;
      rows.push([
        m.label,
        m.peopleCount,
        round1(m.totalHours),
        round1(m.sakuHours),
        round1(m.souHours),
        m.sakuPct !== null ? round1(m.sakuPct) : "",
        m.souPct !== null ? round1(m.souPct) : ""
      ]);
    });
    rows.push([]);
    rows.push(["業務区分", "分類"]);
    Array.from(classification.keys())
      .sort(function (a, b) {
        return a.localeCompare(b, "ja");
      })
      .forEach(function (c) {
        rows.push([c, classification.get(c)]);
      });

    var blob = new Blob(["\ufeff" + window.JobCsv.toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "joblog_summary_" + lastPair.cur.monthKey + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  /* ?demo=1 でサンプルを自動表示（動作確認用） */
  if (/[?&]demo=1/.test(location.search)) {
    window.addEventListener("DOMContentLoaded", function () {
      $("demoBtn").click();
    });
  }
})();
