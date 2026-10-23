import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { google } from 'googleapis';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // 1. Configuración de Google Sheets API
    const auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 2. Leer rango Q2:R24 de la pestaña ELO
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ELO!Q2:R24',
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    // 3. Formatear las filas (Q = ID/Mención de Discord, R = ELO)
    const rankingText = rows
      .filter(row => row[0] && row[1])
      .map((row, index) => {
        const userIdMention = row[0]; // Mención <@ID>
        const eloPoints = row[1];     // Valor de ELO
        return `**${index + 1}.** ${userIdMention} — **${eloPoints} pts**`;
      })
      .join('\n');

    // 4. Crear Embed para Discord
    const embed = new EmbedBuilder()
      .setTitle('🏆 RANKING ELO')
      .setColor('#FF0000')
      .setDescription(rankingText)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);
    await interaction.editReply('Hubo un error al intentar consultar el ELO desde Google Sheets.');
  }
}
