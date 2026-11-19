/* Asteroids building artwork supplied by Siddhant, authored with Claude. */
(function () {
  'use strict';
  var W = 320, H = 180, TAU = Math.PI * 2;

  var manifest = {
    id: 'asteroids-by-siddhant',
    name: 'ASTEROIDS',
    author: 'siddhant-k',
    description: 'Rotate, thrust and blast rocks that split into smaller ones. Survive the waves!',
    version: '1.0.0',
    controls: 'A/D rotate, W thrust, SPACE fire'
  };

  // ---------- tiny helpers (pixel font, pixel lines) ----------
  var FS = "A010101111101101B110101110101110C011100100100011D110101101101110E111100110100111F111100110100100G011100101101011H101101111101101I111010010010111J001001001101010K101101110101101L100100100100111M101111111101101N110101101101101O010101101101010P110101110100100Q010101101111011R110101110101101S011100010001110T111010010010010U101101101101111V101101101101010W101101111111101X101101010101101Y101101010010010Z111001010100111" + "0111101101101111" + "1010110010010111" + "2110001010100111" + "3110001010001110" + "4101101111001001" + "5111100110001110" + "6011100111101111" + "7111001010010010" + "8111101111101111" + "9111101111001110" + ".000000000000010:000010000010000-000000111000000/001001010100100!010010010000010?110001010000010+000010111010000>100010001010100_000000000000111";
  var FD = {};
  for (var i = 0; i < FS.length; i += 16) FD[FS[i]] = FS.slice(i + 1, i + 16);

  function px(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
  function tw(s, sc) { sc = sc || 1; return s.length * 4 * sc - sc; }
  function txt(g, s, x, y, c, sc, shadow) {
    s = String(s).toUpperCase(); sc = sc || 1;
    if (shadow) txt(g, s, x + sc, y + sc, '#14101f', sc);
    g.fillStyle = c;
    for (var i = 0; i < s.length; i++) {
      var d = FD[s[i]]; if (!d) continue;
      for (var b = 0; b < 15; b++) if (d[b] === '1') g.fillRect(Math.round(x) + (i * 4 + b % 3) * sc, Math.round(y) + ((b / 3) | 0) * sc, sc, sc);
    }
  }
  function ln(g, x0, y0, x1, y1, c) { // crisp Bresenham line
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, n = 0;
    g.fillStyle = c;
    for (;;) {
      g.fillRect(x0, y0, 1, 1);
      if ((x0 === x1 && y0 === y1) || n++ > 600) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function shade(h, f) {
    var n = parseInt(h.slice(1), 16);
    return 'rgb(' + Math.min(255, (n >> 16) * f | 0) + ',' + Math.min(255, (n >> 8 & 255) * f | 0) + ',' + Math.min(255, (n & 255) * f | 0) + ')';
  }

  // ====================================================================
  //  BUILDING  (the "house" for the game, 80x64, same layout as the hub's other buildings)
  // ====================================================================
  var NEON = '#7affc8';
  function drawBuilding(g, x, y, t, dark) {
    t = t || 0; dark = dark || 0;
    var wc = '#34397a', rc = '#5a2f7a', INK = '#14101f';
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 3, y + 60, 84, 7);
    // walls
    px(g, INK, x - 1, y + 23, 82, 42); px(g, shade(wc, .72), x, y + 24, 80, 40); px(g, wc, x + 1, y + 25, 78, 34); px(g, shade(wc, 1.25), x + 1, y + 25, 78, 2);
    for (var i = 8; i < 80; i += 8) px(g, shade(wc, .88), x + i, y + 28, 1, 30);
    px(g, '#666b80', x, y + 58, 80, 6); px(g, '#8a8fa5', x, y + 58, 80, 2);
    // roof
    px(g, INK, x - 4, y + 1, 88, 27); px(g, shade(rc, .7), x - 3, y + 2, 86, 25); px(g, rc, x - 3, y + 2, 86, 17); px(g, shade(rc, 1.3), x - 3, y + 2, 86, 2);
    for (i = 0; i < 86; i += 6) px(g, shade(rc, .82), x - 3 + i, y + 4, 1, 15);
    px(g, shade(rc, .5), x - 3, y + 24, 86, 3);
    // antenna with blinking light
    px(g, INK, x + 62, y - 9, 3, 11); px(g, '#8a8fa5', x + 63, y - 8, 1, 10); px(g, (t % 1) < .5 ? '#ff4a4a' : '#6a2a2a', x + 62, y - 11, 3, 3);
    // neon sign plaque
    px(g, INK, x + 7, y + 6, 66, 13); px(g, '#1c1830', x + 8, y + 7, 64, 11);
    g.globalAlpha = Math.sin(t * 37) > -.93 ? 1 : .35;
    px(g, NEON, x + 8, y + 7, 64, 1); px(g, NEON, x + 8, y + 17, 64, 1);
    txt(g, 'ASTEROIDS', x + 40 - tw('ASTEROIDS') / 2, y + 10, NEON);
    g.globalAlpha = 1;
    // door
    px(g, INK, x + 30, y + 41, 20, 23); px(g, '#85572b', x + 32, y + 43, 16, 21); px(g, '#a8743c', x + 32, y + 43, 16, 1); px(g, '#5c3a1e', x + 39, y + 43, 2, 21);
    px(g, '#ffd45e', x + 44, y + 54, 2, 2); px(g, '#b3b8cb', x + 29, y + 62, 22, 2);
    // two mini "space screens" instead of windows
    for (var s = 0; s < 2; s++) {
      var wx = s ? x + 55 : x + 5, wy = y + 33;
      px(g, INK, wx - 1, wy - 1, 22, 14); px(g, dark > .3 ? '#0a1a2e' : '#04101c', wx, wy, 20, 12);
      for (var k = 0; k < 6; k++) { if (((k * 7 + Math.floor(t * 2 + s)) % 4) !== 0) px(g, '#9fd8ff', wx + (k * 7 + s * 3) % 19, wy + (k * 5 + s) % 11, 1, 1); }
      var cx = wx + 10, cy = wy + 6;
      if (!s) { // spinning rock
        var a = t * 1.2, r = [4.5, 3.5, 5, 3.5, 4.5, 3.5, 5];
        for (k = 0; k < r.length; k++) { var a0 = a + k / r.length * TAU, a1 = a + (k + 1) / r.length * TAU, r1 = r[(k + 1) % r.length];
          ln(g, cx + Math.cos(a0) * r[k], cy + Math.sin(a0) * r[k], cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1, '#b8ffd0'); }
      } else { // ship + flying bullet
        ln(g, cx + 4, cy, cx - 3, cy - 3, '#b8ffd0'); ln(g, cx - 3, cy - 3, cx - 1, cy, '#b8ffd0'); ln(g, cx - 1, cy, cx - 3, cy + 3, '#b8ffd0'); ln(g, cx - 3, cy + 3, cx + 4, cy, '#b8ffd0');
        px(g, '#ffd45e', wx + (t * 14) % 20, cy - 1, 2, 1);
      }
      if (dark > .3) { g.globalAlpha = .12 + .1 * dark; px(g, '#7affc8', wx, wy, 20, 12); g.globalAlpha = 1; }
      px(g, '#5c3a1e', wx - 1, wy + 13, 22, 3);
    }
  }

  var plugin = {manifest: manifest, building: {draw: drawBuilding}};
  (globalThis.HubGames = globalThis.HubGames || []).push(plugin);
})();
