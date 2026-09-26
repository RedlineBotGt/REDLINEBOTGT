console.log('🟢 INDEX.TS SE ESTÁ EJECUTANDO');
import 'dotenv/config';

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';

import { msnCommand } from './commands/msn';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (_req, res) => {
  res.send('REDLINE Bot GT activo');
});

app.listen(PORT, () => {
  console.log(`Health server activo en el puerto ${PORT}`);
});

// =========================
// VARIABLES
// =========================

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error(
    '❌ Falta DISCORD_TOKEN en las variables de entorno.'
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

  const guild = client.guilds.cache.first();

  if (!guild) {
    console.error('❌ No se encontró ningún servidor.');
    return;
  }

  console.log(`🏠 Servidor encontrado: ${guild.name}`);

  try {

    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
      Routes.applicationGuildCommands(
        client.user!.id,
        guild.id
      ),
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
  // REGISTRAR COMANDOS
  // =========================

  client.once('ready', async () => {

  console.log(
    `✅ REDLINE Bot GT conectado como ${client.user?.tag}`
  );

  const guild = client.guilds.cache.first();

  if (!guild) {
    console.error('❌ No se encontró ningún servidor.');
    return;
  }

  console.log(`🏠 Servidor encontrado: ${guild.name}`);

  try {

    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
      Routes.applicationGuildCommands(
        client.user!.id,
        guild.id
      ),
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
