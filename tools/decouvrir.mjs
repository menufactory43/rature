// Le site vitrine de Rature, en français et en anglais : node tools/decouvrir.mjs
// Écrit public/decouvrir/index.html et public/decouvrir/en/index.html (les images, la feuille de style et mini.js sont partagés).
import { mkdirSync, writeFileSync } from 'node:fs';

const RACINE = 'https://menufactory43.github.io/rature/';
const ICI = new URL('../public/decouvrir/', import.meta.url).pathname;

const TOURS = [
  ['○', 'Plume', 'Pen', 'tir rapide, une cible', 'rapid fire, one target', '#2a4fd0'],
  ['△', 'Roquettes', 'Rockets', 'explosion de zone', 'area explosions', '#222'],
  ['Z', 'Foudre', 'Lightning', 'saute de monstre en monstre', 'jumps from monster to monster', '#7a3fc4'],
  ['✓', 'Correction', 'Correction', 'portée infinie, voit les furtifs', 'infinite range, sees stealthy ones', '#2a4fd0'],
  ['@', 'Spirale', 'Spiral', 'aura qui ralentit', 'a slowing aura', '#1f8a4c'],
  ['☆', 'Scie', 'Saw', 'lames autour d’elle', 'blades spinning around it', '#444'],
  ['U', 'Encrier', 'Inkwell', 'produit de l’encre', 'makes ink', '#178a8a'],
];

const fr = {
  lang: 'fr', autre: 'en/', autreNom: 'English', p: '',
  titre: 'Rature · Un tower defense où l’on dessine ses tours au stylo bille',
  description: 'Dessine tes tours au stylo bille, trace des murs et rature les lettres qui envahissent ton cahier. Gratuit, sans pub ni achat, jouable dans le navigateur.',
  jouer: 'Jouer', jouerNav: '▶ Jouer dans le navigateur',
  sousTitre: 'un tower defense au stylo bille',
  accroche: 'Les marges de ton cahier sont envahies. Ton arme ? Ton stylo bille.',
  chapeau: 'Des lettres, des fautes, des avions de dictée et des points d’exclamation marchent droit sur ton Cœur. Dessine tes tours, trace des murs, et rature tout ce qui dépasse.',
  promesses: ['Gratuit', 'Sans pub', 'Sans achat', 'Hors ligne'],
  video: 'Une partie de Rature, sur iPhone',
  essaiSur: 'Essaie, là, tout de suite', essaiTitre: 'Défends cette page',
  essaiGestes: [
    ['<circle cx="28" cy="20" r="11"/>', 'Un <b>petit rond</b> à côté du chemin : c’est une tour. Elle garde la forme de ton dessin et tire toute seule.'],
    ['<path class="r" d="M8 30 L48 10"/>', 'Un <b>grand trait</b> sur les lettres : tu les ratures.'],
    ['<path d="M28 8 C 20 20, 18 26, 28 34 C 38 26, 36 20, 28 8 Z"/>', 'Tout coûte de l’<b>encre</b>. Elle revient toute seule, et chaque lettre raturée en rapporte.'],
  ],
  essaiNote: 'Une version de poche avec une seule tour. Le vrai jeu en a sept, plus les murs, la colle, 20 pages et quatre boss.',
  miniAria: 'Mini-jeu : dessiner des tours et raturer les lettres qui traversent la page',
  gestesSur: 'Tout se dessine', gestesTitre: 'Pas de menu de construction : ton stylo suffit',
  gestes: [
    ['<path class="anim" d="M70 25 L95 70 L45 70 Z"/>', 'Un petit symbole', 'un cercle, un triangle, un éclair… et la tour apparaît'],
    ['<path class="anim" d="M15 60 C 45 50, 90 65, 125 45"/>', 'Un trait lent', 'un mur que la horde doit contourner, ou ronger'],
    ['<path class="anim r" d="M20 70 L120 20"/><text x="45" y="62" fill="#d23a32" stroke="none" font-family="Caveat" font-size="34" font-weight="700">mot</text>', 'Un trait sec', 'il rature tout ce qu’il touche'],
    ['<path class="anim" d="M70 15 C 115 15, 125 75, 70 78 C 20 80, 20 18, 72 18"/>', 'Une grande boucle', 'de la colle, qui ralentit tout ce qui passe dedans'],
  ],
  toursSur: 'Sept tours', toursTitre: 'Chaque symbole a sa tour, et chaque tour deux spécialisations',
  toursTexte: 'Trois niveaux, puis un choix au niveau 4 : la Plume devient mitrailleuse ou perforante, la Foudre orage ou surtension… Et la Trousse te laisse redessiner tes tours à ta main.',
  contenuSur: 'Ce qui t’attend', contenuTitre: 'Quatre cahiers à défendre',
  contenu: [
    '<b>4 cahiers, 20 pages faites main</b> : brouillon, maths, musique et dictée, chacun avec son papier.',
    '<b>15 monstres-lettres</b> : des z nerveux qui zigzaguent, des furtifs que seule la Correction voit…',
    '<b>Des défis</b> par page, un <b>mode sans fin</b>, la <b>page du jour</b> (la même pour tout le monde) et l’<b>interro surprise</b>.',
    '<b>Des talents</b> à placer avec tes étoiles.',
    '<b>À deux</b> : chacun sur son téléphone, une seule encre pour deux stylos.',
    '<b>Bille</b>, la mascotte, t’explique tout dans un tutoriel tout doux… et te glisse des conseils (tu peux la faire taire).',
    'Game Center : classements et succès. Sauvegarde iCloud.',
  ],
  bossTitre: 'Et quatre boss',
  boss: ['le Mot-Serpent', 'l’Esperluette', 'l’Œ blindé', 'le Point Final'],
  galerieSur: 'En images', galerieTitre: 'Cinq pages du jeu',
  captures: ['Le menu du cahier, avec Bille', 'Une vague de lettres contre des tours dessinées et des murs d’encre', 'La dernière vague, avec l’Œ blindé', 'Les quatre cahiers et leurs pages', 'Le tutoriel avec Bille'],
  finTitre: 'Prends un stylo',
  finTexte: 'Pas une seule image dans le jeu : tout est tracé à l’encre, comme dans les marges de tes cahiers d’école.',
  bientot: 'Bientôt sur l’App Store, sur iPhone et iPad. En attendant, il se joue en entier dans le navigateur.',
  pied: 'Rature, un jeu du studio <a href="https://praxeongames.com/"><b>Praxeon</b></a>, fait le soir après le coucher des enfants.',
  confidentialite: 'Confidentialité', assistance: 'Assistance',
};

const en = {
  lang: 'en', autre: '../', autreNom: 'Français', p: '../',
  titre: 'Rature · A tower defense where you draw your towers in ballpoint pen',
  description: 'Draw your towers with a ballpoint pen, trace walls and cross out the letters invading your notebook. Free, no ads, no purchases, playable in your browser.',
  jouer: 'Play', jouerNav: '▶ Play in your browser',
  sousTitre: 'a ballpoint-pen tower defence',
  accroche: 'The margins of your notebook are under attack. Your weapon? Your ballpoint pen.',
  chapeau: 'Letters, typos, dictation paper planes and exclamation marks are marching on your Heart. Draw your towers, trace walls, and cross out anything that gets too close.',
  promesses: ['Free', 'No ads', 'No purchases', 'Works offline'],
  video: 'A game of Rature, on iPhone',
  essaiSur: 'Try it right here', essaiTitre: 'Defend this page',
  essaiGestes: [
    ['<circle cx="28" cy="20" r="11"/>', 'A <b>small circle</b> next to the path makes a tower. It keeps the shape you drew and fires by itself.'],
    ['<path class="r" d="M8 30 L48 10"/>', 'A <b>long stroke</b> across the letters crosses them out.'],
    ['<path d="M28 8 C 20 20, 18 26, 28 34 C 38 26, 36 20, 28 8 Z"/>', 'Everything costs <b>ink</b>. It refills by itself, and every crossed-out letter brings some back.'],
  ],
  essaiNote: 'A pocket version with a single tower. The real game has seven, plus walls, glue, 20 pages and four bosses.',
  miniAria: 'Mini-game: draw towers and cross out the letters walking across the page',
  gestesSur: 'You draw everything', gestesTitre: 'No build menu: your pen is enough',
  gestes: [
    ['<path class="anim" d="M70 25 L95 70 L45 70 Z"/>', 'A small symbol', 'a circle, a triangle, a lightning bolt… and a tower appears'],
    ['<path class="anim" d="M15 60 C 45 50, 90 65, 125 45"/>', 'A slow stroke', 'a wall the horde must walk around, or chew through'],
    ['<path class="anim r" d="M20 70 L120 20"/><text x="40" y="62" fill="#d23a32" stroke="none" font-family="Caveat" font-size="34" font-weight="700">word</text>', 'A quick stroke', 'it crosses out whatever it hits'],
    ['<path class="anim" d="M70 15 C 115 15, 125 75, 70 78 C 20 80, 20 18, 72 18"/>', 'A big loop', 'glue that slows down everything inside it'],
  ],
  toursSur: 'Seven towers', toursTitre: 'Each symbol has its tower, and each tower two specialisations',
  toursTexte: 'Three levels, then a choice at level 4: the Pen becomes a machine gun or a piercer, Lightning a storm or a surge… And the Pencil Case lets you redraw your towers by hand.',
  contenuSur: 'What awaits you', contenuTitre: 'Four notebooks to defend',
  contenu: [
    '<b>4 notebooks, 20 handmade pages</b>: scratch, maths, music and dictation, each with its own paper.',
    '<b>15 letter monsters</b>: nervous zigzagging z’s, stealthy ones only the Correction can see…',
    '<b>Challenges</b> for every page, an <b>endless mode</b>, the <b>daily page</b> (the same for everyone) and the <b>pop quiz</b>.',
    '<b>Talents</b> to buy with your stars.',
    '<b>Two players</b>: each on their own phone, one ink pot for two pens.',
    '<b>Bille</b>, the mascot, explains everything in a gentle tutorial… and slips you tips (you can tell her to hush).',
    'Game Center leaderboards and achievements. iCloud save.',
  ],
  bossTitre: 'And four bosses',
  boss: ['the Snake Word', 'the Ampersand', 'the Armoured Œ', 'the Full Stop'],
  galerieSur: 'Screenshots', galerieTitre: 'Five pages from the game',
  captures: ['The notebook menu, with Bille', 'A wave of letters against drawn towers and ink walls', 'The final wave, with the Armoured Œ', 'The four notebooks and their pages', 'The tutorial with Bille'],
  finTitre: 'Grab a pen',
  finTexte: 'Not a single image in the game: everything is drawn in ink, like in the margins of your school notebooks.',
  bientot: 'Coming soon to the App Store, on iPhone and iPad. Until then, the whole game plays in your browser. The game is in English and French.',
  pied: 'Rature, a game by the <a href="https://praxeongames.com/en/"><b>Praxeon</b></a> studio, made in the evenings after the kids are asleep.',
  confidentialite: 'Privacy', assistance: 'Support',
};

const page = (t) => {
  const p = t.p, img = `${p}img/${t.lang}/`, jeu = `${p}../`;
  const ici = t.lang === 'fr' ? `${RACINE}decouvrir/` : `${RACINE}decouvrir/en/`;
  return `<!doctype html>
<html lang="${t.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${t.titre}</title>
  <meta name="description" content="${t.description}">
  <meta name="theme-color" content="#6e4626">
  <link rel="canonical" href="${ici}">
  <link rel="alternate" hreflang="fr" href="${RACINE}decouvrir/">
  <link rel="alternate" hreflang="en" href="${RACINE}decouvrir/en/">
  <link rel="alternate" hreflang="x-default" href="${RACINE}decouvrir/en/">
  <link rel="icon" href="${jeu}icone.svg">
  <link rel="apple-touch-icon" href="${jeu}apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${t.titre}">
  <meta property="og:description" content="${t.description}">
  <meta property="og:image" content="${RACINE}decouvrir/img/${t.lang}/apercu.webp">
  <link rel="preload" href="${p}polices/caveat-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${p}style.css">
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Rature', genre: ['Tower defense', t.lang === 'fr' ? 'Stratégie' : 'Strategy'], gamePlatform: ['Web', 'iPhone', 'iPad'], inLanguage: ['fr', 'en'], url: ici, description: t.description, publisher: { '@type': 'Organization', name: 'Praxeon', url: 'https://praxeongames.com/' }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } })}</script>
</head>
<body>
  <header class="barre">
    <a class="marque" href="#haut"><img src="${p}img/icone.webp" width="32" height="32" alt="">Rature</a>
    <a class="langue" href="${t.autre}" hreflang="${t.lang === 'fr' ? 'en' : 'fr'}" lang="${t.lang === 'fr' ? 'en' : 'fr'}">${t.autreNom}</a>
    <a class="bouton petit" href="${jeu}">${t.jouer}</a>
  </header>

  <main id="haut">
    <section class="feuille bloc une">
      <div>
        <h1 class="titre">Rature</h1>
        <svg class="trait-rouge" viewBox="0 0 340 14" aria-hidden="true"><path d="M4 8 C 90 4, 200 12, 336 5"/></svg>
        <p class="sous-titre">${t.sousTitre}</p>
        <p class="accroche">${t.accroche}</p>
        <p>${t.chapeau}</p>
        <div class="boutons"><a class="bouton" href="${jeu}">${t.jouerNav}</a></div>
        <ul class="promesses">${t.promesses.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>
      <figure class="telephone">
        <video src="${img}apercu.mp4" poster="${img}apercu.webp" autoplay muted loop playsinline preload="metadata" aria-label="${t.video}"></video>
      </figure>
    </section>

    <section class="feuille bloc essai" id="essayer">
      <div>
        <p class="surtitre">✎ ${t.essaiSur}</p>
        <h2>${t.essaiTitre}</h2>
        <ul class="gestes-mini">${t.essaiGestes.map(([svg, txt]) => `
          <li><svg viewBox="0 0 56 40" aria-hidden="true">${svg}</svg><span>${txt}</span></li>`).join('')}
        </ul>
        <p class="discret">${t.essaiNote}</p>
      </div>
      <div class="mini feuille"><canvas role="application" aria-label="${t.miniAria}"></canvas></div>
    </section>

    <section class="feuille bloc">
      <p class="surtitre">✎ ${t.gestesSur}</p>
      <h2>${t.gestesTitre}</h2>
      <div class="gestes">${t.gestes.map(([svg, nom, txt]) => `
        <div class="geste"><svg viewBox="0 0 140 90" aria-hidden="true">${svg}</svg><b>${nom}</b><span>${txt}</span></div>`).join('')}
      </div>
    </section>

    <section class="feuille bloc">
      <p class="surtitre">✎ ${t.toursSur}</p>
      <h2>${t.toursTitre}</h2>
      <p>${t.toursTexte}</p>
      <ul class="tours">${TOURS.map(([sym, nfr, nen, rfr, ren, c]) => `
        <li style="--c:${c}"><span class="sym">${sym}</span><b>${t.lang === 'fr' ? nfr : nen}</b><small>${t.lang === 'fr' ? rfr : ren}</small></li>`).join('')}
      </ul>
    </section>

    <section class="feuille bloc contenu">
      <div>
        <p class="surtitre">✎ ${t.contenuSur}</p>
        <h2>${t.contenuTitre}</h2>
        <ul class="liste">${t.contenu.map((x) => `
          <li>${x}</li>`).join('')}
        </ul>
        <h3 class="rouge" style="margin-top:1.6rem">${t.bossTitre}</h3>
        <ul class="boss">${t.boss.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>
      <figure class="telephone"><img src="${img}iphone-3.webp" width="600" height="1300" loading="lazy" alt="${t.captures[2]}"></figure>
    </section>

    <section class="feuille bloc">
      <p class="surtitre">✎ ${t.galerieSur}</p>
      <h2>${t.galerieTitre}</h2>
      <div class="galerie">${t.captures.map((alt, i) => `
        <img src="${img}iphone-${i + 1}.webp" width="600" height="1300" loading="lazy" alt="${alt}">`).join('')}
      </div>
    </section>

    <section class="feuille bloc fin">
      <h2>${t.finTitre}</h2>
      <p>${t.finTexte}</p>
      <div class="boutons"><a class="bouton" href="${jeu}">${t.jouerNav}</a></div>
      <p class="discret">${t.bientot}</p>
    </section>
  </main>

  <footer class="pied">
    <p>${t.pied}</p>
    <p><a href="${jeu}">${t.jouer}</a> · <a href="https://github.com/menufactory43/rature/issues">${t.assistance}</a> · <a href="${jeu}confidentialite.html">${t.confidentialite}</a> · <a href="${t.autre}" hreflang="${t.lang === 'fr' ? 'en' : 'fr'}">${t.autreNom}</a></p>
  </footer>

  <script type="module" src="${p}mini.js"></script>
</body>
</html>
`;
};

mkdirSync(`${ICI}en`, { recursive: true });
writeFileSync(`${ICI}index.html`, page(fr));
writeFileSync(`${ICI}en/index.html`, page(en));
console.log('public/decouvrir/index.html et en/index.html écrits');
