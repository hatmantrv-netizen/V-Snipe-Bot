import { CONFIG } from "./config.js";
import { callGemini } from "./gemini.js";
import { callGroq } from "./groq.js";

/**
 * Essaie chaque fournisseur défini dans CONFIG.AI_PROVIDERS dans l'ordre,
 * et passe au suivant en cas de quota atteint ou de modèle indisponible.
 * Ne relance PAS sur des erreurs de contenu (image bloquée, JSON invalide) :
 * ces erreurs-là sont les mêmes sur tous les fournisseurs donc inutile
 * d'insister, on les remonte directement.
 *
 * @param {Array<{mimeType: string, data: string}>} images
 * @param {string} systemPrompt - doit décrire explicitement le JSON attendu
 */
export async function callAIJSON(images, systemPrompt) {
  let lastError;

  for (const { provider, model } of CONFIG.AI_PROVIDERS) {
    try {
      if (provider === "gemini") {
        return await callGemini(model, images, systemPrompt);
      }
      if (provider === "groq") {
        return await callGroq(model, images, systemPrompt);
      }
      throw new Error(`Fournisseur inconnu dans la config: "${provider}".`);
    } catch (err) {
      lastError = err;
      const shouldTryNext = err.isQuotaError || err.isModelError;

      console.warn(
        `[aiProvider] Échec sur ${provider}/${model}: ${err.message}` +
          (shouldTryNext ? " → passage au fournisseur suivant." : "")
      );

      if (!shouldTryNext) {
        // Erreur de contenu (sécurité, JSON invalide, clé invalide...) :
        // pas la peine d'essayer les autres fournisseurs avec la même image.
        throw err;
      }
    }
  }

  throw new Error(
    lastError
      ? `Tous les fournisseurs IA sont indisponibles. Dernière erreur : ${lastError.message}`
      : "Aucun fournisseur IA configuré."
  );
}
