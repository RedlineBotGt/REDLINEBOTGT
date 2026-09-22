import { Client, GatewayIntentBits } from 'discord.js';
import http from 'http';

// Servidor web para que Render mantenga el bot activo
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

client.once('ready', () => {
  console.log(`¡Bot conectado exitosamente como ${client.user?.tag}!`);
});

// Inicio de sesión con el token
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('ERROR: No se ha encontrado la variable DISCORD_TOKEN');
} else {
  client.login(token);
  }
