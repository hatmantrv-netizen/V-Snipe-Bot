import { CONFIG } from "./config.js";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Extrait le premier objet JSON valide trouvé dans un texte, même s'il
 * est entouré de texte parasite ou de balises markdown ```json ... ```.
 * Nécessaire car le mode JSON strict de Groq échoue parfois sur les
 * modèles vision "preview" (erreur json_validate_failed).
 */
function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Impossible de parser le JSON renvoyé par Groq.");
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

async function requestGroq(model, images, systemPrompt, useStrictJsonMode) {
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
    ...(useStrictJsonMode ? { response_format: { type: "json_object" } } : {}),
  };

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
      throw Object.assign(
        new Error(`Quota Groq "${model}" temporairement atteint (429).`),
        { isQuotaError: true }
      );
    }

    if (res.status === 404) {
      throw Object.assign(
        new Error(`Le modèle Groq "${model}" n'existe pas ou plus (404).`),
        { isModelError: true }
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw Object.assign(new Error(`Groq a répondu ${res.status}: ${errText.slice(0, 200)}`), {
        isJsonModeFailure: errText.includes("json_validate_failed"),
      });
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("Réponse Groq vide ou dans un format inattendu.");
    }

    return extractJSON(text);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Appelle un modèle vision Groq (compatible OpenAI) avec une ou plusieurs
 * images + un prompt. Le prompt DOIT explicitement décrire le format JSON
 * attendu dans son texte.
 *
 * Essaie d'abord en mode JSON strict ; si Groq échoue à générer un JSON
 * valide dans ce mode (fréquent avec les modèles vision preview), retente
 * automatiquement en texte libre et extrait le JSON manuellement.
 *
 * Lance une erreur avec `.isQuotaError` ou `.isModelError` pour permettre
 * à l'appelant (aiProvider.js) de décider de la suite.
 */
export async function callGroq(model, images, systemPrompt) {
  let lastError;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await requestGroq(model, images, systemPrompt, true);
    } catch (err) {
      if (err.isModelError) throw err;

      if (err.isQuotaError) {
        lastError = err;
        if (attempt < CONFIG.MAX_RETRIES) {
          await sleep(1000 * attempt);
          continue;
        }
        break;
      }

      if (err.isJsonModeFailure) {
        // Le mode JSON strict a échoué : on retente une fois en texte
        // libre avant d'abandonner ou de passer au fournisseur suivant.
        try {
          return await requestGroq(model, images, systemPrompt, false);
        } catch (fallbackErr) {
          lastError = fallbackErr;
          break;
        }
      }

      lastError = err;
      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(600 * attempt);
      }
    }
  }

  throw lastError ?? new Error(`Échec de l'appel à Groq "${model}".`);
}
