import { CONFIG } from "../config.js";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Récupère les pièces jointes valides (images) d'un message Discord,
 * les télécharge et les convertit en base64 pour Gemini.
 * Lance une erreur explicite si un fichier est invalide.
 */
export async function extractImagesFromMessage(message) {
  const attachments = [...message.attachments.values()].filter((a) =>
    ALLOWED_MIME.includes(a.contentType)
  );

  if (attachments.length === 0) {
    throw new Error(
      "Aucune image valide détectée. Formats acceptés : PNG, JPEG, WEBP, GIF."
    );
  }

  if (attachments.length > CONFIG.MAX_IMAGES_PER_REQUEST) {
    throw new Error(
      `Trop d'images envoyées (max ${CONFIG.MAX_IMAGES_PER_REQUEST} à la fois).`
    );
  }

  const maxBytes = CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024;
  for (const a of attachments) {
    if (a.size > maxBytes) {
      throw new Error(
        `L'image "${a.name}" dépasse la taille max autorisée (${CONFIG.MAX_IMAGE_SIZE_MB} Mo).`
      );
    }
  }

  const images = await Promise.all(
    attachments.map(async (a) => {
      const res = await fetch(a.url);
      if (!res.ok) {
        throw new Error(`Téléchargement impossible pour "${a.name}".`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      return {
        mimeType: a.contentType,
        data: buffer.toString("base64"),
      };
    })
  );

  return images;
}
