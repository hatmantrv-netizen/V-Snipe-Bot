import { CONFIG } from "../config.js";

/**
 * Cache mémoire simple: messageId -> { images, options, type, userId }
 * Permet aux boutons (Régénérer / toggles) de retrouver le contexte
 * d'une requête sans tout ré-encoder dans le customId (limité à 100 caractères).
 *
 * Note: si le bot redémarre, le cache est vidé. Dans ce cas les boutons
 * répondent proprement en demandant à l'utilisateur de renvoyer les photos
 * plutôt que de planter (voir handlers).
 */
const store = new Map();

export function setCache(messageId, value) {
  store.set(messageId, { ...value, expiresAt: Date.now() + CONFIG.CACHE_TTL_MS });
}

export function getCache(messageId) {
  const entry = store.get(messageId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(messageId);
    return null;
  }
  return entry;
}

// Nettoyage périodique pour éviter une fuite mémoire sur un bot longue durée
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();
