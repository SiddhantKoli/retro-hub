/*
 * TURBO LAP: Retro Hub mini game plugin (one file = building + game)
 * ---------------------------------------------------------------
 * Top-down drift racer, 3 laps against the clock, with a ghost car replaying your best lap.
 * Self-contained: no libraries, no assets, no network. Targets a 320x180 canvas.
 * Registers itself in window.HubGames and also exports via module.exports.
 *
 * WHAT THE HUB MUST DO (same contract as the other plugins)
 *   const G = HubGames.find(g => g.manifest.id === 'turbo-lap-by-siddhant');
 *
 *   1) BUILDING (town map, next to the Racing Track zone)
 *      G.building.draw(ctx2d, screenX, screenY, timeSeconds, darkness01)
 *        - draws an 80x64 garage; (screenX, screenY) is its top-left. The roof flag
 *          sticks ~10px above y. Y-sort the building by (y + 64).
 *      G.building.collider = {x:0, y:24, w:80, h:40}   (relative to top-left)
 *      G.building.door     = {x:40, y:68}              (stand here, press E)
 *
 *   2) GAME (after the player presses E at the door)
 *      G.Scene.start({ exit, reportScore, beep, isMuted })   once, when launching
 *      G.Scene.update(dt, keys)    every frame (keys = {KeyW:1, KeyA:1, Space:1, ...})
 *      G.Scene.draw(ctx2d)         every frame, fills the whole 320x180 canvas
 *      G.Scene.key(e.code)         forward keydown events (Space/Enter/R/Esc)
 *      G.Scene.end()               when leaving (also stops the engine sound)
 *    ctx.exit()              called when the player presses Esc
 *    ctx.reportScore(n)      called once when the race is finished (points; higher is better)
 *    ctx.beep(f,d,type,vol,f2)  optional: hub sound function. Falls back to WebAudio.
 *    ctx.isMuted()           optional: lets the engine hum respect the hub's mute toggle.
 *
 *   GHOST DATA (for persistence or sharing through pull requests)
 *      G.Scene.exportGhost()        -> JSON string  {lap: seconds, data: [[x,y,angle], ...]}
 *      G.Scene.importGhost(jsonStr) -> loads a ghost (the best lap of another player)
 *      G.Scene.lastResult           -> {total, laps[], best, medal, score} after a race
 *
 * CONTROLS: W gas, S brake/reverse, A/D steer, Space handbrake (drift), R restart, Esc exit.
 */
(function () {
  'use strict';
  var W = 320, H = 180, TAU = Math.PI * 2, WW = 1200, WH = 760, TWD = 46, LAPS = 3;
  var PAR = 17; // seconds per lap for the gold medal (average over the race)

  var manifest = {
    id: 'turbo-lap-by-siddhant',
    name: 'TURBO LAP',
    author: 'siddhant-k',
    description: 'Drift around the circuit and beat your own ghost. Three laps, one best time.',
    version: '1.0.0',
    controls: 'W/S gas and brake, A/D steer, SPACE handbrake'
  };

  // ---------- tiny helpers ----------
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
  function ln(g, x0, y0, x1, y1, c) {
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
  function mk(w, h) {
    var c = (typeof document !== 'undefined') ? document.createElement('canvas') : globalThis.__mkCanvas(w, h);
    c.width = w; c.height = h; return c;
  }
  function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
  function fmt(t) { if (t == null) return '--:--.--'; var m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100); return pad(m, 2) + ':' + pad(s, 2) + '.' + pad(cs, 2); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function angDiff(a, b) { var d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

  // ====================================================================
  //  BUILDING: the garage (80x64, same layout as the hub's other buildings)
  // ====================================================================
  var NEON = '#ff9a3a';
  function drawBuilding(g, x, y, t, dark) {
    t = t || 0; dark = dark || 0;
    var wc = '#9aa0b8', rc = '#2a2f3c', INK = '#14101f', i, k;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 3, y + 60, 84, 7);
    px(g, INK, x - 1, y + 23, 82, 42); px(g, shade(wc, .7), x, y + 24, 80, 40); px(g, wc, x + 1, y + 25, 78, 34); px(g, shade(wc, 1.2), x + 1, y + 25, 78, 2);
    for (i = 8; i < 80; i += 8) px(g, shade(wc, .88), x + i, y + 28, 1, 30);
    px(g, '#666b80', x, y + 58, 80, 6); px(g, '#8a8fa5', x, y + 58, 80, 2);
    // roof with red/white kerb trim
    px(g, INK, x - 4, y + 1, 88, 27); px(g, shade(rc, .7), x - 3, y + 2, 86, 25); px(g, rc, x - 3, y + 2, 86, 17); px(g, shade(rc, 1.6), x - 3, y + 2, 86, 2);
    for (i = 0; i < 86; i += 6) px(g, shade(rc, .8), x - 3 + i, y + 4, 1, 15);
    for (i = 0; i < 86; i += 6) px(g, (i / 6 | 0) % 2 ? '#f4ecd8' : '#d84a4a', x - 3 + i, y + 21, 6, 5);
    // waving checkered flag on a pole
    px(g, INK, x + 13, y - 11, 3, 14); px(g, '#8a8fa5', x + 14, y - 10, 1, 13);
    for (i = 0; i < 12; i++) for (k = 0; k < 6; k++) px(g, (((i / 3) | 0) + ((k / 3) | 0)) % 2 ? '#14101f' : '#f4ecd8', x + 16 + i, y - 10 + k + Math.sin(t * 6 + i * .7) * 1.3, 1, 1);
    // neon plaque with flag icons
    px(g, INK, x + 7, y + 6, 66, 13); px(g, '#1c1830', x + 8, y + 7, 64, 11);
    g.globalAlpha = Math.sin(t * 37) > -.93 ? 1 : .35;
    px(g, NEON, x + 8, y + 7, 64, 1); px(g, NEON, x + 8, y + 17, 64, 1);
    txt(g, 'TURBO LAP', x + 40 - tw('TURBO LAP') / 2, y + 10, NEON);
    for (i = 0; i < 2; i++) for (k = 0; k < 2; k++) { px(g, (i + k) % 2 ? '#14101f' : '#f4ecd8', x + 11 + i * 3, y + 10 + k * 3, 3, 3); px(g, (i + k) % 2 ? '#14101f' : '#f4ecd8', x + 61 + i * 3, y + 10 + k * 3, 3, 3); }
    g.globalAlpha = 1;
    // rolling garage door (partly raised) with a car nose inside
    px(g, INK, x + 25, y + 38, 30, 26); px(g, '#10131a', x + 26, y + 39, 28, 25);
    px(g, '#d84a4a', x + 30, y + 56, 20, 6); px(g, '#8a2a2a', x + 30, y + 60, 20, 2); px(g, '#ffd45e', x + 31, y + 57, 3, 2); px(g, '#ffd45e', x + 46, y + 57, 3, 2);
    if (dark > .3) { g.globalAlpha = .35 * dark; px(g, '#ffe9a0', x + 27, y + 52, 26, 10); g.globalAlpha = 1; }
    var raise = 14 + Math.sin(t * .7) * 3;
    for (i = 0; i < 26; i += 3) { if (i < raise) px(g, i % 6 ? '#b3b8cb' : '#8a8fa5', x + 26, y + 39 + i, 28, 2); }
    px(g, '#b3b8cb', x + 24, y + 62, 32, 2);
    // left screen: spinning tire
    var wx = x + 3, wy = y + 33;
    px(g, INK, wx - 1, wy - 1, 22, 14); px(g, '#06101a', wx, wy, 20, 12);
    var cx = wx + 10, cy = wy + 6, a = t * 3, n = 10;
    for (k = 0; k < n; k++) { var a0 = a + k / n * TAU, a1 = a + (k + 1) / n * TAU; ln(g, cx + Math.cos(a0) * 5, cy + Math.sin(a0) * 5, cx + Math.cos(a1) * 5, cy + Math.sin(a1) * 5, '#e8e8f0'); }
    for (k = 0; k < 4; k++) ln(g, cx, cy, cx + Math.cos(a + k * 1.5708) * 4, cy + Math.sin(a + k * 1.5708) * 4, '#d84a4a');
    // right screen: lap timer
    wx = x + 57;
    px(g, INK, wx - 1, wy - 1, 22, 14); px(g, '#06101a', wx, wy, 20, 12);
    var ss = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
    txt(g, pad(ss, 2) + '.' + pad(cs, 2), wx + 10 - tw('00.00') / 2, wy + 4, '#3dff8a');
    for (i = 0; i < 2; i++) { var sx = i ? x + 57 : x + 3; if (dark > .3) { g.globalAlpha = .12 + .1 * dark; px(g, '#9fd8ff', sx, wy, 20, 12); g.globalAlpha = 1; } px(g, '#5c3a1e', sx - 1, wy + 13, 22, 3); }
    px(g, '#14101f', x + 38, y + 45, 4, 1);
  }

  // ====================================================================
  //  TRACK (built once: smooth loop, baked into a pixel-crisp image)
  // ====================================================================
  var CP = [[280, 600], [520, 625], [760, 615], [960, 570], [1050, 450], [990, 330], [860, 290], [780, 200], [650, 130], [480, 150], [400, 260], [300, 300], [190, 240], [130, 340], [150, 470]];
  var TR = null, pts = [], ang = [], N = 0;
  function cr(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t, o = [];
    for (var i = 0; i < 2; i++) o.push(.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
    return o;
  }
  function hash(x, y) { var h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function offs(i, w) { var a = ang[i], p = pts[i]; return [p[0] - Math.sin(a) * w, p[1] + Math.cos(a) * w, p[0] + Math.sin(a) * w, p[1] - Math.cos(a) * w]; }
  function ring(x, w) {
    var i, o;
    x.beginPath();
    for (i = 0; i < N; i++) { o = offs(i, w); i ? x.lineTo(o[0], o[1]) : x.moveTo(o[0], o[1]); } x.closePath();
    for (i = 0; i < N; i++) { o = offs(i, w); i ? x.lineTo(o[2], o[3]) : x.moveTo(o[2], o[3]); } x.closePath();
    x.fill('evenodd');
  }
  function buildTrack() {
    if (TR) return;
    var n = CP.length, SEG = 24, i, j, x, y;
    pts = []; ang = [];
    for (i = 0; i < n; i++) for (j = 0; j < SEG; j++) pts.push(cr(CP[(i - 1 + n) % n], CP[i], CP[(i + 1) % n], CP[(i + 2) % n], j / SEG));
    N = pts.length;
    for (i = 0; i < N; i++) { var a = pts[(i + 1) % N], b = pts[(i - 1 + N) % N]; ang.push(Math.atan2(a[1] - b[1], a[0] - b[0])); }
    var c = mk(WW, WH), g = c.getContext('2d');
    g.fillStyle = '#4a9a48'; g.fillRect(0, 0, WW, WH);
    g.fillStyle = '#f4ecd8'; ring(g, TWD / 2 + 5);                       // white kerb base
    g.fillStyle = '#d84a4a';                                              // red kerb stripes
    for (i = 0; i < N; i += 6) {
      g.beginPath(); var o;
      for (j = 0; j <= 3; j++) { o = offs((i + j) % N, TWD / 2 + 5); j ? g.lineTo(o[0], o[1]) : g.moveTo(o[0], o[1]); }
      for (j = 3; j >= 0; j--) { o = offs((i + j) % N, TWD / 2 - 1); g.lineTo(o[0], o[1]); }
      g.closePath(); g.fill();
      g.beginPath();
      for (j = 0; j <= 3; j++) { o = offs((i + j) % N, TWD / 2 + 5); j ? g.lineTo(o[2], o[3]) : g.moveTo(o[2], o[3]); }
      for (j = 3; j >= 0; j--) { o = offs((i + j) % N, TWD / 2 - 1); g.lineTo(o[2], o[3]); }
      g.closePath(); g.fill();
    }
    g.fillStyle = '#363948'; ring(g, TWD / 2);                            // asphalt
    g.strokeStyle = '#f0d060'; g.lineWidth = 2;                           // dashed centre line
    for (i = 0; i < N; i++) if (i % 4 < 2) { g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[(i + 1) % N][0], pts[(i + 1) % N][1]); g.stroke(); }
    // start/finish checker
    g.save(); g.translate(pts[0][0], pts[0][1]); g.rotate(ang[0]);
    for (y = -TWD / 2; y < TWD / 2; y += 4) for (x = -4; x < 4; x += 4) { g.fillStyle = (((x + 4) / 4 + (y + TWD / 2) / 4) % 2) ? '#14101f' : '#e8e8f0'; g.fillRect(x, y, 4, 4); }
    g.restore();
    // snap everything to a strict palette (crisp pixels) and record surface type
    var d = g.getImageData(0, 0, WW, WH), D = d.data, surf = new Uint8Array(WW * WH);
    var PAL = [[74, 154, 72, 2], [54, 57, 72, 0], [216, 74, 74, 1], [244, 236, 216, 1], [240, 208, 96, 0], [20, 16, 31, 0], [232, 232, 240, 0]];
    var GR = [[58, 128, 64], [74, 154, 72], [102, 180, 85]], p, bi, bd, q, dd, k;
    for (p = 0; p < WW * WH; p++) {
      var r = D[p * 4], gg = D[p * 4 + 1], bb = D[p * 4 + 2]; bd = 1e9; bi = 0;
      for (k = 0; k < PAL.length; k++) { dd = (r - PAL[k][0]) * (r - PAL[k][0]) + (gg - PAL[k][1]) * (gg - PAL[k][1]) + (bb - PAL[k][2]) * (bb - PAL[k][2]); if (dd < bd) { bd = dd; bi = k; } }
      var col = PAL[bi]; surf[p] = col[3];
      if (bi === 0) { var hh = hash(p % WW, (p / WW) | 0), gc = hh % 11 === 0 ? GR[0] : hh % 13 === 0 ? GR[2] : GR[1]; col = gc; }
      D[p * 4] = col[0]; D[p * 4 + 1] = col[1]; D[p * 4 + 2] = col[2]; D[p * 4 + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    // decoration (only on grass): flowers, trees, grandstand
    function grass(px_, py_) { return px_ > 8 && py_ > 8 && px_ < WW - 8 && py_ < WH - 8 && surf[(py_ | 0) * WW + (px_ | 0)] === 2; }
    for (i = 0; i < 520; i++) { x = rnd() * WW | 0; y = rnd() * WH | 0; if (grass(x, y)) { g.fillStyle = ['#f4a8c8', '#ffd45e', '#f4ecd8', '#c8a8f4'][i % 4]; g.fillRect(x, y, 2, 2); } }
    function blob(cx, cy, r, col) { g.fillStyle = col; for (var dy = -r; dy <= r; dy++) { var hw = Math.floor(Math.sqrt(r * r - dy * dy + .5)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); } }
    var placed = 0;
    for (i = 0; i < 4000 && placed < 90; i++) {
      x = 14 + rnd() * (WW - 28) | 0; y = 14 + rnd() * (WH - 28) | 0;
      if (!grass(x, y) || !grass(x - 12, y) || !grass(x + 12, y) || !grass(x, y - 12) || !grass(x, y + 12) || !grass(x + 9, y + 9) || !grass(x - 9, y - 9)) continue;
      if (x > 200 && x < 440 && y > 635) continue;
      var rr = 7 + (rnd() * 3 | 0);
      blob(x + 3, y + 3, rr, 'rgba(20,40,20,.45)'); blob(x, y, rr + 1, '#14101f'); blob(x, y, rr, '#3a8040'); blob(x - 1, y - 1, rr - 2, '#4a9a48'); blob(x - 3, y - 3, 3, '#66b455');
      placed++;
    }
    // grandstand by the start straight
    g.fillStyle = '#14101f'; g.fillRect(218, 650, 204, 32);
    g.fillStyle = '#666b80'; g.fillRect(220, 652, 200, 28); g.fillStyle = '#8a8fa5'; g.fillRect(220, 652, 200, 3);
    for (x = 222; x < 418; x += 5) for (y = 658; y < 678; y += 6) { g.fillStyle = ['#d84a4a', '#4a6ae0', '#ffd45e', '#f4ecd8', '#4aa860', '#e870a8'][((x * 7 + y * 3) >> 2) % 6]; g.fillRect(x, y, 3, 3); }
    g.fillStyle = '#d84a4a'; g.fillRect(218, 646, 204, 5); for (x = 218; x < 422; x += 12) { g.fillStyle = '#f4ecd8'; g.fillRect(x, 646, 6, 5); }
    // minimap
    var mm = mk(58, 38), m = mm.getContext('2d'), s = .046;
    for (i = 0; i < N; i++) { var q2 = pts[(i + 1) % N]; ln(m, 3 + pts[i][0] * s, 2 + pts[i][1] * s, 3 + q2[0] * s, 2 + q2[1] * s, '#b3b8cb'); }
    px(m, '#d84a4a', 3 + pts[0][0] * s - 1, 2 + pts[0][1] * s - 2, 2, 4);
    TR = { img: c, surf: surf, mini: mm, ms: s };
  }
  function surfAt(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= WW || y >= WH) return 2; return TR.surf[y * WW + x]; }

  // ====================================================================
  //  CAR SPRITES (pixel-rotated so they stay crisp)
  // ====================================================================
  var ART = ['..kk......kk..', '.rrrrrrrrrrrr.', 'rrrrrdggrrrrry', 'rwwwwdggwwwwwy', 'rwwwwdggwwwwwy', 'rrrrrdggrrrrry', '.rrrrrrrrrrrr.', '..kk......kk..'];
  var CS = null, GS = null, SS = null, KS = 32;
  function carSprites() {
    if (CS) return; CS = []; GS = []; SS = [];
    var P = { r: '#d84a4a', w: '#f4ecd8', d: '#8a2a2a', g: '#9fd8ff', k: '#14101f', y: '#ffe9a0' }, PG = { r: '#7ad8ff', w: '#d8f4ff', d: '#3a8ab8', g: '#ffffff', k: '#2a5a7a', y: '#ffffff' };
    for (var s = 0; s < KS; s++) {
      var a = s / KS * TAU, c = Math.cos(a), si = Math.sin(a), cv = [mk(24, 24), mk(24, 24), mk(24, 24)], cx = cv.map(function (v) { return v.getContext('2d'); });
      for (var v = -12; v < 12; v++) for (var u = -12; u < 12; u++) {
        var sx = Math.floor((u + .5) * c + (v + .5) * si + 7), sy = Math.floor(-(u + .5) * si + (v + .5) * c + 4);
        if (sx < 0 || sx > 13 || sy < 0 || sy > 7) continue; var ch = ART[sy][sx]; if (ch === '.') continue;
        cx[0].fillStyle = P[ch]; cx[0].fillRect(u + 12, v + 12, 1, 1); cx[1].fillStyle = PG[ch]; cx[1].fillRect(u + 12, v + 12, 1, 1); cx[2].fillStyle = 'rgba(0,0,0,.32)'; cx[2].fillRect(u + 12, v + 12, 1, 1);
      }
      CS.push(cv[0]); GS.push(cv[1]); SS.push(cv[2]);
    }
  }

  // ====================================================================
  //  GAME STATE
  // ====================================================================
  var S = null, ctx = {}, AC = null, eng = null;
  var ghost = null, ghostLap = null;   // best lap ever (this session): array of [x,y,angle]
  var SKc = null, SKg = null, lastResult = null;

  function sfx(f, d, type, v, f2) {
    if (ctx && ctx.beep) return ctx.beep(f, d, type, v, f2);
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var o = AC.createOscillator(), a = AC.createGain(), n = AC.currentTime;
      o.type = type || 'square'; o.frequency.setValueAtTime(f, n);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + d);
      a.gain.setValueAtTime(v || .04, n); a.gain.exponentialRampToValueAtTime(.001, n + d);
      o.connect(a); a.connect(AC.destination); o.start(); o.stop(n + d);
    } catch (e) {}
  }
  function engineOn() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (eng) return; var o = AC.createOscillator(), gn = AC.createGain(), f = AC.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 50; f.type = 'lowpass'; f.frequency.value = 500; gn.gain.value = 0;
      o.connect(f); f.connect(gn); gn.connect(AC.destination); o.start(); eng = { o: o, g: gn };
    } catch (e) {}
  }
  function engineSet(spd, on) {
    if (!eng) return; var muted = ctx && ctx.isMuted && ctx.isMuted();
    try { eng.o.frequency.value = 48 + spd * .85; eng.g.gain.value = (on && !muted) ? .018 + Math.min(spd, 170) / 170 * .02 : 0; } catch (e) {}
  }
  function engineOff() { if (!eng) return; try { eng.o.stop(); } catch (e) {} eng = null; }

  function fresh(st) {
    buildTrack(); carSprites();
    if (!SKc) { SKc = mk(WW, WH); SKg = SKc.getContext('2d'); }
    SKg.clearRect(0, 0, WW, WH);
    var i0 = 6;
    S = { st: st, t: 0, ct: 3.99, lastN: 4, car: { x: pts[i0][0], y: pts[i0][1], a: ang[i0], vx: 0, vy: 0, spd: 0, lat: 0, surf: 0 },
      idx: i0, cps: 0, lap: 0, lapT: 0, raceT: 0, laps: [], rec: [], recT: 0, parts: [], banner: null, wrong: 0, medal: null, shake: 0, thrT: 0, sk: 0,
      cam: { x: clamp(pts[i0][0] - W / 2, 0, WW - W), y: clamp(pts[i0][1] - H / 2, 0, WH - H) } };
  }
  function startCount() { fresh('count'); }
  function puff(x, y, c, n, sp) { for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = Math.random() * sp; S.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .35 + Math.random() * .4, m: .75, c: c, s: 1 + (Math.random() * 2 | 0) }); } }

  function drive(dt, ctl) {
    var c = S.car, ca = Math.cos(c.a), sa = Math.sin(c.a);
    var fwd = c.vx * ca + c.vy * sa, lat = -c.vx * sa + c.vy * ca;
    var sf = surfAt(c.x, c.y); c.surf = sf;
    if (ctl.gas) fwd += 200 * dt;
    if (ctl.brake) fwd += (fwd > 8 ? -320 : -110) * dt;
    fwd -= fwd * (sf === 2 ? 3.2 : 1.1) * dt;                     // drag (grass is slow)
    if (ctl.hand) fwd *= Math.pow(.55, dt);
    fwd = clamp(fwd, -55, 185);
    lat *= Math.pow(ctl.hand ? .3 : (sf === 2 ? .02 : .012), dt);  // grip: handbrake lets the rear slide
    var steer = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
    var rate = steer * 2.8 * clamp(Math.abs(fwd) / 45, 0, 1) / (1 + Math.abs(fwd) / 280) * (fwd >= 0 ? 1 : -1) * (ctl.hand ? 1.35 : 1);
    c.a += rate * dt;
    ca = Math.cos(c.a); sa = Math.sin(c.a);
    c.vx = fwd * ca - lat * sa; c.vy = fwd * sa + lat * ca;
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.x < 6) { c.x = 6; c.vx = Math.abs(c.vx) * .3; } if (c.x > WW - 6) { c.x = WW - 6; c.vx = -Math.abs(c.vx) * .3; }
    if (c.y < 6) { c.y = 6; c.vy = Math.abs(c.vy) * .3; } if (c.y > WH - 6) { c.y = WH - 6; c.vy = -Math.abs(c.vy) * .3; }
    c.spd = Math.hypot(c.vx, c.vy); c.lat = lat; c.fwd = fwd;
    // effects: skid marks, smoke, dust, kerb rumble
    var slide = Math.abs(lat) > 32 || (ctl.hand && c.spd > 60);
    if (slide && sf !== 2) {
      for (var s = -1; s <= 1; s += 2) { SKg.fillStyle = 'rgba(12,12,20,.4)'; SKg.fillRect(Math.round(c.x - ca * 5 - sa * 3 * s), Math.round(c.y - sa * 5 + ca * 3 * s), 2, 2); }
      if (Math.random() < dt * 25) puff(c.x - ca * 6, c.y - sa * 6, '#c8c8d8', 1, 14);
      S.sk -= dt; if (S.sk <= 0) { sfx(220 + Math.random() * 60, .07, 'sawtooth', .02); S.sk = .09; }
    }
    if (sf === 2 && c.spd > 35 && Math.random() < dt * 40) puff(c.x - ca * 5, c.y - sa * 5, '#b49064', 1, 24);
    if (sf === 1 && c.spd > 45) { S.shake = Math.max(S.shake, .8); S.thrT -= dt; if (S.thrT <= 0) { sfx(90, .04, 'square', .02); S.thrT = .07; } }
  }
  function trackPos() {
    var c = S.car, best = 1e9, bi = S.idx, prev = S.idx;
    for (var d = -30; d <= 30; d++) { var i = (S.idx + d + N) % N, dx = pts[i][0] - c.x, dy = pts[i][1] - c.y, q = dx * dx + dy * dy; if (q < best) { best = q; bi = i; } }
    S.idx = bi; return prev;
  }
  function medalFor(total) {
    var per = total / LAPS; if (per <= PAR) return 'GOLD'; if (per <= PAR * 1.14) return 'SILVER'; if (per <= PAR * 1.35) return 'BRONZE'; return 'NONE';
  }
  function finishLap() {
    var lt = S.lapT; S.laps.push(lt); S.lap++;
    var isBest = (ghostLap == null || lt < ghostLap);
    if (isBest) { ghostLap = lt; ghost = S.rec.slice(); }
    S.banner = { s: 'LAP ' + S.lap + '  ' + fmt(lt), t: 2.2, c: isBest ? '#3dff8a' : '#f4ecd8', sub: isBest ? 'NEW BEST LAP!' : '' };
    sfx(isBest ? 988 : 660, .2, 'square', .05, isBest ? 1568 : 880);
    S.rec = []; S.recT = 0; S.lapT = 0; S.cps = 0;
    if (S.lap >= LAPS) {
      S.st = 'done'; S.total = S.raceT; S.medal = medalFor(S.total);
      var bonus = { GOLD: 500, SILVER: 300, BRONZE: 150, NONE: 0 }[S.medal], score = Math.max(0, Math.round(100 + bonus + Math.max(0, PAR * 1.35 * LAPS - S.total) * 10));
      lastResult = { total: S.total, laps: S.laps.slice(), best: Math.min.apply(null, S.laps), medal: S.medal, score: score };
      Scene.lastResult = lastResult;
      sfx(523, .5, 'square', .06, 1046); if (ctx.reportScore) ctx.reportScore(score);
    }
  }

  var Scene = {
    lastResult: null,
    start: function (c) { ctx = c || ctx || {}; fresh('ready'); engineOn(); },
    end: function () { engineOff(); S = null; },
    key: function (code) {
      if (!S) return;
      if (code === 'Escape') { if (ctx.exit) ctx.exit(); return; }
      if (code === 'Space' || code === 'Enter' || code === 'KeyE') { if (S.st === 'ready' || S.st === 'done') startCount(); }
      if (code === 'KeyR' && S.st !== 'ready') startCount();
    },
    exportGhost: function () { return ghost ? JSON.stringify({ lap: ghostLap, data: ghost }) : ''; },
    importGhost: function (js) { try { var o = JSON.parse(js); if (o && o.data && o.data.length > 5) { ghost = o.data; ghostLap = o.lap; return true; } } catch (e) {} return false; },
    update: function (dt, keys) {
      if (!S) fresh('ready');
      dt = Math.min(dt || 0, .05); keys = keys || {};
      S.t += dt; S.shake = Math.max(0, S.shake - dt * 4);
      var c = S.car, ctl = { gas: 0, brake: 0, left: 0, right: 0, hand: 0 };
      if (S.st === 'count') {
        S.ct -= dt; var n = Math.ceil(S.ct);
        if (n !== S.lastN) { S.lastN = n; if (n > 0) sfx(440, .12, 'square', .05); }
        if (S.ct <= 0) { S.st = 'race'; S.banner = { s: 'GO!', t: 1, c: '#ffd45e', sub: '' }; sfx(880, .4, 'square', .06, 1320); }
      }
      if (S.st === 'race') {
        ctl.gas = keys.KeyW || keys.ArrowUp; ctl.brake = keys.KeyS || keys.ArrowDown; ctl.left = keys.KeyA || keys.ArrowLeft; ctl.right = keys.KeyD || keys.ArrowRight; ctl.hand = keys.Space;
        S.raceT += dt; S.lapT += dt;
        S.recT += dt; while (S.recT >= .05) { S.recT -= .05; S.rec.push([+c.x.toFixed(1), +c.y.toFixed(1), +c.a.toFixed(2)]); }
      }
      if (S.st === 'race' || S.st === 'done') {
        if (S.st === 'done') ctl.brake = 1;
        drive(dt, ctl);
        var prev = trackPos(), bi = S.idx;
        if (S.st === 'race') {
          if (prev > N * .75 && bi < N * .25) { if (S.cps === 3) finishLap(); }
          else if (prev < N * .25 && bi > N * .75) S.cps = 0;
          var thr = N * (S.cps + 1) / 4;
          if (S.cps < 3 && bi >= thr && bi < thr + N * .2) { S.cps++; sfx(1200, .06, 'square', .03); }
          var tx = Math.cos(ang[bi]), ty = Math.sin(ang[bi]);
          S.wrong = (c.vx * tx + c.vy * ty < -30) ? S.wrong + dt : 0;
        }
      }
      engineSet(c.spd, S.st !== 'ready' && S.st !== 'done');
      // camera with look-ahead
      var tx2 = clamp(c.x + c.vx * .3 - W / 2, 0, WW - W), ty2 = clamp(c.y + c.vy * .3 - H / 2, 0, WH - H);
      S.cam.x += (tx2 - S.cam.x) * Math.min(1, dt * 6); S.cam.y += (ty2 - S.cam.y) * Math.min(1, dt * 6);
      for (var i = S.parts.length - 1; i >= 0; i--) { var p = S.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; if (p.l <= 0) S.parts.splice(i, 1); }
      if (S.banner && (S.banner.t -= dt) <= 0) S.banner = null;
    },
    draw: function (g) {
      if (!S) fresh('ready');
      g.imageSmoothingEnabled = false;
      var sh = S.shake > 0 ? (Math.random() - .5) * 2 * S.shake : 0, sv = S.shake > 0 ? (Math.random() - .5) * 2 * S.shake : 0;
      var cx = clamp(Math.round(S.cam.x + sh), 0, WW - W), cy = clamp(Math.round(S.cam.y + sv), 0, WH - H);
      g.drawImage(TR.img, cx, cy, W, H, 0, 0, W, H);
      g.drawImage(SKc, cx, cy, W, H, 0, 0, W, H);
      for (var i = 0; i < S.parts.length; i++) { var p = S.parts[i]; g.globalAlpha = clamp(p.l / p.m, 0, 1) * .8; px(g, p.c, p.x - cx, p.y - cy, p.s, p.s); }
      g.globalAlpha = 1;
      // ghost car
      if (ghost && (S.st === 'race' || S.st === 'count')) {
        var f = S.st === 'race' ? S.lapT / .05 : 0, k = Math.min(ghost.length - 1, Math.floor(f)), k2 = Math.min(ghost.length - 1, k + 1), fr = f - Math.floor(f);
        if (k >= ghost.length - 1) fr = 0;
        var gx = ghost[k][0] + (ghost[k2][0] - ghost[k][0]) * fr, gy = ghost[k][1] + (ghost[k2][1] - ghost[k][1]) * fr, ga = ghost[k][2] + angDiff(ghost[k][2], ghost[k2][2]) * fr;
        var gi = ((Math.round(ga / TAU * KS) % KS) + KS) % KS; g.globalAlpha = .5; g.drawImage(GS[gi], Math.round(gx - cx - 12), Math.round(gy - cy - 12)); g.globalAlpha = 1;
        S.gpos = [gx, gy];
      } else S.gpos = null;
      // player car
      var c = S.car, ki = ((Math.round(c.a / TAU * KS) % KS) + KS) % KS;
      g.drawImage(SS[ki], Math.round(c.x - cx - 12 + 2), Math.round(c.y - cy - 12 + 2));
      g.drawImage(CS[ki], Math.round(c.x - cx - 12), Math.round(c.y - cy - 12));
      // ---- HUD ----
      this.hud(g);
    },
    hud: function (g) {
      var c = S.car, i;
      if (S.st === 'ready') {
        px(g, 'rgba(10,6,24,.55)', 0, 0, W, H);
        px(g, '#14101f', 62, 40, 196, 62); px(g, '#6d5fa8', 63, 41, 194, 60); px(g, '#2b2540', 64, 42, 192, 58);
        txt(g, 'TURBO LAP', 160 - tw('TURBO LAP', 3) / 2, 50, NEON, 3, true);
        txt(g, '3 LAPS  -  BEAT YOUR GHOST', 160 - tw('3 LAPS  -  BEAT YOUR GHOST') / 2, 76, '#f4ecd8', 1, true);
        if (Math.floor(S.t * 2) % 2) txt(g, 'PRESS SPACE TO START', 160 - tw('PRESS SPACE TO START') / 2, 88, '#ffd45e', 1, true);
        txt(g, 'W GAS  S BRAKE  A D STEER  SPACE DRIFT  ESC EXIT', 160 - tw('W GAS  S BRAKE  A D STEER  SPACE DRIFT  ESC EXIT') / 2, 168, '#f4ecd8', 1, true);
        return;
      }
      // top-left timing box
      px(g, '#14101f', 4, 4, 82, 30); px(g, '#6d5fa8', 5, 5, 80, 28); px(g, '#2b2540', 6, 6, 78, 26);
      txt(g, 'LAP ' + Math.min(LAPS, S.lap + 1) + '/' + LAPS, 10, 9, '#ffd45e');
      txt(g, fmt(S.lapT), 10, 17, '#f4ecd8');
      txt(g, 'BEST ' + fmt(ghostLap), 10, 25, '#7ad8ff');
      // minimap
      px(g, '#14101f', W - 64, 4, 60, 40); px(g, '#6d5fa8', W - 63, 5, 58, 38); px(g, '#17122a', W - 62, 6, 56, 36);
      g.drawImage(TR.mini, W - 63, 5);
      px(g, '#ffd45e', W - 63 + 3 + c.x * TR.ms - 1, 5 + 2 + c.y * TR.ms - 1, 3, 3);
      if (S.gpos) px(g, '#7ad8ff', W - 63 + 3 + S.gpos[0] * TR.ms - 1, 5 + 2 + S.gpos[1] * TR.ms - 1, 2, 2);
      // speed bar
      var kmh = Math.round(c.spd * 1.15);
      px(g, '#14101f', 4, H - 18, 92, 14); px(g, '#6d5fa8', 5, H - 17, 90, 12); px(g, '#2b2540', 6, H - 16, 88, 10);
      px(g, '#0a0f14', 36, H - 14, 56, 6);
      var w = Math.round(clamp(c.spd / 185, 0, 1) * 54); px(g, c.spd > 150 ? '#ff6a6a' : c.spd > 100 ? '#ffd45e' : '#3dff8a', 37, H - 13, w, 4);
      txt(g, kmh + ' KMH', 9, H - 13, '#f4ecd8');
      if (S.wrong > .8 && Math.floor(S.t * 4) % 2) txt(g, 'WRONG WAY!', 160 - tw('WRONG WAY!', 2) / 2, 40, '#ff6a6a', 2, true);
      if (S.st === 'count') { var n = Math.max(1, Math.ceil(S.ct)); txt(g, String(n), 160 - tw(String(n), 5) / 2, 50, '#ffd45e', 5, true); }
      if (S.banner) { var b = S.banner; txt(g, b.s, 160 - tw(b.s, 2) / 2, 56, b.c, 2, true); if (b.sub) txt(g, b.sub, 160 - tw(b.sub) / 2, 74, '#ffd45e', 1, true); }
      if (S.st === 'done') {
        px(g, 'rgba(10,6,24,.6)', 0, 0, W, H);
        px(g, '#14101f', 70, 20, 180, 140); px(g, '#6d5fa8', 71, 21, 178, 138); px(g, '#2b2540', 72, 22, 176, 136);
        txt(g, 'FINISH!', 160 - tw('FINISH!', 3) / 2, 28, '#ffd45e', 3, true);
        txt(g, 'TOTAL ' + fmt(S.total), 160 - tw('TOTAL 00:00.00') / 2, 54, '#f4ecd8', 1, true);
        for (i = 0; i < S.laps.length; i++) txt(g, 'LAP ' + (i + 1) + '  ' + fmt(S.laps[i]) + (S.laps[i] === lastResult.best ? '  BEST' : ''), 100, 68 + i * 9, S.laps[i] === lastResult.best ? '#3dff8a' : '#b3b8cb', 1, true);
        var mc = { GOLD: '#ffd45e', SILVER: '#d8dcec', BRONZE: '#d8883a', NONE: '#8a8fa5' }[S.medal];
        px(g, '#14101f', 128, 98, 64, 20); px(g, mc, 129, 99, 62, 18); txt(g, S.medal === 'NONE' ? 'NO MEDAL' : S.medal + ' MEDAL', 160 - tw(S.medal === 'NONE' ? 'NO MEDAL' : S.medal + ' MEDAL') / 2, 105, '#14101f');
        txt(g, 'SCORE ' + lastResult.score, 160 - tw('SCORE ' + lastResult.score) / 2, 126, '#f4ecd8', 1, true);
        if (Math.floor(S.t * 2) % 2) txt(g, 'SPACE: RACE AGAIN', 160 - tw('SPACE: RACE AGAIN') / 2, 140, '#ffd45e', 1, true);
        txt(g, 'ESC: EXIT', 160 - tw('ESC: EXIT') / 2, 150, '#b3b8cb', 1, true);
      } else txt(g, 'R RESTART  SPACE DRIFT  ESC EXIT', W - 4 - tw('R RESTART  SPACE DRIFT  ESC EXIT'), H - 8, '#b3b8cb', 1, true);
    }
  };

  var plugin = {
    manifest: manifest,
    building: { w: 80, h: 64, collider: { x: 0, y: 24, w: 80, h: 40 }, door: { x: 40, y: 68 }, neon: NEON, draw: drawBuilding },
    Scene: Scene
  };
  (globalThis.HubGames = globalThis.HubGames || []).push(plugin);
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;
})();
