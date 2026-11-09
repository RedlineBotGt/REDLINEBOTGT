import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    FileUploadBuilder,
    LabelBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    ModalSubmitInteraction,
    EmbedBuilder,
    TextChannel,
    Attachment,
    Guild
} from 'discord.js';
import { getDefensaConfigFromDB, getDefensaPendingCollection } from './defensewizard';
import { buildReportAttachments } from '../reporte/reportFileUpload';

async function getPendingCollection() {
    return getDefensaPendingCollection();
}

async function findPendingDefense(defenseId: string, guildId: string, userId: string) {
    const col = await getPendingCollection();
    const now = new Date();
    await col.deleteMany({ expiresAt: { $lte: now } });
    return col.findOne({ defenseId, guildId, userId, status: 'pending', expiresAt: { $gt: now } });
}

async function claimPendingDefense(defenseId: string, guildId: string, userId: string) {
    const col = await getPendingCollection();
    const result = await col.updateOne(
        { defenseId, guildId, userId, status: 'pending', expiresAt: { $gt: new Date() } },
        { $set: { status: 'processing' } }
    );
    if (!result.modifiedCount) return null;
    return col.findOne({ defenseId, guildId, userId, status: 'processing' });
}

async function releasePendingDefense(defense: any) {
    const col = await getPendingCollection();
    await col.updateOne({ _id: defense._id, status: 'processing' }, { $set: { status: 'pending' } });
}

function buildDefenseEmbed(defense: any, serverName: string) {
    const fields: any[] = [
        { name: '🆔 Reporte', value: defense.reportId, inline: true },
        { name: '👤 Reportó', value: defense.pilotoReporta, inline: true },
        { name: '🛡️ En Defensa', value: defense.pilotoDefensa, inline: true },
        { name: '📝 Explicación / Alegación', value: defense.explicacion, inline: false }
    ];
    if (defense.nota) fields.push({ name: '📌 Nota', value: defense.nota, inline: false });
    if (defense.enlace) fields.push({ name: '🔗 Pruebas / Enlace', value: defense.enlace, inline: false });
    return new EmbedBuilder()
        .setTitle(`🛡️ DEFENSA PRESENTADA - 🆔 ${defense.reportId}`)
        .setColor(0x00FF00)
        .addFields(fields)
        .setFooter({ text: serverName })
        .setTimestamp(new Date(defense.createdAt));
}

async function sendDefense(guild: Guild, defense: any, files: any[]) {
    const config = defense.config;
    const embed = buildDefenseEmbed(defense, guild.name);

    if (config.canal1) {
        try {
            const canal1 = await guild.channels.fetch(config.canal1) as TextChannel | null;
            if (canal1?.isTextBased()) {
                const mentionText = config.rol1
                    ? `📢 <@&${config.rol1}> Nueva defensa registrada.`
                    : '📢 Nueva defensa registrada.';
                await canal1.send({ content: mentionText, embeds: [embed], allowedMentions: { parse: ['roles'] } });
            }
        } catch (error) {
            console.error('❌ Error al enviar al Canal Destino 1 (Defensas):', error);
        }
    }

    const canal2 = await guild.channels.fetch(config.canal2) as TextChannel | null;
    if (!canal2?.isTextBased()) throw new Error('No se encuentra el Canal Destino 2 de defensas.');

    const activeThreads = await guild.channels.fetchActiveThreads();
    let targetThread: any = activeThreads.threads.find(thread =>
        thread.parentId === canal2.id && thread.name.includes(defense.reportId)
    );

    if (!targetThread) {
        const archivedThreads = await canal2.threads.fetchArchived();
        targetThread = archivedThreads.threads.find(thread => thread.name.includes(defense.reportId));
    }

    if (targetThread) {
        const mentionText = `📢 <@&${config.rol2}> El piloto **${defense.pilotoDefensa}** ha presentado su defensa para este reporte.`;
        await targetThread.send({ content: mentionText, embeds: [embed], files, allowedMentions: { parse: ['roles'] } });
    } else {
        const mentionText = `📢 <@&${config.rol2}> Defensa de **${defense.pilotoDefensa}** (⚠️ No se encontró el hilo correspondiente al reporte **${defense.reportId}**):`;
        await canal2.send({ content: mentionText, embeds: [embed], files, allowedMentions: { parse: ['roles'] } });
    }

    await (await getPendingCollection()).deleteOne({ _id: defense._id });
}

// 1. Formulario principal: conserva los cuatro campos originales y añade Nota opcional.
export async function handleDefensaButton(interaction: ButtonInteraction) {
    if (interaction.customId !== 'btn_abrir_defensa') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_envio_defensa')
        .setTitle('Formulario de Defensa de Reporte');

    const inputReportId = new TextInputBuilder().setCustomId('input_def_report_id').setLabel('🆔 ID del Reporte a Defender').setStyle(TextInputStyle.Short).setPlaceholder('Ej: 001 (solo 3 cifras)').setRequired(true);
    const inputReporta = new TextInputBuilder().setCustomId('input_def_reporta').setLabel('Piloto que Reportó').setStyle(TextInputStyle.Short).setPlaceholder('Nombre del denunciante').setRequired(true);
    const inputPilotoDefensa = new TextInputBuilder().setCustomId('input_def_piloto').setLabel('Piloto en Defensa').setStyle(TextInputStyle.Short).setPlaceholder('Tu nombre o ID de piloto').setRequired(true);
    const inputExplicacion = new TextInputBuilder().setCustomId('input_def_explicacion').setLabel('Explicación / Alegación').setStyle(TextInputStyle.Paragraph).setPlaceholder('Explica tu versión de los hechos...').setRequired(true);
    const inputNota = new TextInputBuilder().setCustomId('input_def_nota').setLabel('Nota (opcional)').setStyle(TextInputStyle.Short).setPlaceholder('Pulsa ENVIAR para adjuntar tus archivos o enlaces').setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReportId),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporta),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPilotoDefensa),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputExplicacion),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputNota)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Guardar la defensa como borrador y mostrar información con Continuar.
export async function handleDefensaModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'modal_envio_defensa') return false;

    const guildId = interaction.guildId;
    if (!guildId || !interaction.guild) {
        await interaction.reply({ content: '❌ No se pudo identificar el servidor de la defensa.', ephemeral: true });
        return true;
    }

    const config = await getDefensaConfigFromDB(guildId);
    if (!config || !config.canal2 || !config.rol2) {
        await interaction.reply({
            content: '❌ Error: El sistema de defensas no está completamente configurado (Falta el Canal 2 o su rol de mención). Reconfigúralo desde el panel.',
            ephemeral: true
        });
        return true;
    }

    try {
        const reportId = interaction.fields.getTextInputValue('input_def_report_id').trim().padStart(3, '0');
        const defenseId = `${Date.now()}-${interaction.user.id}`;
        const defense = {
            defenseId,
            guildId,
            userId: interaction.user.id,
            reportId,
            pilotoReporta: interaction.fields.getTextInputValue('input_def_reporta').trim(),
            pilotoDefensa: interaction.fields.getTextInputValue('input_def_piloto').trim(),
            explicacion: interaction.fields.getTextInputValue('input_def_explicacion').trim(),
            nota: interaction.fields.getTextInputValue('input_def_nota').trim(),
            enlace: '',
            config: { canal1: config.canal1 || null, rol1: config.rol1 || null, canal2: config.canal2, rol2: config.rol2 },
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            status: 'pending'
        };

        const col = await getPendingCollection();
        await col.deleteMany({ expiresAt: { $lte: new Date() } });
        await col.insertOne(defense);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`defense_continue_${defenseId}`).setLabel('Continuar').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({
            content: '📎 **ADJUNTAR PRUEBAS**\nPuedes adjuntar tus pruebas mediante un enlace o subir directamente tus archivos.',
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('❌ Error al preparar la defensa:', error);
        await interaction.reply({ content: '❌ No se pudo preparar la defensa. Inténtalo de nuevo.', ephemeral: true }).catch(() => {});
    }
    return true;
}

// 3. Abrir el segundo formulario con Link y Archivo.
export async function handleDefensaContinueButton(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith('defense_continue_')) return false;
    const defenseId = interaction.customId.slice('defense_continue_'.length);
    const defense = await findPendingDefense(defenseId, interaction.guildId || '', interaction.user.id);
    if (!defense) {
        await interaction.reply({ content: '⏰ Esta defensa ha caducado o no pertenece a tu usuario. Vuelve a rellenar el formulario.', ephemeral: true });
        return true;
    }

    const inputEnlace = new TextInputBuilder()
        .setCustomId('input_defensa_enlace')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Pega aquí el enlace de vídeo o pruebas (opcional)')
        .setRequired(false);
    const fileUpload = new FileUploadBuilder()
        .setCustomId('input_defensa_archivos')
        .setMinValues(0)
        .setMaxValues(10)
        .setRequired(false);

    const modal = new ModalBuilder()
        .setCustomId(`modal_defensa_archivos_${defenseId}`)
        .setTitle('Adjuntar pruebas a la defensa')
        .addLabelComponents(
            new LabelBuilder().setLabel('🔗 Link (opcional)').setTextInputComponent(inputEnlace),
            new LabelBuilder().setLabel('📎 Archivo (opcional)').setDescription('Puedes seleccionar hasta 10 fotos o vídeos.').setFileUploadComponent(fileUpload)
        );

    await interaction.showModal(modal);
    return true;
}

// 4. Validar pruebas y publicar la defensa completa en el mismo hilo del reporte.
export async function handleDefensaFilesModalSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('modal_defensa_archivos_')) return false;
    const defenseId = interaction.customId.slice('modal_defensa_archivos_'.length);
    const pending = await findPendingDefense(defenseId, interaction.guildId || '', interaction.user.id);

    if (!pending || !interaction.guild) {
        await interaction.reply({ content: '⏰ Esta defensa ya se ha enviado, ha caducado o no se puede recuperar.', ephemeral: true });
        return true;
    }

    const enlace = interaction.fields.getTextInputValue('input_defensa_enlace').trim();
    const uploadedFiles = Array.from(interaction.fields.getUploadedFiles('input_defensa_archivos')?.values() ?? []) as Attachment[];

    if (!enlace && uploadedFiles.length === 0) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`defense_continue_${defenseId}`).setLabel('Continuar').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({
            content: '⚠️ Debes añadir al menos un **Link** o un **Archivo** para poder enviar la defensa. Vuelve a intentarlo.',
            components: [row],
            ephemeral: true
        });
        return true;
    }

    const defense = await claimPendingDefense(defenseId, interaction.guildId || '', interaction.user.id);
    if (!defense) {
        await interaction.reply({ content: '⏰ Esta defensa ya se ha enviado o está siendo procesada.', ephemeral: true });
        return true;
    }

    defense.enlace = enlace;
    await interaction.deferReply({ ephemeral: true });
    try {
        const files = await buildReportAttachments(uploadedFiles);
        await sendDefense(interaction.guild, defense, files);
        await interaction.editReply({ content: `✅ Defensa del reporte **${defense.reportId}** enviada correctamente con ${files.length} archivo(s). Las pruebas están en el hilo correspondiente.` });
    } catch (error) {
        console.error('❌ Error al procesar los archivos de la defensa:', error);
        await releasePendingDefense(defense);
        await interaction.editReply({
            content: error instanceof Error
                ? `❌ No se pudo completar el envío: ${error.message}\nLa defensa sigue guardada durante 30 minutos; puedes volver a intentarlo.`
                : '❌ No se pudo completar el envío. La defensa sigue guardada durante 30 minutos; puedes volver a intentarlo.'
        });
    }
    return true;
}
