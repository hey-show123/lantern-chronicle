// Hero motion: parallax layers (img/hero/layers.json when present, else the single picture), a light sweep from the
// lighthouse lamp, and drifting lanterns / paper letters / sparkles on a canvas. Everything pauses off-screen and
// is skipped under prefers-reduced-motion. Same particle engine also powers the calm section canvases.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const LETTERS = "ABCDEGHILMNORSTW";

  function engine(canvas, host, cfg) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1, items = [], last = 0, run = false, raf = 0;
    const fit = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      const r = host.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const make = (kind, fresh) => {
      const o = { kind, x: rand(0, 1), p: rand(0, 6.28), s: rand(0.6, 1.4) };
      o.y = fresh ? rand(0, 1) : 1.08;
      if (kind === "lantern") o.v = rand(0.012, 0.03);
      if (kind === "letter") { o.v = rand(0.01, 0.022); o.l = LETTERS[(Math.random() * LETTERS.length) | 0]; o.r = rand(-0.5, 0.5); o.vr = rand(-0.5, 0.5); }
      if (kind === "spark") { o.y = rand(0, 1); o.tw = rand(0.6, 1.6); }
      return o;
    };
    const spawn = () => {
      items = [];
      for (let i = 0; i < cfg.lanterns; i++) items.push(make("lantern", true));
      for (let i = 0; i < cfg.letters; i++) items.push(make("letter", true));
      for (let i = 0; i < cfg.sparks; i++) items.push(make("spark", true));
    };
    const star = (x, y, r) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    };
    const draw = (now) => {
      raf = 0; if (!run) return;
      const dt = Math.min((now - last) / 1000 || 0, 0.05); last = now;
      ctx.clearRect(0, 0, W, H);
      const u = Math.min(W, H * 1.3);
      for (const o of items) {
        if (o.kind === "spark") {
          const a = 0.25 + 0.75 * Math.abs(Math.sin(now / 1000 * o.tw + o.p));
          ctx.fillStyle = `rgba(255,236,160,${a})`; star(o.x * W, o.y * H, (u * 0.006 + 1) * o.s * a * 1.4);
          continue;
        }
        o.y -= o.v * dt * (cfg.speed || 1);
        const edge = Math.min(1, Math.max(0, (1.06 - o.y) * 6), Math.max(0, o.y + 0.04) * 6);
        const sway = Math.sin(now / 1000 * 0.6 + o.p) * 0.012;
        const x = (o.x + sway) * W, y = o.y * H;
        if (o.kind === "lantern") {
          const r = u * 0.017 * o.s;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.2);
          g.addColorStop(0, `rgba(255,214,120,${0.55 * edge})`); g.addColorStop(1, "rgba(255,170,60,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4.2, 0, 6.3); ctx.fill();
          ctx.fillStyle = `rgba(255,236,170,${0.95 * edge})`;
          ctx.beginPath(); ctx.roundRect(x - r * 0.7, y - r, r * 1.4, r * 2, r * 0.4); ctx.fill();
          ctx.fillStyle = `rgba(255,150,60,${0.8 * edge})`; ctx.fillRect(x - r * 0.7, y + r * 0.7, r * 1.4, r * 0.3);
        } else {
          o.x += o.v * 0.5 * dt; o.r += o.vr * dt;
          const s = u * 0.024 * o.s;
          ctx.save(); ctx.translate(x, y); ctx.rotate(o.r); ctx.globalAlpha = 0.9 * edge;
          ctx.fillStyle = "#fff1cf"; ctx.shadowColor = "#ffd47a"; ctx.shadowBlur = s * 0.8;
          ctx.beginPath(); ctx.roundRect(-s, -s, s * 2, s * 2, s * 0.18); ctx.fill();
          ctx.shadowBlur = 0; ctx.fillStyle = "#5a3a12"; ctx.font = `${s * 1.35}px "Mochiy Pop One", sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(o.l, 0, s * 0.08);
          ctx.restore();
        }
        if (o.y < -0.08 || o.x > 1.1) Object.assign(o, make(o.kind, false));
      }
      raf = requestAnimationFrame(draw);
    };
    const start = () => { if (run || reduce) return; run = true; last = performance.now(); raf = requestAnimationFrame(draw); };
    const stop = () => { run = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
    fit(); spawn();
    if (reduce) { // one still frame of sparkles so the section is not empty
      run = true; draw(performance.now()); run = false;
    }
    new ResizeObserver(() => { fit(); }).observe(host);
    new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting && !document.hidden ? start() : stop())), { threshold: 0 }).observe(host);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : null));
    return { start, stop };
  }

  // ---- hero ----
  const stage = document.getElementById("stage");
  if (!stage) return;
  const art = document.getElementById("art"), pic = document.getElementById("heroPic"), lamp = document.getElementById("lamp");
  const mq = matchMedia("(max-width:820px)");
  const MODES = {
    wide: { a: 16 / 9, fx: 0.5, fy: 0.25, lamp: [72, 6.5] },
    tall: { a: 760 / 1351, fx: 0.5, fy: 0, lamp: [61, 17] },
  };
  let mode = mq.matches ? "tall" : "wide", layers = [], cfg = null;

  function layout() {
    const m = MODES[mode], sw = stage.clientWidth, sh = stage.clientHeight;
    const w = Math.max(sw, sh * m.a), h = w / m.a;
    Object.assign(art.style, { width: w + "px", height: h + "px", left: (sw - w) * m.fx + "px", top: (sh - h) * m.fy + "px" });
    const lp = (cfg && cfg[mode] && cfg[mode].lamp) || m.lamp;
    lamp.style.left = lp[0] + "%"; lamp.style.top = lp[1] + "%";
  }

  async function loadLayers() {
    try {
      const r = await fetch("img/hero/layers.json", { cache: "no-cache" });
      if (!r.ok) return;
      cfg = await r.json();
    } catch { return; }
    const set = cfg[mode];
    if (!set || !set.layers || !set.layers.length) return;
    pic.hidden = true;
    layers.forEach((l) => l.el.remove()); layers = [];
    set.layers.forEach((l) => {
      const im = new Image(); im.className = "layer"; im.alt = ""; im.decoding = "async"; im.src = l.src;
      art.insertBefore(im, lamp); layers.push({ el: im, d: l.depth || 0 });
    });
    layout();
  }
  mq.addEventListener("change", () => { mode = mq.matches ? "tall" : "wide"; layers.forEach((l) => l.el.remove()); layers = []; pic.hidden = false; layout(); loadLayers(); });
  addEventListener("resize", layout);
  layout(); loadLayers();

  if (reduce) { lamp.style.display = "none"; }
  const fx = engine(document.getElementById("fx"), art, { lanterns: 9, letters: 7, sparks: 34 });

  // parallax: pointer + scroll + a slow idle drift (so touch screens move too)
  let px = 0, py = 0, tx = 0, ty = 0;
  if (!reduce) {
    addEventListener("pointermove", (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });
    const hero = stage.parentElement;
    const tick = (now) => {
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      const sc = Math.min(1, scrollY / (hero.clientHeight || 800));
      const t = now / 1000;
      if (layers.length) {
        layers.forEach((l, i) => {
          const dx = px * l.d * -60 + Math.sin(t * 0.25 + i) * l.d * 18;
          const dy = py * l.d * -40 + Math.cos(t * 0.2 + i) * l.d * 10 + sc * l.d * 90;
          l.el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
        });
      } else {
        const z = 1.04 + Math.sin(t * 0.12) * 0.015;
        pic.style.transform = `translate3d(${px * -14 + Math.sin(t * 0.2) * 6}px,${py * -8 + sc * 40}px,0) scale(${z})`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // calm canvases in other sections
  document.querySelectorAll("canvas.fx2").forEach((c) => engine(c, c.parentElement, { lanterns: 3, letters: 3, sparks: 22, speed: 0.7 }));

  // tilt + shine on cards
  if (!reduce && matchMedia("(hover:hover)").matches) {
    document.querySelectorAll(".cast figure, .rw, .feat, .step").forEach((el) => {
      el.classList.add("tilt"); const gl = document.createElement("i"); gl.className = "gl"; el.appendChild(gl);
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 10}deg) translateZ(0)`;
        el.style.setProperty("--mx", x * 100 + "%"); el.style.setProperty("--my", y * 100 + "%");
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }
})();
