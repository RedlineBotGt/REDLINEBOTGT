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

const configPath = path.join(process.cwd(), 'reportConfig.json');

// Función para obtener la configuración del servidor
function getConfig(guildId: string) {
    if (!fs.existsSync(configPath)) return null;
    const configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return configs[guildId] || null;
}

// Función para generar el ID correlativo limpio (ej. 001, 002...)
function getNextReportId(guildId: string): string {
    let configs: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
        configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    if (!configs[guildId]) configs[guildId] = {};

    let currentCounter = configs[guildId].counter || 0;
    currentCounter++;
    configs[guildId].counter = currentCounter;

    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));

    const paddedNum = String(currentCounter).padStart(3, '0');
    return paddedNum; // Sin prefijo RG
}

// 1. Mostrar el Modal al pulsar el botón REPORTE
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
        .setPlaceholder('https://youtube.com/... o enlace de Twitch/Drive')
        .setRequired(true);

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

// 2. Procesar el formulario y ejecutar la Salida Dual completa
export async function handleReportModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'modal_envio_reporte') return false;

    const guildId = interaction.guildId!;
    const config = getConfig(guildId);

    // Canal 2 y Rol2 son obligatorios; Canal 1 y Rol 1 ahora son opcionales
    if (!config || !config.canal2 || !config.rol2) {
        await interaction.reply({
            content: '❌ Error: El sistema de reportes no está completamente configurado (falta el Canal Destino 2 o su rol). Ejecuta `/setup-reporte` de nuevo.',
            ephemeral: true
        });
        return;
    }

    const reportId = getNextReportId(guildId);

    // Capturamos los 5 campos
    const jornada = interaction.fields.getTextInputValue('input_jornada');
    const pilotoReporta = interaction.fields.getTextInputValue('input_reporta');
    const pilotoAReportar = interaction.fields.getTextInputValue('input_a_reportar');
    const descripcion = interaction.fields.getTextInputValue('input_descripcion');
    const enlace = interaction.fields.getTextInputValue('input_enlace');

    // Respondemos de forma privada al usuario al instante
    await interaction.reply({
        content: `✅ ¡Reporte enviado con éxito! Identificador generado: **🆔 ${reportId}**`,
        ephemeral: true
    });

    const guild = interaction.guild!;

    // Construimos el Embed Rojo oficial con el nombre del servidor en el footer
    const embedReporte = new EmbedBuilder()
        .setTitle(`🚨 NUEVO REPORTE - 🆔 ${reportId}`)
        .setColor(0xFF0000)
        .addFields(
            { name: '📅 Jornada', value: jornada, inline: true },
            { name: '👤 Reporta', value: pilotoReporta, inline: true },
            { name: '🎯 A Reportar', value: pilotoAReportar, inline: true },
            { name: '📝 Descripción', value: descripcion, inline: false },
            { name: '🔗 Pruebas / Enlace', value: enlace, inline: false }
        )
        .setFooter({ text: serverName })
        .setTimestamp();

    // --- SALIDA 1: Canal Destino 1 + Mención 1 (Opcional, solo si está configurado) ---
    if (config.canal1 && config.rol1) {
        try {
            const canal1 = await guild.channels.fetch(config.canal1) as TextChannel;
            if (canal1) {
                await canal1.send({
                    content: `📢 <@&${config.rol1}> Nuevo reporte registrado.`,
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
            // 1. Creamos el hilo directamente en el canal de forma limpia
            const thread = await canal2.threads.create({
                name: `Reporte-${reportId}`,
                autoArchiveDuration: 1440 // 24 horas de inactividad para archivar
            });

            // 2. Enviamos el embed y la mención directamente dentro del hilo creado
            await thread.send({
                content: `📢 <@&${config.rol2}> Expediente abierto para revisión.`,
                embeds: [embedReporte]
            });
        }
    } catch (error) {
        console.error('❌ Error al crear el hilo en el Canal Destino 2:', error);
    }
}
