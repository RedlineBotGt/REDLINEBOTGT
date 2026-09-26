import { SlashCommandBuilder } from 'discord.js';

export const msnCommand = new SlashCommandBuilder()
  .setName('msn')
  .setDescription('Enviar un mensaje desde REDLINE');
