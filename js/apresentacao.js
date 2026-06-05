function setEnterLoading(loading) {
  var btn = document.querySelector(".btn-enter");
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.querySelector("span").textContent = "✦   Entrando…   ✦";
  } else {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    btn.querySelector("span").innerHTML = "✦ &nbsp; Entrar &nbsp; ✦";
  }
}

function enterSite() {
  setEnterLoading(true);
  sessionStorage.setItem("soter_allow_index", "1");
  if (window.SoterStorage && typeof window.SoterStorage.tryAutoEnter === "function") {
    window.SoterStorage.tryAutoEnter("index.html").then(function (entered) {
      if (entered) return;
      setEnterLoading(false);
      if (window.SoterStorage && typeof window.SoterStorage.openAuthModal === "function") {
        window.SoterStorage.openAuthModal({ redirectUrl: "index.html" });
        return;
      }
      window.location.href = "index.html";
    }).catch(function () {
      setEnterLoading(false);
    });
    return;
  }
  setEnterLoading(false);
  if (window.SoterStorage && typeof window.SoterStorage.openAuthModal === "function") {
    window.SoterStorage.openAuthModal({ redirectUrl: "index.html" });
    return;
  }
  window.location.href = "index.html";
}

function setupEnterButtonRipple() {
  const button = document.querySelector(".btn-enter");
  if (!button) return;

  function updateRippleOrigin(evt) {
    const rect = button.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const maxX = Math.max(x, rect.width - x);
    const maxY = Math.max(y, rect.height - y);
    const radius = Math.ceil(Math.sqrt(maxX * maxX + maxY * maxY)) * 2;
    button.style.setProperty("--ripple-x", `${x}px`);
    button.style.setProperty("--ripple-y", `${y}px`);
    button.style.setProperty("--ripple-size", `${radius}px`);
  }

  button.addEventListener("pointerenter", updateRippleOrigin);
  button.addEventListener("pointermove", updateRippleOrigin);
  button.addEventListener("click", enterSite);
}

(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let W;
  let H;
  let stars = [];
  let shootTimer = 0;
  let animationFrameId = 0;
  let isAnimating = false;
  const mouse = { x: -9999, y: -9999 };

  const STAR_COUNT = prefersReducedMotion ? 140 : 320;
  const PARALLAX_LAYERS = 3;
  const SHOOT_INTERVAL = 4000;
  const CONNECT_DIST = 100;
  const MOUSE_REPEL = 90;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars();
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const layer = Math.floor(Math.random() * PARALLAX_LAYERS);
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-0.04, 0.04) * (layer + 1),
        vy: rand(-0.02, 0.03) * (layer + 1),
        r: rand(0.3, 1.2) * (layer * 0.4 + 0.6),
        alpha: rand(0.3, 1),
        twinkleSpeed: rand(0.005, 0.025),
        twinkleDir: Math.random() > 0.5 ? 1 : -1,
        layer: layer,
        hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? "gold" : (Math.random() < 0.5 ? "violet" : "sky")) : "white"
      });
    }
  }

  const hueMap = {
    white: [220, 215, 255],
    gold: [200, 169, 110],
    violet: [140, 120, 210],
    sky: [120, 190, 240]
  };

  const shoots = [];

  function spawnShoot() {
    if (prefersReducedMotion) return;
    shoots.push({
      x: rand(W * 0.2, W),
      y: rand(0, H * 0.4),
      len: rand(100, 200),
      angle: rand(20, 50) * Math.PI / 180,
      speed: rand(8, 16),
      alpha: 1
    });
  }

  function shouldAnimate() {
    return !document.hidden;
  }

  function startEffects() {
    if (shootTimer) return;
    shootTimer = window.setInterval(function () {
      if (!document.hidden) spawnShoot();
    }, SHOOT_INTERVAL);
    window.setTimeout(function () {
      if (!document.hidden) spawnShoot();
    }, 800);
  }

  function stopEffects() {
    if (!shootTimer) return;
    window.clearInterval(shootTimer);
    shootTimer = 0;
  }

  function drawConstellations() {
    ctx.save();
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < CONNECT_DIST && stars[i].layer === stars[j].layer) {
          const op = (1 - d / CONNECT_DIST) * 0.07;
          ctx.strokeStyle = `rgba(200,180,255,${op})`;
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawNebula(cx, cy, r, color) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function frame() {
    if (!shouldAnimate()) {
      isAnimating = false;
      animationFrameId = 0;
      return;
    }

    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(W * 0.35, H * 0.3, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
    bg.addColorStop(0, "#08082a");
    bg.addColorStop(0.4, "#05050f");
    bg.addColorStop(1, "#020208");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawNebula(W * 0.15, H * 0.2, 320, "rgba(80,50,180,0.035)");
    drawNebula(W * 0.75, H * 0.6, 280, "rgba(180,120,50,0.028)");
    drawNebula(W * 0.5, H * 0.85, 200, "rgba(40,120,150,0.025)");

    drawConstellations();

    for (const s of stars) {
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha >= 1) { s.alpha = 1; s.twinkleDir = -1; }
      if (s.alpha <= 0.15) { s.alpha = 0.15; s.twinkleDir = 1; }

      const mx = mouse.x - s.x;
      const my = mouse.y - s.y;
      const md = Math.sqrt(mx * mx + my * my);
      if (md < MOUSE_REPEL && md > 0) {
        const force = (1 - md / MOUSE_REPEL) * 0.6;
        s.x -= (mx / md) * force;
        s.y -= (my / md) * force;
      }

      s.x += s.vx;
      s.y += s.vy;
      if (s.x < -5) s.x = W + 5;
      if (s.x > W + 5) s.x = -5;
      if (s.y < -5) s.y = H + 5;
      if (s.y > H + 5) s.y = -5;

      const rgb = hueMap[s.hue];
      const glow = s.r * 3;
      const glowGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glow);
      glowGrad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${s.alpha})`);
      glowGrad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.beginPath();
      ctx.arc(s.x, s.y, glow, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(s.alpha * 1.4, 1)})`;
      ctx.fill();
    }

    for (let i = shoots.length - 1; i >= 0; i--) {
      const sh = shoots[i];
      sh.x -= Math.cos(sh.angle) * sh.speed;
      sh.y += Math.sin(sh.angle) * sh.speed;
      sh.alpha -= 0.012;
      if (sh.alpha <= 0 || sh.x < -50 || sh.y > H + 50) {
        shoots.splice(i, 1);
        continue;
      }

      const tx = sh.x + Math.cos(sh.angle) * sh.len;
      const ty = sh.y - Math.sin(sh.angle) * sh.len;
      const grad = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${sh.alpha})`);
      grad.addColorStop(0.3, `rgba(200,180,255,${sh.alpha * 0.6})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sh.x, sh.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${sh.alpha})`;
      ctx.fill();
    }

    animationFrameId = requestAnimationFrame(frame);
  }

  function ensureAnimationLoop() {
    if (isAnimating || !shouldAnimate()) return;
    isAnimating = true;
    frame();
  }

  function stopAnimationLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    isAnimating = false;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });
  window.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopAnimationLoop();
      stopEffects();
      return;
    }
    startEffects();
    ensureAnimationLoop();
  });

  setupEnterButtonRipple();
  resize();
  startEffects();
  ensureAnimationLoop();
}());
