# Rature — conception du MVP

Nom de travail. Un tower defense **difficile**, pour adultes, inspiré d'InkTower (Aliaksandr Yanukovich, App Store) :
on en garde le cahier, le stylo bille et les trois gestes, on en retire tout l'idle.

## Le principe

Une tour au centre d'une page de cahier tire seule. Les monstres des marges arrivent des bords.
Le joueur dessine du doigt, et chaque trait coûte de l'**encre**, qui revient lentement (6/s, 100 au départ).

| Geste | Reconnu quand | Effet |
|---|---|---|
| **Mur** | tracé lent | Bloque les monstres au sol, qui le rongent. Sèche en 30 s. |
| **Rature** | trait sec (< 260 ms ou > 1,3 px/ms) | Frappe tous les monstres touchés. Dans le vide : encre perdue. |
| **Colle** | boucle refermée | Ralentit tout ce qui est dedans (pas les volants). |

Le stylo **sèche** : le trait s'arrête quand l'encre manque. Le geste deviné s'affiche à côté du doigt pendant le tracé.

## Ce qui rend le jeu dur (et le distingue d'InkTower)

- **L'encre est la ressource.** Un mur raté, c'est de l'encre perdue au pire moment.
- **Les murs s'usent** bout par bout : un trou laisse passer la horde.
- **Pas d'idle.** Pas de gains hors ligne, pas de recherche en temps réel : toute la puissance se gagne pendant la page (une amélioration sur trois tirées après chaque vague).
- **Une seule vie.** 20 vagues, boss aux vagues 10 et 20, et la page perdue si la tour tombe.
- **Les monstres contrent les gestes** : l'avion passe les murs, la tache les dissout, la gomme efface murs et colle, l'araignée zigzague.
- **Les vagues sont annoncées** (composition et flèches de direction) : on peut dessiner pendant la préparation.
- **Page du jour** : graine = date, la même pour tout le monde.

## Réglage de la difficulté (`npm run bot`)

Joueur automatique sur 30 pages :
- **passif** (ne dessine jamais) : perd vers la vague 5 ;
- **moyen** (un geste toutes les 0,6 s, imprécis) : tient environ 15 vagues ;
- **fort** : gagne rarement, environ 1 page sur 15.

Un humain qui place bien ses murs fait mieux que le bot ; gagner doit rester une performance.

## Technique

- TypeScript, Vite, Canvas 2D. **Aucune image** : tout est tracé en code, avec un tremblé qui se redessine 8 fois par seconde.
- `src/sim/` est pur (sans DOM) et reproductible : les tests et le bot l'utilisent directement.
- Sons synthétisés en WebAudio (grattement du stylo selon la vitesse du doigt).
- PWA : installable, et jouable hors ligne une fois chargée.
- Polices sous licence OFL : Caveat (titres) et Patrick Hand (texte).

## Après le MVP

1. Publier la version web (GitHub Pages, comme Panache).
2. App iPhone avec Capacitor (le code web tel quel), puis TestFlight.
3. Classement de la page du jour (petit serveur), plus de boss, un mode sans fin après la vague 20.
