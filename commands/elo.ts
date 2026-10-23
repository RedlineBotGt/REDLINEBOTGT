import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { getPrivateKey } from '../convertKey';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const credentialsPath = path.join(process.cwd(), 'credentials.json');
    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    };

    if (fs.existsSync(credentialsPath)) {
      authOptions.keyFile = credentialsPath;
    } else {
      authOptions.credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: getPrivateKey(),
      };
    }

    const auth = new google.auth.GoogleAuth(authOptions);
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = process.env.SPREADSHEET_ID || '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ELO!Q2:R24',
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    const rankingLines = rows
      .filter(row => row[0] && row[1])
      .map((row, index) => {
        const userIdMention = row[0]; // Mención <@ID>
        const eloPoints = row[1];     // Valor de ELO
        return `**${index + 1}.** ${userIdMention} — **${eloPoints} pts**`;
      });

    if (rankingLines.length === 0) {
      return await interaction.editReply('No se encontraron datos válidos en el ranking de ELO.');
    }

    const rankingText = `🏆 **RANKING ELO**\n\n` + rankingLines.join('\n');

    await interaction.editReply({ content: rankingText });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);
    await interaction.editReply('Hubo un error al intentar consultar el ELO desde Google Sheets.');
  }
}
