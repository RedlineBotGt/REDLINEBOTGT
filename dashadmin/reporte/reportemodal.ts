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
import { MongoClient } from 'mongodb';
import { buildReportAttachments } from './reportFileUpload';

// Se conserva la conexión MongoDB que ya utiliza el módulo de reportes.
const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoClient(uri);

let reportCollection: any = null;
let pendingCollection: any = null;

async function getReportCollection() {
    if (!reportCollection) {
        await client.connect();
        reportCollection = client.db('redline_bot').collection('reportConfig');
    }
    return reportCollection;
}

async function getPendingCollection() {
    if (!pendingCollection) {
        await client.connect();
        pendingCollection = client.db('redline_bot').collection('reportPending');
    }
    return pendingCollection;
}

async function getConfigFromDB(guildId: string) {
    try {
        const col = await getReportCollection();
        return await col.findOne({ guildId });
    } catch (error) {
        console.error('❌ Error al leer la configuración de reportes de MongoDB:', error);
        return null;
    }
}

async function getNextReportIdFromDB(guildId: string): Promise<string> {
    const col = await getReportCollection();
    const doc = await col.findOne({ guildId });
    const currentCounter = doc?.counter ? doc.counter + 1 : 1;

    await col.updateOne(
        { guildId },
        { $set: { counter: currentCounter } },
        { upsert: true }
    );

    return String(currentCounter).padStart(3, '0');
}

function buildReportEmbed(report: any, serverName: string): EmbedBuilder {
    const fields: any[] = [
        { name: '📅 Jornada', value: report.jornada, inline: true },
        { name: '👤 Reporta', value: report.pilotoReporta, inline: true },
        { name: '🎯 A Reportar', value: report.pilotoAReportar, inline: true },
        { name: '📝 Descripción', value: report.descripcion, inline: false }
    ];

    if (report.enlace) {
        fields.push({
            name: '🔗 Pruebas / Enlace',
            value: report.enlace,
            inline: false
        });
    }

    return new EmbedBuilder()
        .setTitle(`🚨 NUEVO REPORTE - 🆔 ${report.reportId}`)
        .setColor(0xFF0000)
        .addFields(fields)
        .setFooter({ text: serverName })
        .setTimestamp(new Date(report.createdAt));
}

async function findPendingReport(reportId: string, guildId: string, userId: string) {
    const col = await getPendingCollection();
    const now = new Date();

    await col.deleteMany({ expiresAt: { $lte: now } });

    return await col.findOne({
        reportId,
        guildId,
        userId,
        status: 'pending',
        expiresAt: { $gt: now }
    });
}

async function claimPendingReport(reportId: string, guildId: string, userId: string) {
    const col = await getPendingCollection();
    const now = new Date();

    const result = await col.updateOne(
        {
            reportId,
            guildId,
            userId,
            status: 'pending',
            expiresAt: { $gt: now }
        },
        { $set: { status: 'processing' } }
    );

    if (!result.modifiedCount) return null;

    return await col.findOne({ reportId, guildId, userId, status: 'processing' });
}

async function releasePendingReport(report: any) {
    const col = await getPendingCollection();
    await col.updateOne(
        { _id: report._id, status: 'processing' },
        { $set: { status: 'pending' } }
    );
}

async function finishReport(guild: Guild, report: any, files: any[] = []): Promise<void> {
    const config = report.config;
    const embedReporte = buildReportEmbed(report, guild.name);

    // El expediente privado se crea primero y recibe todas las pruebas adjuntas.
    const canal2 = await guild.channels.fetch(config.canal2) as TextChannel | null;
    if (!canal2 || !canal2.isTextBased()) {
        throw new Error('No se encuentra el canal privado de revisión o no admite mensajes.');
    }

    const thread = await canal2.threads.create({
        name: `Reporte-${report.reportId}`,
        autoArchiveDuration: 1440
    });

    await thread.send({
        content: `📢 <@&${config.rol2}> Expediente abierto para revisión.`,
        embeds: [embedReporte],
        files,
        allowedMentions: { parse: ['roles'] }
    });

    // El canal de avisos recibe el resumen, sin duplicar los archivos.
    if (config.canal1) {
        try {
            const canal1 = await guild.channels.fetch(config.canal1) as TextChannel | null;
            if (canal1 && canal1.isTextBased()) {
                const mentionText = config.rol1
                    ? `📢 <@&${config.rol1}> Nuevo reporte registrado.`
                    : '📢 Nuevo reporte registrado.';

                await canal1.send({
                    content: mentionText,
                    embeds: [embedReporte],
                    allowedMentions: { parse: ['roles'] }
                });
            }
        } catch (error) {
            console.error('❌ Error al enviar el aviso al Canal Destino 1:', error);
        }
    }

    const col = await getPendingCollection();
    await col.deleteOne({ _id: report._id });
}

// 1. Formulario principal: cuatro campos obligatorios, sin enlace ni pruebas.
export async function handleReportButton(interaction: ButtonInteraction) {
    if (interaction.customId !== 'btn_abrir_reporte') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_envio_reporte')
        .setTitle('Formulario de Reporte de Carrera');

    const inputJornada = new TextInputBuilder()
        .setCustomId('input_jornada')
        .setLabel('Jornada')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Jornada 3')
        .setRequired(true);

    const inputReporta = new TextInputBuilder()
        .setCustomId('input_reporta')
        .setLabel('Piloto que Reporta')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Tu nombre o ID de piloto')
        .setRequired(true);

    const inputAReportar = new TextInputBuilder()
        .setCustomId('input_a_reportar')
        .setLabel('Piloto a Reportar')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Piloto denunciado')
        .setRequired(true);

    const inputDescripcion = new TextInputBuilder()
        .setCustomId('input_descripcion')
        .setLabel('Breve descripción de los hechos')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Explica brevemente qué ha sucedido...')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputJornada),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporta),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputAReportar),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDescripcion)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Guardar el formulario y preguntar si quiere adjuntar fotos o vídeos.
export async function handleReportModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'modal_envio_reporte') return false;

    const guildId = interaction.guildId;
    if (!guildId || !interaction.guild) {
        await interaction.reply({
            content: '❌ No se pudo identificar el servidor del reporte.',
            ephemeral: true
        });
        return true;
    }

    const config = await getConfigFromDB(guildId);
    if (!config || !config.canal2 || !config.rol2) {
        await interaction.reply({
            content: '❌ El sistema de reportes no está completamente configurado. Vuelve a configurarlo desde el panel de administración.',
            ephemeral: true
        });
        return true;
    }

    try {
        const reportId = await getNextReportIdFromDB(guildId);
        const report = {
            reportId,
            guildId,
            userId: interaction.user.id,
            config: {
                canal1: config.canal1 || null,
                rol1: config.rol1 || null,
                canal2: config.canal2,
                rol2: config.rol2
            },
            jornada: interaction.fields.getTextInputValue('input_jornada').trim(),
            pilotoReporta: interaction.fields.getTextInputValue('input_reporta').trim(),
            pilotoAReportar: interaction.fields.getTextInputValue('input_a_reportar').trim(),
            descripcion: interaction.fields.getTextInputValue('input_descripcion').trim(),
            enlace: '',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            status: 'pending'
        };

        const col = await getPendingCollection();
        await col.deleteMany({ expiresAt: { $lte: new Date() } });
        await col.insertOne(report);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(\`report_attach_\${reportId}\`)
                .setLabel('Adjuntar pruebas')
                .setEmoji('📎')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            content: \`📝 **Reporte \${reportId} preparado.**\nPulsa **Adjuntar pruebas** para añadir un enlace o archivos. Debes incluir al menos uno para poder enviar el reporte.\`,
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('❌ Error al preparar el reporte:', error);
        await interaction.reply({
            content: '❌ No se pudo preparar el reporte. No se ha enviado; inténtalo de nuevo.',
            ephemeral: true
        }).catch(() => {});
    }

    return true;
}

// 3. Abrir el selector de fotos y vídeos.
export async function handleReportAttachButton(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith('report_attach_')) return false;

    const reportId = interaction.customId.slice('report_attach_'.length);
    const report = await findPendingReport(reportId, interaction.guildId || '', interaction.user.id);

    if (!report) {
        await interaction.reply({
            content: '⏰ Este reporte ha caducado o no pertenece a tu usuario. Vuelve a rellenar el formulario.',
            ephemeral: true
        });
        return true;
    }

    const inputEnlace = new TextInputBuilder()
        .setCustomId('input_reporte_enlace')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Pega aquí el enlace de vídeo o pruebas (opcional)')
        .setRequired(false);

    const fileUpload = new FileUploadBuilder()
        .setCustomId('input_reporte_archivos')
        .setMinValues(0)
        .setMaxValues(10)
        .setRequired(false);

    const modal = new ModalBuilder()
        .setCustomId(\`modal_reporte_archivos_\${reportId}\`)
        .setTitle('Adjuntar pruebas al reporte')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('🔗 Link (opcional)')
                .setTextInputComponent(inputEnlace),
            new LabelBuilder()
                .setLabel('📎 Archivo (opcional)')
                .setDescription('Puedes seleccionar hasta 10 fotos o vídeos.')
                .setFileUploadComponent(fileUpload)
        );

    await interaction.showModal(modal);
    return true;
}

// 4. Validar el enlace/archivos y enviar las pruebas al hilo privado.
export async function handleReportFilesModalSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('modal_reporte_archivos_')) return false;

    const reportId = interaction.customId.slice('modal_reporte_archivos_'.length);
    const pendingReport = await findPendingReport(reportId, interaction.guildId || '', interaction.user.id);

    if (!pendingReport || !interaction.guild) {
        await interaction.reply({
            content: '⏰ Este reporte ya se ha enviado, ha caducado o no se puede recuperar.',
            ephemeral: true
        });
        return true;
    }

    const enlace = interaction.fields.getTextInputValue('input_reporte_enlace').trim();
    const uploadedFiles = Array.from(
        interaction.fields.getUploadedFiles('input_reporte_archivos')?.values() ?? []
    ) as Attachment[];

    if (!enlace && uploadedFiles.length === 0) {
        const retryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(\`report_attach_\${reportId}\`)
                .setLabel('Adjuntar pruebas')
                .setEmoji('📎')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            content: '⚠️ Debes añadir al menos un **Link** o un **Archivo** para poder enviar el reporte. Vuelve a intentarlo.',
            components: [retryRow],
            ephemeral: true
        });
        return true;
    }

    const report = await claimPendingReport(reportId, interaction.guildId || '', interaction.user.id);
    if (!report) {
        await interaction.reply({
            content: '⏰ Este reporte ya se ha enviado o está siendo procesado.',
            ephemeral: true
        });
        return true;
    }

    report.enlace = enlace;

    await interaction.deferReply({ ephemeral: true });

    try {
        const files = await buildReportAttachments(uploadedFiles);
        await finishReport(interaction.guild, report, files);
        await interaction.editReply({
            content: `✅ Reporte **${reportId}** enviado correctamente con ${files.length} archivo(s). Las pruebas están en el hilo privado de revisión.`
        });
    } catch (error) {
        console.error('❌ Error al procesar los archivos del reporte:', error);
        await releasePendingReport(report);
        await interaction.editReply({
            content: error instanceof Error
                ? `❌ No se pudo completar el envío: ${error.message}\nEl reporte sigue guardado durante 30 minutos; puedes volver a intentarlo.`
                : '❌ No se pudo completar el envío. El reporte sigue guardado durante 30 minutos; puedes volver a intentarlo.'
        });
    }

    return true;
}
