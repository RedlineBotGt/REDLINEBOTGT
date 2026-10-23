import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { google } from 'googleapis';

export const data = new SlashCommandBuilder()
  .setName('elo')
  .setDescription('Muestra el ranking de ELO actualizado');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    // 1. Configuración de autenticación compatible con Render y entorno local
    let auth;
    
    if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
      // Si estamos en Render y usamos variables de entorno para la cuenta de servicio
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      // Método estándar (busca credenciales por defecto o archivo local si existe)
      auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // 2. ID de la Google Sheet de la liga
    const spreadsheetId = process.env.SPREADSHEET_ID || '1E-dMxBrK7gZLAGR2Ge7OuGEt-IvzVK8BWOTtxZojsXs';

    if (!spreadsheetId) {
      return await interaction.editReply('❌ No se ha configurado el SPREADSHEET_ID.');
    }

    // 3. Leer rango Q2:R24 de la pestaña ELO
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ELO!Q2:R24',
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return await interaction.editReply('No se encontraron datos en la hoja de ELO.');
    }

    // 4. Formatear las filas (Q = ID/Mención de Discord, R = ELO)
    const rankingText = rows
      .filter(row => row[0] && row[1])
      .map((row, index) => {
        const userIdMention = row[0]; // Mención <@ID>
        const eloPoints = row[1];     // Valor de ELO
        return `**${index + 1}.** ${userIdMention} — **${eloPoints} pts**`;
      })
      .join('\n');

    // 5. Crear Embed para Discord
    const embed = new EmbedBuilder()
      .setTitle('🏆 RANKING ELO')
      .setColor('#FF0000')
      .setDescription(rankingText)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error al obtener los datos de ELO:', error);
    await interaction.editReply('Hubo an error al intentar consultar el ELO desde Google Sheets.');
  }
}
