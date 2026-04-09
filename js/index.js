(function () {
  "use strict";

  var PARALLAX_LAYERS = 3;
  var SHOOT_INTERVAL = 4000;
  var CONNECT_DIST = 100;
  var MOUSE_REPEL = 90;

  var canvas = document.getElementById("bg-canvas");
  var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var starCount = prefersReducedMotion ? 70 : 220;
  var connectDistSq = CONNECT_DIST * CONNECT_DIST;
  var shootTimer = null;
  var animationFrameId = 0;
  var isAnimating = false;
  var W;
  var H;
  var stars = [];
  var shoots = [];
  var mouse = { x: -9999, y: -9999 };

  var hueMap = {
    white: [220, 215, 255],
    gold: [200, 169, 110],
    violet: [140, 120, 210],
    sky: [120, 190, 240]
  };

  function shouldAnimateBackground() {
    return !!(canvas && ctx && !document.hidden);
  }

  function resolveStarCount() {
    var width = window.innerWidth || 0;
    if (prefersReducedMotion) return 70;
    if (width <= 640) return 90;
    if (width <= 1024) return 140;
    return 220;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function initStars() {
    stars = [];
    starCount = resolveStarCount();
    for (var i = 0; i < starCount; i += 1) {
      var layer = Math.floor(Math.random() * PARALLAX_LAYERS);
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

  function spawnShoot() {
    shoots.push({
      x: rand(W * 0.2, W),
      y: rand(0, H * 0.4),
      len: rand(100, 200),
      angle: rand(20, 50) * Math.PI / 180,
      speed: rand(8, 16),
      alpha: 1
    });
  }

  function drawNebula(cx, cy, r, color) {
    var gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawConstellations() {
    if (prefersReducedMotion || W < 900) return;
    ctx.save();
    for (var i = 0; i < stars.length; i += 1) {
      for (var j = i + 1; j < stars.length; j += 1) {
        var dx = stars[i].x - stars[j].x;
        var dy = stars[i].y - stars[j].y;
        var distSq = dx * dx + dy * dy;
        if (distSq < connectDistSq && stars[i].layer === stars[j].layer) {
          var d = Math.sqrt(distSq);
          var op = (1 - d / CONNECT_DIST) * 0.07;
          ctx.strokeStyle = "rgba(200,180,255," + op + ")";
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

  function frame() {
    if (!shouldAnimateBackground()) {
      isAnimating = false;
      animationFrameId = 0;
      return;
    }

    ctx.clearRect(0, 0, W, H);

    var bg = ctx.createRadialGradient(W * 0.35, H * 0.3, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.9);
    bg.addColorStop(0, "#08082a");
    bg.addColorStop(0.4, "#05050f");
    bg.addColorStop(1, "#020208");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawNebula(W * 0.15, H * 0.2, 320, "rgba(80,50,180,0.035)");
    drawNebula(W * 0.75, H * 0.6, 280, "rgba(180,120,50,0.028)");
    drawNebula(W * 0.5, H * 0.85, 200, "rgba(40,120,150,0.025)");

    drawConstellations();

    for (var i = 0; i < stars.length; i += 1) {
      var s = stars[i];
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha >= 1) { s.alpha = 1; s.twinkleDir = -1; }
      if (s.alpha <= 0.15) { s.alpha = 0.15; s.twinkleDir = 1; }

      var mx = mouse.x - s.x;
      var my = mouse.y - s.y;
      var md = Math.sqrt(mx * mx + my * my);
      if (md < MOUSE_REPEL && md > 0) {
        var force = (1 - md / MOUSE_REPEL) * 0.6;
        s.x -= (mx / md) * force;
        s.y -= (my / md) * force;
      }

      s.x += s.vx;
      s.y += s.vy;
      if (s.x < -5) s.x = W + 5;
      if (s.x > W + 5) s.x = -5;
      if (s.y < -5) s.y = H + 5;
      if (s.y > H + 5) s.y = -5;

      var rgb = hueMap[s.hue];
      var glow = s.r * 3;
      var glowGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glow);
      glowGrad.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + s.alpha + ")");
      glowGrad.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
      ctx.beginPath();
      ctx.arc(s.x, s.y, glow, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + Math.min(s.alpha * 1.4, 1) + ")";
      ctx.fill();
    }

    for (var k = shoots.length - 1; k >= 0; k -= 1) {
      var sh = shoots[k];
      sh.x -= Math.cos(sh.angle) * sh.speed;
      sh.y += Math.sin(sh.angle) * sh.speed;
      sh.alpha -= 0.012;

      if (sh.alpha <= 0 || sh.x < -50 || sh.y > H + 50) {
        shoots.splice(k, 1);
        continue;
      }

      var tx = sh.x + Math.cos(sh.angle) * sh.len;
      var ty = sh.y - Math.sin(sh.angle) * sh.len;
      var grad = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
      grad.addColorStop(0, "rgba(255,255,255," + sh.alpha + ")");
      grad.addColorStop(0.3, "rgba(200,180,255," + (sh.alpha * 0.6) + ")");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sh.x, sh.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255," + sh.alpha + ")";
      ctx.fill();
    }

    animationFrameId = requestAnimationFrame(frame);
  }

  function resize() {
    if (!canvas || !ctx) return;
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars();
  }

  function ensureAnimationLoop() {
    if (!shouldAnimateBackground() || isAnimating) return;
    isAnimating = true;
    frame();
  }

  function stopAnimationLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    isAnimating = false;
  }

  function countArray(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  function countObjectKeys(value) {
    return value && typeof value === "object" ? Object.keys(value).length : 0;
  }

  function getState() {
    return window.SoterStorage && window.SoterStorage.getState ? window.SoterStorage.getState() : null;
  }

  function getData() {
    var state = getState();
    return state && state.data ? state.data : {};
  }

  function getTasks(data) {
    return data.tasks || data.tarefas || [];
  }

  function getDreams(data) {
    if (data.sonhosHub && Array.isArray(data.sonhosHub.sonhos)) return data.sonhosHub.sonhos;
    return data.sonhos || [];
  }

  function getWishlist(data) {
    if (data.wishlistTracker && Array.isArray(data.wishlistTracker.items)) return data.wishlistTracker.items;
    return data.wishlist || [];
  }

  function getFinances(data) {
    if (data.financasTracker && Array.isArray(data.financasTracker.txs)) return data.financasTracker.txs;
    return data.financas || [];
  }

  function getReviewCount(data) {
    var planner = data.revisaoPlanner;
    if (!planner || typeof planner !== "object") return 0;
    return countArray(planner.cards) || countArray(planner.reviews) || countArray(planner.items) || countArray(planner.sessions);
  }

  function getGymCount(data) {
    var gym = data.academiaTracker;
    if (!gym || typeof gym !== "object") return 0;
    return countArray(gym.exercicios) || countArray(gym.exercises) || countArray(gym.workouts);
  }

  function formatCount(value, nounSingular, nounPlural) {
    var amount = Number(value || 0);
    return amount + " " + (amount === 1 ? nounSingular : nounPlural);
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (!node) return;
    node.textContent = value;
  }

  function setStat(name, value) {
    document.querySelectorAll("[data-stat=\"" + name + "\"]").forEach(function (node) {
      node.textContent = value;
    });
  }

  function getProfileName() {
    var state = getState();
    var name = state && state.profile && state.profile.name ? String(state.profile.name).trim() : "";
    return name || "bem-vindo";
  }

  function getRpgXp(state) {
    if (window.SoterRPG && typeof window.SoterRPG.calcXP === "function") {
      return Number(window.SoterRPG.calcXP(state) || 0);
    }
    return 0;
  }

  function getRpgLevel(xp) {
    if (window.SoterRPG && typeof window.SoterRPG.getLevel === "function") {
      return Number(window.SoterRPG.getLevel(xp) || 1);
    }
    return 1;
  }

  function getRpgTitle(level) {
    var titles = ["Iniciante", "Aprendiz", "Explorador", "Aventureiro", "Viajante", "Veterano", "Especialista", "Mestre", "Grão-Mestre", "Lendário"];
    return titles[Math.max(0, Math.min(titles.length - 1, level - 1))] || "Iniciante";
  }

  function getXpForLevel(level) {
    if (window.SoterRPG && typeof window.SoterRPG.xpForLevel === "function") {
      return Number(window.SoterRPG.xpForLevel(level) || 0);
    }
    return level * 100 + (level - 1) * 50;
  }

  function renderCurrentCard(id, icon, title, subtitle) {
    var node = document.getElementById(id);
    if (!node) return;
    if (!title) {
      return;
    }
    node.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px;text-align:left;width:100%">' +
      '<div style="font-size:24px;line-height:1">' + icon + '</div>' +
      '<div><div style="font-weight:700;color:var(--text);margin-bottom:4px">' + title + '</div>' +
      '<div style="font-size:11px;color:var(--muted);font-family:var(--font-mono)">' + subtitle + '</div></div></div>';
  }

  function updateCurrentItems(data) {
    var books = data.trackerLivraria || data.trackerLivros || data.livros || data.livraria || [];
    var cinema = data.trackerCinema || data.trackerFilmes || data.trackerSeries || data.cinema || data.filmes || [];
    var tasks = getTasks(data);
    var currentBook = books.filter(function (item) {
      var status = String(item && item.status || "").toLowerCase();
      return status === "lendo" || status === "relendo" || status === "pausado";
    })[0];
    var currentCinema = cinema.filter(function (item) {
      var status = String(item && item.status || "").toLowerCase();
      return status === "assistindo" || status === "reassistindo" || status === "pausado";
    })[0];
    var nextTask = tasks.filter(function (item) { return item && !item.done; }).sort(function (a, b) {
      return String(a && a.data || "9999-99-99").localeCompare(String(b && b.data || "9999-99-99"));
    })[0];

    if (currentBook) {
      renderCurrentCard("home-lendo", "📚", String(currentBook.titulo || currentBook.title || "Livro"), String(currentBook.autor || currentBook.author || currentBook.status || "Em progresso"));
    }
    if (currentCinema) {
      renderCurrentCard("home-cinema", "🎬", String(currentCinema.titulo || currentCinema.title || "Titulo"), String(currentCinema.tipo || currentCinema.status || "Em andamento"));
    }
    if (nextTask) {
      renderCurrentCard("home-tarefa", "✅", String(nextTask.nome || "Tarefa"), String(nextTask.data || nextTask.prior || "Pendente"));
    }
  }

  function hydrateMoodNote(state) {
    var data = state && state.data ? state.data : {};
    var mood = String(data.homeMood || "");
    var note = String(data.homeQuickNote || "");
    var noteInput = document.getElementById("quickNote");
    setText("moodDisplay", mood || "—");
    if (noteInput && noteInput.value !== note) noteInput.value = note;
    document.querySelectorAll(".mood-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.textContent === mood);
    });
  }

  function syncHomeDate() {
    var now = new Date();
    var text = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    setText("homeDate", text);
  }

  function setMood(btn, mood) {
    var state = getState();
    if (!state) return;
    if (!state.data || typeof state.data !== "object") state.data = {};
    state.data.homeMood = mood;
    if (window.SoterStorage && typeof window.SoterStorage.save === "function") {
      window.SoterStorage.save(state);
    }
    hydrateMoodNote(state);
  }

  function saveNote() {
    var state = getState();
    var input = document.getElementById("quickNote");
    if (!state || !input) return;
    if (!state.data || typeof state.data !== "object") state.data = {};
    state.data.homeQuickNote = String(input.value || "");
    if (window.SoterStorage && typeof window.SoterStorage.save === "function") {
      window.SoterStorage.save(state);
    }
  }

  function hydrateSummary() {
    var state = getState() || {};
    var data = getData();
    var books = countArray(data.trackerLivraria || data.trackerLivros || data.livros || data.livraria);
    var cinema = countArray(data.trackerCinema || data.trackerFilmes || data.trackerSeries || data.cinema || data.filmes);
    var mangas = countArray(data.trackerMangas || data.trackerManga || data.mangas);
    var dreams = countArray(getDreams(data));
    var trips = countArray(data.viagens || data.travels);
    var wishlist = countArray(getWishlist(data));
    var finances = countArray(getFinances(data));
    var tasks = countArray(getTasks(data));
    var review = getReviewCount(data);
    var gym = getGymCount(data);
    var notifications = countArray(data.notifications);
    var doneTasks = getTasks(data).filter(function (item) { return item && item.done; }).length;
    var pendingTasks = Math.max(0, tasks - doneTasks);
    var rpgXp = getRpgXp(state);
    var rpgLevel = getRpgLevel(rpgXp);
    var xpThisLevel = getXpForLevel(rpgLevel);
    var xpNextLevel = getXpForLevel(rpgLevel + 1);
    var xpPct = xpNextLevel > xpThisLevel ? Math.max(0, Math.min(100, Math.round((rpgXp - xpThisLevel) / (xpNextLevel - xpThisLevel) * 100))) : 0;
    var records = books + cinema + mangas + dreams + trips + wishlist + finances + tasks + review + gym;
    var library = books + cinema + mangas;
    var personal = dreams + trips + wishlist + finances;
    var execution = tasks + review + gym;

    setStat("modules", "10");
    setStat("records", String(records));
    setStat("notifications", String(notifications));
    setStat("rpg-level", String(rpgLevel));

    setStat("library", formatCount(library, "item", "itens"));
    setStat("personal", formatCount(personal || 4, "frente", "frentes"));
    setStat("execution", formatCount(execution || 3, "fluxo", "fluxos"));

    setStat("library-detail", formatCount(library, "mídia", "mídias"));
    setStat("personal-detail", formatCount(personal || 4, "meta", "metas"));
    setStat("planning-detail", formatCount(tasks + review, "frente", "frentes"));
    setStat("evolution-detail", formatCount(countObjectKeys(data.rpg || {}) ? 2 : 1, "sistema", "sistemas"));

    setStat("books", formatCount(books, "livro", "livros"));
    setStat("cinema", formatCount(cinema, "título", "títulos"));
    setStat("mangas", formatCount(mangas, "coleção", "coleções"));
    setStat("dreams", formatCount(dreams, "sonho", "sonhos"));
    setStat("trips", formatCount(trips, "viagem", "viagens"));
    setStat("wishlist", formatCount(wishlist, "desejo", "desejos"));
    setStat("finances", formatCount(finances, "lançamento", "lançamentos"));
    setStat("tasks", formatCount(tasks, "tarefa", "tarefas"));
    setStat("review", formatCount(review, "card", "cards"));
    setStat("gym", formatCount(gym, "exercício", "exercícios"));

    setText("home-hero-name", getProfileName());
    setText("hs-livros", String(books));
    setText("hs-filmes", String(cinema));
    setText("hs-viagens", String(trips));
    setText("hs-xp", String(Math.round(rpgXp)));
    setText("hs-level", String(rpgLevel));
    setText("hs-level-2", String(rpgLevel));
    setText("hs-rpg-title", getRpgTitle(rpgLevel));
    setText("hs-rpg-title-2", getRpgTitle(rpgLevel));
    setText("ht-livros", String(books));
    setText("ht-cinema", String(cinema));
    setText("ht-mangas", String(mangas));
    setText("ht-tarefas", String(tasks));
    setText("hs-dreams", String(dreams));
    setText("hs-tasks", String(tasks));
    setText("hs-wishlist", String(wishlist));
    setText("hs-tarefas-done", String(doneTasks));
    setText("hs-tarefas-pend", String(pendingTasks));
    document.querySelectorAll("#hs-xp-bar,#hs-xp-bar-2").forEach(function (node) {
      node.style.width = xpPct + "%";
    });
    updateCurrentItems(data);
    hydrateMoodNote(state);
    syncHomeDate();
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal-up");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });

    items.forEach(function (item) { observer.observe(item); });
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseleave", function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });
  window.addEventListener("touchmove", function (e) {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopAnimationLoop();
      return;
    }
    ensureAnimationLoop();
  });
  window.addEventListener("soter:notifications-changed", hydrateSummary);
  window.addEventListener("storage", hydrateSummary);
  window.setMood = setMood;
  window.saveNote = saveNote;

  if (canvas && ctx) {
    resize();
    shootTimer = setInterval(function () {
      if (!document.hidden && !prefersReducedMotion) spawnShoot();
    }, SHOOT_INTERVAL);
    setTimeout(function () {
      if (!document.hidden && !prefersReducedMotion) spawnShoot();
    }, 800);
    ensureAnimationLoop();
  }

  initReveal();
  hydrateSummary();
}());
