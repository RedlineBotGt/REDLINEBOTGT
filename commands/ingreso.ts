import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    MessageFlags 
} from 'discord.js';
import { handleIngresoCommand } from '../dashsheet/ingreso/ingresohandler';

// Reemplaza este valor con tu ID de usuario de Discord para restricción exclusiva
const ADMIN_USER_ID = 'TU_DISCORD_USER_ID';

export const data = new SlashCommandBuilder()
    .setName('ingreso')
    .setDescription('Procesa capturas de pantalla de resultados para rellenar la hoja Ingreso2.')
    .addAttachmentOption(option => 
        option.setName('foto1')
            .setDescription('Primera captura de pantalla con resultados de la carrera/qualy')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('sesion')
            .setDescription('Código de sesión (ej. Q1, C1, Q2, C2...)')
            .setRequired(true))
    .addAttachmentOption(option => 
        option.setName('foto2')
            .setDescription('Segunda captura de pantalla (opcional)')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    // 🛡️ Restricción exclusiva: Solo tú puedes ejecutar este comando
    if (interaction.user.id !== ADMIN_USER_ID) {
        return interaction.reply({
            content: '⛔ Este comando es de uso exclusivo para la administración.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    // Delegar la ejecución al handler dedicado
    await handleIngresoCommand(interaction);
}
