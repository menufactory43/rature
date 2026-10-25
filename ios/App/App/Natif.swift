// Ce que le jeu demande à l'iPhone : garder la sauvegarde dans iCloud (et dans l'app, en double), et Game Center
// (connexion, classements, succès). Le jeu l'appelle par Capacitor sous le nom « Rature ».
import Capacitor
import GameKit
import UIKit

/** Le contrôleur de Capacitor, qui branche notre plugin au démarrage. */
class Pont: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RaturePlugin())
    }
}

@objc(RaturePlugin)
public class RaturePlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "RaturePlugin"
    public let jsName = "Rature"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "lire", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ecrire", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connecter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "score", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "succes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tableau", returnType: CAPPluginReturnPromise),
    ]

    private let nuage = NSUbiquitousKeyValueStore.default
    private let local = UserDefaults.standard

    override public func load() {
        // Une autre appareil a changé la sauvegarde : on prévient le jeu
        NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: nuage, queue: .main) { [weak self] n in
            let cles = (n.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String]) ?? []
            for cle in cles {
                self?.notifyListeners("nuage", data: ["cle": cle, "valeur": self?.nuage.string(forKey: cle) ?? ""])
            }
        }
        nuage.synchronize()
    }

    /** Une valeur : celle d'iCloud et celle gardée dans l'app, le jeu fusionne. */
    @objc func lire(_ call: CAPPluginCall) {
        let cle = call.getString("cle") ?? ""
        call.resolve(["nuage": nuage.string(forKey: cle) ?? "", "local": local.string(forKey: "rature." + cle) ?? ""])
    }

    @objc func ecrire(_ call: CAPPluginCall) {
        let cle = call.getString("cle") ?? ""
        let valeur = call.getString("valeur") ?? ""
        local.set(valeur, forKey: "rature." + cle)
        nuage.set(valeur, forKey: cle)
        call.resolve()
    }

    // --- Game Center ---

    @objc func connecter(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let joueur = GKLocalPlayer.local
            if joueur.isAuthenticated {
                call.resolve(["ok": true])
                return
            }
            var repondu = false
            joueur.authenticateHandler = { [weak self] vc, erreur in
                if let vc = vc {
                    self?.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                if !repondu {
                    repondu = true
                    call.resolve(["ok": joueur.isAuthenticated, "erreur": erreur?.localizedDescription ?? ""])
                }
                self?.notifyListeners("gameCenter", data: ["ok": joueur.isAuthenticated])
            }
        }
    }

    @objc func score(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated, let tableau = call.getString("tableau") else {
            call.resolve(["ok": false])
            return
        }
        let valeur = call.getInt("valeur") ?? 0
        GKLeaderboard.submitScore(valeur, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [tableau]) { erreur in
            call.resolve(["ok": erreur == nil])
        }
    }

    @objc func succes(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated, let id = call.getString("id") else {
            call.resolve(["ok": false])
            return
        }
        let a = GKAchievement(identifier: id)
        a.percentComplete = call.getDouble("pourcent") ?? 100
        a.showsCompletionBanner = true
        GKAchievement.report([a]) { erreur in
            call.resolve(["ok": erreur == nil])
        }
    }

    /** Le tableau de Game Center : les classements et les succès. */
    @objc func tableau(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let vc: GKGameCenterViewController
            if let id = call.getString("tableau") {
                vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
            } else {
                vc = GKGameCenterViewController(state: .default)
            }
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
