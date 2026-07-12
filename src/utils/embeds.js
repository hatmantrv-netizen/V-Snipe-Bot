import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const COLOR_DEFAULT = 0x2b2d31;
const COLOR_ERROR = 0xed4245;

export function loadingEmbed(label) {
  return new EmbedBuilder()
    .setColor(COLOR_DEFAULT)
    .setDescription(`⏳ ${label}`);
}

export function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLOR_ERROR)
    .setTitle("❌ Une erreur est survenue")
    .setDescription(message);
}

export function descriptionEmbed({ title, description, options, imageUrl }) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_DEFAULT)
    .setTitle("📝 Description Vinted prête")
    .setDescription("Copie-colle le titre et la description ci-dessous.")
    .addFields(
      { name: "Titre", value: "```" + title + "```" },
      { name: "Description", value: "```" + description + "```" }
    )
    .setFooter({
      text: `Mots-clés ${options.keywords ? "ON" : "OFF"} · Hashtags ${
        options.hashtags ? "ON" : "OFF"
      } · Emoji ${options.emoji ? "ON" : "OFF"}`,
    });

  if (imageUrl) embed.setThumbnail(imageUrl);
  return embed;
}

export function descriptionButtons(options) {
  const toggles = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("desc:toggle:keywords")
      .setLabel("🔑 Mots-clés")
      .setStyle(options.keywords ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("desc:toggle:hashtags")
      .setLabel("# Hashtags")
      .setStyle(options.hashtags ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("desc:toggle:emoji")
      .setLabel("✨ Emoji")
      .setStyle(options.emoji ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("desc:copy")
      .setLabel("Copier")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("desc:regen")
      .setLabel("Régénérer")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary)
  );

  return [toggles, actions];
}

export function priceEmbed({ priceMin, priceMax, note, searchQuery }) {
  return new EmbedBuilder()
    .setColor(COLOR_DEFAULT)
    .setTitle("💰 Estimation Vinted")
    .setDescription(
      `Cet article vaut environ **${priceMin}€ – ${priceMax}€**.\n` +
        `Note IA : ${note}`
    )
    .addFields({ name: "Recherche équivalente", value: "```" + searchQuery + "```" })
    .setFooter({
      text: "Estimation générée par IA — à titre indicatif, pas une donnée de marché en temps réel.",
    });
}

export function priceButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("price:regen")
        .setLabel("Régénérer")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}
