(() => {
  const API = "https://mxebwsikgdhzcfcwtljc.supabase.co/functions/v1/prereg";
  const TIERS = [1000, 3000, 5000, 10000, 30000];
  const $ = (id) => document.getElementById(id);

  // site.json: the App Store button and the official X links appear only once their values are set
  fetch("site.json", { cache: "no-cache" }).then((r) => r.json()).then((s) => {
    if (s.app_store_url) {
      const a = document.createElement("a");
      a.className = "btn ghost"; a.href = s.app_store_url; a.textContent = "App Store で予約注文";
      a.target = "_blank"; a.rel = "noopener";
      $("appstore").replaceWith(a);
    }
    // official accounts: each link appears once its account exists (live: true) and the name is valid there
    const RULES = {
      x: [/^[A-Za-z0-9_]{1,15}$/, (h) => "https://x.com/" + h],
      tiktok: [/^[A-Za-z0-9_.]{2,24}$/, (h) => "https://www.tiktok.com/@" + h],
      instagram: [/^[A-Za-z0-9_.]{1,30}$/, (h) => "https://www.instagram.com/" + h + "/"],
      youtube: [/^[A-Za-z0-9_.-]{3,30}$/, (h) => "https://www.youtube.com/@" + h],
    };
    let any = false;
    Object.entries(s.sns || {}).forEach(([k, v]) => {
      const rule = RULES[k], h = String((v && v.handle) || "").replace(/^@/, "").trim();
      if (!rule || !v || v.live !== true || !rule[0].test(h)) return;
      document.querySelectorAll(`[data-sns-link="${k}"]`).forEach((a) => { a.href = rule[1](h); a.hidden = false; });
      any = true;
    });
    if (any) document.querySelectorAll("[data-sns]").forEach((el) => { el.hidden = false; });
  }).catch(() => {});

  function countUp(el, n) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = n.toLocaleString("ja-JP"); return; }
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))).toLocaleString("ja-JP"); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function paint(n) {
    const small = n < 100; // a tiny honest number looks worse than the plain fact that it has just started
    if (small) $("count").textContent = "受付スタート！";
    else countUp($("count"), n);
    $("count").nextElementSibling.hidden = small;
    const idx = TIERS.findIndex((t) => n < t);
    // equal-width segments: each reward is one step on the bar
    let pct;
    if (idx === -1) pct = 100;
    else {
      const lo = idx === 0 ? 0 : TIERS[idx - 1];
      pct = ((idx + (n - lo) / (TIERS[idx] - lo)) / TIERS.length) * 100;
    }
    $("fill").style.width = Math.max(pct, n > 0 ? 3 : 0) + "%";
    document.querySelector(".bar").setAttribute("aria-valuenow", String(Math.round(pct)));
    $("next").textContent = idx === -1
      ? "すべての特典を達成しました！ありがとうございます"
      : `次の特典まで、あと ${(TIERS[idx] - n).toLocaleString("ja-JP")} 人`;
    document.querySelectorAll(".rw").forEach((el) => {
      const t = Number(el.dataset.n), st = el.querySelector(".st");
      el.classList.toggle("done", n >= t);
      el.classList.toggle("cur", TIERS[idx] === t);
      st.textContent = n >= t ? "達成！" : `あと ${(t - n).toLocaleString("ja-JP")} 人`;
    });
  }
  fetch(API + "/count").then((r) => r.json()).then((d) => paint(d.count || 0)).catch(() => paint(0));

  const form = $("form"), msg = $("msg"), btn = $("submit");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "msg"; msg.textContent = "";
    const email = $("email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.className = "msg err"; msg.textContent = "メールアドレスを確かめてください。"; return; }
    if (!$("consent").checked) { msg.className = "msg err"; msg.textContent = "「取り扱いについて」への同意にチェックを入れてください。"; return; }
    btn.disabled = true;
    try {
      const r = await fetch(API + "/register", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent: true, website: $("website").value, source: "lp" }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        msg.className = "msg ok";
        msg.textContent = d.mode === "double"
          ? "確認メールを送りました。メール内のリンクを開くと登録が完了します（届かないときは迷惑メールもご確認ください）。"
          : "登録しました。配信の日にお知らせします。ありがとうございます！";
        form.reset();
        if (d.mode !== "double") fetch(API + "/count").then((x) => x.json()).then((c) => paint(c.count || 0)).catch(() => {});
      } else {
        msg.className = "msg err";
        msg.textContent = d.error === "rate_limited" ? "回数が多すぎます。時間をおいてお試しください。"
          : d.error === "invalid_email" ? "メールアドレスを確かめてください。" : "うまくいきませんでした。時間をおいてお試しください。";
      }
    } catch { msg.className = "msg err"; msg.textContent = "通信できませんでした。電波のよいところでお試しください。"; }
    btn.disabled = false;
  });

  // header: hidden over the hero art, shown once the art has scrolled half away
  const top = document.querySelector(".top"), heroEl = document.querySelector(".hero");
  const onScroll = () => top.classList.toggle("show", scrollY > (heroEl ? heroEl.offsetHeight * 0.5 : 300));
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // reveal variants: groups come in one by one
  document.querySelectorAll(".steps,.feats,.rewards").forEach((g) => [...g.children].forEach((c, i) => { c.style.setProperty("--d", i * 0.08 + "s"); c.classList.add("reveal", "r-pop"); }));
  document.querySelectorAll(".shots .phone").forEach((c) => c.classList.add("r-left"));
  document.querySelectorAll(".story .frame,#about .frame").forEach((c) => c.classList.add("r-pop"));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  } else document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));

})();
