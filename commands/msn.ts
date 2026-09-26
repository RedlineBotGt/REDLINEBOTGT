import {
  SlashCommandBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} from 'discord.js';

export const msnCommand = new SlashCommandBuilder()
  .setName('msn')
  .setDescription('Enviar un mensaje desde REDLINE');

export const msnChannelSelect = new ChannelSelectMenuBuilder()
  .setCustomId('msn_select_channel')
  .setPlaceholder('Selecciona el canal de destino')
  .setChannelTypes(
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement
  );
