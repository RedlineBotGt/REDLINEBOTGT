import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonInteraction, 
    ModalSubmitInteraction 
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'reportConfig.json');

// Función para generar el ID correlativo único (ej. RG-001, RG-002...)
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
    return `RG-${paddedNum}`;
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

// 2. Procesar el envío del Modal
export async function handleReportModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'modal_envio_reporte') return false;

    const guildId = interaction.guildId!;
    const reportId = getNextReportId(guildId);

    const jornada = interaction.fields.getTextInputValue('input_jornada');
    const pilotoReporta = interaction.fields.getTextInputValue('input_reporta');
    const pilotoAReportar = interaction.fields.getTextInputValue('input_a_reportar');
    const descripcion = interaction.fields.getTextInputValue('input_descripcion');
    const enlace = interaction.fields.getTextInputValue('input_enlace');

    await interaction.reply({
        content: `✅ Reporte recibido correctamente con el identificador **🆔 ${reportId}**. Procesando envío dual...`,
        ephemeral: true
    });

    return {
        reportId,
        jornada,
        pilotoReporta,
        pilotoAReportar,
        descripcion,
        enlace
    };
}
