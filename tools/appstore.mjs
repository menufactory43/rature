// Remplit la fiche App Store de Rature par l'API App Store Connect : textes FR et EN, catégories, âge, URLs,
// captures d'écran (tools/fiche/captures/<langue>/<appareil>-N.png) et Game Center (succès, classements, images).
// La fiche de l'app doit exister (Apple ne permet pas de la créer par l'API). Relançable : ce qui existe est mis à jour.
//   node tools/appstore.mjs [textes] [captures] [apercu] [gamecenter]     (sans argument : tout)
import { createHash, createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const KID = "P2DPLW2SRN";
const ISS = "fb365280-db5a-48bb-84b3-98ae481c1235";
const BUNDLE = "com.meffysto.rature.ios";
const ICI = new URL(".", import.meta.url).pathname;
const textes = JSON.parse(readFileSync(join(ICI, "fiche/textes.json"), "utf8"));
const LANGUES = ["fr-FR", "en-US"];
const quoi = process.argv.slice(2);
const faire = (k) => !quoi.length || quoi.includes(k);

const cle = createPrivateKey(readFileSync(join(homedir(), ".appstoreconnect/private_keys", `AuthKey_${KID}.p8`)));
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function jeton() {
  const t = Math.floor(Date.now() / 1000);
  const corps = `${b64({ alg: "ES256", kid: KID, typ: "JWT" })}.${b64({ iss: ISS, iat: t, exp: t + 1000, aud: "appstoreconnect-v1" })}`;
  return `${corps}.${sign("sha256", Buffer.from(corps), { key: cle, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

async function api(methode, chemin, corps) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton()}`, "Content-Type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  const d = texte ? JSON.parse(texte) : {};
  if (!r.ok) {
    const e = new Error(`${methode} ${chemin} → ${r.status} ${(d.errors ?? []).map((x) => x.detail ?? x.title).join(" ; ")}`);
    e.statut = r.status;
    throw e;
  }
  return d;
}
const essayer = async (nom, f) => {
  try {
    return await f();
  } catch (e) {
    console.log(`  ✗ ${nom} : ${e.message}`);
    return null;
  }
};

/** Envoie un fichier selon les « upload operations » d'Apple, puis le déclare envoyé. */
async function televerser(type, attributsCreation, relation, fichier) {
  const octets = readFileSync(fichier);
  const nom = fichier.split("/").pop();
  const cree = await api("POST", `/v1/${type}`, { data: { type, attributes: { fileName: nom, fileSize: octets.length, ...attributsCreation }, relationships: relation } });
  for (const op of cree.data.attributes.uploadOperations) {
    const h = Object.fromEntries(op.requestHeaders.map((x) => [x.name, x.value]));
    const r = await fetch(op.url, { method: op.method, headers: h, body: octets.subarray(op.offset, op.offset + op.length) });
    if (!r.ok) throw new Error(`envoi de ${nom} : ${r.status}`);
  }
  await api("PATCH", `/v1/${type}/${cree.data.id}`, { data: { type, id: cree.data.id, attributes: { uploaded: true, ...(["appScreenshots", "appPreviews"].includes(type) ? { sourceFileChecksum: createHash("md5").update(octets).digest("hex") } : {}) } } });
  return cree.data.id;
}

const apps = await api("GET", `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = apps.data[0];
if (!app) {
  console.log(`Pas encore de fiche pour ${BUNDLE} dans App Store Connect : crée-la (Apps → + → Nouvelle app), puis relance.`);
  process.exit(1);
}
console.log(`App ${app.attributes.name} (${app.id})`);

// --- Les textes, les catégories, l'âge ---

if (faire("textes")) {
  console.log("Textes");
  const infos = await api("GET", `/v1/apps/${app.id}/appInfos`);
  // L'info modifiable : celle qui n'est pas encore en vente
  const info = infos.data.find((i) => !["READY_FOR_DISTRIBUTION", "READY_FOR_SALE"].includes(i.attributes.appStoreState ?? i.attributes.state)) ?? infos.data[0];
  await essayer("catégories", () => api("PATCH", `/v1/appInfos/${info.id}`, { data: { type: "appInfos", id: info.id, relationships: {
    primaryCategory: { data: { type: "appCategories", id: "GAMES" } },
    primarySubcategoryOne: { data: { type: "appCategories", id: "GAMES_STRATEGY" } },
    primarySubcategoryTwo: { data: { type: "appCategories", id: "GAMES_CASUAL" } },
  } } }));
  const locs = await api("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`);
  for (const l of LANGUES) {
    const t = textes[l];
    const attributs = { name: t.nom, subtitle: t.sousTitre, privacyPolicyUrl: textes.urls.confidentialite };
    const existe = locs.data.find((x) => x.attributes.locale === l);
    await essayer(`infos ${l}`, () => existe
      ? api("PATCH", `/v1/appInfoLocalizations/${existe.id}`, { data: { type: "appInfoLocalizations", id: existe.id, attributes: attributs } })
      : api("POST", "/v1/appInfoLocalizations", { data: { type: "appInfoLocalizations", attributes: { locale: l, ...attributs }, relationships: { appInfo: { data: { type: "appInfos", id: info.id } } } } }));
  }
  const age = await essayer("âge", () => api("GET", `/v1/appInfos/${info.id}/ageRatingDeclaration`));
  if (age) {
    const AUCUN = ["alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "horrorOrFearThemes", "matureOrSuggestiveThemes", "medicalOrTreatmentInformation", "profanityOrCrudeHumor", "sexualContentGraphicAndNudity", "sexualContentOrNudity", "violenceRealistic", "violenceRealisticProlongedGraphicOrSadistic", "gunsOrOtherWeapons"];
    const attributs = { ...Object.fromEntries(AUCUN.map((k) => [k, "NONE"])), violenceCartoonOrFantasy: "INFREQUENT_OR_MILD", gambling: false, unrestrictedWebAccess: false, lootBox: false, messagingAndChat: false, userGeneratedContent: false, advertising: false, parentalControls: false, ageAssurance: false, healthOrWellnessTopics: false };
    // Les champs changent d'une version de l'API à l'autre : on retire ceux qu'Apple refuse
    let restants = { ...attributs };
    for (let essai = 0; essai < 6; essai++) {
      try {
        await api("PATCH", `/v1/ageRatingDeclarations/${age.data.id}`, { data: { type: "ageRatingDeclarations", id: age.data.id, attributes: restants } });
        break;
      } catch (e) {
        const fautif = Object.keys(restants).find((k) => e.message.includes(k));
        if (!fautif) {
          console.log(`  ✗ âge : ${e.message}`);
          break;
        }
        delete restants[fautif];
      }
    }
  }
  const versions = await api("GET", `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`);
  const version = versions.data.find((v) => ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"].includes(v.attributes.appStoreState ?? v.attributes.appVersionState)) ?? versions.data[0];
  console.log(`  version ${version.attributes.versionString}`);
  const vlocs = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  for (const l of LANGUES) {
    const t = textes[l];
    const attributs = { description: t.description, keywords: t.motsCles, promotionalText: t.promo, supportUrl: textes.urls.support, marketingUrl: textes.urls.marketing };
    const existe = vlocs.data.find((x) => x.attributes.locale === l);
    await essayer(`version ${l}`, () => existe
      ? api("PATCH", `/v1/appStoreVersionLocalizations/${existe.id}`, { data: { type: "appStoreVersionLocalizations", id: existe.id, attributes: attributs } })
      : api("POST", "/v1/appStoreVersionLocalizations", { data: { type: "appStoreVersionLocalizations", attributes: { locale: l, ...attributs }, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } } } }));
  }
  await essayer("copyright", () => api("PATCH", `/v1/appStoreVersions/${version.id}`, { data: { type: "appStoreVersions", id: version.id, attributes: { copyright: `${new Date().getFullYear()} Rature` } } }));
}

// --- Les captures ---

const TYPES_CAPTURE = { iphone: "APP_IPHONE_67", ipad: "APP_IPAD_PRO_3GEN_129" };

if (faire("captures")) {
  console.log("Captures");
  const versions = await api("GET", `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`);
  const version = versions.data[0];
  const vlocs = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  for (const loc of vlocs.data) {
    const l = loc.attributes.locale;
    const dossier = join(ICI, "fiche/captures", l.slice(0, 2));
    if (!existsSync(dossier)) continue;
    const sets = await api("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots`);
    for (const [appareil, type] of Object.entries(TYPES_CAPTURE)) {
      const fichiers = readdirSync(dossier).filter((f) => f.startsWith(appareil + "-") && f.endsWith(".png")).sort();
      if (!fichiers.length) continue;
      let set = sets.data.find((s) => s.attributes.screenshotDisplayType === type);
      if (set) {
        // On remplace les anciennes
        for (const c of set.relationships?.appScreenshots?.data ?? []) await essayer("effacer une capture", () => api("DELETE", `/v1/appScreenshots/${c.id}`));
      } else {
        set = (await api("POST", "/v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } })).data;
      }
      for (const f of fichiers) {
        await essayer(`${l} ${f}`, () => televerser("appScreenshots", {}, { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } }, join(dossier, f)));
        console.log(`  ${l} ${f} (${Math.round(statSync(join(dossier, f)).size / 1024)} ko)`);
      }
    }
  }
}

// --- La vidéo d'aperçu (tools/apercu.mjs) ---

if (faire("apercu")) {
  console.log("Aperçu vidéo");
  const version = (await api("GET", `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`)).data[0];
  const vlocs = await api("GET", `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  for (const loc of vlocs.data) {
    const l = loc.attributes.locale;
    const fichier = join(ICI, "fiche/apercu", l.slice(0, 2), "iphone.mp4");
    if (!existsSync(fichier)) continue;
    const sets = await api("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appPreviewSets?include=appPreviews`);
    let set = sets.data.find((s) => s.attributes.previewType === "IPHONE_67");
    if (set) for (const c of set.relationships?.appPreviews?.data ?? []) await essayer("effacer un aperçu", () => api("DELETE", `/v1/appPreviews/${c.id}`));
    else set = (await api("POST", "/v1/appPreviewSets", { data: { type: "appPreviewSets", attributes: { previewType: "IPHONE_67" }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } })).data;
    // L'image d'affiche : en pleine bataille
    await essayer(`${l} aperçu`, () => televerser("appPreviews", { mimeType: "video/mp4", previewFrameTimeCode: "00:00:06:00" }, { appPreviewSet: { data: { type: "appPreviewSets", id: set.id } } }, fichier));
    console.log(`  ${l} iphone.mp4 (${Math.round(statSync(fichier).size / 1024)} ko)`);
  }
}

// --- Game Center ---

if (faire("gamecenter")) {
  console.log("Game Center");
  // Les succès et les classements viennent du jeu lui-même (src/succes.ts), traduits par fiche/gamecenter.json
  const gc = JSON.parse(readFileSync(join(ICI, "fiche/gamecenter.json"), "utf8"));
  let detail = await essayer("détail", () => api("GET", `/v1/apps/${app.id}/gameCenterDetail`));
  if (!detail?.data) detail = await essayer("activer", () => api("POST", "/v1/gameCenterDetails", { data: { type: "gameCenterDetails", relationships: { app: { data: { type: "apps", id: app.id } } } } }));
  if (!detail?.data) process.exit(1);
  const did = detail.data.id;
  const succesExistants = (await api("GET", `/v1/gameCenterDetails/${did}/gameCenterAchievements?limit=200`)).data;
  for (const s of gc.succes) {
    let a = succesExistants.find((x) => x.attributes.vendorIdentifier === s.id);
    if (!a) {
      a = (await essayer(`succès ${s.id}`, () => api("POST", "/v1/gameCenterAchievements", { data: { type: "gameCenterAchievements",
        attributes: { referenceName: s.fr.nom, vendorIdentifier: s.id, points: s.points, showBeforeEarned: true, repeatable: false },
        relationships: { gameCenterDetail: { data: { type: "gameCenterDetails", id: did } } } } })))?.data;
      if (!a) continue;
    }
    const locs = (await api("GET", `/v1/gameCenterAchievements/${a.id}/localizations`)).data;
    for (const l of LANGUES) {
      const t = s[l.slice(0, 2)];
      let loc = locs.find((x) => x.attributes.locale === l);
      const attributs = { name: t.nom, beforeEarnedDescription: t.texte, afterEarnedDescription: t.texte };
      if (loc) await essayer(`texte ${s.id} ${l}`, () => api("PATCH", `/v1/gameCenterAchievementLocalizations/${loc.id}`, { data: { type: "gameCenterAchievementLocalizations", id: loc.id, attributes: attributs } }));
      else loc = (await essayer(`texte ${s.id} ${l}`, () => api("POST", "/v1/gameCenterAchievementLocalizations", { data: { type: "gameCenterAchievementLocalizations", attributes: { locale: l, ...attributs }, relationships: { gameCenterAchievement: { data: { type: "gameCenterAchievements", id: a.id } } } } })))?.data;
      const image = join(ICI, "fiche/gamecenter", `${s.id}.png`);
      if (loc && existsSync(image)) {
        const deja = await essayer("image ?", () => api("GET", `/v1/gameCenterAchievementLocalizations/${loc.id}/gameCenterAchievementImage`));
        // Une image envoyée mais pas encore déclarée (un essai précédent interrompu) : on la déclare
        if (deja?.data && deja.data.attributes?.assetDeliveryState?.state !== "COMPLETE") await essayer(`image ${s.id} ${l}`, () => api("PATCH", `/v1/gameCenterAchievementImages/${deja.data.id}`, { data: { type: "gameCenterAchievementImages", id: deja.data.id, attributes: { uploaded: true } } }));
        if (!deja?.data) await essayer(`image ${s.id} ${l}`, () => televerser("gameCenterAchievementImages", {}, { gameCenterAchievementLocalization: { data: { type: "gameCenterAchievementLocalizations", id: loc.id } } }, image));
      }
    }
    console.log(`  succès ${s.id}`);
  }
  const tableauxExistants = (await api("GET", `/v1/gameCenterDetails/${did}/gameCenterLeaderboards?limit=50`)).data;
  for (const t of gc.tableaux) {
    let b = tableauxExistants.find((x) => x.attributes.vendorIdentifier === t.id);
    if (!b) {
      const base = { defaultFormatter: "INTEGER", referenceName: t.fr.nom, vendorIdentifier: t.id, submissionType: "BEST_SCORE", scoreSortType: "DESC" };
      const recurrent = t.quotidien ? { recurrenceStartDate: new Date(Date.UTC(2026, 0, 1)).toISOString(), recurrenceDuration: "P1D", recurrenceRule: "FREQ=DAILY;INTERVAL=1" } : {};
      const creer = (attributs) => api("POST", "/v1/gameCenterLeaderboards", { data: { type: "gameCenterLeaderboards", attributes: attributs, relationships: { gameCenterDetail: { data: { type: "gameCenterDetails", id: did } } } } });
      b = (await essayer(`classement ${t.id}`, () => creer({ ...base, ...recurrent }).catch((e) => (t.quotidien ? creer(base) : Promise.reject(e)))))?.data;
      if (!b) continue;
    }
    const locs = (await api("GET", `/v1/gameCenterLeaderboards/${b.id}/localizations`)).data;
    for (const l of LANGUES) {
      const x = t[l.slice(0, 2)];
      const existe = locs.find((y) => y.attributes.locale === l);
      const attributs = { name: x.nom, formatterSuffix: x.suffixe, formatterSuffixSingular: x.suffixe1 };
      await essayer(`texte ${t.id} ${l}`, () => existe
        ? api("PATCH", `/v1/gameCenterLeaderboardLocalizations/${existe.id}`, { data: { type: "gameCenterLeaderboardLocalizations", id: existe.id, attributes: attributs } })
        : api("POST", "/v1/gameCenterLeaderboardLocalizations", { data: { type: "gameCenterLeaderboardLocalizations", attributes: { locale: l, ...attributs }, relationships: { gameCenterLeaderboard: { data: { type: "gameCenterLeaderboards", id: b.id } } } } }));
    }
    console.log(`  classement ${t.id}`);
  }
}
console.log("Fini. Reste à faire à la main dans App Store Connect : la confidentialité de l'app (« aucune donnée collectée ») et le prix.");
