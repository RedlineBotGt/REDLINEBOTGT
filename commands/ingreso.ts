import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    MessageFlags 
} from 'discord.js';
import { handleIngresoCommand } from '../dashsheet/ingreso/ingresohandler';

const ADMIN_USER_ID = '709022842204979230';

export const data = new SlashCommandBuilder()
    .setName('ingreso')
    .setDescription('Procesa capturas de pantalla de resultados para rellenar la hoja Ingreso2.')
    .addStringOption(option =>
        option.setName('sesion')
            .setDescription('Código de sesión (ej. Q1, C1, Q2, C2...)')
            .setRequired(true))
    .addAttachmentOption(option => 
        option.setName('foto1')
            .setDescription('Primera captura de pantalla con resultados de la carrera/qualy')
            .setRequired(true))
    .addAttachmentOption(option => 
        option.setName('foto2')
            .setDescription('Segunda captura de pantalla (opcional)')
            .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== ADMIN_USER_ID) {
        return interaction.reply({
            content: '⛔ Este comando es de uso exclusivo para la administración.',
            flags: [MessageFlags.Ephemeral]
        });
    }

    await handleIngresoCommand(interaction);
}
