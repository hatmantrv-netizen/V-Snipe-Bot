import { extractImagesFromMessage } from "../utils/imageUtils.js";
import { callAIJSON } from "../aiProvider.js";
import { setCache, getCache } from "../utils/cache.js";
import { checkCooldown } from "../utils/cooldown.js";
import {
  loadingEmbed,
  errorEmbed,
  descriptionEmbed,
  descriptionButtons,
} from "../utils/embeds.js";

// ------------------------------------------------------------
// Banque de mots-clés par catégorie, utilisée par l'IA pour enrichir
// naturellement le titre/la description avec des termes de recherche
// Vinted pertinents (synonymes que les acheteurs tapent réellement).
// Ajoute/édite des catégories ici si besoin.
// ------------------------------------------------------------
const KEYWORD_BANK = `
Doudoune : Doudoune veste matelassé épaisse Gilet Parka Manteau Blouson Jacket légère
Veste : Veste full zip fermeture éclair Gilet blouson Sweat Pull capuche haut
Pull : Pull Sweat Crewneck Hoodie tricot pullover Col rond ras de cou
Pantalon : Pantalon pant jogging joggo survêtement survet bas trackpant large
`.trim();

// Exemple fourni comme référence de TON et de STRUCTURE uniquement.
// L'IA ne doit jamais recopier ce texte tel quel : elle doit l'adapter
// entièrement à l'article réellement présent sur la photo.
const STYLE_REFERENCE = `Veste Nike Tech en bon état. Très belle couleur noire ! ⚠️ Petit trou pas voyant et pas dérangeant, voir photo 7 ! 📏 Taille XS ! 🚚 Envoi rapide ! 💰 Frais de port réduit au minimum ! ✨ Pour toutes questions, n'hésitez pas à venir en messages privés 🤝 Je possède plusieurs autres articles, n'hésitez pas à me faire une offre !`;

function buildPrompt(options) {
  const extras = [];
  if (options.hashtags)
    extras.push(
      "Termine la description par 6 à 10 hashtags pertinents (marque, type de vêtement, style)."
    );
  else extras.push("N'inclus aucun hashtag.");

  if (options.emoji)
    extras.push(
      "Utilise quelques emoji pertinents pour aérer la description, à la manière du style de référence ci-dessous (⚠️ pour un défaut, 📏 pour la taille, 🚚 pour l'envoi, etc.)."
    );
  else extras.push("N'utilise aucun emoji.");

  if (options.keywords)
    extras.push(
      "Identifie la catégorie de l'article parmi la banque de mots-clés ci-dessous, et intègre naturellement plusieurs de ces synonymes dans la description (pas juste une liste collée, des vrais mots utilisés dans des phrases) pour améliorer la visibilité dans la recherche Vinted."
    );

  return `Tu es un expert en vente sur Vinted (France). Analyse la ou les photos de l'article fourni et rédige une annonce professionnelle et vendeuse.

RÈGLE DE FORMAT ABSOLUE : n'utilise JAMAIS de markdown. Pas d'astérisques **texte**, pas de _italique_, pas de #titre, pas de tirets de liste. Discord et Vinted n'interprètent pas ce formatage, donc le texte final doit être 100% brut (texte simple, emoji autorisés, mais aucun symbole de mise en forme). Si tu veux mettre un mot en avant, utilise un emoji ou une majuscule ponctuelle, jamais des astérisques.

Banque de mots-clés par catégorie (utilise celle qui correspond à l'article détecté) :
${KEYWORD_BANK}

Style de référence à t'inspirer pour le TON et la STRUCTURE uniquement (état, taille, défaut éventuel, envoi, ouverture aux questions/offres) — NE RECOPIE JAMAIS ce texte, adapte entièrement le contenu à l'article réellement visible sur la photo :
"${STYLE_REFERENCE}"

Règles :
- Titre : moins de 70 caractères, marque en premier si identifiable, puis type d'article et détail distinctif (couleur, motif...). Pas de markdown.
- Description : structurée comme le style de référence (état, détail taille, défaut visible s'il y en a un, envoi, ouverture aux questions/offres), honnête sur l'état visuel apparent (ne jamais inventer de défaut ni prétendre que l'article est neuf si rien ne l'indique), mentionne la matière si visible, la couleur.
- Reste factuel : ne décris que ce qui est visible sur la photo, n'invente pas de taille ni de marque si ce n'est pas identifiable (indique "non précisé" le cas échéant).
${extras.join("\n")}

Réponds UNIQUEMENT avec un objet JSON valide de cette forme exacte, sans aucun texte avant ou après, et sans aucun markdown à l'intérieur des valeurs :
{"title": "string, moins de 70 caractères, texte brut sans markdown", "description": "string, texte brut sans markdown"}`;
}

function stripMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // **gras**
    .replace(/\*(.*?)\*/g, "$1") // *italique*
    .replace(/__(.*?)__/g, "$1") // __souligné__
    .replace(/_(.*?)_/g, "$1") // _italique_
    .replace(/^#{1,6}\s*/gm, "") // # titres
    .replace(/^[-*]\s+/gm, "") // - listes
    .replace(/`{1,3}/g, ""); // code
}

async function generate(images, options) {
  const result = await callAIJSON(images, buildPrompt(options));
  if (!result.title || !result.description) {
    throw new Error("Réponse IA incomplète, réessaie.");
  }
  // Filet de sécurité : même si le modèle désobéit à la consigne,
  // on nettoie tout markdown résiduel avant l'affichage.
  return {
    title: stripMarkdown(result.title).trim(),
    description: stripMarkdown(result.description).trim(),
  };
}

export async function handleDescriptionMessage(message) {
  const wait = checkCooldown(message.author.id);
  if (wait > 0) {
    await message.reply({
      content: `⏱️ Merci de patienter encore ${wait}s avant une nouvelle demande.`,
    });
    return;
  }

  const placeholder = await message.reply({
    embeds: [loadingEmbed("Analyse de l'image et génération en cours...")],
  });

  try {
    const images = await extractImagesFromMessage(message);
    const options = { keywords: true, hashtags: true, emoji: true };
    const result = await generate(images, options);

    const imageUrl = [...message.attachments.values()][0]?.url;
    const embed = descriptionEmbed({ ...result, options, imageUrl });
    const components = descriptionButtons(options);

    await placeholder.edit({ embeds: [embed], components });

    setCache(placeholder.id, {
      type: "description",
      images,
      options,
      imageUrl,
      userId: message.author.id,
    });
  } catch (err) {
    console.error("[descriptionHandler]", err);
    await placeholder.edit({
      embeds: [errorEmbed(err.message || "Erreur inconnue.")],
      components: [],
    });
  }
}

export async function handleDescriptionButton(interaction) {
  const cached = getCache(interaction.message.id);

  if (!cached) {
    await interaction.reply({
      content:
        "⚠️ Cette requête a expiré (ou le bot a redémarré). Renvoie une photo pour relancer.",
      ephemeral: true,
    });
    return;
  }

  const action = interaction.customId.split(":")[1];
  const key = interaction.customId.split(":")[2];

  if (action === "copy") {
    const embed = interaction.message.embeds[0];
    const title = embed.fields[0].value.replace(/```/g, "");
    const description = embed.fields[1].value.replace(/```/g, "");
    await interaction.reply({
      content: `**Titre**\n${title}\n\n**Description**\n${description}`,
      ephemeral: true,
    });
    return;
  }

  if (action === "toggle") {
    cached.options[key] = !cached.options[key];
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
    const result = await generate(cached.images, cached.options);
    const embed = descriptionEmbed({
      ...result,
      options: cached.options,
      imageUrl: cached.imageUrl,
    });
    const components = descriptionButtons(cached.options);

    await interaction.editReply({ embeds: [embed], components });
    setCache(interaction.message.id, cached);
  } catch (err) {
    console.error("[descriptionHandler:button]", err);
    await interaction.followUp({
      content: `❌ ${err.message || "Erreur lors de la régénération."}`,
      ephemeral: true,
    });
  }
}
