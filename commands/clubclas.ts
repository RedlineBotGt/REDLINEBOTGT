import { SlashCommandBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { getClubSession, loadActiveSessionFromDB } from '../dashadmin/club/clubmanager';
import { buildGeneralStandingsEmbed } from '../dashadmin/club/clubactions';

export const data = new SlashCommandBuilder()
    .setName('clubclas')
    .setDescription('Muestra la clasificación general acumulada de GT Club')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
    try {
        const guildId = interaction.guildId;
        if (!guildId) return;

        // Cargar o recuperar sesión activa
        let session = getClubSession(guildId);
        if (!session.active) {
            const loaded = await loadActiveSessionFromDB(guildId);
            if (loaded) session = loaded;
        }

        if (!session.active || !session.channelId) {
            await interaction.reply({
                content: '❌ No hay ninguna sesión de GT Club activa en este momento.',
                ephemeral: true
            });
            return;
        }

        const channel = await interaction.guild?.channels.fetch(session.channelId) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            await interaction.reply({
                content: '❌ No se encontró el canal configurado para GT Club.',
                ephemeral: true
            });
            return;
        }

        // Construir el Embed limpio de la General
        const embed = buildGeneralStandingsEmbed(session);

        // Publicar como NUEVO mensaje en el canal asignado
        await channel.send({ embeds: [embed] });

        // Confirmar la ejecución al administrador que lanzó el comando
        await interaction.reply({
            content: `✅ Clasificación General publicada correctamente en <#${session.channelId}>.`,
            ephemeral: true
        });

    } catch (error) {
        console.error('❌ Error al ejecutar /clubclas:', error);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({
                content: '❌ Hubo un error al generar la Clasificación General.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}
