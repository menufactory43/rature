# rature-relais

Le relais de la coop de Rature (« À deux »). Un Cloudflare Worker et un Durable Object par salon : l'hôte et
l'invité s'y branchent par WebSocket, et chaque message de l'un part tel quel chez l'autre. Le lockstep, la
vérification de synchro et le reste se font dans le jeu (`src/coop/`). Repris du relais de Panache
(`~/panache/relay`), avec des messages plus longs (un trait de stylo, ce sont des points) et du JSON.

```
wss://rature-relais.<compte>.workers.dev/salon/ABCD?role=hote|invite&cle=<clé>[&nouveau=1]
```

- **Code** : 4 lettres sans I ni O. L'hôte le tire et crée le salon (`nouveau=1`) ; un code pris ferme en 4010 et
  le jeu en tire un autre. L'invité entre avec le code ou le lien `…/?salon=ABCD`.
- **Places** : deux, tenues chacune par une clé gardée dans le `sessionStorage` ; on reprend sa place dans la minute.
- **Messages** : `{"t":"salut","role":…,"pair":bool}` à l'arrivée, `{"t":"pair","on":bool}` quand l'autre arrive ou
  part ; ensuite seulement le JSON du jeu (`{…}`, 32 000 caractères au plus, 60 par seconde en moyenne). `ping` reçoit
  `pong` sans réveiller le salon.
- **Messages du jeu** : `debut` (l'hôte : la page et ce qu'il faut pour construire la même partie), `tour` (les
  actions d'un tour de lockstep, avec de temps en temps une empreinte de l'état), `crayon` (le trait de l'autre en
  train de s'écrire), `bonjour` (l'invité arrive sans partie), `quitte`.
- **Fermetures** : 4000 remplacé, 4003 origine, 4004 salon introuvable, 4008 trop de messages, 4009 complet, 4010
  code pris, 4011 expiré.

Essai en local : `npx wrangler dev --port 8787` ici, puis le jeu avec `?relais=ws://127.0.0.1:8787`.
Mise en ligne : `npx wrangler deploy` depuis ce dossier, avec `CLOUDFLARE_API_TOKEN` dans l'environnement.
