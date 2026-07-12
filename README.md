# Bot Discord Vinted IA

Bot Discord avec 2 outils, chacun cantonné à un salon dédié :
- **Description IA** (titre + description Vinted à partir de photos)
- **Estimation de prix IA** (fourchette de prix à partir de photos)

Les deux utilisent une **chaîne de secours à 3 paliers**, entièrement gratuite :
1. `gemini-2.5-flash` (Google AI Studio) — meilleure qualité
2. `gemini-2.5-flash-lite` (Google AI Studio) — si le 1er est saturé
3. `qwen/qwen3.6-27b` (Groq) — dernier recours si les deux Gemini sont saturés

Le bot bascule automatiquement d'un palier à l'autre en cas de quota atteint, sans aucune action de ta part. La chaîne est définie dans `src/config.js` (`AI_PROVIDERS`) — tu peux réordonner ou ajouter des paliers.

## 1. Installation

```bash
npm install
cp .env.example .env
```

## 2. Récupérer les clés

**Discord :**
1. https://discord.com/developers/applications → New Application
2. Onglet "Bot" → Reset Token → colle-le dans `.env` (`DISCORD_TOKEN`)
3. Dans "Bot", active **Message Content Intent** (obligatoire, sinon le bot ne voit pas les images)
4. Onglet "OAuth2 > URL Generator" → coche `bot` → permissions : `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History` → utilise l'URL générée pour inviter le bot sur ton serveur

**Gemini (gratuit) :**
1. https://aistudio.google.com/apikey → Create API key
2. Colle-la dans `.env` (`GEMINI_API_KEY`)

**Groq (gratuit, palier de secours) :**
1. https://console.groq.com/keys → Create API Key
2. Colle-la dans `.env` (`GROQ_API_KEY`)

Si `GROQ_API_KEY` n'est pas renseignée, le bot démarre quand même (juste un avertissement dans le terminal) mais perd le 3ème palier de secours — il s'arrêtera aux deux modèles Gemini en cas de quota atteint sur les deux.

⚠️ Note sur Groq : le modèle vision utilisé (`qwen/qwen3.6-27b`) est un modèle "preview" chez Groq — leur catalogue vision change fréquemment (3 dépréciations en un an). C'est pour ça qu'il est en dernier recours plutôt qu'en principal. Si un jour ce modèle disparaît, va sur https://console.groq.com/docs/vision pour trouver le modèle vision actuel et mets à jour `AI_PROVIDERS` dans `src/config.js`.

## 3. Configurer les salons

Active le mode développeur Discord (Paramètres > Avancés > Mode développeur), puis clic droit sur chaque salon > "Copier l'identifiant".

Ouvre `src/config.js` et remplace :

```js
CHANNELS: {
  DESCRIPTION: "1234567890123456789", // ton salon "description"
  PRICE: "9876543210987654321",       // ton salon "prix"
},
```

## 4. Lancer le bot

```bash
npm start
```

Le bot affiche au démarrage les IDs de salons qu'il a bien pris en compte. S'il manque une clé ou un ID, il s'arrête immédiatement avec un message explicite plutôt que de planter en silence plus tard.

## Utilisation

Il suffit d'envoyer une ou plusieurs photos (jusqu'à 4, 8 Mo max chacune) dans le salon concerné :

- **Salon description** → le bot répond avec un embed titre + description, avec des boutons pour activer/désactiver mots-clés / hashtags / emoji, un bouton "Copier" (envoie le texte brut en message éphémère, facile à copier), et "Régénérer".
- **Salon prix** → le bot répond avec une fourchette de prix + une note explicative + un exemple de requête de recherche équivalente, avec un bouton "Régénérer".

⚠️ L'estimation de prix est générée par l'IA à partir de ses connaissances générales du marché — ce n'est **pas** une recherche en temps réel sur Vinted (le scraping direct de Vinted est fragile et contraire à leurs CGU). C'est indiqué dans le footer de l'embed pour que tes utilisateurs le sachent.

## Fiabilité — ce qui a été prévu pour que ça ne tombe pas

- **Chaîne de secours à 3 fournisseurs** (`src/aiProvider.js`) : bascule automatique Gemini Flash → Gemini Flash-Lite → Groq en cas de quota atteint ou de modèle indisponible
- **Timeout** de 30s par appel pour ne jamais rester bloqué
- **Validation stricte** des images (format, taille, nombre) avant tout appel API
- **Cooldown par utilisateur** (12s par défaut) pour éviter le spam et la surconsommation du quota gratuit
- **Aucune erreur ne peut crasher le process** : `unhandledRejection` / `uncaughtException` sont interceptées et loguées, chaque handler a son propre try/catch avec message d'erreur clair renvoyé à l'utilisateur
- Le cache mémoire utilisé pour "Régénérer" a une durée de vie (30 min) et se nettoie automatiquement ; si le bot redémarre entre-temps, le bouton répond proprement en demandant de renvoyer une photo au lieu de planter

## Aller plus loin (idées)

- Remplacer le cache mémoire par Redis/Supabase si tu veux que "Régénérer" survive à un redémarrage
- Ajouter une commande slash `/description` et `/prix` en plus du déclenchement automatique par upload d'image
- Logger les usages dans Supabase pour avoir des stats (comme pour Butin)
