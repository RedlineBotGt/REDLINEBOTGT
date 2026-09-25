import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Health check para Render / Uptime Robot
app.get('/health', (_req, res) => {
  res.status(200).send('REDLINE BOT GT OK');
});

app.listen(PORT, () => {
  console.log(`Health server activo en el puerto ${PORT}`);
});

client.once('ready', () => {
  console.log(`REDLINE BOT GT conectado como ${client.user?.tag}`);
});

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Falta la variable DISCORD_TOKEN');
  process.exit(1);
}

client.login(token);
