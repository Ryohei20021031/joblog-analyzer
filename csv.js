/* CSV 読み込み（依存ライブラリなし）
   - UTF-8 / Shift_JIS を自動判定
   - ダブルクォート囲み・CRLF・BOMに対応
*/
(function (global) {
  "use strict";

  function decodeBuffer(buffer) {
    var bytes = new Uint8Array(buffer);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (e) {
      try {
        return new TextDecoder("shift_jis").decode(bytes);
      } catch (e2) {
        return new TextDecoder("utf-8").decode(bytes);
      }
    }
  }

  function parseText(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
        continue;
      }
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    row.push(field);
    rows.push(row);

    return rows.filter(function (r) {
      return r.some(function (v) {
        return String(v).trim() !== "";
      });
    });
  }

  /* ヘッダ付きCSV → { fields, data } */
  function parseWithHeader(text) {
    var rows = parseText(text);
    if (rows.length === 0) return { fields: [], data: [] };
    var fields = rows[0].map(function (f) {
      return String(f).replace(/^\s+|\s+$/g, "");
    });
    var data = rows.slice(1).map(function (r) {
      var obj = {};
      for (var i = 0; i < fields.length; i++) obj[fields[i]] = r[i] === undefined ? "" : r[i];
      return obj;
    });
    return { fields: fields, data: data };
  }

  function parseFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("ファイルの読み取りに失敗しました"));
      };
      reader.onload = function () {
        try {
          resolve(parseWithHeader(decodeBuffer(reader.result)));
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function toCsv(rows) {
    return rows
      .map(function (r) {
        return r
          .map(function (v) {
            var s = v === null || v === undefined ? "" : String(v);
            return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          })
          .join(",");
      })
      .join("\r\n");
  }

  global.JobCsv = {
    parseText: parseWithHeader,
    parseFile: parseFile,
    toCsv: toCsv
  };
})(window);
