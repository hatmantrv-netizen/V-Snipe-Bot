// ============================================================
// CONFIGURATION — modifie les valeurs ci-dessous
// ============================================================
export const CONFIG = {
    // Clic droit sur le salon Discord > "Copier l'identifiant"
    // (active le mode développeur dans Discord si besoin :
    //  Paramètres > Avancés > Mode développeur)
    //
    // Chaque outil accepte une LISTE d'IDs de salons : tu peux donc
    // avoir un salon "description" sur ton serveur ET un autre salon
    // "description" sur le serveur d'un collaborateur, tant que le bot
    // est invité sur les deux serveurs. Ajoute simplement l'ID à la liste.
    CHANNELS: {
        DESCRIPTION: [
            "1525053746420256768",
            // "1525904029060829355",
        ],
        PRICE: [
            "1522175656505638993",
            // "1500529549383831744",
        ],
    },

    // ------------------------------------------------------------
    // Chaîne de secours IA : le bot essaie chaque fournisseur dans
    // l'ordre, et passe au suivant en cas de quota atteint (429),
    // de modèle indisponible (404), ou d'échec réseau persistant.
    // ------------------------------------------------------------
    AI_PROVIDERS: [
        { provider: "gemini", model: "gemini-2.5-flash" },
        { provider: "gemini", model: "gemini-2.5-flash-lite" },
        // Modèle vision "preview" chez Groq : rapide et gratuit, mais Groq
        // fait tourner ses modèles vision fréquemment (3 dépréciations en
        // un an). D'où sa place en dernier recours plutôt qu'en principal.
        { provider: "groq", model: "qwen/qwen3.6-27b" },
    ],

    // Limites de sécurité
    MAX_IMAGES_PER_REQUEST: 4,
    MAX_IMAGE_SIZE_MB: 8,
    COOLDOWN_SECONDS: 12, // anti-spam par utilisateur

    // Cache en mémoire pour le bouton "Régénérer"
    // (durée pendant laquelle une requête reste régénérable)
    CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes

    // Nombre de tentatives PAR FOURNISSEUR avant de passer au suivant
    // dans AI_PROVIDERS. Volontairement bas (1) pour ne pas gaspiller
    // le quota gratuit : la chaîne complète (3 fournisseurs) peut déjà
    // représenter jusqu'à 3 appels pour une seule requête utilisateur.
    MAX_RETRIES: 1,
};