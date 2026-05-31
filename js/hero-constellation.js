(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var GOLD = '#c9a96e';
  var MOUSE_R = 110;
  var MAX_DISP = 9;
  var TEMP_R = 88;
  var CONN_RATIO = 0.27;

  // [rx, ry, radius, brightness] — normalized 0–1 within the SVG bounds
  var STAR_DATA = [
    [0.45, 0.30, 2.0, 0.85],
    [0.60, 0.22, 1.6, 0.75],
    [0.55, 0.42, 1.4, 0.70],
    [0.38, 0.38, 1.5, 0.65],
    [0.72, 0.35, 1.8, 0.80],
    [0.28, 0.12, 1.8, 0.80],
    [0.45, 0.07, 1.0, 0.55],
    [0.62, 0.10, 1.3, 0.65],
    [0.80, 0.16, 1.1, 0.50],
    [0.88, 0.30, 1.6, 0.75],
    [0.92, 0.48, 1.1, 0.55],
    [0.82, 0.55, 1.3, 0.65],
    [0.08, 0.22, 1.4, 0.70],
    [0.18, 0.38, 1.0, 0.55],
    [0.12, 0.52, 1.2, 0.60],
    [0.35, 0.62, 1.5, 0.70],
    [0.50, 0.70, 1.2, 0.60],
    [0.64, 0.65, 1.0, 0.55],
    [0.78, 0.72, 0.9, 0.50],
    [0.25, 0.72, 0.9, 0.45],
    [0.42, 0.82, 1.1, 0.55],
    [0.58, 0.85, 0.8, 0.45],
    [0.88, 0.80, 0.8, 0.45],
    [0.05, 0.68, 0.9, 0.45],
    [0.96, 0.68, 0.7, 0.40],
    [0.16, 0.82, 0.8, 0.40],
    [0.70, 0.52, 1.3, 0.65],
    [0.32, 0.52, 1.0, 0.55]
  ];

  var svg, svgW, svgH;
  var linesG, glowsG, dotsG, tempG;
  var stars = [], lines = [], tempLines = [];
  var rafId = 0;
  var mx = -9999, my = -9999;
  var scrollOff = 0;
  var resizeTid;

  function el(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  function build() {
    svg.innerHTML = '';
    svgW = svg.clientWidth;
    svgH = svg.clientHeight;
    if (svgW < 10 || svgH < 10) return false;

    // Glow radial gradient
    var defs = el('defs');
    var rg = el('radialGradient');
    rg.id = 'cst-glow';
    var s1 = el('stop'); s1.setAttribute('offset', '0%');
    s1.setAttribute('stop-color', GOLD); s1.setAttribute('stop-opacity', '0.9');
    var s2 = el('stop'); s2.setAttribute('offset', '100%');
    s2.setAttribute('stop-color', GOLD); s2.setAttribute('stop-opacity', '0');
    rg.appendChild(s1); rg.appendChild(s2);
    defs.appendChild(rg);
    svg.appendChild(defs);

    linesG = el('g'); svg.appendChild(linesG);
    tempG  = el('g'); svg.appendChild(tempG);
    glowsG = el('g'); svg.appendChild(glowsG);
    dotsG  = el('g'); svg.appendChild(dotsG);

    stars = []; lines = []; tempLines = [];

    STAR_DATA.forEach(function (d) {
      var bx = d[0] * svgW;
      var by = d[1] * svgH;

      var glow = el('circle');
      glow.setAttribute('fill', 'url(#cst-glow)');
      glowsG.appendChild(glow);

      var dot = el('circle');
      dot.setAttribute('fill', GOLD);
      dotsG.appendChild(dot);

      stars.push({
        bx: bx, by: by, x: bx, y: by,
        r: d[2], base: d[3],
        pP: Math.random() * 6.28,
        fP: Math.random() * 6.28,
        fAx: (Math.random() - 0.5) * 5,
        fAy: (Math.random() - 0.5) * 3,
        glow: glow, dot: dot
      });
    });

    // Permanent connections — nearest pairs, max degree 3 per star
    var thresh = Math.min(svgW, svgH) * CONN_RATIO;
    var pairs = [];
    for (var i = 0; i < stars.length; i++) {
      for (var j = i + 1; j < stars.length; j++) {
        var dx = stars[i].bx - stars[j].bx;
        var dy = stars[i].by - stars[j].by;
        var d  = Math.sqrt(dx * dx + dy * dy);
        if (d < thresh) pairs.push({ i: i, j: j, d: d });
      }
    }
    pairs.sort(function (a, b) { return a.d - b.d; });
    var deg = new Array(stars.length).fill(0);
    pairs.forEach(function (p) {
      if (deg[p.i] >= 3 || deg[p.j] >= 3) return;
      var line = el('line');
      line.setAttribute('stroke', GOLD);
      line.setAttribute('stroke-width', '0.45');
      line.setAttribute('stroke-opacity', '0.18');
      line.setAttribute('x1', stars[p.i].bx.toFixed(1));
      line.setAttribute('y1', stars[p.i].by.toFixed(1));
      line.setAttribute('x2', stars[p.j].bx.toFixed(1));
      line.setAttribute('y2', stars[p.j].by.toFixed(1));
      linesG.appendChild(line);
      lines.push({ el: line, a: stars[p.i], b: stars[p.j] });
      deg[p.i]++;
      deg[p.j]++;
    });

    // Pre-allocated temp lines (one per star, hidden)
    stars.forEach(function () {
      var line = el('line');
      line.setAttribute('stroke', GOLD);
      line.setAttribute('stroke-width', '0.4');
      line.setAttribute('stroke-opacity', '0');
      tempG.appendChild(line);
      tempLines.push(line);
    });

    return true;
  }

  function tick(ts) {
    var t    = ts * 0.001;
    var rect = svg.getBoundingClientRect();
    var lx   = mx - rect.left;
    var ly   = my - rect.top;
    var act  = mx > 0 && mx < 99999;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      // Subtle float
      var fx = Math.sin(t * 0.38 + s.fP) * s.fAx;
      var fy = Math.cos(t * 0.31 + s.fP) * s.fAy;

      // Scroll parallax — deeper stars shift more
      var py = -scrollOff * 0.004 * (s.r / 2);

      // Mouse repulsion within radius
      var dx   = s.x - lx;
      var dy   = s.y - ly;
      var dd   = Math.sqrt(dx * dx + dy * dy);
      var near = act && dd < MOUSE_R;
      var diX  = 0, diY = 0;

      if (near && dd > 1) {
        var f = (1 - dd / MOUSE_R) * MAX_DISP;
        diX = (dx / dd) * f;
        diY = (dy / dd) * f;
      }

      // Smooth approach (exponential easing)
      s.x += (s.bx + fx + diX - s.x) * 0.065;
      s.y += (s.by + fy + diY + py - s.y) * 0.065;

      // Slow pulsing brightness
      var pulse = 0.74 + 0.26 * Math.sin(t * (0.48 + s.r * 0.1) + s.pP);
      var op    = Math.min(1, s.base * pulse + (near ? 0.2 : 0));
      var gr    = s.r * (near ? 9 : 4.5);

      s.glow.setAttribute('cx', s.x.toFixed(1));
      s.glow.setAttribute('cy', s.y.toFixed(1));
      s.glow.setAttribute('r',  gr.toFixed(1));
      s.glow.setAttribute('opacity', (near ? 0.5 : 0.22).toString());

      s.dot.setAttribute('cx', s.x.toFixed(1));
      s.dot.setAttribute('cy', s.y.toFixed(1));
      s.dot.setAttribute('r',  s.r.toString());
      s.dot.setAttribute('opacity', op.toFixed(3));

      // Temporary line to cursor when very close
      var tl = tempLines[i];
      if (act && dd < TEMP_R) {
        var tf = ((1 - dd / TEMP_R) * 0.28).toFixed(3);
        tl.setAttribute('x1', s.x.toFixed(1));
        tl.setAttribute('y1', s.y.toFixed(1));
        tl.setAttribute('x2', lx.toFixed(1));
        tl.setAttribute('y2', ly.toFixed(1));
        tl.setAttribute('stroke-opacity', tf);
      } else {
        tl.setAttribute('stroke-opacity', '0');
      }
    }

    for (var j = 0; j < lines.length; j++) {
      var l   = lines[j];
      var midX = (l.a.x + l.b.x) * 0.5;
      var midY = (l.a.y + l.b.y) * 0.5;
      var mdx  = midX - lx;
      var mdy  = midY - ly;
      var md   = Math.sqrt(mdx * mdx + mdy * mdy);
      var ln   = act && md < 130;

      l.el.setAttribute('x1', l.a.x.toFixed(1));
      l.el.setAttribute('y1', l.a.y.toFixed(1));
      l.el.setAttribute('x2', l.b.x.toFixed(1));
      l.el.setAttribute('y2', l.b.y.toFixed(1));
      l.el.setAttribute('stroke-opacity', ln ? '0.48' : '0.18');
      l.el.setAttribute('stroke-width',   ln ? '0.75' : '0.45');
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (build()) rafId = requestAnimationFrame(tick);
  }

  function init() {
    svg = document.getElementById('hero-constellation');
    if (!svg) return;

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX;
      my = e.clientY;
    });
    window.addEventListener('mouseleave', function () {
      mx = -9999;
      my = -9999;
    });
    window.addEventListener('scroll', function () {
      scrollOff = window.pageYOffset || window.scrollY || 0;
    }, { passive: true });
    window.addEventListener('resize', function () {
      clearTimeout(resizeTid);
      resizeTid = setTimeout(start, 200);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!rafId && stars.length) {
        rafId = requestAnimationFrame(tick);
      }
    });

    setTimeout(start, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
