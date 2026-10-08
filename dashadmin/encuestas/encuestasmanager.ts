import { 
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    StringSelectMenuBuilder,
    ChannelType, 
    ButtonInteraction
} from 'discord.js';
import { getCollections } from './encuestastorage';

// 1. Paso inicial: Menús desplegables para configuración previa
export async function handleEncuestaStart(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_encuesta_create') return false;

    const selectPublishChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_publish_channel')
        .setPlaceholder('Canal destino de la encuesta...')
        .addChannelTypes(ChannelType.GuildText);

    const selectLogChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_log_channel')
        .setPlaceholder('Canal destino respuestas...');

    const selectAvisoChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_aviso_channel')
        .setPlaceholder('Canal avisos (reacciones)...');

    const selectDuration = new StringSelectMenuBuilder()
        .setCustomId('encuesta_pre_duration')
        .setPlaceholder('Duración (en días hasta 15)...')
        .addOptions(
            Array.from({ length: 15 }, (_, i) => ({
                label: `${i + 1} ${i === 0 ? 'día' : 'días'}`,
                value: String(i + 1)
            }))
        );

    const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('encuesta_btn_open_modal')
            .setLabel('Siguiente: Rellenar Título, Descripción y Opciones')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
        content: '📊 **Configuración de Encuesta:** Selecciona las opciones en los menús desplegables y pulsa el botón:',
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectPublishChannel),
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectLogChannel),
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectAvisoChannel),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectDuration),
            rowButton
        ],
        ephemeral: true
    });

    return true;
}

// 2. Maneja las selecciones de los menús previos
export async function handleEncuestaPreSelections(interaction: any): Promise<boolean> {
    if (!['encuesta_pre_publish_channel', 'encuesta_pre_role', 'encuesta_pre_log_channel', 'encuesta_pre_aviso_channel', 'encuesta_pre_duration'].includes(interaction.customId)) {
        return false;
    }

    const { pendingPollsCol } = await getCollections();
    const updateData: any = {};

    if (interaction.customId === 'encuesta_pre_publish_channel') {
        updateData.publishChannelId = interaction.values[0];
    } else if (interaction.customId === 'encuesta_pre_role') {
        updateData.roleId = interaction.values[0];
    } else if (interaction.customId === 'encuesta_pre_log_channel') {
        updateData.logChannelId = interaction.values[0];
    } else if (interaction.customId === 'encuesta_pre_aviso_channel') {
        updateData.avisoChannelId = interaction.values[0];
    } else if (interaction.customId === 'encuesta_pre_duration') {
        updateData.durationDays = parseInt(interaction.values[0], 10);
    }

    await pendingPollsCol.updateOne(
        { userId: interaction.user.id },
        { $set: { userId: interaction.user.id, guildId: interaction.guildId, ...updateData } },
        { upsert: true }
    );

    await interaction.update({ content: '✅ Selección guardada correctamente. Continúa con los demás menús o pulsa el botón.' });
    return true;
}
