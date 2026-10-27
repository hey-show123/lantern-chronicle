// Fills the phone screenshots and the play video from media.json, so swapping a picture is "drop a file + edit one line".
(async () => {
  let m;
  try { m = await (await fetch("media.json", { cache: "no-cache" })).json(); } catch { return; }
  const el = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; Object.assign(e, attrs); return e; };

  // phone screenshots (battle slots come first in media.json so they are the first thing seen)
  const row = document.getElementById("shotRow");
  if (row && m.phone) {
    const p = m.phone, s = p.screen;
    row.style.setProperty("--pw", p.ratio[0]); row.style.setProperty("--ph", p.ratio[1]);
    row.style.setProperty("--sl", s.left + "%"); row.style.setProperty("--st", s.top + "%");
    row.style.setProperty("--sw", s.width + "%"); row.style.setProperty("--sh", s.height + "%");
    (m.shots || []).forEach((it) => {
      const fig = el("figure", "shot reveal r-pop"), ph = el("div", "phone"), scr = el("div", "scr");
      scr.dataset.slot = it.slot;
      scr.append(el("img", "", { src: it.file, alt: it.alt || it.title || "", loading: "lazy", decoding: "async" }));
      ph.append(scr, el("img", "frame", { src: p.frame, alt: "", loading: "lazy" }));
      const cap = el("figcaption"); cap.innerHTML = "<b></b><span></span>";
      cap.firstChild.textContent = it.title || ""; cap.lastChild.textContent = it.caption || "";
      fig.append(ph, cap); row.append(fig);
    });
    document.dispatchEvent(new Event("lp-media-ready"));
  }

  // play video: plays muted while visible, tap toggles; with reduced motion it waits for a tap
  const box = document.querySelector('[data-slot="video"]');
  if (box && m.video) {
    const vid = el("video", "", { muted: true, loop: true, playsInline: true, preload: "metadata", poster: m.video.poster });
    vid.setAttribute("aria-label", m.video.alt || ""); vid.muted = true;
    vid.append(el("source", "", { src: m.video.file, type: "video/mp4" }));
    const btn = el("button", "vbtn", { type: "button", textContent: "▶" }); btn.setAttribute("aria-label", "再生・停止");
    box.append(vid, btn);
    const sync = () => { box.classList.toggle("paused", vid.paused); btn.textContent = vid.paused ? "▶" : "❚❚"; };
    vid.addEventListener("play", sync); vid.addEventListener("pause", sync); sync();
    box.addEventListener("click", () => (vid.paused ? vid.play() : vid.pause()));
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still && "IntersectionObserver" in window)
      new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? vid.play().catch(() => {}) : vid.pause())), { threshold: 0.5 }).observe(vid);
  }

  // reveal for the elements created above
  const io = "IntersectionObserver" in window && new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.12 });
  document.querySelectorAll(".shot.reveal,.vcard.reveal").forEach((n) => (io ? io.observe(n) : n.classList.add("in")));
})();
