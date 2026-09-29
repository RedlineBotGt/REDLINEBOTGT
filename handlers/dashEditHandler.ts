import { 
    ButtonInteraction, 
    StringSelectMenuInteraction, 
    StringSelectMenuBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} from 'discord.js';
import { obtenerFormularios, obtenerFormularioPorTitulo } from '../utils/formsStorage';

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
            description: `Canal ID: ${form.canalRespuestas || 'No asignado'}`
        });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
        content: '✏️ **Editar Formulario:** Selecciona de la lista el formulario cuyas preguntas quieres modificar:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del formulario del menú y abre el modal
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
        .setTitle(`Editar: ${tituloFormulario}`.substring(0, 45));

    // Campo de preguntas pre-llenado con las actuales (una por línea)
    const inputPreguntas = new TextInputBuilder()
        .setCustomId('input_edit_preguntas')
        .setLabel('📋 Preguntas (1 por línea)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(formulario.preguntas.join('\n'))
        .setRequired(true);

    // Campo de canal pre-llenado con el ID actual (protegido por si es null)
    const inputCanal = new TextInputBuilder()
        .setCustomId('input_edit_canal')
        .setLabel('📺 ID del Canal de Respuestas')
        .setStyle(TextInputStyle.Short)
        .setValue(formulario.canalRespuestas || '')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputPreguntas),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputCanal)
    );

    await interaction.showModal(modal);
    return true;
}
