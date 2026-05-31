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

  // Hero constellation — real patterns mapped onto background stars
  var heroConns    = [];
  var heroConnDist = 150;
  var heroScrollY  = 0;
  var heroZoneX0   = 0;
  var heroZoneX1   = 0;
  var HERO_BREAK_DIST = 16;
  var HERO_FADE       = 0.03;
  var HERO_MAX_DEG    = 3;

  // Real constellation shapes — node positions as fractions of (zone width, viewport height)
  // Each edge is an index pair into that constellation's nodes array
  var HERO_CONSTS = [
    {
      name: 'Lyra',            // upper zone — harp shape with Vega at top
      nodes: [
        { rx: 0.50, ry: 0.11 }, // Vega (α) — brightest
        { rx: 0.30, ry: 0.24 }, // ε¹ Lyr
        { rx: 0.34, ry: 0.37 }, // ε² Lyr
        { rx: 0.70, ry: 0.22 }, // ζ¹ Lyr
        { rx: 0.65, ry: 0.35 }  // ζ² Lyr
      ],
      edges: [[0,1],[0,3],[1,2],[3,4],[2,4]]
    },
    {
      name: 'Crux',            // middle zone — Southern Cross
      nodes: [
        { rx: 0.50, ry: 0.44 }, // γ Cru — Gacrux (top)
        { rx: 0.76, ry: 0.53 }, // β Cru — Mimosa (right)
        { rx: 0.50, ry: 0.62 }, // α Cru — Acrux (bottom)
        { rx: 0.24, ry: 0.53 }  // δ Cru (left)
      ],
      edges: [[0,2],[1,3]]
    },
    {
      name: 'Cassiopeia',      // lower zone — W shape
      nodes: [
        { rx: 0.08, ry: 0.79 }, // ε Cas — Segin
        { rx: 0.28, ry: 0.71 }, // δ Cas — Ruchbah
        { rx: 0.50, ry: 0.79 }, // γ Cas
        { rx: 0.72, ry: 0.71 }, // α Cas — Schedar
        { rx: 0.92, ry: 0.79 }  // β Cas — Caph
      ],
      edges: [[0,1],[1,2],[2,3],[3,4]]
    }
  ];

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

  // Distance from point (px,py) to segment (ax,ay)→(bx,by)
  function distToSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
    var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    var qx = ax + t * dx, qy = ay + t * dy;
    return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
  }

  // Snap each constellation node to the nearest available background star
  function buildHeroConns() {
    var conns = [];
    var used  = {};
    var zoneW = heroZoneX1 - heroZoneX0;
    var snap  = Math.min(zoneW, H) * 0.22; // search radius per node

    HERO_CONSTS.forEach(function (constl) {
      // Map constellation node index → global star index (-1 if none found)
      var nodeMap = [];
      constl.nodes.forEach(function (n, ni) {
        var tx = heroZoneX0 + n.rx * zoneW;
        var ty = n.ry * H;
        var best = -1, bestD = Infinity;
        for (var j = 0; j < stars.length; j++) {
          if (used[j]) continue;
          var dx = stars[j].x - tx, dy = stars[j].y - ty;
          var d  = Math.sqrt(dx * dx + dy * dy);
          if (d < snap && d < bestD) { bestD = d; best = j; }
        }
        nodeMap[ni] = best;
        if (best >= 0) used[best] = true;
      });

      // Create connections only when both endpoints were resolved
      constl.edges.forEach(function (e) {
        var a = nodeMap[e[0]], b = nodeMap[e[1]];
        if (a >= 0 && b >= 0) {
          conns.push({ a: a, b: b, op: 0, dir: 1, breaking: false, born: performance.now() });
        }
      });
    });

    return conns;
  }

  function initHeroConstellation() {
    heroConns = [];
    if (prefersReducedMotion || W < 900) return;
    var contentW  = Math.min(1785, W - 40);
    var leftPad   = (W - contentW) / 2;
    heroZoneX0    = leftPad + contentW * 0.60;
    heroZoneX1    = heroZoneX0 + contentW * 0.40;
    heroConnDist  = Math.min(contentW * 0.40, H) * 0.28;
    heroConns     = buildHeroConns();
  }

  // Find a new connection partner for star idx, excluding star exclude
  function heroReconnect(idx, exclude) {
    var deg = 0, connSet = {}, k, c, jDeg, dx, dy, d, best = -1, bestD = Infinity;
    for (k = 0; k < heroConns.length; k++) {
      c = heroConns[k];
      if (c.a === idx || c.b === idx) {
        deg++;
        connSet[c.a === idx ? c.b : c.a] = true;
      }
    }
    if (deg >= HERO_MAX_DEG) return;
    for (var j = 0; j < stars.length; j++) {
      if (j === idx || j === exclude || connSet[j]) continue;
      if (stars[j].x < heroZoneX0 || stars[j].x > heroZoneX1) continue;
      jDeg = 0;
      for (k = 0; k < heroConns.length; k++) {
        if (heroConns[k].a === j || heroConns[k].b === j) jDeg++;
      }
      if (jDeg >= HERO_MAX_DEG) continue;
      dx = stars[idx].x - stars[j].x;
      dy = stars[idx].y - stars[j].y;
      d  = Math.sqrt(dx * dx + dy * dy);
      if (d < heroConnDist * 1.5 && d < bestD) { bestD = d; best = j; }
    }
    if (best >= 0) heroConns.push({ a: idx, b: best, op: 0, dir: 1, breaking: false, born: performance.now() });
  }

  function drawHeroConstellation() {
    if (prefersReducedMotion || W < 900) return;
    var t      = performance.now() * 0.001;
    var fadeIn = Math.max(0, Math.min(1, 1 - heroScrollY / H));
    if (fadeIn <= 0 || heroConns.length === 0) return;

    var toRemove = [], connectedSet = {};
    var i, conn, sa, sb, midX, midY, mdist, nearBoost, lineOp, lineW;

    for (i = 0; i < heroConns.length; i++) {
      conn = heroConns[i];

      if (conn.dir > 0) {
        conn.op = Math.min(0.22, conn.op + HERO_FADE * 0.6);
      } else {
        conn.op = Math.max(0, conn.op - HERO_FADE);
        if (conn.op <= 0) { toRemove.push(i); continue; }
      }

      sa = stars[conn.a]; sb = stars[conn.b];

      // Auto-break when a star drifts out of the zone
      if (!conn.breaking && (sa.x < heroZoneX0 || sa.x > heroZoneX1 || sb.x < heroZoneX0 || sb.x > heroZoneX1)) {
        conn.breaking = true;
        conn.dir = -1;
      }

      // Break when mouse cuts through the line (300ms grace period)
      if (!conn.breaking && conn.dir > 0 && conn.op > 0.10 && (t * 1000 - conn.born) > 300) {
        if (distToSeg(mouse.x, mouse.y, sa.x, sa.y, sb.x, sb.y) < HERO_BREAK_DIST) {
          conn.breaking = true;
          conn.dir = -1;
        }
      }

      if (conn.op > 0.005) {
        connectedSet[conn.a] = true;
        connectedSet[conn.b] = true;
        midX      = (sa.x + sb.x) * 0.5;
        midY      = (sa.y + sb.y) * 0.5;
        mdist     = Math.sqrt((midX - mouse.x) * (midX - mouse.x) + (midY - mouse.y) * (midY - mouse.y));
        nearBoost = conn.breaking ? 0 : Math.max(0, (1 - mdist / 130) * 0.3);
        lineOp    = (conn.op + nearBoost) * fadeIn;
        lineW     = conn.breaking ? 0.35 : (nearBoost > 0.1 ? 0.8 : 0.45);
        ctx.save();
        ctx.strokeStyle = 'rgba(201,169,110,' + lineOp.toFixed(3) + ')';
        ctx.lineWidth   = lineW;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Remove faded connections and reconnect orphaned stars that remain in zone
    for (var r = toRemove.length - 1; r >= 0; r--) {
      var gone = heroConns.splice(toRemove[r], 1)[0];
      if (gone.breaking) {
        var gaIn = stars[gone.a].x >= heroZoneX0 && stars[gone.a].x <= heroZoneX1;
        var gbIn = stars[gone.b].x >= heroZoneX0 && stars[gone.b].x <= heroZoneX1;
        if (gaIn) heroReconnect(gone.a, gone.b);
        if (gbIn) heroReconnect(gone.b, gone.a);
      }
    }

    // Golden glow overlay on connected stars so they stand out from the background
    var keys = Object.keys(connectedSet);
    for (i = 0; i < keys.length; i++) {
      var s  = stars[Number(keys[i])];
      var gr = s.r * 6 * fadeIn;
      var gg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, gr);
      gg.addColorStop(0, 'rgba(201,169,110,0.30)');
      gg.addColorStop(1, 'rgba(201,169,110,0)');
      ctx.beginPath();
      ctx.arc(s.x, s.y, gr, 0, Math.PI * 2);
      ctx.fillStyle = gg;
      ctx.fill();
    }
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

    drawHeroConstellation();

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
    initHeroConstellation();
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

  function getStudyHours(data) {
    var tracker = data.estudoTracker;
    var estudos = tracker && Array.isArray(tracker.sessions) ? tracker.sessions : (data.estudos || data.studySessions || data.study || []);
    return (Array.isArray(estudos) ? estudos : []).reduce(function (acc, item) {
      return acc + Number(item && item.horas || item && item.hours || 0);
    }, 0);
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

  function setBar(id, percent) {
    var node = document.getElementById(id);
    if (!node) return;
    node.style.width = Math.max(0, Math.min(100, percent)) + "%";
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
    var titles = ["Iniciante", "Aprendiz", "Explorador", "Aventureiro", "Viajante", "Veterano", "Especialista", "Mestre", "Gr\u00e3o-Mestre", "Lend\u00e1rio"];
    return titles[Math.max(0, Math.min(titles.length - 1, level - 1))] || "Iniciante";
  }

  function getXpForLevel(level) {
    if (window.SoterRPG && typeof window.SoterRPG.xpForLevel === "function") {
      return Number(window.SoterRPG.xpForLevel(level) || 0);
    }
    return level * 100 + (level - 1) * 50;
  }

  function hydrateMoodNote(state) {
    var data = state && state.data ? state.data : {};
    var mood = String(data.homeMood || "");
    var note = String(data.homeQuickNote || "");
    var noteInput = document.getElementById("quickNote");
    setText("moodDisplay", mood || "â€”");
    if (noteInput && noteInput.value !== note) noteInput.value = note;
    document.querySelectorAll(".humor-btn").forEach(function (btn) {
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
    var study = getStudyHours(data);
    var notifications = countArray(data.notifications);
    var doneTasks = getTasks(data).filter(function (item) { return item && item.done; }).length;
    var pendingTasks = Math.max(0, tasks - doneTasks);
    var rpgXp = getRpgXp(state);
    var rpgLevel = getRpgLevel(rpgXp);
    var xpThisLevel = getXpForLevel(rpgLevel);
    var xpNextLevel = getXpForLevel(rpgLevel + 1);
    var xpPct = xpNextLevel > xpThisLevel ? Math.max(0, Math.min(100, Math.round((rpgXp - xpThisLevel) / (xpNextLevel - xpThisLevel) * 100))) : 0;
    var xpRemaining = Math.max(0, xpNextLevel - rpgXp);
    var records = books + cinema + mangas + dreams + trips + wishlist + finances + tasks + review + gym;
    var library = books + cinema + mangas;
    var personal = dreams + trips + wishlist + finances;
    var execution = tasks + review + gym;
    var attrs = window.SoterRPG && typeof window.SoterRPG.getAttrs === "function"
      ? window.SoterRPG.getAttrs(state)
      : [
          { label: "Intelecto", val: Math.min(100, books * 4 + study * 2) },
          { label: "Forca", val: Math.min(100, gym * 3) },
          { label: "Sabedoria", val: Math.min(100, books * 2 + study * 3) },
          { label: "Disciplina", val: Math.min(100, tasks * 2 + gym) },
          { label: "Exploracao", val: Math.min(100, trips * 10 + cinema * 2) },
          { label: "Prestigio", val: Math.min(100, Math.floor(rpgXp / 20)) }
        ];

    setStat("modules", "10");
    setStat("records", String(records));
    setStat("notifications", String(notifications));
    setStat("library-detail", formatCount(library, "midia", "midias"));
    setStat("personal-detail", formatCount(personal, "meta", "metas"));
    setStat("planning-detail", formatCount(tasks + review, "frente", "frentes"));
    setStat("evolution-detail", formatCount(countObjectKeys(data.rpg || {}) ? 2 : 1, "sistema", "sistemas"));
    setStat("dreams", formatCount(dreams, "sonho", "sonhos"));
    setStat("wishlist", formatCount(wishlist, "desejo", "desejos"));

    setText("hero-rpg-level", String(rpgLevel));
    setText("constellation-rpg-level", String(rpgLevel));
    setText("constellation-rpg-title", getRpgTitle(rpgLevel));
    setText("featured-rpg-level", String(rpgLevel));
    setText("featured-rpg-title", getRpgTitle(rpgLevel));
    setText("hs-livros", String(books));
    setText("hs-filmes", String(cinema));
    setText("hs-viagens", String(trips));
    setText("ht-livros", String(books));
    setText("ht-cinema", String(cinema));
    setText("ht-mangas", String(mangas));
    setText("ht-tarefas", String(tasks));
    setText("hs-dreams", String(dreams));
    setText("hs-wishlist", String(wishlist));
    setText("hs-level-2", String(rpgLevel));
    setText("hs-rpg-title-2", getRpgTitle(rpgLevel));
    setText("xp-progress-label", Math.round(rpgXp) + " XP - " + xpRemaining + " XP para o proximo nivel");

    setBar("hs-xp-bar-2", xpPct);
    attrs.forEach(function (attr) {
      var key = String(attr && attr.label || "")
        .toLowerCase()
        .replace(/\u00e7/g, "c")
        .replace(/\u00e3/g, "a")
        .replace(/\u00ed/g, "i")
        .replace(/\u00f3/g, "o");
      var id = key === "intelecto" ? "intellect"
        : key === "forca" ? "strength"
        : key === "sabedoria" ? "wisdom"
        : key === "disciplina" ? "discipline"
        : key === "exploracao" ? "exploration"
        : key === "prestigio" ? "prestige"
        : "";
      if (!id) return;
      setBar("attr-" + id, Number(attr.val || 0));
      setText("attr-" + id + "-val", String(Number(attr.val || 0)));
    });

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
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

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
  window.addEventListener("scroll", function () {
    heroScrollY = window.pageYOffset || window.scrollY || 0;
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
