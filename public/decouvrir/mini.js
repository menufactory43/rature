// Une page de poche de Rature pour le site : un petit dessin pose une tour, un grand trait rature les lettres.
// Sans dépendance ; la langue suit <html lang>.
const EN = document.documentElement.lang.startsWith('en');
const T = EN ? {
  mots: ['homework', 'monday', 'spelling', 'grammar', 'detention', 'quiz', 'report', 'lunch', 'zero', 'typo'],
  vague: (n) => `wave ${n}`, encre: 'ink', record: (n) => `best: wave ${n}`,
  aide: 'draw a small circle here', chemin: 'not on the path!', sec: 'not enough ink', perdu: 'Page lost', relance: 'a fresh page in a moment…',
  boss: 'the Ampersand',
} : {
  mots: ['dictée', 'lundi', 'devoirs', 'conjugaison', 'interro', 'bulletin', 'punition', 'cantine', 'zéro', 'faute'],
  vague: (n) => `vague ${n}`, encre: 'encre', record: (n) => `record : vague ${n}`,
  aide: 'dessine un petit rond ici', chemin: 'pas sur le chemin !', sec: "pas assez d'encre", perdu: 'Page perdue', relance: 'nouvelle page dans un instant…',
  boss: "l'Esperluette",
};
const BLEU = '#2a4fd0', ROUGE = '#d23a32', GRIS = 'rgba(90,90,90,.45)';
const CHEMIN = [[.42, -.06], [.42, .24], [.84, .24], [.84, .5], [.2, .5], [.2, .76], [.62, .76], [.62, .9]];
const PRIX_TOUR = 50, PRIX_RATURE = 12;

export function lancer(cv) {
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, u = 1, segs = [], total = 0;
  let lettres, tours, billes, traits, taches, bulles, encre, coeurs, vague, attente, perdu, aide, horloge = 0;
  let record = +(localStorage.getItem('rature-mini') || 0);

  const mesurer = () => {
    segs = []; total = 0;
    for (let i = 1; i < CHEMIN.length; i++) {
      const [ax, ay] = CHEMIN[i - 1], [bx, by] = CHEMIN[i];
      const l = Math.hypot((bx - ax) * W, (by - ay) * H);
      segs.push({ ax: ax * W, ay: ay * H, bx: bx * W, by: by * H, l, s0: total }); total += l;
    }
  };
  const point = (s) => {
    const g = segs.find((g) => s <= g.s0 + g.l) ?? segs[segs.length - 1];
    const k = Math.min(1, Math.max(0, (s - g.s0) / g.l));
    return { x: g.ax + (g.bx - g.ax) * k, y: g.ay + (g.by - g.ay) * k };
  };
  const distSeg = (x, y, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + dx * k - x, ay + dy * k - y);
  };
  const surChemin = (x, y) => segs.some((g) => distSeg(x, y, g.ax, g.ay, g.bx, g.by) < 26 * u);

  const nouvellePartie = () => {
    lettres = []; tours = []; billes = []; traits = []; taches = []; bulles = [];
    encre = 110; coeurs = 20; vague = 0; attente = 2.5; perdu = 0; aide = true;
  };
  nouvellePartie();

  const bulle = (x, y, txt, c = BLEU) => bulles.push({ x, y, txt, c, t: 0 });
  const lancerVague = () => {
    vague++;
    const boss = vague % 4 === 0;
    const mot = boss ? '&' : T.mots[(vague - 1) % T.mots.length];
    const pv = 2 + Math.floor(vague / 2);
    [...mot].forEach((c, i) => lettres.push({ c, s: -i * 26 * u - 10, pv: boss ? 14 + vague * 3 : pv, pv0: boss ? 14 + vague * 3 : pv, v: boss ? 22 : 34 + vague, boss, rature: 0, ph: Math.random() * 6 }));
    if (vague > record) { record = vague; localStorage.setItem('rature-mini', String(record)); }
  };

  // Le tracé du doigt
  let trace = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  cv.addEventListener('pointerdown', (e) => { if (perdu) return; cv.setPointerCapture(e.pointerId); trace = { pts: [pos(e)], t0: performance.now() }; });
  cv.addEventListener('pointermove', (e) => { if (!trace) return; const p = pos(e), d = trace.pts[trace.pts.length - 1]; if (Math.hypot(p.x - d.x, p.y - d.y) > 2) trace.pts.push(p); });
  const lever = () => {
    if (!trace) return;
    const pts = trace.pts; trace = null;
    let L = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach((p, i) => { if (i) L += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    const taille = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (L < 12) { bulle(cx, cy - 20, T.aide, GRIS); return; }
    if (taille < 90 * u) {
      // un petit dessin : une tour, qui garde la forme tracée
      if (surChemin(cx, cy)) { bulle(cx, cy - 24, T.chemin, ROUGE); return; }
      if (encre < PRIX_TOUR) { bulle(cx, cy - 24, T.sec, ROUGE); return; }
      encre -= PRIX_TOUR; aide = false;
      const k = Math.min(1, 34 * u / Math.max(taille, 1));
      tours.push({ x: cx, y: cy, forme: pts.map((p) => ({ x: (p.x - cx) * k, y: (p.y - cy) * k })), nait: horloge, recharge: .3 });
      bulle(cx, cy - 30, `−${PRIX_TOUR}`);
      return;
    }
    // un grand trait : une rature
    if (encre < PRIX_RATURE) { bulle(cx, cy, T.sec, ROUGE); return; }
    encre -= PRIX_RATURE;
    traits.push({ pts, t: 0 });
    for (const l of lettres) {
      if (l.rature || l.s < 0) continue;
      const p = point(l.s);
      for (let i = 1; i < pts.length; i++) if (distSeg(p.x, p.y - 14 * u, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) < 22 * u) { toucher(l, l.boss ? 4 : 3); break; }
    }
  };
  cv.addEventListener('pointerup', lever);
  cv.addEventListener('pointercancel', () => { trace = null; });

  const toucher = (l, n) => {
    if (l.rature) return;
    l.pv -= n; l.choc = .15;
    if (l.pv <= 0) { l.rature = .001; encre = Math.min(240, encre + (l.boss ? 40 : 6)); }
  };

  const trembler = (g, i) => Math.sin(g * 12.9898 + i * 78.233) * 1.2;
  const lettre = (l, t) => {
    const p = point(l.s), saut = l.rature ? 0 : Math.abs(Math.sin(t * 9 + l.ph)) * 4 * u, taille = (l.boss ? 70 : 34) * u;
    ctx.globalAlpha = l.rature ? Math.max(0, 1 - (l.rature - .35) * 2.5) : 1;
    ctx.fillStyle = l.choc > 0 ? '#ff8a7a' : ROUGE;
    ctx.font = `700 ${taille}px Caveat, cursive`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(l.c, p.x, p.y - saut);
    if (!l.rature) {
      const oy = p.y - taille * .82 - saut, ex = (l.boss ? 8 : 4) * u;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = ROUGE; ctx.lineWidth = 1.5;
      for (const dx of [-ex, ex]) { ctx.beginPath(); ctx.arc(p.x + dx, oy, (l.boss ? 5 : 3.2) * u, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#222';
      for (const dx of [-ex, ex]) { ctx.beginPath(); ctx.arc(p.x + dx - 1, oy, (l.boss ? 2.2 : 1.3) * u, 0, 7); ctx.fill(); }
      const pas = Math.sin(t * 14 + l.ph) * 4 * u;
      ctx.beginPath(); ctx.moveTo(p.x - ex, p.y); ctx.lineTo(p.x - ex - 2 + pas, p.y + 7 * u); ctx.moveTo(p.x + ex, p.y); ctx.lineTo(p.x + ex + 2 - pas, p.y + 7 * u); ctx.stroke();
      if (l.boss) {
        ctx.fillStyle = ROUGE; ctx.font = `400 ${13 * u}px "Patrick Hand", cursive`; ctx.fillText(T.boss, p.x, oy - 22 * u);
        ctx.fillRect(p.x - 26 * u, oy - 16 * u, 52 * u * Math.max(0, l.pv / l.pv0), 3 * u);
      }
    } else {
      const k = Math.min(1, l.rature / .35), zig = 7, w = taille * .45;
      ctx.strokeStyle = BLEU; ctx.lineWidth = 2.6 * u; ctx.beginPath();
      for (let i = 0; i <= zig * k; i++) { const x = p.x - w + (2 * w * i) / zig, y = p.y - taille * .75 + (i % 2 ? taille * .65 : 0) + trembler(l.ph, i) * 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const crayon = (pts, ox, oy, k = 1, w = 3) => {
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(ox + p.x * k, oy + p.y * k) : ctx.moveTo(ox + p.x * k, oy + p.y * k)); ctx.lineWidth = w * u; ctx.stroke();
  };
  const coeur = (x, y, r) => {
    ctx.fillStyle = 'rgba(210,58,50,.25)'; ctx.strokeStyle = ROUGE; ctx.lineWidth = 2.4 * u; ctx.beginPath();
    ctx.moveTo(x, y + r * .9); ctx.bezierCurveTo(x - r * 1.6, y - r * .1, x - r * .7, y - r * 1.3, x, y - r * .4); ctx.bezierCurveTo(x + r * .7, y - r * 1.3, x + r * 1.6, y - r * .1, x, y + r * .9);
    ctx.fill(); ctx.stroke();
  };

  let visible = false, dernier = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { dernier = performance.now(); requestAnimationFrame(image); } }).observe(cv);
  document.fonts?.load('700 40px Caveat');

  function image(now) {
    if (!visible) return;
    const dt = Math.min(.05, (now - dernier) / 1000); dernier = now; horloge += dt;
    const w = cv.clientWidth, h = cv.clientHeight, pr = Math.min(2, devicePixelRatio || 1);
    if (w !== W || h !== H) { W = w; H = h; u = Math.max(.75, Math.min(1.3, W / 420)); cv.width = Math.round(W * pr); cv.height = Math.round(H * pr); mesurer(); }
    ctx.setTransform(pr, 0, 0, pr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = ctx.lineCap = 'round';

    if (!perdu) {
      encre = Math.min(240, encre + 6 * dt);
      if ((attente -= dt) <= 0 && !lettres.some((l) => l.s < 0)) { lancerVague(); attente = Math.max(4, 8 - vague * .3); }
    } else if ((perdu -= dt) <= 0) nouvellePartie();

    // le chemin au crayon, et le Cœur
    ctx.setLineDash([3 * u, 7 * u]); ctx.strokeStyle = GRIS; ctx.lineWidth = 2;
    ctx.beginPath(); segs.forEach((g, i) => { if (!i) ctx.moveTo(g.ax, g.ay); ctx.lineTo(g.bx, g.by); }); ctx.stroke(); ctx.setLineDash([]);
    const fin = segs[segs.length - 1]; coeur(fin.bx, fin.by + 6 * u, 15 * u);

    // l'aide du début : un rond en pointillés qui se dessine
    if (aide && !perdu) {
      const x = W * .5, y = H * .37, a = (horloge * 2.2) % (Math.PI * 2.6);
      ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(42,79,208,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 16 * u, -Math.PI / 2, -Math.PI / 2 + Math.min(a, Math.PI * 2)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(42,79,208,.75)'; ctx.font = `400 ${15 * u}px "Patrick Hand", cursive`; ctx.textAlign = 'center'; ctx.fillText(T.aide, x, y + 38 * u);
    }

    for (let i = taches.length - 1; i >= 0; i--) {
      const k = taches[i]; k.t += dt; if (k.t > 6) { taches.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(42,79,208,${.18 * (1 - k.t / 6)})`; ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, 7); ctx.fill();
    }

    for (let i = lettres.length - 1; i >= 0; i--) {
      const l = lettres[i]; l.choc = (l.choc || 0) - dt;
      if (l.rature) { l.rature += dt; if (l.rature > .8) { const p = point(l.s); taches.push({ x: p.x, y: p.y - 12 * u, r: (l.boss ? 22 : 10) * u, t: 0 }); lettres.splice(i, 1); } continue; }
      if (perdu) continue;
      l.s += l.v * u * dt;
      if (l.s > total) {
        lettres.splice(i, 1); coeurs = Math.max(0, coeurs - (l.boss ? 10 : 1));
        if (!coeurs) { perdu = 3.5; lettres.forEach((m) => { if (!m.rature) m.rature = .001; }); }
      }
    }

    for (const tr of tours) {
      const k = Math.min(1, (horloge - tr.nait) / .25), pop = 1 + Math.sin(k * Math.PI) * .25;
      ctx.strokeStyle = BLEU; crayon(tr.forme, tr.x, tr.y, pop, 2.6);
      ctx.fillStyle = 'rgba(40,30,20,.12)'; ctx.beginPath(); ctx.ellipse(tr.x, tr.y + 24 * u, 14 * u, 4 * u, 0, 0, 7); ctx.fill();
      if (perdu || (tr.recharge -= dt) > 0) continue;
      let cible = null, d = 120 * u;
      for (const l of lettres) { if (l.rature || l.s < 0) continue; const p = point(l.s), e = Math.hypot(p.x - tr.x, p.y - 14 * u - tr.y); if (e < d) { d = e; cible = l; } }
      if (cible) { billes.push({ x: tr.x, y: tr.y, cible, t: 0 }); tr.recharge = .5; }
    }
    for (let i = billes.length - 1; i >= 0; i--) {
      const b = billes[i]; b.t += dt / .2;
      const p = point(b.cible.s), bx = b.x + (p.x - b.x) * b.t, by = b.y + (p.y - 16 * u - b.y) * b.t;
      ctx.fillStyle = BLEU; ctx.beginPath(); ctx.arc(bx, by, 3 * u, 0, 7); ctx.fill();
      if (b.t >= 1) { billes.splice(i, 1); toucher(b.cible, 1); }
    }
    for (const l of lettres) if (l.s > -20) lettre(l, horloge);

    // les ratures tracées, qui pâlissent
    for (let i = traits.length - 1; i >= 0; i--) {
      const r = traits[i]; r.t += dt; if (r.t > .7) { traits.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - r.t / .7; ctx.strokeStyle = BLEU; crayon(r.pts, 0, 0, 1, 3.4); ctx.globalAlpha = 1;
    }
    if (trace) { ctx.strokeStyle = 'rgba(42,79,208,.8)'; crayon(trace.pts, 0, 0, 1, 2.6); }

    for (let i = bulles.length - 1; i >= 0; i--) {
      const b = bulles[i]; b.t += dt; if (b.t > 1.2) { bulles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, (1.2 - b.t) * 3); ctx.fillStyle = b.c; ctx.font = `700 ${18 * u}px "Patrick Hand", cursive`; ctx.textAlign = 'center';
      ctx.fillText(b.txt, Math.max(70, Math.min(W - 70, b.x)), b.y - b.t * 20); ctx.globalAlpha = 1;
    }

    // en haut et en bas de la page, comme dans le jeu
    ctx.textAlign = 'left'; ctx.font = `700 ${24 * u}px Caveat, cursive`;
    ctx.fillStyle = ROUGE; ctx.fillText(`♥ ${coeurs}`, W * .16, 30 * u);
    ctx.fillStyle = BLEU; ctx.textAlign = 'right'; ctx.fillText(T.vague(vague), W - 14, 30 * u);
    ctx.font = `400 ${14 * u}px "Patrick Hand", cursive`; ctx.fillStyle = '#777'; ctx.fillText(T.record(record), W - 14, 48 * u);
    ctx.textAlign = 'left'; ctx.font = `700 ${26 * u}px Caveat, cursive`; ctx.fillStyle = BLEU;
    ctx.beginPath(); const gx = W * .16, gy = H - 22 * u; ctx.moveTo(gx, gy - 12 * u); ctx.quadraticCurveTo(gx + 8 * u, gy, gx, gy + 5 * u); ctx.quadraticCurveTo(gx - 8 * u, gy, gx, gy - 12 * u); ctx.fill();
    ctx.fillText(`${Math.floor(encre)}`, gx + 12 * u, gy + 5 * u);
    ctx.font = `400 ${14 * u}px "Patrick Hand", cursive`; ctx.fillStyle = '#777'; ctx.fillText(`○ ${PRIX_TOUR}   ⟋ ${PRIX_RATURE}`, gx + 60 * u, gy + 3 * u);

    if (perdu) {
      ctx.fillStyle = 'rgba(251,248,240,.75)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = ROUGE; ctx.font = `700 ${54 * u}px Caveat, cursive`; ctx.fillText(T.perdu, W / 2, H * .45);
      ctx.fillStyle = BLEU; ctx.font = `400 ${18 * u}px "Patrick Hand", cursive`; ctx.fillText(T.relance, W / 2, H * .45 + 34 * u);
    }
    requestAnimationFrame(image);
  }
}

const cv = document.querySelector('.mini canvas');
if (cv) lancer(cv);
