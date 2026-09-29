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
import { getDefensaConfigFromDB } from './dashDefensaHandler';

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

    // Validamos que el Canal Destino 2 (hilos de reporte) esté configurado
    if (!config || !config.canal2 || !config.rol2) {
        await interaction.reply({
            content: '❌ Error: El sistema de defensas no está completamente configurado (Falta el Canal 2 o su rol de mención). Reconfigúralo desde el panel.',
            ephemeral: true
        });
        return;
    }

    // Capturamos los campos asegurando el formato de 3 cifras (ej. 001)
    const reportIdInput = interaction.fields.getTextInputValue('input_def_report_id').trim().padStart(3, '0');
    const pilotoReporta = interaction.fields.getTextInputValue('input_def_reporta');
    const pilotoDefensa = interaction.fields.getTextInputValue('input_def_piloto');
    const explicacion = interaction.fields.getTextInputValue('input_def_explicacion');
    const enlaceInput = interaction.fields.getTextInputValue('input_def_enlace').trim();

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

    // Embed verde oficial de defensa
    const embedDefensa = new EmbedBuilder()
        .setTitle(`🛡️ DEFENSA PRESENTADA - 🆔 ${reportIdInput}`)
        .setColor(0x00FF00)
        .addFields(embedFields)
        .setFooter({ text: serverName })
        .setTimestamp();

    // --- SALIDA 1: Canal Destino 1 (Opcional, si se configuró en el paso 1) ---
    if (config.canal1) {
        try {
            const canal1 = await guild.channels.fetch(config.canal1) as TextChannel;
            if (canal1) {
                const mentionText1 = config.rol1 ? `📢 <@&${config.rol1}> Nueva defensa registrada.` : `📢 Nueva defensa registrada.`;
                await canal1.send({
                    content: mentionText1,
                    embeds: [embedDefensa]
                });
            }
        } catch (error) {
            console.error('❌ Error al enviar al Canal Destino 1 (Defensas):', error);
        }
    }

    // --- SALIDA 2: Búsqueda del hilo en el Canal Destino 2 mediante las 3 cifras ---
    try {
        const canal2 = await guild.channels.fetch(config.canal2) as TextChannel;
        
        if (canal2) {
            // Buscamos entre los hilos activos del servidor
            const activeThreads = await guild.channels.fetchActiveThreads();
            let targetThread = activeThreads.threads.find(thread => 
                thread.parentId === canal2.id && thread.name.includes(reportIdInput)
            );

            // Si no está activo, buscamos en los hilos archivados del canal
            if (!targetThread) {
                const archivedThreads = await canal2.threads.fetchArchived();
                targetThread = archivedThreads.threads.find(thread => thread.name.includes(reportIdInput));
            }

            if (targetThread) {
                // Publicamos dentro del hilo encontrado con la Mención 2
                const mentionText2 = `📢 <@&${config.rol2}> El piloto **${pilotoDefensa}** ha presentado su defensa para este reporte.`;
                await targetThread.send({
                    content: mentionText2,
                    embeds: [embedDefensa]
                });
            } else {
                // Si por lo que sea no encuentra el hilo, lo mandamos al canal principal 2 con advertencia
                const mentionTextFallback = `📢 <@&${config.rol2}> Defensa de **${pilotoDefensa}** (⚠️ No se encontró el hilo correspondiente al reporte **${reportIdInput}**):`;
                await canal2.send({
                    content: mentionTextFallback,
                    embeds: [embedDefensa]
                });
            }
        }
    } catch (error) {
        console.error('❌ Error al buscar el hilo o enviar la defensa al Canal 2:', error);
    }
}
