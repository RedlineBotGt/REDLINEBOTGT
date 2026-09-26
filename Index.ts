import 'dotenv/config';

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';

import { msnCommand } from './commands/msn';

// =========================
// VARIABLES
// =========================

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    '❌ Faltan DISCORD_TOKEN, CLIENT_ID o GUILD_ID en las variables de entorno.'
  );
}

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

client.once('ready', async () => {

  console.log(
    `✅ REDLINE Bot GT conectado como ${client.user?.tag}`
  );

  // =========================
  // REGISTRAR COMANDOS
  // =========================

  try {

    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      {
        body: [
          msnCommand.toJSON(),
        ],
      }
    );

    console.log('✅ /msn registrado correctamente.');

  } catch (error) {

    console.error(
      '❌ Error registrando /msn:',
      error
    );

  }

});

// =========================
// INTERACCIONES
// =========================

client.on('interactionCreate', async (interaction) => {

  console.log(
    `📥 Interacción recibida: ${interaction.type}`
  );

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === 'msn'
  ) {

    await interaction.reply({
      content: '🟢 /msn funciona correctamente.',
      ephemeral: true,
    });

  }

});

// =========================
// INICIAR BOT
// =========================

client.login(token);
