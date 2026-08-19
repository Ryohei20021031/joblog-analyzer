/* 軽量チャート描画（Canvas 2D、外部ライブラリなし）
   - drawStackedBar : 100%積上げ横棒グラフ
   - drawLine       : 推移折れ線（割合%）
*/
(function (global) {
  "use strict";

  var FONT = '"Hiragino Sans","Yu Gothic","Noto Sans JP",-apple-system,"Segoe UI",sans-serif';
  var INK = "#1c1c1a";
  var SUB = "#6b6a64";
  var GRID = "#e4e2da";

  function setupCanvas(canvas) {
    var dpr = global.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(320, Math.round(rect.width || canvas.clientWidth || 640));
    var h = Math.max(200, Math.round(rect.height || canvas.clientHeight || 280));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = "middle";
    return { ctx: ctx, w: w, h: h };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, h / 2, w / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /* bars: [{ label, sublabel, segments:[{ name, value(%), hours, color }] }] */
  function drawStackedBar(canvas, bars) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx;
    var isNarrow = s.w < 520;
    var padLeft = isNarrow ? 96 : 132;
    var padRight = 16;
    var padTop = 12;
    var padBottom = 46;
    var plotW = s.w - padLeft - padRight;
    var plotH = s.h - padTop - padBottom;

    ctx.font = "11px " + FONT;
    ctx.fillStyle = SUB;
    ctx.textAlign = "center";
    for (var t = 0; t <= 100; t += 25) {
      var gx = padLeft + (plotW * t) / 100;
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, padTop);
      ctx.lineTo(gx, padTop + plotH);
      ctx.stroke();
      ctx.fillText(t + "%", gx, padTop + plotH + 14);
    }
    ctx.fillStyle = SUB;
    ctx.font = "11px " + FONT;
    ctx.fillText("構成比（100%＝各月の総工数）", padLeft + plotW / 2, padTop + plotH + 34);

    var slot = plotH / bars.length;
    var barH = Math.min(64, slot * 0.56);

    bars.forEach(function (bar, i) {
      var cy = padTop + slot * i + slot / 2;
      ctx.textAlign = "right";
      ctx.fillStyle = INK;
      ctx.font = "bold 12px " + FONT;
      ctx.fillText(bar.label, padLeft - 12, cy - (bar.sublabel ? 8 : 0));
      if (bar.sublabel) {
        ctx.fillStyle = SUB;
        ctx.font = "11px " + FONT;
        ctx.fillText(bar.sublabel, padLeft - 12, cy + 9);
      }

      var x = padLeft;
      bar.segments.forEach(function (seg) {
        var w = (plotW * Math.max(0, seg.value || 0)) / 100;
        if (w <= 0) return;
        ctx.fillStyle = seg.color;
        roundRectPath(ctx, x, cy - barH / 2, w, barH, 4);
        ctx.fill();

        var text1 = seg.name + " " + seg.value.toFixed(1) + "%";
        var text2 = "(" + seg.hours + "h)";
        ctx.textAlign = "center";
        ctx.font = "bold 12px " + FONT;
        var needed = Math.max(ctx.measureText(text1).width, ctx.measureText(text2).width) + 12;
        if (w >= needed) {
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text1, x + w / 2, cy - 8);
          ctx.font = "11px " + FONT;
          ctx.fillText(text2, x + w / 2, cy + 8);
        } else if (w >= 30) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px " + FONT;
          ctx.fillText(Math.round(seg.value) + "%", x + w / 2, cy);
        }
        x += w;
      });
    });
  }

  /* series: [{ name, color, values:[..] }], labels: [..] */
  function drawLine(canvas, labels, series) {
    var s = setupCanvas(canvas);
    var ctx = s.ctx;
    var padLeft = 72;
    var padRight = 24;
    var padTop = 16;
    var padBottom = 44;
    var plotW = s.w - padLeft - padRight;
    var plotH = s.h - padTop - padBottom;

    ctx.font = "11px " + FONT;
    for (var v = 0; v <= 100; v += 25) {
      var y = padTop + plotH - (plotH * v) / 100;
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.fillStyle = SUB;
      ctx.textAlign = "right";
      ctx.fillText(v + "%", padLeft - 10, y);
    }
    ctx.save();
    ctx.translate(16, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = SUB;
    ctx.fillText("割合(%)", 0, 0);
    ctx.restore();

    var n = Math.max(1, labels.length);
    function px(i) {
      return n === 1 ? padLeft + plotW / 2 : padLeft + (plotW * i) / (n - 1);
    }
    function py(val) {
      return padTop + plotH - (plotH * Math.max(0, Math.min(100, val))) / 100;
    }

    labels.forEach(function (lab, i) {
      ctx.fillStyle = INK;
      ctx.font = "12px " + FONT;
      ctx.textAlign = n > 1 && i === 0 ? "left" : n > 1 && i === n - 1 ? "right" : "center";
      ctx.fillText(lab, px(i), padTop + plotH + 20);
    });

    series.forEach(function (ser) {
      ctx.strokeStyle = ser.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ser.values.forEach(function (val, i) {
        var x = px(i);
        var y = py(val || 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ser.values.forEach(function (val, i) {
        var x = px(i);
        var y = py(val || 0);
        ctx.fillStyle = ser.color;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        var text = ser.name + " " + (val || 0).toFixed(1) + "%";
        ctx.font = "bold 11px " + FONT;
        var above = y > padTop + 26;
        ctx.textAlign = i === 0 ? "left" : "right";
        var tx = i === 0 ? x + 10 : x - 10;
        var ty = above ? y - 14 : y + 16;
        var tw = ctx.measureText(text).width + 10;
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillRect(i === 0 ? tx - 5 : tx - tw + 5, ty - 9, tw, 18);
        ctx.fillStyle = ser.color;
        ctx.fillText(text, tx, ty);
      });
    });
  }

  global.JobCharts = { drawStackedBar: drawStackedBar, drawLine: drawLine };
})(window);
