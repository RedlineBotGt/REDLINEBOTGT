import 'dotenv/config';

import {
  REST,
  Routes,
} from 'discord.js';

import { msnCommand } from './commands/msn';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    '❌ Faltan DISCORD_TOKEN, CLIENT_ID o GUILD_ID en las variables de entorno.'
  );
}

const rest = new REST({ version: '10' }).setToken(token);

async function registerCommands() {
  try {
    console.log('🔄 Registrando comandos...');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      {
        body: [
          msnCommand.toJSON(),
        ],
      }
    );

    console.log('✅ Comando /msn registrado correctamente.');
  } catch (error) {
    console.error('❌ Error registrando comandos:', error);
  }
}

registerCommands();
