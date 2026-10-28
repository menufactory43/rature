import { describe, expect, it } from "vitest";
import { FERME, MESSAGE_MAX, admettre, entrer, origineAdmise, relayable, type Etat } from "../relais/src/salon";

const VIDE: Etat = { cree: null, hote: null, invite: null };

describe("relais de la coop", () => {
  it("ne fait passer que le JSON du jeu, pas trop long", () => {
    expect(relayable('{"t":"tour","n":3,"a":[]}')).toBe(true);
    expect(relayable("ping")).toBe(false);
    expect(relayable("p8 AAAA")).toBe(false);
    expect(relayable("{" + "x".repeat(MESSAGE_MAX))).toBe(false);
  });
  it("un salon, deux places tenues par leur clé", () => {
    const t = 1000;
    expect(admettre(VIDE, "invite", "b", false, new Set(), t)).toEqual({ ok: false, code: FERME.inconnu, raison: "salon introuvable" });
    expect(admettre(VIDE, "hote", "a", true, new Set(), t).ok).toBe(true);
    let e = entrer(VIDE, "hote", "a", true, t);
    expect(admettre(e, "invite", "b", false, new Set(["hote"]), t).ok).toBe(true);
    e = entrer(e, "invite", "b", false, t);
    expect(admettre(e, "invite", "c", false, new Set(["hote", "invite"]), t)).toMatchObject({ ok: false, code: FERME.complet });
    expect(admettre(e, "hote", "z", true, new Set(["hote"]), t)).toMatchObject({ ok: false, code: FERME.pris });
  });
  it("admet la page publiée, l'app et le réseau local", () => {
    expect(origineAdmise("https://menufactory43.github.io")).toBe(true);
    expect(origineAdmise("capacitor://localhost")).toBe(true);
    expect(origineAdmise("http://192.168.1.139:5191")).toBe(true);
    expect(origineAdmise("https://html-classic.itch.zone")).toBe(true);
    expect(origineAdmise("https://itch.zone.exemple.com")).toBe(false);
    expect(origineAdmise("https://rature.game-files.crazygames.com")).toBe(true);
    expect(origineAdmise("https://crazygames.com.exemple.com")).toBe(false);
    expect(origineAdmise("https://exemple.com")).toBe(false);
  });
});
