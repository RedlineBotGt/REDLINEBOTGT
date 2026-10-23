import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    let auth;
    const credentialsPath = path.join(process.cwd(), 'credentials.json');

    // Si existe el archivo físico (local), lo usa; si no, usa variables de entorno o autenticación estándar de Render
    if (fs.existsSync(credentialsPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // ID de tu Google Sheet con respaldo
    const spreadsheetId = process.env.SPREADSHEET_ID || '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

    if (!spreadsheetId) {
      return await interaction.editReply('❌ No se ha configurado el SPREADSHEET_ID.');
    }

    // Leer rango Q2:R24 de la pestaña ELO
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ELO!Q2:R24',
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    // Formatear las filas (Q = ID/Mención de Discord, R = ELO)
    const rankingText = rows
      .filter(row => row[0] && row[1])
      .map((row, index) => {
        const userIdMention = row[0]; // Mención <@ID>
        const eloPoints = row[1];     // Valor de ELO
        return `**${index + 1}.** ${userIdMention} — **${eloPoints} pts**`;
      })
      .join('\n');

    // Crear Embed para Discord
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
