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

    // 1. Si existe el archivo local de credenciales, lo usa
    if (fs.existsSync(credentialsPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } 
    // 2. Si estamos en Render y leemos las variables de entorno de la cuenta de servicio
    else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      
      // Limpiar comillas extras si las hubiera y normalizar los saltos de línea para evitar el error de OpenSSL
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      return await interaction.editReply('❌ No se han encontrado credenciales válidas de Google (ni archivo local ni variables de entorno).');
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // 3. ID de tu Google Sheet
    const spreadsheetId = process.env.SPREADSHEET_ID || '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

    if (!spreadsheetId) {
      return await interaction.editReply('❌ No se ha configurado el SPREADSHEET_ID.');
    }

    // 4. Leer rango Q2:R24 de la pestaña ELO
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ELO!Q2:R24',
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    // 5. Formatear las filas (Q = ID/Mención de Discord, R = ELO)
    const rankingText = rows
      .filter(row => row[0] && row[1])
      .map((row, index) => {
        const userIdMention = row[0]; // Mención <@ID>
        const eloPoints = row[1];     // Valor de ELO
        return `**${index + 1}.** ${userIdMention} — **${eloPoints} pts**`;
      })
      .join('\n');

    // 6. Crear Embed para Discord
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
