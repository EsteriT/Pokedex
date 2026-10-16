(() => {
  "use strict";
  window.BinderGeometry = function pocketGeometry(cells, cw, ch, gap) {
    const x0 = Math.min(...cells.map((c) => c[1]));
    const y0 = Math.min(...cells.map((c) => c[0]));
    const keys = new Set(cells.map(([y, x]) => y + "," + x));
    const tiles = new Set();
    const has = (y, x) => keys.has(y + "," + x);
    cells.forEach(([y, x]) => {
      const ty = (y - y0) * 2,
        tx = (x - x0) * 2;
      tiles.add(ty + "," + tx);
      if (has(y, x + 1)) tiles.add(ty + "," + (tx + 1));
      if (has(y + 1, x)) tiles.add(ty + 1 + "," + tx);
    });
    const yMax = Math.max(...cells.map((c) => c[0]));
    const xMax = Math.max(...cells.map((c) => c[1]));
    for (let y = y0; y < yMax; y++) {
      for (let x = x0; x < xMax; x++) {
        const corners = [
          has(y, x),
          has(y, x + 1),
          has(y + 1, x),
          has(y + 1, x + 1),
        ];
        if (corners.every(Boolean))
          tiles.add((y - y0) * 2 + 1 + "," + ((x - x0) * 2 + 1));
      }
    }
    const rects = [];
    let outline = "";
    const occupied = (y, x) => tiles.has(y + "," + x);
    tiles.forEach((key) => {
      const [y, x] = key.split(",").map(Number);
      const xx = Math.floor(x / 2) * (cw + gap) + (x % 2 ? cw : 0);
      const yy = Math.floor(y / 2) * (ch + gap) + (y % 2 ? ch : 0);
      const w = x % 2 ? gap : cw,
        h = y % 2 ? gap : ch;
      rects.push({ x: xx, y: yy, width: w, height: h });
      if (!occupied(y - 1, x)) outline += `M${xx} ${yy}h${w}`;
      if (!occupied(y, x + 1)) outline += `M${xx + w} ${yy}v${h}`;
      if (!occupied(y + 1, x)) outline += `M${xx} ${yy + h}h${w}`;
      if (!occupied(y, x - 1)) outline += `M${xx} ${yy}v${h}`;
    });
    return { rects, outline };
  };
})();
