// The living multiverse behind every screen: drifting stars, two realm
// nebulae, and in battle mode, streams of divine energy colliding mid-screen.

window.Cosmos = (() => {
  const canvas = document.getElementById("cosmos");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  let stars = [], motes = [], sparks = [];
  let mode = "idle"; // idle | select | battle
  let left = { color: "#7c6cff", glow: "#ff2d55" };
  let right = { color: "#ffc94a", glow: "#7fe7ff" };
  let shake = 0, flash = 0, flashColor = "#fff", t = 0;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    const count = Math.floor((innerWidth * innerHeight) / 2600);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      z: Math.random() * 0.9 + 0.1, tw: Math.random() * Math.PI * 2,
    }));
  }

  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

  function spawnMote(side) {
    const fromLeft = side === 0;
    const c = fromLeft ? left : right;
    motes.push({
      x: fromLeft ? -20 * DPR : W + 20 * DPR,
      y: H * (0.25 + Math.random() * 0.5),
      vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 4) * DPR,
      vy: (Math.random() - 0.5) * 0.6 * DPR,
      r: (1 + Math.random() * 2.5) * DPR,
      color: Math.random() < 0.7 ? c.color : c.glow,
      life: 1,
    });
  }

  function burst(color, n = 60, x = W / 2, y = H / 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 9) * DPR;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, r: (1 + Math.random() * 2) * DPR });
    }
  }

  function nebula(cx, cy, r, color, a) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, hexA(color, a));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function frame() {
    t += 0.005;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * DPR, (Math.random() - 0.5) * shake * DPR);
      shake *= 0.88;
      if (shake < 0.3) shake = 0;
    }
    ctx.fillStyle = "#03020a";
    ctx.fillRect(-50, -50, W + 100, H + 100);

    // Realm nebulae: one per god, breathing slowly.
    const breathe = 0.5 + Math.sin(t * 3) * 0.08;
    if (mode === "idle") {
      nebula(W * (0.3 + Math.sin(t) * 0.05), H * 0.35, W * 0.55, "#5a2cff", 0.22 * breathe * 2);
      nebula(W * (0.75 + Math.cos(t) * 0.05), H * 0.7, W * 0.5, "#ff2d75", 0.16 * breathe * 2);
      nebula(W * 0.55, H * 0.1, W * 0.35, "#1fd1ff", 0.08);
    } else {
      nebula(W * 0.12, H * 0.5, W * 0.6, left.color, 0.24 * breathe * 2);
      nebula(W * 0.12, H * 0.8, W * 0.4, left.glow, 0.12);
      nebula(W * 0.88, H * 0.5, W * 0.6, right.color, 0.24 * breathe * 2);
      nebula(W * 0.88, H * 0.2, W * 0.4, right.glow, 0.12);
    }

    // Stars, drifting toward the centre in battle as if pulled in.
    for (const s of stars) {
      s.tw += 0.03;
      if (!reduced) {
        if (mode === "battle") {
          s.x += (s.x < W / 2 ? 1 : -1) * s.z * 0.6 * DPR;
          if (Math.abs(s.x - W / 2) < 4 * DPR) s.x = Math.random() < 0.5 ? 0 : W;
        } else {
          s.x -= s.z * 0.15 * DPR;
          if (s.x < 0) s.x = W;
        }
      }
      const a = 0.35 + Math.sin(s.tw) * 0.3 * s.z + 0.3 * s.z;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(s.x, s.y, s.z * 2 * DPR, s.z * 2 * DPR);
    }

    // Energy streams.
    if (mode === "battle" && !reduced) {
      if (Math.random() < 0.9) spawnMote(0);
      if (Math.random() < 0.9) spawnMote(1);
      // The seam where two realms meet.
      const seam = ctx.createLinearGradient(W / 2 - 80 * DPR, 0, W / 2 + 80 * DPR, 0);
      seam.addColorStop(0, hexA(left.color, 0));
      seam.addColorStop(0.5, `rgba(255,255,255,${0.06 + Math.random() * 0.05})`);
      seam.addColorStop(1, hexA(right.color, 0));
      ctx.fillStyle = seam;
      ctx.fillRect(W / 2 - 80 * DPR, 0, 160 * DPR, H);
    }

    ctx.globalCompositeOperation = "lighter";
    motes = motes.filter((m) => {
      m.x += m.vx; m.y += m.vy;
      const toCenter = Math.abs(m.x - W / 2);
      if (toCenter < 10 * DPR) {
        if (Math.random() < 0.15) burst(m.color, 2, m.x, m.y);
        return false;
      }
      ctx.fillStyle = hexA(m.color, 0.8);
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hexA(m.color, 0.15);
      ctx.fillRect(m.x - m.vx * 4, m.y - m.r / 2, m.vx * 4, m.r);
      return true;
    });
    sparks = sparks.filter((p) => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy *= 0.95; p.life -= 0.018;
      if (p.life <= 0) return false;
      ctx.fillStyle = hexA(p.color, p.life);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life + 0.5, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    ctx.globalCompositeOperation = "source-over";

    if (flash > 0) {
      ctx.fillStyle = hexA(flashColor, flash * 0.5);
      ctx.fillRect(-50, -50, W + 100, H + 100);
      flash *= 0.85;
      if (flash < 0.02) flash = 0;
    }
    ctx.restore();
    requestAnimationFrame(frame);
  }

  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setMode(m) { mode = m; if (m !== "battle") motes = []; },
    setRealms(l, r) { left = l; right = r; },
    impact({ color = "#ffffff", power = 1, x, y } = {}) {
      if (reduced) { flash = 0.3 * power; flashColor = color; return; }
      shake = 18 * power;
      flash = 0.6 * power;
      flashColor = color;
      burst(color, Math.floor(80 * power), x != null ? x * DPR : W / 2, y != null ? y * DPR : H / 2);
    },
    burst(color, n, x, y) { burst(color, n, x * DPR, y * DPR); },
  };
})();
