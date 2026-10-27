(() => {
  const API = "https://mxebwsikgdhzcfcwtljc.supabase.co/functions/v1/prereg";
  const TIERS = [1000, 3000, 5000, 10000, 30000];
  const $ = (id) => document.getElementById(id);

  // App Store button: shown only when this URL is set (once the pre-order page exists).
  const APP_STORE_URL = "";
  if (APP_STORE_URL) {
    const a = document.createElement("a");
    a.className = "btn ghost"; a.href = APP_STORE_URL; a.textContent = "App Store で予約注文";
    $("appstore").replaceWith(a);
  }

  function paint(n) {
    const small = n < 100; // a tiny honest number looks worse than the plain fact that it has just started
    $("count").textContent = small ? "受付スタート！" : n.toLocaleString("ja-JP");
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

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  } else document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
})();
