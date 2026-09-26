import 'dotenv/config';

import {
  Client,
  GatewayIntentBits,
} from 'discord.js';

// =========================
// CLIENTE DISCORD
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// =========================
// BOT LISTO
// =========================

client.once('ready', () => {
  console.log(`✅ REDLINE Bot GT conectado como ${client.user?.tag}`);
});

// =========================
// INTERACCIONES
// =========================

client.on('interactionCreate', async (interaction) => {

  console.log(
    `📥 Interacción recibida: ${interaction.type}`
  );

});

// =========================
// INICIAR BOT
// =========================

client.login(process.env.DISCORD_TOKEN);
