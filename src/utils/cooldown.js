import { CONFIG } from "../config.js";

const lastUse = new Map();

/**
 * Retourne le nombre de secondes restantes avant que l'utilisateur
 * puisse relancer une requête, ou 0 s'il peut y aller.
 */
export function checkCooldown(userId) {
  const now = Date.now();
  const last = lastUse.get(userId) ?? 0;
  const elapsed = (now - last) / 1000;

  if (elapsed < CONFIG.COOLDOWN_SECONDS) {
    return Math.ceil(CONFIG.COOLDOWN_SECONDS - elapsed);
  }
  lastUse.set(userId, now);
  return 0;
}
