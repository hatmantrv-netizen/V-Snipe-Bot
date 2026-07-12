import { CONFIG } from "./config.js";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Appelle un modèle vision Groq (compatible OpenAI) avec une ou plusieurs
 * images + un prompt. Le prompt DOIT explicitement décrire le format JSON
 * attendu dans son texte, car Groq ne supporte pas de schéma structuré
 * strict comme Gemini (juste un mode "JSON valide" générique).
 *
 * Lance une erreur avec `.isQuotaError` ou `.isModelError` pour permettre
 * à l'appelant (aiProvider.js) de décider de la suite.
 */
export async function callGroq(model, images, systemPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY manquante. Ajoute-la dans le fichier .env.");
  }

  const content = [
    { type: "text", text: systemPrompt },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    })),
  ];

  const body = {
    model,
    messages: [{ role: "user", content }],
    temperature: 0.6,
    response_format: { type: "json_object" },
  };

  let lastError;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        lastError = Object.assign(
          new Error(`Quota Groq "${model}" temporairement atteint (429).`),
          { isQuotaError: true }
        );
        await sleep(1000 * attempt);
        continue;
      }

      if (res.status === 404) {
        throw Object.assign(
          new Error(`Le modèle Groq "${model}" n'existe pas ou plus (404).`),
          { isModelError: true }
        );
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Groq a répondu ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("Réponse Groq vide ou dans un format inattendu.");
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Impossible de parser le JSON renvoyé par Groq.");
      }
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (err.isModelError) throw err;

      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(600 * attempt);
      }
    }
  }

  throw lastError ?? new Error(`Échec de l'appel à Groq "${model}".`);
}
