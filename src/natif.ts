// Le pont vers l'iPhone (le plugin « Rature » de ios/App/App/Natif.swift) : la sauvegarde dans iCloud et Game Center.
// Dans le navigateur, rien de tout ça : chaque fonction ne fait rien, sans erreur.
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

interface PluginRature {
  lire(o: { cle: string }): Promise<{ nuage: string; local: string }>;
  ecrire(o: { cle: string; valeur: string }): Promise<void>;
  connecter(): Promise<{ ok: boolean }>;
  score(o: { tableau: string; valeur: number }): Promise<{ ok: boolean }>;
  succes(o: { id: string; pourcent?: number }): Promise<{ ok: boolean }>;
  tableau(o: { tableau?: string }): Promise<void>;
  addListener(evenement: "nuage", f: (d: { cle: string; valeur: string }) => void): Promise<PluginListenerHandle>;
  addListener(evenement: "gameCenter", f: (d: { ok: boolean }) => void): Promise<PluginListenerHandle>;
}

export const natif = Capacitor.isNativePlatform();
export const plugin = natif ? registerPlugin<PluginRature>("Rature") : null;
