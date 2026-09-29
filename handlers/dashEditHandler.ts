import { 
    ButtonInteraction, 
    StringSelectMenuInteraction, 
    StringSelectMenuBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ModalSubmitInteraction 
} from 'discord.js';
import { obtenerFormularios, obtenerFormularioPorTitulo, guardarFormulario, eliminarFormulario } from '../utils/formsStorage';

// 1. Maneja el clic en el botón "Editar" del panel /dash
export async function handleDashEditButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_editar_form') return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', ephemeral: true });
        return true;
    }

    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({
            content: '❌ No hay formularios guardados en este servidor para editar.',
            ephemeral: true
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('dash_select_editar_form')
        .setPlaceholder('📋 Selecciona el formulario que deseas editar...');

    for (const titulo of titulos.slice(0, 25)) {
        const form = formularios[titulo];
        selectMenu.addOptions({
            label: titulo,
            value: titulo,
            description: `Preguntas: ${form.preguntas.length}`
        });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
        content: '✏️ **Editar Formulario:** Selecciona de la lista el formulario que deseas modificar:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del formulario del menú y abre el modal (Solo Título y Preguntas)
export async function handleDashEditFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_editar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario) {
        await interaction.update({ content: '❌ No se encontró el formulario seleccionado en este servidor.', components: [] });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId(`modal_editar_form_${encodeURIComponent(tituloFormulario)}`)
        .setTitle(`Editar Formulario`.substring(0, 45));

    // Campo 1: Editar Título
    const inputTitulo = new TextInputBuilder()
        .setCustomId('input_edit_titulo')
        .setLabel('🏷️ Título del Formulario')
        .setStyle(TextInputStyle.Short)
        .setValue(formulario.titulo)
        .setRequired(true);

    // Campo 2: Preguntas (1 por línea)
    const inputPreguntas = new TextInputBuilder()
        .setCustomId('input_edit_preguntas')
        .setLabel('📋 Preguntas (1 por línea)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(formulario.preguntas.join('\n'))
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPreguntas)
    );

    await interaction.showModal(modal);
    return true;
}

// 3. Maneja el envío del modal (Guarda título y preguntas, conservando el canal previo en segundo plano)
export async function handleModalEditFormSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('modal_editar_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', ephemeral: true });
        return true;
    }

    const encodedTitle = interaction.customId.replace('modal_editar_form_', '');
    const tituloOriginal = decodeURIComponent(encodedTitle);

    // Recuperar el formulario actual para conservar el canal de respuestas que ya tuviera asignado
    const formularioActual = await obtenerFormularioPorTitulo(interaction.guildId, tituloOriginal);
    const canalRespuestasActual = formularioActual ? formularioActual.canalRespuestas : null;

    // Obtener los valores del modal
    const nuevoTitulo = interaction.fields.getTextInputValue('input_edit_titulo').trim();
    const preguntasTexto = interaction.fields.getTextInputValue('input_edit_preguntas');

    const preguntas = preguntasTexto
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    // Si cambió el título, eliminamos el registro antiguo para evitar duplicados
    if (nuevoTitulo !== tituloOriginal) {
        await eliminarFormulario(interaction.guildId, tituloOriginal);
    }

    // Guardar o actualizar en MongoDB manteniendo el canal previo intacto
    await guardarFormulario(
        interaction.guildId,
        nuevoTitulo,
        canalRespuestasActual,
        preguntas
    );

    await interaction.reply({
        content: `✅ ¡El formulario se ha actualizado correctamente!\n\n` +
                 `🏷️ **Título:** ${nuevoTitulo}\n` +
                 `📋 **Total de preguntas:** ${preguntas.length}`,
        ephemeral: true
    });

    return true;
}
