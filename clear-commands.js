import 'dotenv/config';
import { REST, Routes } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const clientId = '1551200581190942862';
const guildId = '1462945932390695068';

const rest = new REST({ version: '10' }).setToken(token);

try {
  console.log('🧹 Limpiando comandos globales...');
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: [] }
  );
  console.log('✅ Comandos globales eliminados.');

  console.log('🧹 Limpiando comandos del servidor REDLINE...');
  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: [] }
  );
  console.log('✅ Comandos de REDLINE eliminados.');

  console.log('🎉 Limpieza completada.');
} catch (error) {
  console.error('❌ Error limpiando comandos:', error);
}
