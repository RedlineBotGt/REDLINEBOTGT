import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { resetClubSession } from '../dashadmin/club/clubmanager';
import { showChallengeModal } from '../dashadmin/club/clubactions';

export const data = new SlashCommandBuilder()
    .setName('club')
    .setDescription('Inicia el configurador de desafíos offline de GT Club')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
    try {
        const guildId = interaction.guildId;
        if (!guildId) return;

        // Reiniciar/Inicializar sesión y abrir el modal del Desafío #1
        resetClubSession(guildId);
        await showChallengeModal(interaction, 1);
    } catch (error) {
        console.error('❌ Error al ejecutar el comando /club:', error);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({ 
                content: '❌ Hubo un error al iniciar el configurador de GT Club.', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
}
