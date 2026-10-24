// Les vibrations : par l'app iPhone (Capacitor Haptics) quand elle est là, sinon par le navigateur (Android).
// Safari sur iPhone ne vibre pas : sur le web, rien ne se passe, c'est normal.
export type Vibration = "leger" | "moyen" | "fort" | "refus";

import { reglages } from "./reglages";

interface Haptics {
  impact(o: { style: "LIGHT" | "MEDIUM" | "HEAVY" }): Promise<void>;
  notification(o: { type: "WARNING" | "ERROR" | "SUCCESS" }): Promise<void>;
}

let dernier = 0;

export function vibrer(v: Vibration): void {
  if (!reglages.vibrations) return;
  // Pas plus d'une vibration toutes les 60 ms : une rafale de morts ne doit pas faire bourdonner le téléphone
  const t = performance.now();
  if (t - dernier < 60 && v === "leger") return;
  dernier = t;
  const haptics = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: Haptics } } }).Capacitor?.Plugins?.Haptics;
  if (haptics) {
    if (v === "refus") void haptics.notification({ type: "WARNING" }).catch(() => {});
    else void haptics.impact({ style: v === "leger" ? "LIGHT" : v === "moyen" ? "MEDIUM" : "HEAVY" }).catch(() => {});
    return;
  }
  navigator.vibrate?.(v === "leger" ? 8 : v === "moyen" ? 20 : v === "fort" ? [30, 30, 60] : [15, 40, 15]);
}
