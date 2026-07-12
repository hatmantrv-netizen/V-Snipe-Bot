import { CONFIG } from "./config.js";

const API_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Appelle un modèle Gemini précis avec une ou plusieurs images + un prompt.
 * Ne gère PAS de fallback entre modèles : ça, c'est le rôle de aiProvider.js.
 * Lance une erreur avec `.isQuotaError` ou `.isModelError` pour permettre
 * à l'appelant de décider s'il faut basculer sur un autre fournisseur.
 */
export async function callGemini(model, images, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquante. Ajoute-la dans le fichier .env.");
  }

  const parts = [
    ...images.map((img) => ({
      inline_data: { mime_type: img.mimeType, data: img.data },
    })),
    { text: systemPrompt },
  ];

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.6,
      responseMimeType: "application/json",
    },
  };

  let lastError;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(API_URL(model, apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        lastError = Object.assign(
          new Error(`Quota Gemini "${model}" temporairement atteint (429).`),
          { isQuotaError: true }
        );
        await sleep(1000 * attempt);
        continue;
      }

      if (res.status === 404) {
        throw Object.assign(
          new Error(`Le modèle Gemini "${model}" n'existe pas ou plus (404).`),
          { isModelError: true }
        );
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Gemini a répondu ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
        throw new Error(
          "Le contenu de l'image a été bloqué par les filtres de sécurité de Gemini."
        );
      }

      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Réponse Gemini vide ou dans un format inattendu.");
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Impossible de parser le JSON renvoyé par Gemini.");
      }
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (String(err.message).includes("API key not valid")) throw err;
      if (err.isModelError) throw err;

      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(600 * attempt);
      }
    }
  }

  throw lastError ?? new Error(`Échec de l'appel à Gemini "${model}".`);
}
