import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import http from 'http';

// Servidor web para mantener vivo el bot en Render
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Bot REDLINE GT Online');
  res.end();
}).listen(PORT, () => {
  console.log(`Servidor web activo en puerto ${PORT}`);
});

// Cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  console.log(`¡Bot conectado exitosamente como ${client.user?.tag}!`);

  // LIMPIEZA DE COMANDOS VIEJOS DE BOTGHOST
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
    console.log('Eliminando comandos globales de BotGhost...');
    
    // Sobreescribe la lista global de comandos con un array vacío []
    if (client.user) {
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      console.log('¡Todos los comandos viejos de BotGhost han sido eliminados correctamente!');
    }
  } catch (error) {
    console.error('Error al borrar comandos viejos:', error);
  }
});

// Listener de prueba para el !ping
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('¡Pong! 🏎️ El bot de REDLINE GT está funcionando perfectamente.');
  }
});

// Inicio de sesión
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('ERROR: No se ha encontrado la variable DISCORD_TOKEN');
} else {
  client.login(token);
}
  
