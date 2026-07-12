import { extractImagesFromMessage } from "../utils/imageUtils.js";
import { callAIJSON } from "../aiProvider.js";
import { setCache, getCache } from "../utils/cache.js";
import { checkCooldown } from "../utils/cooldown.js";
import { loadingEmbed, errorEmbed, priceEmbed, priceButtons } from "../utils/embeds.js";

const PROMPT = `Tu es un expert en revente de vêtements et accessoires d'occasion sur Vinted (marché français).
Analyse la ou les photos de l'article et estime une fourchette de prix de revente réaliste sur Vinted, basée sur :
- le type d'article et la marque si identifiable,
- l'état visuel apparent (usure, taches, accrocs éventuels),
- les tendances générales du marché de la seconde main en France.

Sois prudent et réaliste (ne surestime pas). Si la marque n'est pas identifiable, base-toi sur le type d'article générique.
Donne aussi une courte note explicative (1-2 phrases, en français) et une requête de recherche Vinted type qui correspondrait à cet article (ex: "polo lacoste beige poche").

Réponds UNIQUEMENT avec un objet JSON valide de cette forme exacte, sans aucun texte avant ou après :
{"price_min": nombre, "price_max": nombre, "note": "string", "search_query": "string"}

Cette estimation est indicative et ne remplace pas une recherche manuelle sur Vinted.`;

async function generate(images) {
  const result = await callAIJSON(images, PROMPT);
  if (result.price_min == null || result.price_max == null) {
    throw new Error("Réponse IA incomplète, réessaie.");
  }
  return result;
}

export async function handlePriceMessage(message) {
  const wait = checkCooldown(message.author.id);
  if (wait > 0) {
    await message.reply({
      content: `⏱️ Merci de patienter encore ${wait}s avant une nouvelle demande.`,
    });
    return;
  }

  const placeholder = await message.reply({
    embeds: [loadingEmbed("Analyse de l'image et estimation en cours...")],
  });

  try {
    const images = await extractImagesFromMessage(message);
    const result = await generate(images);

    const embed = priceEmbed({
      priceMin: result.price_min,
      priceMax: result.price_max,
      note: result.note,
      searchQuery: result.search_query,
    });

    await placeholder.edit({ embeds: [embed], components: priceButtons() });

    setCache(placeholder.id, {
      type: "price",
      images,
      userId: message.author.id,
    });
  } catch (err) {
    console.error("[priceHandler]", err);
    await placeholder.edit({
      embeds: [errorEmbed(err.message || "Erreur inconnue.")],
      components: [],
    });
  }
}

export async function handlePriceButton(interaction) {
  const cached = getCache(interaction.message.id);

  if (!cached) {
    await interaction.reply({
      content:
        "⚠️ Cette requête a expiré (ou le bot a redémarré). Renvoie une photo pour relancer.",
      ephemeral: true,
    });
    return;
  }

  const wait = checkCooldown(interaction.user.id);
  if (wait > 0) {
    await interaction.reply({
      content: `⏱️ Merci de patienter encore ${wait}s.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const result = await generate(cached.images);
    const embed = priceEmbed({
      priceMin: result.price_min,
      priceMax: result.price_max,
      note: result.note,
      searchQuery: result.search_query,
    });

    await interaction.editReply({ embeds: [embed], components: priceButtons() });
    setCache(interaction.message.id, cached);
  } catch (err) {
    console.error("[priceHandler:button]", err);
    await interaction.followUp({
      content: `❌ ${err.message || "Erreur lors de la régénération."}`,
      ephemeral: true,
    });
  }
}
