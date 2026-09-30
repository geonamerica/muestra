/* =========================================================
   PyPDF Lab · interacciones, luces y animaciones con GSAP
   ========================================================= */
(() => {
  const hasGsap = typeof window.gsap !== "undefined";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  }

  /* ---------------------------------------------------------
     1. Resaltado de sintaxis (Python y terminal)
     --------------------------------------------------------- */
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const PY_RE = /(#[^\n]*)|([rf]?"(?:\\.|[^"\\\n])*"|[rf]?'(?:\\.|[^'\\\n])*')|\b(import|from|as|for|in|if|elif|else|return|def|class|with|not|and|or|while|try|except|pass|lambda|is)\b|\b(None|True|False|self)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(?=\()/g;
  const SH_RE = /(#[^\n]*)|("(?:\\.|[^"\\\n])*")|\b(pip|python|source|install)\b|(\s-{1,2}[\w-]+)/g;

  function highlight(code, lang) {
    const re = lang === "sh" ? SH_RE : PY_RE;
    let out = "";
    let last = 0;
    code.replace(re, (m, ...groups) => {
      const offset = groups[groups.length - 2];
      out += esc(code.slice(last, offset));
      let cls;
      if (lang === "sh") {
        cls = groups[0] ? "com" : groups[1] ? "str" : groups[2] ? "fn" : "flag";
      } else {
        cls = groups[0] ? "com" : groups[1] ? "str" : groups[2] ? "kw" : groups[3] ? "con" : groups[4] ? "num" : "fn";
      }
      out += `<span class="tk-${cls}">${esc(m)}</span>`;
      last = offset + m.length;
      return m;
    });
    out += esc(code.slice(last));
    return out;
  }

  const toLines = (html) =>
    html.split("\n").map((l) => `<span class="ln">${l || " "}</span>`).join("");

  $$("pre code").forEach((el) => {
    const raw = el.textContent;
    el.dataset.raw = raw;
    const lang = el.classList.contains("lang-sh") ? "sh" : "py";
    el.innerHTML = toLines(highlight(raw, lang));
  });

  /* ---------------------------------------------------------
     2. Copiar al portapapeles + toast
     --------------------------------------------------------- */
  const toast = $("#toast");
  if (hasGsap) gsap.set(toast, { x: 0, y: 0, xPercent: -50, yPercent: 140 });
  function showToast(msg) {
    toast.textContent = msg;
    if (!hasGsap) return;
    gsap.killTweensOf(toast);
    gsap.timeline()
      .to(toast, { yPercent: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)" })
      .to(toast, { yPercent: 140, opacity: 0, duration: 0.35, ease: "power2.in" }, "+=2");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }

  $$(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.closest(".code-window").querySelector("code");
      if (await copyText(code.dataset.raw)) {
        btn.textContent = "¡Copiado!";
        btn.classList.add("done");
        showToast("📋 Código copiado al portapapeles");
        setTimeout(() => { btn.textContent = "Copiar"; btn.classList.remove("done"); }, 1600);
      }
    });
  });

  $$(".pip").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (await copyText(btn.dataset.copy)) {
        const label = btn.querySelector("span");
        label.textContent = "✓";
        showToast(`📋 ${btn.dataset.copy}`);
        setTimeout(() => (label.textContent = "Copiar"), 1400);
      }
    });
  });

  /* ---------------------------------------------------------
     3. Lienzo de luces (partículas que reaccionan al mouse)
     --------------------------------------------------------- */
  const canvas = $("#lights");
  const ctx = canvas.getContext("2d");
  const COLORS = ["79,140,255", "255,79,163", "255,212,59", "46,230,214", "155,107,255"];
  const mouse = { x: -9999, y: -9999 };
  let particles = [];
  let W = 0, H = 0, DPR = 1;
  let lightsOn = true;
  let rafId = null;

  function resizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const count = Math.round(Math.min(70, (W * H) / 22000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25 - 0.08,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      t: Math.random() * Math.PI * 2,
    }));
  }

  function drawLights() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      p.t += 0.02;
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.hypot(dx, dy);

      if (!reduceMotion) {
        if (dist < 140 && dist > 0) {
          const force = (140 - dist) / 140;
          p.x += (dx / dist) * force * 2.2;
          p.y += (dy / dist) * force * 2.2;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20;
        if (p.y > H + 20) p.y = -20;
      }

      const alpha = 0.45 + Math.sin(p.t) * 0.3;
      const glow = p.r * 7;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
      g.addColorStop(0, `rgba(${p.c},${alpha})`);
      g.addColorStop(0.25, `rgba(${p.c},${alpha * 0.35})`);
      g.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
      ctx.fill();

      // Hilos de luz hacia el cursor
      if (dist < 190) {
        ctx.strokeStyle = `rgba(${p.c},${(1 - dist / 190) * 0.35})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function loopLights() {
    drawLights();
    rafId = lightsOn && !reduceMotion ? requestAnimationFrame(loopLights) : null;
  }

  resizeCanvas();
  loopLights();
  window.addEventListener("resize", () => { resizeCanvas(); if (!rafId) drawLights(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
    else if (lightsOn && !rafId) loopLights();
  });

  /* ---------------------------------------------------------
     4. Brillo que sigue al cursor + spotlight en tarjetas
     --------------------------------------------------------- */
  const glow = $("#cursor-glow");
  let glowX, glowY;
  if (hasGsap) {
    gsap.set(glow, { x: window.innerWidth / 2, y: window.innerHeight / 3 });
    glowX = gsap.quickTo(glow, "x", { duration: 0.7, ease: "power3.out" });
    glowY = gsap.quickTo(glow, "y", { duration: 0.7, ease: "power3.out" });
  }
  if (!finePointer) glow.style.display = "none";

  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (glowX) { glowX(e.clientX); glowY(e.clientY); }
  });
  document.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

  $$(".spot").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------------------------------------------------------
     5. Interruptor de luces
     --------------------------------------------------------- */
  const lightToggle = $("#lightToggle");
  lightToggle.addEventListener("click", () => {
    lightsOn = !lightsOn;
    document.body.classList.toggle("lights-off", !lightsOn);
    lightToggle.setAttribute("aria-pressed", String(lightsOn));

    if (lightsOn) {
      if (!rafId) loopLights();
      if (hasGsap && !reduceMotion) {
        // Parpadeo de tubo de neón al encender
        gsap.fromTo(
          [".neon", ".logo-mark", ".hero-stats strong", ".kicker", ".orb"],
          { opacity: 0.1 },
          { keyframes: { opacity: [0.1, 1, 0.25, 0.9, 0.4, 1] }, duration: 0.8, ease: "none", clearProps: "opacity" }
        );
      }
      showToast("💡 Luces encendidas");
    } else {
      showToast("🌙 Luces apagadas");
    }
  });

  /* ---------------------------------------------------------
     6. Navegación suave por anclas (one page)
     --------------------------------------------------------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = $(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (hasGsap) {
        gsap.to(window, { duration: reduceMotion ? 0 : 1.1, scrollTo: { y: target, offsetY: 20 }, ease: "power3.inOut" });
      } else {
        target.scrollIntoView({ behavior: "smooth" });
      }
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });

  /* ---------------------------------------------------------
     7. Pasos del tutorial (pestañas)
     --------------------------------------------------------- */
  const stepBtns = $$(".step-btn");
  const stepPanels = $$(".step-panel");
  const stepProgress = $("#stepProgress");

  function setStep(i) {
    stepBtns.forEach((b, j) => {
      b.classList.toggle("active", j === i);
      b.setAttribute("aria-selected", String(j === i));
    });
    stepPanels.forEach((p, j) => {
      p.hidden = j !== i;
      p.classList.toggle("active", j === i);
    });
    const pct = ((i + 1) / stepBtns.length) * 100;
    if (hasGsap) {
      gsap.to(stepProgress, { height: `${pct}%`, duration: 0.6, ease: "power3.out" });
      if (!reduceMotion) {
        const panel = stepPanels[i];
        gsap.fromTo(panel.querySelectorAll("h3, p"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: "power2.out" });
        gsap.fromTo(panel.querySelectorAll(".ln"), { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.025, ease: "power2.out", delay: 0.1 });
      }
    } else {
      stepProgress.style.height = `${pct}%`;
    }
  }
  stepBtns.forEach((b, i) => b.addEventListener("click", () => setStep(i)));
  // Flechas del teclado para moverse entre pasos
  $(".step-list").addEventListener("keydown", (e) => {
    const cur = stepBtns.findIndex((b) => b.classList.contains("active"));
    let next = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (cur + 1) % stepBtns.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (cur - 1 + stepBtns.length) % stepBtns.length;
    if (next !== null) { e.preventDefault(); setStep(next); stepBtns[next].focus(); }
  });
  if (stepProgress) stepProgress.style.height = `${100 / stepBtns.length}%`;

  /* ---------------------------------------------------------
     8. Código completo expandible
     --------------------------------------------------------- */
  const fullCode = $("#fullCode");
  const expandBtn = $("#expandBtn");
  const fullPre = fullCode.querySelector("pre");
  expandBtn.addEventListener("click", () => {
    const open = !fullCode.classList.contains("open");
    fullCode.classList.toggle("open", open);
    expandBtn.textContent = open ? "Ocultar código" : "Ver código completo";
    const target = open ? fullPre.scrollHeight : 440;
    if (hasGsap) {
      gsap.to(fullPre, {
        maxHeight: target,
        duration: reduceMotion ? 0 : 0.9,
        ease: "power3.inOut",
        onComplete: () => ScrollTrigger.refresh(),
      });
      if (!open) gsap.to(window, { duration: 0.8, scrollTo: { y: "#codigo", offsetY: 20 }, ease: "power3.inOut" });
    } else {
      fullPre.style.maxHeight = `${target}px`;
    }
  });

  /* ---------------------------------------------------------
     9. Demo interactiva
     --------------------------------------------------------- */
  const paper = $("#paper");
  const stamp = $("#stamp");
  const watermark = $("#watermark");
  const scan = $("#scan");
  const consoleEl = $("#console");
  const state = { highlight: false, redact: false, stamp: false, watermark: false, rot: 0 };
  let typingQueue = Promise.resolve();

  if (hasGsap) {
    gsap.set(watermark, { x: 0, y: 0, xPercent: -50, yPercent: -50, rotation: -35 });
  }

  function typeLine(text, kind = "code") {
    typingQueue = typingQueue.then(
      () =>
        new Promise((resolve) => {
          const line = document.createElement("div");
          line.className = "console-line" + (kind === "ok" ? " ok" : kind === "muted" ? " muted" : "");
          const prefix = kind === "code" ? '<span class="prompt">&gt;&gt;&gt;</span>' : "";
          consoleEl.appendChild(line);
          const finish = () => {
            line.innerHTML = prefix + (kind === "code" ? highlight(text, "py") : esc(text));
            consoleEl.scrollTop = consoleEl.scrollHeight;
            resolve();
          };
          if (reduceMotion) return finish();
          let i = 0;
          const timer = setInterval(() => {
            i += 2;
            line.innerHTML = prefix + esc(text.slice(0, i)) + '<span class="caret"></span>';
            consoleEl.scrollTop = consoleEl.scrollHeight;
            if (i >= text.length) { clearInterval(timer); finish(); }
          }, 14);
        })
    );
    return typingQueue;
  }

  function nudge(btn) {
    if (!hasGsap) return;
    gsap.fromTo(btn, { x: 0 }, { keyframes: { x: [-6, 6, -4, 4, 0] }, duration: 0.4 });
  }

  function flashPaper(color) {
    if (!hasGsap || reduceMotion) return;
    gsap.fromTo(
      paper,
      { boxShadow: `0 0 0 2px ${color}, 0 0 90px ${color}, 0 30px 60px rgba(0,0,0,0.5)` },
      { boxShadow: "0 0 0 1px rgba(255,255,255,0.4), 0 0 60px rgba(79,140,255,0.35), 0 30px 60px rgba(0,0,0,0.5)", duration: 1.2, ease: "power2.out" }
    );
  }

  const actions = {
    highlight(btn) {
      if (state.highlight) return alreadyDone(btn);
      state.highlight = true;
      gsap.to(".mark-hl", { backgroundSize: "100% 100%", duration: 0.6, stagger: 0.35, ease: "power2.inOut" });
      flashPaper("rgba(255,212,59,0.7)");
      typeLine('for r in page.search_for("importe"): page.add_highlight_annot(r)');
      typeLine('for r in page.search_for("plazo"): page.add_highlight_annot(r)');
    },
    redact(btn) {
      if (state.redact) return alreadyDone(btn);
      state.redact = true;
      gsap.to(".mark-redact", { backgroundSize: "100% 100%", color: "#111", duration: 0.45, stagger: 0.25, ease: "power3.inOut" });
      flashPaper("rgba(200,200,220,0.6)");
      typeLine('for r in page.search_for("DNI"): page.add_redact_annot(r, fill=(0, 0, 0))');
      typeLine("page.apply_redactions()");
      typeLine("# Datos eliminados del archivo, no solo tapados", "muted");
    },
    stamp(btn) {
      if (state.stamp) return alreadyDone(btn);
      state.stamp = true;
      gsap.timeline()
        .fromTo(stamp, { scale: 3, opacity: 0, rotation: -40 }, { scale: 1, opacity: 0.9, rotation: -14, duration: 0.5, ease: "back.out(2.2)" })
        .fromTo(paper, { y: 0 }, { keyframes: { y: [4, -3, 2, 0] }, duration: 0.3 }, "-=0.12");
      flashPaper("rgba(74,222,128,0.7)");
      typeLine('page.insert_text((300, 700), "APROBADO", fontsize=28, color=(0, 0.6, 0.3))');
    },
    watermark(btn) {
      if (state.watermark) return alreadyDone(btn);
      state.watermark = true;
      gsap.fromTo(watermark, { opacity: 0, scale: 0.6 }, { opacity: 0.17, scale: 1, duration: 1, ease: "power3.out" });
      flashPaper("rgba(255,79,163,0.7)");
      typeLine('page.insert_text(p, "CONFIDENCIAL", fontsize=64, fill_opacity=0.18, morph=(p, pymupdf.Matrix(35)))');
    },
    rotate() {
      state.rot += 90;
      const sideways = (state.rot / 90) % 2 === 1;
      gsap.to(paper, { rotation: state.rot, scale: sideways ? 0.74 : 1, duration: 0.8, ease: "power3.inOut" });
      flashPaper("rgba(46,230,214,0.7)");
      typeLine(`page.set_rotation(${state.rot % 360})`);
    },
    save() {
      gsap.fromTo(scan, { top: "-30%", opacity: 1 }, { top: "110%", duration: 1.1, ease: "power2.inOut", onComplete: () => gsap.set(scan, { opacity: 0 }) });
      flashPaper("rgba(79,140,255,0.8)");
      typeLine('doc.save("contrato_editado.pdf", garbage=3, deflate=True)');
      typeLine("✓ contrato_editado.pdf guardado", "ok").then(() => showToast("💾 contrato_editado.pdf guardado (simulación)"));
    },
    reset() {
      Object.assign(state, { highlight: false, redact: false, stamp: false, watermark: false, rot: 0 });
      gsap.to(".mark-hl", { backgroundSize: "0% 100%", duration: 0.4 });
      gsap.to(".mark-redact", { backgroundSize: "0% 100%", color: "#1c1c2b", duration: 0.4 });
      gsap.to([stamp, watermark], { opacity: 0, duration: 0.3 });
      gsap.to(paper, { rotation: 0, scale: 1, duration: 0.7, ease: "power3.inOut" });
      $$(".tool-btn").forEach((b) => b.classList.remove("used"));
      typingQueue = typingQueue.then(() => {
        consoleEl.innerHTML = "";
      });
      typeLine("# Documento recargado", "muted");
      typeLine('doc = pymupdf.open("contrato.pdf")');
    },
  };

  function alreadyDone(btn) {
    nudge(btn);
    typeLine("# Esa herramienta ya está aplicada. Probá otra o reiniciá.", "muted");
  }

  $$(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.action;
      if (!hasGsap || !actions[act]) return;
      actions[act](btn);
      if (!["reset", "save", "rotate"].includes(act)) btn.classList.add("used");
      if (!reduceMotion) gsap.fromTo(btn, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.2, 0.4)" });
    });
  });

  /* ---------------------------------------------------------
     10. Animaciones GSAP (intro, scroll, loops)
     --------------------------------------------------------- */
  if (!hasGsap) return;

  // Contadores del hero
  function runCounters() {
    $$("[data-count]").forEach((el) => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: +el.dataset.count,
        duration: reduceMotion ? 0 : 1.8,
        ease: "power2.out",
        delay: reduceMotion ? 0 : 0.9,
        onUpdate: () => (el.textContent = Math.round(obj.v)),
      });
    });
  }

  // Barra de progreso de scroll
  gsap.to(".scroll-progress", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.3 },
  });

  // Link activo en la navegación
  $$(".nav-links a").forEach((link) => {
    const section = $(link.getAttribute("href"));
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top center",
      end: "bottom center",
      onToggle: (self) => link.classList.toggle("active", self.isActive),
    });
  });

  if (reduceMotion) {
    runCounters();
    gsap.set(".pdf-stamp", { opacity: 1 });
    return;
  }

  // Intro del hero
  $$(".hero-title .line").forEach((line) => {
    line.innerHTML = `<span class="word">${line.innerHTML}</span>`;
  });
  gsap.timeline({ defaults: { ease: "power4.out" } })
    .from(".nav", { y: -80, opacity: 0, duration: 1 })
    .from(".eyebrow", { y: 20, opacity: 0, duration: 0.7 }, "-=0.6")
    .from(".hero-title .word", { yPercent: 115, rotation: 4, duration: 1.1, stagger: 0.12 }, "-=0.5")
    .from(".hero-sub", { y: 24, opacity: 0, duration: 0.8 }, "-=0.7")
    .from(".hero-cta .btn", { y: 24, opacity: 0, duration: 0.7, stagger: 0.1 }, "-=0.6")
    .from(".hero-stats li", { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 }, "-=0.5")
    .from(".pdf-card", { z: -400, y: 120, opacity: 0, rotationX: 40, duration: 1.4, stagger: -0.15 }, 0.3)
    .from(".float-tag", { scale: 0, opacity: 0, duration: 0.7, stagger: 0.15, ease: "back.out(2)" }, "-=0.6");
  runCounters();

  // Etiquetas flotantes
  $$(".float-tag").forEach((tag, i) => {
    gsap.to(tag, { y: i % 2 ? 14 : -14, duration: 2.4 + i * 0.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.5 });
  });

  // Orbes de luz que flotan
  gsap.to(".orb-1", { x: 120, y: 80, duration: 14, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".orb-2", { x: -100, y: 120, duration: 16, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(".orb-3", { x: 160, y: -60, duration: 18, repeat: -1, yoyo: true, ease: "sine.inOut" });

  // Inclinación 3D de la pila de PDFs con el mouse
  const heroVisual = $("#heroVisual");
  const stack = $("#pdfStack");
  const rotY = gsap.quickTo(stack, "rotationY", { duration: 0.8, ease: "power3.out" });
  const rotX = gsap.quickTo(stack, "rotationX", { duration: 0.8, ease: "power3.out" });
  $(".hero").addEventListener("pointermove", (e) => {
    const r = heroVisual.getBoundingClientRect();
    const px = (e.clientX - (r.left + r.width / 2)) / r.width;
    const py = (e.clientY - (r.top + r.height / 2)) / r.height;
    rotY(px * 22);
    rotX(-py * 18);
  });
  $(".hero").addEventListener("pointerleave", () => { rotY(0); rotX(0); });

  // Mini animación en bucle dentro del PDF del hero
  const card = $(".pdf-card.c1");
  const cursor = $(".pdf-cursor");
  const hlBar = $(".bar.hl");
  const rdBar = $(".bar.red");
  const miniStamp = $(".pdf-stamp");
  const posOf = (el) => ({
    x: el.offsetLeft + el.offsetWidth * 0.2 - card.offsetWidth / 2,
    y: el.offsetTop + el.parentElement.offsetTop - card.offsetHeight / 2,
  });
  gsap.set([hlBar, rdBar], { "--hl": 0, "--rd": 0 });
  gsap.set(cursor, { xPercent: -50, yPercent: -50 });
  gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 2 })
    .to(cursor, { x: () => posOf(hlBar).x, y: () => posOf(hlBar).y, duration: 0.8, ease: "power2.inOut" })
    .to(hlBar, { "--hl": 1, duration: 0.7, ease: "power2.inOut" })
    .to(cursor, { x: () => posOf(hlBar).x + hlBar.offsetWidth * 0.75, duration: 0.7, ease: "power2.inOut" }, "<")
    .to(cursor, { x: () => posOf(rdBar).x, y: () => posOf(rdBar).y, duration: 0.7, ease: "power2.inOut" })
    .to(rdBar, { "--rd": 1, duration: 0.5, ease: "power2.inOut" })
    .to(cursor, { x: 80, y: 150, duration: 0.8, ease: "power2.inOut" })
    .fromTo(miniStamp, { opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" })
    .to(card, { keyframes: { x: [3, -2, 0] }, duration: 0.25 }, "-=0.1")
    .to({}, { duration: 1.4 })
    .to([hlBar, rdBar], { "--hl": 0, "--rd": 0, duration: 0.4 })
    .to(miniStamp, { opacity: 0, duration: 0.4 }, "<")
    .to(cursor, { x: 0, y: 0, duration: 0.8, ease: "power2.inOut" }, "<");

  // Marquee infinito que acelera con el scroll
  const marqueeTween = gsap.to(".marquee-track", { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
  ScrollTrigger.create({
    onUpdate: (self) => {
      const v = Math.min(Math.abs(self.getVelocity()) / 400, 5);
      gsap.to(marqueeTween, { timeScale: 1 + v, duration: 0.2, overwrite: true });
      gsap.to(marqueeTween, { timeScale: 1, duration: 1, delay: 0.25 });
    },
  });

  // Aparición de elementos al hacer scroll
  gsap.set("[data-reveal]", { opacity: 0 });
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 85%",
    once: true,
    onEnter: (els) =>
      gsap.fromTo(els, { y: 50, opacity: 0, filter: "blur(8px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 1, stagger: 0.12, ease: "power3.out", clearProps: "filter" }),
  });

  // Parallax suave en los títulos de sección
  $$(".section-head h2").forEach((h) => {
    gsap.fromTo(h, { y: 20 }, {
      y: -20, ease: "none",
      scrollTrigger: { trigger: h, start: "top bottom", end: "bottom top", scrub: true },
    });
  });

  // Botones magnéticos
  if (finePointer) {
    $$(".magnetic").forEach((btn) => {
      const mx = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
      const my = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * 0.35);
        my((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      btn.addEventListener("pointerleave", () => { mx(0); my(0); });
    });
  }
})();
