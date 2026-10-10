import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { showClubControlPanel } from '../dashadmin/club/clubactions';

export const data = new SlashCommandBuilder()
    .setName('club')
    .setDescription('Panel de Control para la gestión de GT Club')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
    try {
        const guildId = interaction.guildId;
        if (!guildId) return;

        // Abrir el Panel de Control con todas las opciones (Crear, Editar/Borrar, Publicar, Reiniciar)
        await showClubControlPanel(interaction);
    } catch (error) {
        console.error('❌ Error al ejecutar el comando /club:', error);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({ 
                content: '❌ Hubo un error al abrir el Panel de Control de GT Club.', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
}
