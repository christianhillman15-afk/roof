/* ============================================================
   Vertical Solutions Roofing — scroll-scrubbed hero
   Bird's-eye storm-to-restoration timelapse, drawn on <canvas>:
   calm → hail storm damages the roof → tear-off → dry-in →
   new shingles → restored. If assets/hero-timelapse.mp4 exists
   (AI-generated video), the canvas hands off to the video and
   scroll scrubs it instead.
   ============================================================ */
(function () {
  "use strict";

  // ---------- deterministic RNG so the scene never flickers ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const phase = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

  // ---------- timeline ----------
  const T = {
    introEnd: 0.06,
    stormStart: 0.06, stormEnd: 0.22,
    tearStart: 0.24, tearEnd: 0.48,
    underStart: 0.48, underEnd: 0.58,
    instStart: 0.58, instEnd: 0.90,
    capStart: 0.90, capEnd: 0.95,
  };

  // ---------- scene geometry (design space 1600 x 900) ----------
  const W = 1600, H = 900;

  // Roof sections: main house (horizontal ridge) + garage (vertical ridge)
  const ROOFS = [
    { x: 330, y: 250, w: 590, h: 360, ridge: "h" },
    { x: 920, y: 330, w: 230, h: 220, ridge: "v" },
  ];
  const ROW = 26;   // shingle course thickness
  const CELL = 44;  // shingle cell width

  // Build the cell list once (deterministic)
  const cells = [];
  {
    const rnd = mulberry32(1897);
    const minX = 330, maxX = 1150;
    for (const r of ROOFS) {
      if (r.ridge === "h") {
        // rows sized exactly so the two halves meet at the ridge with no gap
        const halfH = r.h / 2;
        const rows = Math.max(1, Math.round(halfH / ROW));
        const rowH = halfH / rows;
        const cols = Math.max(1, Math.round(r.w / CELL));
        const cellW = r.w / cols;
        for (const half of [0, 1]) { // 0 = top half, 1 = bottom half
          for (let ri = 0; ri < rows; ri++) {
            const y0 = half === 0 ? r.y + ri * rowH : r.y + r.h - (ri + 1) * rowH;
            for (let ci = 0; ci < cols; ci++) {
              cells.push(makeCell(r.x + ci * cellW, y0, cellW, rowH, ri, rows, rnd, minX, maxX, half === 0 ? -1 : 1, r));
            }
          }
        }
      } else {
        const halfW = r.w / 2;
        const rows = Math.max(1, Math.round(halfW / ROW));
        const rowW = halfW / rows;
        const cols = Math.max(1, Math.round(r.h / CELL));
        const cellH = r.h / cols;
        for (const half of [0, 1]) { // 0 = left half, 1 = right half
          for (let ri = 0; ri < rows; ri++) {
            const x0 = half === 0 ? r.x + ri * rowW : r.x + r.w - (ri + 1) * rowW;
            for (let ci = 0; ci < cols; ci++) {
              cells.push(makeCell(x0, r.y + ci * cellH, rowW, cellH, ri, rows, rnd, minX, maxX, 0, r));
            }
          }
        }
      }
    }
  }

  function makeCell(x, y, w, h, rowIdx, rowCount, rnd, minX, maxX, sunSide, roof) {
    const cx = x + w / 2;
    const j1 = rnd(), j2 = rnd(), j3 = rnd(), j4 = rnd();
    const xf = (cx - minX) / (maxX - minX); // 0..1 across the whole roofline, L → R
    return {
      x, y, w, h, roof,
      shade: j1,                                   // per-cell tint variation
      damaged: j4 < 0.32,                          // takes a hail/wind hit during the storm
      dmgT: 0.05 + (j4 / 0.32) * 0.85,             // when during the storm the hit lands
      dmgSeed: j2,                                 // pock placement / torn-off variant
      tearT: xf * 0.82 + j1 * 0.18,                // tear-off order (wipe L → R)
      underT: xf * 0.85 + j2 * 0.15,               // underlayment order
      instT: (rowIdx / Math.max(1, rowCount - 1)) * 0.62 + xf * 0.3 + j3 * 0.08, // eave → ridge
      sunSide,
    };
  }

  // ---------- palette ----------
  const C = {
    grass1: "#547c3e", grass2: "#4c7338", grassDark: "#41632f",
    street: "#3c3f45", sidewalk: "#8f8b83", curb: "#6f6b64",
    drive: "#a29b8e", driveLine: "#8d8577",
    wall: "#d8d2c6", walk: "#b7b0a2",
    oldA: "#8a8178", oldB: "#7d746b", oldC: "#948b81", oldStain: "#5a524a",
    oldMissing: "#453e37", pock: "#4a423b",
    deckA: "#b98e5a", deckB: "#ad8250", deckSeam: "#8a6538",
    under: "#8d9096", underSeam: "#75787e",
    newA: "#2e3238", newB: "#343941", newC: "#282c31", newEdge: "#454b55",
    ridgeCap: "#22252a",
    dumpster: "#24558f", dumpsterDark: "#1c4271",
    truck: "#e9e7e1", accent: "#3aa0ff",
  };

  // ---------- one full frame at progress p ----------
  function renderScene(ctx, cw, ch, p, now, opts) {
    const s = Math.max(cw / W, ch / H);
    ctx.save();
    ctx.clearRect(0, 0, cw, ch);
    ctx.translate(cw / 2, ch / 2);
    const zoom = opts && opts.zoom === false ? 1 : 1 + 0.06 * (1 - ease(phase(p, 0, T.introEnd)));
    ctx.scale(s * zoom, s * zoom);
    ctx.translate(-W / 2, -H / 2);

    const stormP = phase(p, T.stormStart, T.stormEnd);
    const stormI = Math.sin(stormP * Math.PI);              // storm rolls in, peaks, clears
    const dmgReveal = ease(phase(p, T.stormStart + 0.02, T.stormEnd - 0.02));
    const tearP = ease(phase(p, T.tearStart, T.tearEnd));
    const underP = ease(phase(p, T.underStart, T.underEnd));
    const instP = ease(phase(p, T.instStart, T.instEnd));
    const capP = ease(phase(p, T.capStart, T.capEnd));

    // Sun drifts as the day passes — shadows swing with it
    const sunA = lerp(-0.45, 0.55, p);
    const shLen = lerp(26, 40, Math.abs(Math.sin(sunA * 2)));
    const shX = Math.sin(sunA) * shLen, shY = Math.cos(sunA) * shLen * 0.6 + 14;

    // ----- ground -----
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.grass1); g.addColorStop(1, C.grass2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rnd = mulberry32(42);
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 46; i++) { // mottled lawn
      ctx.fillStyle = i % 2 ? C.grassDark : "#5f8a47";
      const bx = rnd() * W, by = rnd() * H, br = 30 + rnd() * 90;
      ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.6, rnd() * 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.05; // mow stripes
    for (let x = -H; x < W; x += 90) {
      ctx.fillStyle = "#fff";
      ctx.save(); ctx.translate(x, 0); ctx.rotate(0.5);
      ctx.fillRect(0, -200, 45, H * 2); ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ----- street, sidewalk, driveway -----
    ctx.fillStyle = C.sidewalk; ctx.fillRect(0, 806, W, 26);
    ctx.fillStyle = C.curb; ctx.fillRect(0, 830, W, 5);
    ctx.fillStyle = C.street; ctx.fillRect(0, 835, W, 65);
    ctx.strokeStyle = "#d8d33f"; ctx.lineWidth = 3; ctx.setLineDash([26, 30]);
    ctx.beginPath(); ctx.moveTo(0, 884); ctx.lineTo(W, 884); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.drive; ctx.fillRect(960, 550, 180, 285);
    ctx.strokeStyle = C.driveLine; ctx.lineWidth = 2;
    for (let y = 610; y < 830; y += 62) { ctx.beginPath(); ctx.moveTo(960, y); ctx.lineTo(1140, y); ctx.stroke(); }
    // front walk
    ctx.fillStyle = C.walk; ctx.fillRect(598, 610, 44, 200);

    // ----- house & tree shadows -----
    ctx.fillStyle = "rgba(20,24,16,0.3)";
    for (const r of ROOFS) {
      ctx.beginPath();
      ctx.moveTo(r.x + shX, r.y + shY); ctx.lineTo(r.x + r.w + shX, r.y + shY);
      ctx.lineTo(r.x + r.w + shX, r.y + r.h + shY); ctx.lineTo(r.x + shX, r.y + r.h + shY);
      ctx.closePath(); ctx.fill();
    }

    // ----- trees -----
    drawTree(ctx, 150, 150, 62, shX, shY, 7);
    drawTree(ctx, 1452, 200, 74, shX, shY, 8);
    drawTree(ctx, 180, 705, 52, shX, shY, 9);
    // shrubs along the front wall
    for (let i = 0; i < 6; i++) drawBush(ctx, 380 + i * 46, 622, 14 + (i % 3) * 3);
    for (let i = 0; i < 4; i++) drawBush(ctx, 700 + i * 52, 622, 15 + (i % 2) * 4);

    // ----- wall reveal under eaves -----
    for (const r of ROOFS) {
      ctx.fillStyle = C.wall;
      ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
    }

    // ----- roof cells -----
    for (const cell of cells) {
      let state = 0; // 0 pre-storm/damaged, 1 deck, 2 underlayment, 3 new
      if (instP >= cell.instT) state = 3;
      else if (underP >= cell.underT) state = 2;
      else if (tearP >= cell.tearT) state = 1;
      const dmg = state === 0 && cell.damaged && dmgReveal >= cell.dmgT;
      drawCell(ctx, cell, state, dmg);
    }

    // ----- eave outline for definition -----
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 3;
    for (const r of ROOFS) ctx.strokeRect(r.x, r.y, r.w, r.h);

    // ----- ridge caps once shingling wraps up -----
    if (capP > 0) {
      ctx.strokeStyle = C.ridgeCap; ctx.lineCap = "round";
      const r0 = ROOFS[0], r1 = ROOFS[1];
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(r0.x + 6, r0.y + r0.h / 2);
      ctx.lineTo(r0.x + 6 + (r0.w - 12) * capP, r0.y + r0.h / 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r1.x + r1.w / 2, r1.y + 6);
      ctx.lineTo(r1.x + r1.w / 2, r1.y + 6 + (r1.h - 12) * capP); ctx.stroke();
    }

    // ----- job site props (arrive once the rebuild begins) -----
    if (p >= T.tearStart - 0.02) {
      drawTruck(ctx);
      drawDumpster(ctx, tearP);
    }
    drawPallets(ctx, p, instP);

    // ----- debris flying to the dumpster -----
    if (tearP > 0.02 && tearP < 1) {
      const fx = lerp(330, 1150, tearP); // tear frontier
      for (let i = 0; i < 6; i++) {
        const t = (p * 34 + i * 0.37) % 1;
        const sx = fx - 30 + (i % 3) * 30, sy = 300 + i * 52;
        const dx = 1050, dy = 640;
        const x = lerp(sx, dx, t), y = lerp(sy, dy, t) - Math.sin(t * Math.PI) * 90;
        ctx.globalAlpha = 0.85 * Math.sin(Math.min(1, t) * Math.PI);
        ctx.fillStyle = C.oldB;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 9 + i); ctx.fillRect(-8, -4, 16, 8); ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // ----- the crew -----
    drawCrew(ctx, p, tearP, underP, instP, now);

    // ----- drifting cloud shadows -----
    ctx.globalAlpha = 0.07; ctx.fillStyle = "#0a1408";
    ctx.beginPath(); ctx.ellipse(((p * 900) % (W + 800)) - 400, 200, 300, 120, 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(W - ((p * 600) % (W + 700)) + 300, 650, 260, 100, -0.2, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;

    // ----- the storm itself -----
    if (stormI > 0.01) {
      // sky goes dark
      ctx.fillStyle = "rgba(9,13,22," + (0.42 * stormI).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
      // racing storm-cloud banks
      ctx.globalAlpha = 0.16 * stormI; ctx.fillStyle = "#060a12";
      for (let k = 0; k < 3; k++) {
        const x = ((p * 4200 + k * 640) % (W + 1200)) - 600;
        ctx.beginPath(); ctx.ellipse(x, 140 + k * 260, 420, 150, 0.25, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // driving rain
      const rr = mulberry32(555);
      ctx.strokeStyle = "rgba(200,215,235," + (0.28 * stormI).toFixed(3) + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const bx = rr() * W, by = rr() * H;
        const x = (bx + p * 2400) % W, y = (by + p * 5200) % H;
        ctx.moveTo(x, y); ctx.lineTo(x - 16, y + 30);
      }
      ctx.stroke();
      // hail
      ctx.fillStyle = "rgba(235,242,250," + (0.55 * stormI).toFixed(3) + ")";
      for (let i = 0; i < 40; i++) {
        const bx = rr() * W, by = rr() * H;
        const x = (bx + p * 1500) % W, y = (by + p * 6400) % H;
        ctx.beginPath(); ctx.arc(x, y, 2 + rr() * 2, 0, 7); ctx.fill();
      }
      // lightning strobes
      const f = Math.exp(-Math.pow((stormP - 0.48) / 0.02, 2)) + Math.exp(-Math.pow((stormP - 0.72) / 0.015, 2));
      if (f > 0.01) {
        ctx.fillStyle = "rgba(240,246,255," + (0.5 * f * stormI).toFixed(3) + ")";
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ----- finishing sheen on the new roof -----
    if (p > T.capEnd) {
      const q = phase(p, T.capEnd, 1);
      for (const r of ROOFS) {
        const sh = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        const c = clamp(q * 1.4 - 0.2, 0, 1);
        sh.addColorStop(clamp(c - 0.18, 0, 1), "rgba(255,255,255,0)");
        sh.addColorStop(c, "rgba(255,255,255,0.13)");
        sh.addColorStop(clamp(c + 0.18, 0, 1), "rgba(255,255,255,0)");
        ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    }

    ctx.restore();
  }

  function drawCell(ctx, cell, state, dmg) {
    const { x, y, w, h } = cell;
    if (state === 0) {
      ctx.fillStyle = cell.shade < 0.33 ? C.oldA : cell.shade < 0.66 ? C.oldB : C.oldC;
      ctx.fillRect(x, y, w, h);
      if (dmg) {
        if (cell.dmgSeed > 0.75) { // shingle torn clean off by wind
          ctx.fillStyle = C.oldMissing; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        } else { // hail pocks
          ctx.fillStyle = C.pock;
          const o = cell.dmgSeed;
          ctx.fillRect(x + 4 + o * 10, y + 4, 7, 6);
          ctx.fillRect(x + w * 0.55 - o * 8, y + h * 0.4, 6, 6);
          ctx.fillRect(x + w * 0.3, y + h - 10, 5, 5);
          ctx.fillStyle = C.oldStain; ctx.globalAlpha = 0.4;
          ctx.fillRect(x + 2, y + 2, w - 4, h - 4); ctx.globalAlpha = 1;
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    } else if (state === 1) {
      ctx.fillStyle = cell.shade < 0.5 ? C.deckA : C.deckB;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = C.deckSeam; ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    } else if (state === 2) {
      ctx.fillStyle = C.under; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = C.underSeam; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
    } else {
      ctx.fillStyle = cell.shade < 0.33 ? C.newA : cell.shade < 0.66 ? C.newB : C.newC;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = C.newEdge; ctx.lineWidth = 1;
      if (cell.roof.ridge === "h") {
        ctx.beginPath(); ctx.moveTo(x, y + (cell.sunSide < 0 ? h : 0)); ctx.lineTo(x + w, y + (cell.sunSide < 0 ? h : 0)); ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 3); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.moveTo(x + 3, y + h / 2); ctx.lineTo(x + w - 3, y + h / 2); ctx.stroke();
      }
    }
  }

  function drawTree(ctx, x, y, r, shX, shY, seed) {
    const rnd = mulberry32(seed);
    ctx.fillStyle = "rgba(20,24,16,0.28)";
    ctx.beginPath(); ctx.ellipse(x + shX * 1.4, y + shY * 1.4, r * 1.05, r * 0.8, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = rnd() * 6.28, d = rnd() * r * 0.5;
      ctx.fillStyle = i % 2 ? "#3f6b34" : "#487a3b";
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.5 + rnd() * 0.35), 0, 7); ctx.fill();
    }
    ctx.fillStyle = "#54893f";
    ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.45, 0, 7); ctx.fill();
  }

  function drawBush(ctx, x, y, r) {
    ctx.fillStyle = "rgba(20,24,16,0.25)";
    ctx.beginPath(); ctx.ellipse(x + 5, y + 6, r, r * 0.7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#3e6a33"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = "#4c7d3d"; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, 7); ctx.fill();
  }

  function drawTruck(ctx) {
    ctx.save();
    ctx.translate(300, 838);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(6, 8, 218, 54);
    ctx.fillStyle = C.truck; ctx.fillRect(0, 0, 220, 56);          // bed + cab
    ctx.fillStyle = "#c9c5bc"; ctx.fillRect(150, 0, 70, 56);       // cab roof
    ctx.fillStyle = "#2c3340"; ctx.fillRect(142, 4, 10, 48);       // windshield
    ctx.fillStyle = C.accent; ctx.fillRect(0, 24, 142, 8);         // brand stripe
    ctx.fillStyle = "#5d554b";                                      // ladder in the bed
    ctx.fillRect(12, 14, 118, 4); ctx.fillRect(12, 38, 118, 4);
    for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 20, 14, 4, 28);
    ctx.restore();
  }

  function drawDumpster(ctx, tearP) {
    ctx.save();
    ctx.translate(975, 620);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(5, 6, 150, 92);
    ctx.fillStyle = C.dumpster; ctx.fillRect(0, 0, 150, 92);
    ctx.fillStyle = C.dumpsterDark; ctx.fillRect(8, 8, 134, 76);
    if (tearP > 0.03) { // debris pile grows with tear-off
      const rnd = mulberry32(77);
      const n = Math.floor(90 * tearP);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 3 ? C.oldB : C.oldStain;
        const dx = 12 + rnd() * 124, dy = 12 + rnd() * 66;
        ctx.save(); ctx.translate(dx, dy); ctx.rotate(rnd() * 3); ctx.fillRect(-7, -3, 14, 6); ctx.restore();
      }
    }
    ctx.fillStyle = C.accent; // hazard stripe
    for (let i = 0; i < 5; i++) ctx.fillRect(6 + i * 32, 88, 18, 4);
    ctx.restore();
  }

  function drawPallets(ctx, p, instP) {
    if (p < 0.42) return;
    const left = Math.max(0, 1 - instP); // bundles get used up
    const stacks = [[1190, 590], [1265, 600], [1225, 660]];
    stacks.forEach(([px, py], si) => {
      const bundles = Math.ceil((5 - si) * left);
      if (bundles <= 0) return;
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(px + 4, py + 5, 64, 40);
      ctx.fillStyle = "#8a6538"; ctx.fillRect(px, py, 64, 40);
      for (let b = 0; b < bundles; b++) {
        ctx.fillStyle = b % 2 ? "#31353c" : "#3a3f47";
        ctx.fillRect(px + 4, py + 32 - b * 6, 56, 6);
      }
    });
  }

  function drawCrew(ctx, p, tearP, underP, instP, now) {
    if (p < T.tearStart - 0.01 || p > 0.97) return;
    const active = tearP < 1 ? "tear" : underP < 1 ? "under" : instP < 1 ? "inst" : "done";
    const fxTear = lerp(360, 1130, tearP);
    const fxUnder = lerp(360, 1130, underP);
    const wob = (i) => Math.sin(p * 120 + i * 2.1) * 7;

    for (let i = 0; i < 7; i++) {
      let x, y;
      if (active === "tear") { x = fxTear - 20 + (i % 3) * 34; y = 285 + i * 46; }
      else if (active === "under") { x = fxUnder - 20 + (i % 3) * 34; y = 300 + i * 42; }
      else if (active === "inst") {
        const r0 = ROOFS[0];
        const rowFromEave = instP * (r0.h / 2);
        y = i % 2 ? r0.y + rowFromEave : r0.y + r0.h - rowFromEave;
        x = r0.x + 60 + i * 78 + wob(i);
      } else { x = 1000 + i * 20; y = 760; }
      x += wob(i) * 0.4; y = clamp(y + wob(i + 3) * 0.4, 255, 800);
      // shadow, shoulders, hard hat
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(x + 5, y + 6, 11, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = i % 3 === 0 ? "#e8641f" : "#f07f24";
      ctx.beginPath(); ctx.ellipse(x, y, 11, 7.5, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = i % 4 === 0 ? "#f2f2ee" : "#f4c020";
      ctx.beginPath(); ctx.arc(x, y - 1, 4.6, 0, 7); ctx.fill();
    }
    // two ground crew by the dumpster during tear-off
    if (active === "tear") {
      for (let i = 0; i < 2; i++) {
        const x = 1005 + i * 60 + wob(i + 9) * 0.5, y = 740;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(x + 5, y + 6, 11, 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#f07f24"; ctx.beginPath(); ctx.ellipse(x, y, 11, 7.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#f2f2ee"; ctx.beginPath(); ctx.arc(x, y - 1, 4.6, 0, 7); ctx.fill();
      }
    }
  }

  // Expose for the before/after slider in main.js
  window.VERTICAL_RENDER = renderScene;
  // Progress value where storm damage is fully visible but the sky has cleared
  window.VERTICAL_DAMAGED_P = (T.stormEnd + T.tearStart) / 2;

  // ============================================================
  // Wiring: canvas sizing, scroll scrub, captions, video handoff
  // ============================================================
  const hero = document.getElementById("hero");
  const canvas = document.getElementById("heroCanvas");
  const video = document.getElementById("heroVideo");
  const fill = document.getElementById("heroProgressFill");
  const stageLabel = document.getElementById("heroStageLabel");
  const hint = document.getElementById("scrollHint");
  const captions = Array.from(document.querySelectorAll(".hero__caption"));
  if (!hero || !canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  let cw = 0, ch = 0, dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    needsDraw = true;
  }
  window.addEventListener("resize", resize, { passive: true });

  // ----- optional AI-video mode -----
  let videoMode = false;
  if (video && !reduceMotion) {
    video.addEventListener("loadedmetadata", () => {
      if (video.duration && isFinite(video.duration) && video.duration > 0.5) {
        videoMode = true;
        hero.classList.add("hero--video");
      }
    });
    video.addEventListener("error", () => { videoMode = false; }, true);
    video.load();
  }

  // ----- scroll → VIDEO-TIME remap -----
  // The AI clip briefly "teleports" the tear-off around 1.0–1.9s. To keep
  // scroll-scrubbing smooth we dwell on the crappy "before" roof, then rush
  // through that jump in a narrow scroll band (right as the tear-off caption
  // appears, so it reads as intentional), then play the rest evenly.
  // Control points: [scrollFraction, videoFraction], piecewise-linear.
  const VIDEO_CURVE = [
    [0.00, 0.00],
    [0.24, 0.12], // hold the failing roof through the "before"/"damage" beats
    [0.33, 0.32], // whip through the teleport + into active tear-off
    [0.56, 0.55], // tear-off → underlayment
    [1.00, 1.00], // new shingles → restored
  ];
  function scrollToVideoFrac(p) {
    for (let i = 1; i < VIDEO_CURVE.length; i++) {
      const [s1, v1] = VIDEO_CURVE[i];
      if (p <= s1) {
        const [s0, v0] = VIDEO_CURVE[i - 1];
        const t = s1 === s0 ? 0 : (p - s0) / (s1 - s0);
        return v0 + (v1 - v0) * t;
      }
    }
    return 1;
  }

  // ----- scroll → progress -----
  let target = 0, shown = -1, needsDraw = true;
  const STAGES = [
    [0.07, "Before the storm"], [0.25, "The storm"], [0.50, "Tear-off"],
    [0.60, "Dry-in"], [0.88, "New shingles"], [1.01, "Restored"],
  ];

  function readScroll() {
    const rect = hero.getBoundingClientRect();
    const total = hero.offsetHeight - window.innerHeight;
    target = total > 0 ? clamp(-rect.top / total, 0, 1) : 1;
  }
  window.addEventListener("scroll", readScroll, { passive: true });

  function updateOverlay(p) {
    let stage = 0;
    for (let i = 0; i < STAGES.length; i++) { if (p < STAGES[i][0]) { stage = i; break; } stage = i; }
    captions.forEach((el) => el.classList.toggle("is-active", +el.dataset.stage === stage));
    if (stageLabel) stageLabel.textContent = STAGES[stage][1];
    if (fill) fill.style.height = (p * 100).toFixed(1) + "%";
    if (hint) hint.classList.toggle("is-hidden", p > 0.02);
  }

  function tick(now) {
    if (Math.abs(target - (shown < 0 ? 0 : shown)) > 0.0004 || needsDraw) {
      shown = shown < 0 ? target : lerp(shown, target, 0.14);
      if (Math.abs(target - shown) < 0.0004) shown = target;
      needsDraw = false;
      if (videoMode && video.duration) {
        const t = scrollToVideoFrac(shown) * Math.max(0, video.duration - 0.05);
        if (Math.abs(video.currentTime - t) > 0.001) {
          if (video.fastSeek && Math.abs(video.currentTime - t) > 0.3) video.fastSeek(t);
          else video.currentTime = t;
        }
      } else {
        renderScene(ctx, cw, ch, shown, now);
      }
      updateOverlay(shown);
    }
    requestAnimationFrame(tick);
  }

  resize();
  readScroll();
  if (reduceMotion) {
    renderScene(ctx, cw, ch, 1, 0);
    updateOverlay(1);
  } else {
    requestAnimationFrame(tick);
  }
})();
