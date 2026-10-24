# Rature — conception

Un tower defense **difficile**, pour adultes, dessiné au stylo bille. Inspiré d'InkTower pour le cahier et les gestes, mais
avec un vrai cœur de tower defense : **ce que tu dessines devient la tour.**

Décidé avec l'utilisateur le 2026-10-24 :
- cœur : **tours dessinées** (un symbole tracé sur la page fait apparaître une tour) + les gestes du MVP (mur, rature, colle) ;
- structure : **campagne** (cahiers, cartes faites à la main, étoiles) **+ modes** (page du jour, sans fin, défis) ;
- progression : **légère et juste** (déblocages de tours, petit arbre de talents, rien à acheter) ;
- apparence : **pochoir** (on repasse un modèle, le dessin devient l'apparence de la tour en jeu).

## 1. La page

Une carte est une page de cahier. Les monstres entrent par une ou plusieurs **entrées** (flèches dans la marge) et marchent
vers **le Cœur** (le cœur dessiné au coin de la page, avec le nom de l'élève). Chaque monstre qui l'atteint retire des
**vies** (20 au départ, 1 à 3 par monstre, 10 à 20 pour un boss). À zéro, la page est perdue.

Les monstres au sol suivent **le chemin le moins coûteux** jusqu'au Cœur (champ de flux recalculé quand la page change) :
- une case libre coûte 1 ;
- un **mur** coûte le temps de le ronger : s'il est plus court de le traverser que de le contourner, ils le rongent ;
- une **tour** coûte très cher : si on les enferme complètement, ils s'attaquent aux tours ;
- les **obstacles** de la carte (taches d'encre séchée, trous dans la feuille) sont infranchissables.

On n'interdit donc jamais de bloquer : on construit des labyrinthes, et la horde choisit entre le détour et le mur.
Les **volants** vont tout droit au Cœur, par-dessus tout.

## 2. L'encre, la seule monnaie

Tout coûte de l'encre : tours, améliorations, murs, ratures, colle. Elle revient lentement (2/s), chaque monstre tué en
rapporte (sa prime), et l'encrier (une tour) en produit. Appeler la vague suivante en avance rapporte un bonus.

## 3. Dessiner

| Ce qu'on trace | Ce que ça fait |
|---|---|
| **Petit symbole** (moins de 80 px) | Pose une **tour** de ce type à l'endroit tracé |
| Grand trait lent | **Mur** (la horde le ronge ; il sèche en 30 s) |
| Trait sec et rapide | **Rature** (frappe tout ce qu'elle touche) |
| Grande boucle refermée | **Colle** (ralentit tout ce qui est dedans) |

Les symboles sont reconnus par un algorithme de reconnaissance de tracés ($1 Unistroke). Un pense-bête en bas de l'écran
montre les symboles débloqués et leur prix. Le geste deviné s'affiche à côté du doigt pendant qu'on trace.

### Les tours

Chaque tour a 3 niveaux, puis **2 spécialisations** au choix (niveau 4). On touche une tour pour l'améliorer, la vendre
(60 % rendus) ou changer sa cible (premier, dernier, plus fort, plus proche).

| Symbole | Tour | Rôle | Spécialisation A | Spécialisation B |
|---|---|---|---|---|
| ○ cercle | **Plume** | tir rapide, une cible | Mitrailleuse (cadence ×3) | Perforante (traverse 4 monstres) |
| △ triangle | **Roquettes** | explosion de zone | Napalm (sol en feu) | Obus (énorme zone, lent) |
| Z éclair | **Foudre** | saute de monstre en monstre | Orage (+3 rebonds) | Surtension (étourdit) |
| ✓ coche | **Correction** | portée infinie, gros dégâts, voit les furtifs | Stylo rouge (critiques, exécute) | Tampon (marque : +30 % de dégâts subis) |
| @ spirale | **Spirale** | aura qui ralentit | Glu (ralentit plus, englue) | Acide (ronge l'armure, dégâts) |
| ☆ étoile | **Scie** | lames autour d'elle | Tourbillon (plus large, plus de lames) | Broyeuse (ignore l'armure) |
| U coupe | **Encrier** | produit de l'encre | Banque (intérêts à chaque vague) | Plume d'or (+50 % de prime autour) |

## 4. Les monstres des marges

| Monstre | Particularité | Ce qu'il exige |
|---|---|---|
| Gribouille | le tout-venant | — |
| Carré | armure (réduit chaque coup) | gros dégâts par coup |
| Avion en papier | vole | rature, plume, correction |
| Araignée | rapide, zigzague | spirale, colle |
| Tache | ronge les murs, se divise | zone |
| Gomme | efface murs et colle | priorité de cible |
| Post-it | bouclier qui absorbe les premiers coups | cadence |
| Fantôme au crayon | furtif : invisible pour les tours sauf la Correction et les tours à moins de 50 px | correction, rature |
| Tipp-Ex | soigne les monstres autour | priorité, zone |
| Punaise | s'attaque aux tours | protéger ses tours avec des murs |
| **Boss** | la Tache Mère (cahier 1), l'Araignée-Compas (cahier 2), le Taille-Crayon (cahier 3, dévore les tours) | |

## 5. La campagne

Trois **cahiers**, chacun avec son papier et ses obstacles :
1. **Cahier de brouillon** (Seyès) : on apprend (5 pages, boss : la Tache Mère) ;
2. **Cahier de maths** (petits carreaux, compas et équerres en obstacles) : 5 pages, boss : l'Araignée-Compas ;
3. **Cahier de musique** (portées) : 5 pages, boss : le Taille-Crayon.

Chaque page est faite à la main (entrées, Cœur, obstacles) ; les vagues sont générées depuis une graine propre à la page,
donc identiques pour tout le monde. **Étoiles** : 3 si on garde au moins 18 vies, 2 au moins 10, 1 si on gagne.
Une page gagnée débloque son **défi** (une contrainte : pas de murs, 4 tours maximum, encre réduite…) et son **mode sans fin**.

### Progression légère
- les tours se débloquent au fil de la campagne, chacune avec sa page d'apprentissage ;
- les étoiles donnent des **bons points**, à dépenser dans un petit **arbre de talents** (+10 % d'encre, murs plus solides,
  ratures plus fortes…), qu'on peut redistribuer à tout moment ;
- rien ne s'achète, et le mode **page du jour** se joue sans talents (même page, mêmes règles pour tout le monde).

## 6. Les modes
- **Campagne** (ci-dessus), avec défis et sans fin par page ;
- **Page du jour** : une carte générée depuis la date, 20 vagues, toutes les tours, sans talents ;
- **Sans fin** : sur une page gagnée, les vagues ne s'arrêtent pas ; on compte jusqu'où on tient.

## 7. La trousse : dessiner ses tours
Pour chaque tour débloquée, un **pochoir** en pointillés : on le repasse au doigt, la prof tamponne « ACCEPTÉ », et ce
dessin devient l'apparence de la tour en jeu (les niveaux et spécialisations s'ajoutent par-dessus). Purement esthétique.

## 8. Confort
Vitesse ×1 / ×2 / ×3, pause, appel anticipé des vagues, aperçu de la vague suivante, portée des tours au toucher,
chiffres de dégâts lisibles, son et vibrations coupables, sauvegarde automatique de la progression.

## 9. Technique
- TypeScript, Vite, Canvas 2D, **aucune image** : tout est tracé en code avec un trait de stylo qui tremble.
- `src/sim/` est pur et reproductible (graine) : tests et joueur automatique l'utilisent directement.
- Joueur automatique (`npm run bot`) : chaque page doit être perdue sans rien faire, gagnée par un bon joueur, et ses
  trois étoiles doivent demander de bien jouer.
- PWA hors ligne ; ensuite l'app iPhone avec Capacitor.

Le plan de construction est dans [docs/plan.md](docs/plan.md).
