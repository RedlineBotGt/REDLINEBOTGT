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

let defensaCollection: any = null;

async function getDefensaCollection() {
    if (!defensaCollection) {
        await client.connect();
        defensaCollection = client.db('redline_bot').collection('defensaConfig');
    }
    return defensaCollection;
}

// Función para obtener la configuración de defensas desde MongoDB
async function getDefensaConfigFromDB(guildId: string) {
    try {
        const col = await getDefensaCollection();
        return await col.findOne({ guildId });
    } catch (error) {
        console.error('❌ Error al leer la configuración de defensas de MongoDB:', error);
        return null;
    }
}

// 1. Mostrar el Modal de Defensa al pulsar el botón
export async function handleDefensaButton(interaction: ButtonInteraction) {
    if (interaction.customId !== 'btn_abrir_defensa') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_envio_defensa')
        .setTitle('Formulario de Defensa de Reporte');

    const inputReportId = new TextInputBuilder()
        .setCustomId('input_def_report_id')
        .setLabel('🆔 ID del Reporte a Defender')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 001 (solo 3 cifras)')
        .setRequired(true);

    const inputReporta = new TextInputBuilder()
        .setCustomId('input_def_reporta')
        .setLabel('Piloto que Reportó')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nombre del denunciante')
        .setRequired(true);

    const inputPilotoDefensa = new TextInputBuilder()
        .setCustomId('input_def_piloto')
        .setLabel('Piloto en Defensa')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Tu nombre o ID de piloto')
        .setRequired(true);

    const inputExplicacion = new TextInputBuilder()
        .setCustomId('input_def_explicacion')
        .setLabel('Explicación / Alegación')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Explica tu versión de los hechos...')
        .setRequired(true);

    const inputEnlace = new TextInputBuilder()
        .setCustomId('input_def_enlace')
        .setLabel('Enlace (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://youtube.com/... (opcional)')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReportId),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputReporta),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPilotoDefensa),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputExplicacion),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputEnlace)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Procesar el formulario de Defensa
export async function handleDefensaModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'modal_envio_defensa') return false;

    const guildId = interaction.guildId!;
    const config = await getDefensaConfigFromDB(guildId);

    if (!config || !config.channelId) {
        await interaction.reply({
            content: '❌ Error: El sistema de defensas no está completamente configurado. Ejecuta el comando de setup de defensas desde el panel.',
            ephemeral: true
        });
        return;
    }

    // Capturamos los campos
    const reportIdInput = interaction.fields.getTextInputValue('input_def_report_id').trim().padStart(3, '0');
    const pilotoReporta = interaction.fields.getTextInputValue('input_def_reporta');
    const pilotoDefensa = interaction.fields.getTextInputValue('input_def_piloto');
    const explicacion = interaction.fields.getTextInputValue('input_def_explicacion');
    const enlaceInput = interaction.fields.getTextInputValue('input_def_enlace').trim();
    const enlace = enlaceInput || 'Sin enlace adjunto';

    const guild = interaction.guild!;
    const serverName = guild.name;

    await interaction.reply({
        content: `✅ ¡Defensa registrada con éxito para el reporte **🆔 ${reportIdInput}**!`,
        ephemeral: true
    });

    const embedFields: any[] = [
        { name: '👤 Reportó', value: pilotoReporta, inline: true },
        { name: '🛡️ En Defensa', value: pilotoDefensa, inline: true },
        { name: '📝 Explicación / Alegación', value: explicacion, inline: false }
    ];

    if (enlaceInput) {
        embedFields.push({ name: '🔗 Pruebas / Enlace', value: enlaceInput, inline: false });
    }

    const embedDefensa = new EmbedBuilder()
        .setTitle(`🛡️ DEFENSA PRESENTADA - 🆔 ${reportIdInput}`)
        .setColor(0x00FF00)
        .addFields(embedFields)
        .setFooter({ text: serverName })
        .setTimestamp();

    // --- Búsqueda del hilo en el canal de reportes / canal destino correspondiente ---
    try {
        // Nota: Si el sistema de defensas comparte canal con el de reportes (canal2), 
        // buscamos el hilo por sus 3 cifras tal como lo tenías estructurado.
        const targetChannelId = config.canal2 || config.channelId;
        const canalDestino = await guild.channels.fetch(targetChannelId) as TextChannel;
        
        if (canalDestino) {
            const activeThreads = await guild.channels.fetchActiveThreads();
            let targetThread = activeThreads.threads.find(thread => 
                thread.parentId === canalDestino.id && thread.name.includes(reportIdInput)
            );

            if (!targetThread) {
                const archivedThreads = await canalDestino.threads.fetchArchived();
                targetThread = archivedThreads.threads.find(thread => thread.name.includes(reportIdInput));
            }

            if (targetThread) {
                const mentionText = config.rol2 ? `📢 <@&${config.rol2}> El piloto **${pilotoDefensa}** ha presentado su defensa para este reporte.` : `📢 El piloto **${pilotoDefensa}** ha presentado su defensa para este reporte.`;
                await targetThread.send({
                    content: mentionText,
                    embeds: [embedDefensa]
                });
            } else {
                const mentionText = config.rol2 ? `📢 <@&${config.rol2}> Defensa de **${pilotoDefensa}** (No se encontró el hilo **Reporte-${reportIdInput}**):` : `📢 Defensa de **${pilotoDefensa}**:`;
                await canalDestino.send({
                    content: mentionText,
                    embeds: [embedDefensa]
                });
            }
        }
    } catch (error) {
        console.error('❌ Error al buscar el hilo o enviar la defensa:', error);
    }
}
