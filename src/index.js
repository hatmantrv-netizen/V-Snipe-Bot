import "dotenv/config";
import { Client, GatewayIntentBits, Partials, Events } from "discord.js";
import { CONFIG } from "./config.js";
import {
  handleDescriptionMessage,
  handleDescriptionButton,
} from "./handlers/descriptionHandler.js";
import { handlePriceMessage, handlePriceButton } from "./handlers/priceHandler.js";

// ------------------------------------------------------------
// Protections globales : le process ne doit JAMAIS crasher pour
// une erreur ponctuelle (appel API raté, message malformé, etc.)
// ------------------------------------------------------------
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN manquant dans le fichier .env. Arrêt.");
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY manquant dans le fichier .env. Arrêt.");
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.warn(
    "⚠️  GROQ_API_KEY manquant dans le .env — le bot fonctionnera mais sans le palier de secours Groq. Ajoute-la pour une meilleure disponibilité (https://console.groq.com/keys)."
  );
}
if (
  CONFIG.CHANNELS.DESCRIPTION.startsWith("METTRE_ICI") ||
  CONFIG.CHANNELS.PRICE.startsWith("METTRE_ICI")
) {
  console.error(
    "❌ Configure d'abord les IDs de salons dans src/config.js (CHANNELS.DESCRIPTION / CHANNELS.PRICE). Arrêt."
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot connecté en tant que ${c.user.tag}`);
  console.log(`   Salon description : ${CONFIG.CHANNELS.DESCRIPTION}`);
  console.log(`   Salon prix        : ${CONFIG.CHANNELS.PRICE}`);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (message.attachments.size === 0) return;

    if (message.channelId === CONFIG.CHANNELS.DESCRIPTION) {
      await handleDescriptionMessage(message);
    } else if (message.channelId === CONFIG.CHANNELS.PRICE) {
      await handlePriceMessage(message);
    }
  } catch (err) {
    // Filet de sécurité : ne jamais laisser une erreur remonter sans réponse
    console.error("[MessageCreate]", err);
    message.reply("❌ Une erreur inattendue est survenue.").catch(() => {});
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith("desc:")) {
      await handleDescriptionButton(interaction);
    } else if (interaction.customId.startsWith("price:")) {
      await handlePriceButton(interaction);
    }
  } catch (err) {
    console.error("[InteractionCreate]", err);
    const payload = {
      content: "❌ Une erreur inattendue est survenue.",
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      interaction.followUp(payload).catch(() => {});
    } else {
      interaction.reply(payload).catch(() => {});
    }
  }
});

client.on(Events.Error, (err) => console.error("[ClientError]", err));
client.on(Events.ShardError, (err) => console.error("[ShardError]", err));

client.login(process.env.DISCORD_TOKEN);
