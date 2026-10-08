import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonInteraction, 
    ModalSubmitInteraction,
    EmbedBuilder,
    TextChannel
} from 'discord.js';
import { MongoClient } from 'mongodb';

// Configuración de MongoDB
const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoClient(uri);

let reportCollection: any = null;

async function getReportCollection() {
    if (!reportCollection) {
        await client.connect();
        reportCollection = client.db('redline_bot').collection('reportConfig');
    }
    return reportCollection;
}

// Función para obtener la configuración del servidor desde MongoDB
async function getConfigFromDB(guildId: string) {
    try {
        const col = await getReportCollection();
        return await col.findOne({ guildId });
    } catch (error) {
        console.error('❌ Error al leer la configuración de reportes de MongoDB:', error);
        return null;
    }
}

// Función para generar y actualizar el ID correlativo de forma persistente en MongoDB
async function getNextReportIdFromDB(guildId: string): Promise<string> {
    try {
        const col = await getReportCollection();
        const doc = await col.findOne({ guildId });
        let currentCounter = doc?.counter ? doc.counter + 1 : 1;

        await col.updateOne(
            { guildId },
            { $set: { counter: currentCounter } },
            { upsert: true }
        );

        return String(currentCounter).padStart(3, '0');
    } catch (error) {
        console.error('❌ Error al generar el ID correlativo en MongoDB:', error);
        return '001';
    }
}

// 1. Mostrar el Modal al pulsar el botón REPORTE del panel público
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

    const inputEnlace = new TextInputBuilder()
        .setCustomId('input_enlace')
        .setLabel('Enlace web (Video / Clip / Pruebas)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://youtube.com/... (Opcional)')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputJornada),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporta),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputAReportar),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDescripcion),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputEnlace)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Procesar el formulario del modal y ejecutar la Salida Dual completa
export async function handleReportModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'modal_envio_reporte') return false;

    const guildId = interaction.guildId!;
    const config = await getConfigFromDB(guildId);

    if (!config || !config.canal2 || !config.rol2) {
        await interaction.reply({
            content: '❌ Error: El sistema de reportes no está completamente configurado (falta el Canal Destino 2 o su rol). Vuelve a configurarlo desde el panel de admin.',
            ephemeral: true
        });
        return true;
    }

    const reportId = await getNextReportIdFromDB(guildId);

    const jornada = interaction.fields.getTextInputValue('input_jornada');
    const pilotoReporta = interaction.fields.getTextInputValue('input_reporta');
    const pilotoAReportar = interaction.fields.getTextInputValue('input_a_reportar');
    const descripcion = interaction.fields.getTextInputValue('input_descripcion');
    const enlace = interaction.fields.getTextInputValue('input_enlace').trim();

    await interaction.reply({
        content: `✅ ¡Reporte enviado con éxito! Identificador generado: **🆔 ${reportId}**`,
        ephemeral: true
    });

    const guild = interaction.guild!;
    const serverName = guild.name;

    const embedFields: any[] = [
        { name: '📅 Jornada', value: jornada, inline: true },
        { name: '👤 Reporta', value: pilotoReporta, inline: true },
        { name: '🎯 A Reportar', value: pilotoAReportar, inline: true },
        { name: '📝 Descripción', value: descripcion, inline: false }
    ];

    if (enlace) {
        embedFields.push({ name: '🔗 Pruebas / Enlace', value: enlace, inline: false });
    }

    const embedReporte = new EmbedBuilder()
        .setTitle(`🚨 NUEVO REPORTE - 🆔 ${reportId}`)
        .setColor(0xFF0000)
        .addFields(embedFields)
        .setFooter({ text: serverName })
        .setTimestamp();

    // --- SALIDA 1: Canal Destino 1 (Opcional, con o sin mención) ---
    if (config.canal1) {
        try {
            const canal1 = await guild.channels.fetch(config.canal1) as TextChannel;
            if (canal1) {
                const mentionText = config.rol1 ? `📢 <@&${config.rol1}> Nuevo reporte registrado.` : `📢 Nuevo reporte registrado.`;
                await canal1.send({
                    content: mentionText,
                    embeds: [embedReporte]
                });
            }
        } catch (error) {
            console.error('❌ Error al enviar al Canal Destino 1:', error);
        }
    }

    // --- SALIDA 2: Canal Destino 2 (Crea hilo directamente y manda el embed dentro) ---
    try {
        const canal2 = await guild.channels.fetch(config.canal2) as TextChannel;
        if (canal2) {
            const thread = await canal2.threads.create({
                name: `Reporte-${reportId}`,
                autoArchiveDuration: 1440 // 24 horas
            });

            await thread.send({
                content: `📢 <@&${config.rol2}> Expediente abierto para revisión.`,
                embeds: [embedReporte]
            });
        }
    } catch (error) {
        console.error('❌ Error al crear el hilo en el Canal Destino 2:', error);
    }

    return true;
}
