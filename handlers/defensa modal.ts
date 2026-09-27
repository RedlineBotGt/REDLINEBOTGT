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
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'defensaConfig.json');

function getConfig(guildId: string) {
    if (!fs.existsSync(configPath)) return null;
    const configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return configs[guildId] || null;
}

// 1. Mostrar el Modal de Defensa al pulsar el botón verde
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
        .setRequired(false); // Opcional tal como pediste

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
    const config = getConfig(guildId);

    if (!config || !config.canal2 || !config.rol2) {
        await interaction.reply({
            content: '❌ Error: El sistema de defensas no está completamente configurado (falta el Canal Destino 2 o su rol). Ejecuta `/setupdefensa` de nuevo.',
            ephemeral: true
        });
        return;
    }

    // Capturamos los campos
    const reportIdInput = interaction.fields.getTextInputValue('input_def_report_id').trim().padStart(3, '0'); // Asegura formato 3 cifras (ej. 001)
    const pilotoReporta = interaction.fields.getTextInputValue('input_def_reporta');
    const pilotoDefensa = interaction.fields.getTextInputValue('input_def_piloto');
    const explicacion = interaction.fields.getTextInputValue('input_def_explicacion');
    const enlace = interaction.fields.getTextInputValue('input_def_enlace') || 'Sin enlace adjunto';

    const guild = interaction.guild!;
    const serverName = guild.name;

    // Respondemos de forma privada al instante
    await interaction.reply({
        content: `✅ ¡Defensa registrada con éxito para el reporte **🆔 ${reportIdInput}**!`,
        ephemeral: true
    });

    // Construimos el Embed Verde oficial de Defensa
    const embedDefensa = new EmbedBuilder()
        .setTitle(`🛡️ DEFENSA PRESENTADA - 🆔 ${reportIdInput}`)
        .setColor(0x00FF00) // Verde
        .addFields(
            { name: '👤 Reportó', value: pilotoReporta, inline: true },
            { name: '🛡️ En Defensa', value: pilotoDefensa, inline: true },
            { name: '📝 Explicación / Alegación', value: explicacion, inline: false },
            { name: '🔗 Pruebas / Enlace', value: enlace, inline: false }
        )
        .setFooter({ text: serverName })
        .setTimestamp();

    // --- SALIDA 1: Canal Destino 1 + Mención 1 (Opcional) ---
    if (config.canal1 && config.rol1) {
        try {
            const canal1 = await guild.channels.fetch(config.canal1) as TextChannel;
            if (canal1) {
                await canal1.send({
                    content: `📢 <@&${config.rol1}> Nueva defensa presentada para el reporte **🆔 ${reportIdInput}**.`,
                    embeds: [embedDefensa]
                });
            }
        } catch (error) {
            console.error('❌ Error al enviar defensa al Canal Destino 1:', error);
        }
    }

    // --- SALIDA 2: Búsqueda del hilo en Canal 2 mediante las 3 cifras ---
    try {
        const canal2 = await guild.channels.fetch(config.canal2) as TextChannel;
        if (canal2) {
            // Buscamos entre los hilos activos del servidor / canal
            const activeThreads = await guild.channels.fetchActiveThreads();
            let targetThread = activeThreads.threads.find(thread => 
                thread.parentId === canal2.id && thread.name.includes(reportIdInput)
            );

            // Si no está en los activos, intentamos buscar en los hilos archivados del canal 2
            if (!targetThread) {
                const archivedThreads = await canal2.threads.fetchArchived();
                targetThread = archivedThreads.threads.find(thread => thread.name.includes(reportIdInput));
            }

            if (targetThread) {
                // Publicamos dentro del hilo encontrado con la mención 2
                await targetThread.send({
                    content: `📢 <@&${config.rol2}> El piloto **${pilotoDefensa}** ha presentado su defensa para este reporte.`,
                    embeds: [embedDefensa]
                });
            } else {
                // Si por lo que sea no encuentra el hilo, lo mandamos directo al canal 2 para no perder la defensa
                await canal2.send({
                    content: `⚠️ (No se encontró el hilo **Reporte-${reportIdInput}**)\n📢 <@&${config.rol2}> Defensa de **${pilotoDefensa}**:`,
                    embeds: [embedDefensa]
                });
            }
        }
    } catch (error) {
        console.error('❌ Error al buscar el hilo o enviar la defensa al Canal Destino 2:', error);
    }
}
