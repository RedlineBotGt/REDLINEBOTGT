import { 
    ButtonInteraction,
    StringSelectMenuInteraction, 
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} from 'discord.js';
import { obtenerFormularios, obtenerFormularioPorTitulo, guardarFormulario, eliminarFormulario } from './formsstorage';

// Mapas temporales de sesión para la administración
export const recentUserForms = new Map<string, string>();
export const activeEditingForms = new Map<string, string>();

// 1. Botón "Crear F" (Abre modal de 5 preguntas)
export async function handleDashCrearFormButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_crear_form') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_crear_5_preguntas')
        .setTitle('Crear Formulario (5 Preguntas)');

    for (let i = 1; i <= 5; i++) {
        const input = new TextInputBuilder()
            .setCustomId(`p${i}`)
            .setLabel(`Pregunta ${i}${i === 1 ? '(Obligatoria)' : '(Opcional)'}`.substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setRequired(i === 1);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    }

    await interaction.showModal(modal);
    return true;
}

// 2. Envío del modal de 5 preguntas (Guarda borrador y pide renombrar)
export async function handleFormCreate5Modal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_crear_5_preguntas') return false;

    const guildId = interaction.guildId;
    if (!guildId) return true;

    const preguntas: string[] = [];
    for (let i = 1; i <= 5; i++) {
        try {
            const val = interaction.fields.getTextInputValue(`p${i}`);
            if (val && val.trim().length > 0) preguntas.push(val.trim());
        } catch {}
    }

    if (preguntas.length === 0) {
        await interaction.reply({ content: '❌ Debes añadir al menos una pregunta.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const provisionalTitle = `Formulario #${Math.floor(1000 + Math.random() * 9000)}`;
    recentUserForms.set(interaction.user.id, provisionalTitle);
    await guardarFormulario(guildId, provisionalTitle, null, preguntas);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_prompt_renombrar').setLabel('Poner nombre personalizado').setStyle(ButtonStyle.Success).setEmoji('✏️')
    );

    await interaction.reply({
        content: `✅ ¡Formulario guardado con **${preguntas.length} preguntas**!\n- **Título provisional:** \`${provisionalTitle}\``,
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 3. Botón para renombrar formulario provisional
export async function handlePromptRenombrarButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_prompt_renombrar') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_renombrar_formulario')
        .setTitle('Personalizar Nombre');

    const input = new TextInputBuilder()
        .setCustomId('nuevo_titulo_input')
        .setLabel('Título / Nombre')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
}

// 4. Modal de renombrar definitivo
export async function handleRenombrarModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_renombrar_formulario') return false;

    const guildId = interaction.guildId;
    if (!guildId) return true;

    const nuevoTitulo = interaction.fields.getTextInputValue('nuevo_titulo_input').trim();
    const viejoTitulo = recentUserForms.get(interaction.user.id);

    if (!nuevoTitulo || !viejoTitulo) return true;

    const formActual = await obtenerFormularioPorTitulo(guildId, viejoTitulo);
    if (!formActual) return true;

    await guardarFormulario(guildId, nuevoTitulo, formActual.canalRespuestas || null, formActual.preguntas);
    await eliminarFormulario(guildId, viejoTitulo);
    recentUserForms.delete(interaction.user.id);

    await interaction.update({
        content: `✅ ¡Formulario guardado como **"${nuevoTitulo}"**!`,
        components: [],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 5. Botón "Editar F" del panel
export async function handleDashEditarFormButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_editar_form') return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({ content: '❌ No hay formularios para editar.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('dash_select_editar_form')
        .setPlaceholder('✏️ Selecciona el formulario...');

    for (const titulo of titulos.slice(0, 25)) {
        const form = formularios[titulo];
        selectMenu.addOptions({ label: titulo, value: titulo, description: `Preguntas: ${form.preguntas.length}` });
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await interaction.reply({ content: '✏️ **Gestionar Formulario:**', components: [row], flags: [MessageFlags.Ephemeral] });
    return true;
}

// 6. Selección de formulario a editar/borrar
export async function handleDashEditarFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_editar_form') return false;

    const tituloFormulario = interaction.values[0];
    activeEditingForms.set(interaction.user.id, tituloFormulario);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('edit_btn_borrar_si').setLabel('Sí, borrar').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId('edit_btn_borrar_no').setLabel('No, editar').setStyle(ButtonStyle.Secondary).setEmoji('✏️')
    );

    await interaction.update({ content: `📌 Formulario: **"${tituloFormulario}"**. ¿Borrar o editar?`, components: [row] });
    return true;
}

// 7. Borrar formulario seleccionado
export async function handleEditDeleteButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_borrar_si') return false;

    const guildId = interaction.guildId;
    const tituloFormulario = activeEditingForms.get(interaction.user.id);
    if (!guildId || !tituloFormulario) return true;

    await eliminarFormulario(guildId, tituloFormulario);
    activeEditingForms.delete(interaction.user.id);

    await interaction.update({ content: `✅ ¡Formulario **"${tituloFormulario}"** borrado con éxito!`, components: [] });
    return true;
}

// 8. Continuar editando preguntas
export async function handleEditContinueButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_borrar_no') return false;

    const guildId = interaction.guildId;
    const tituloFormulario = activeEditingForms.get(interaction.user.id);
    if (!guildId || !tituloFormulario) return true;

    const formulario = await obtenerFormularioPorTitulo(guildId, tituloFormulario);
    if (!formulario) return true;

    const modal = new ModalBuilder()
        .setCustomId('modal_editar_formulario_preguntas')
        .setTitle(`Editar: ${tituloFormulario.substring(0, 25)}`);

    for (let i = 0; i < 5; i++) {
        const preguntaActual = formulario.preguntas[i] || '';
        const input = new TextInputBuilder()
            .setCustomId(`p_${i}`)
            .setLabel(`Pregunta ${i + 1}`.substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setValue(preguntaActual.substring(0, 100))
            .setRequired(i === 0);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    }

    await interaction.showModal(modal);
    return true;
}

// 9. Envío del modal de edición de preguntas
export async function handleEditarFormModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_editar_formulario_preguntas') return false;

    const guildId = interaction.guildId;
    const tituloFormulario = activeEditingForms.get(interaction.user.id);
    if (!guildId || !tituloFormulario) return true;

    const formulario = await obtenerFormularioPorTitulo(guildId, tituloFormulario);
    if (!formulario) return true;

    const nuevasPreguntas: string[] = [];
    for (let i = 0; i < 5; i++) {
        try {
            const val = interaction.fields.getTextInputValue(`p_${i}`);
            if (val && val.trim().length > 0) nuevasPreguntas.push(val.trim());
        } catch {}
    }

    await guardarFormulario(guildId, tituloFormulario, formulario.canalRespuestas || null, nuevasPreguntas);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('edit_btn_titulo_si').setLabel('Sí, cambiar').setStyle(ButtonStyle.Success).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('edit_btn_titulo_no').setLabel('Finalizar').setStyle(ButtonStyle.Secondary).setEmoji('✔️')
    );

    await interaction.reply({ content: `✅ ¡Preguntas actualizadas!\n\n¿Quieres cambiar el título?`, components: [row], flags: [MessageFlags.Ephemeral] });
    return true;
}

// 10. Botón para cambiar título en edición
export async function handleEditChangeTitleButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_titulo_si') return false;

    const modal = new ModalBuilder().setCustomId('modal_editar_nuevo_titulo').setTitle('Cambiar Título');
    const input = new TextInputBuilder().setCustomId('nuevo_titulo_editado').setLabel('Nuevo título').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
}

// 11. Modal de nuevo título editado
export async function handleEditarNuevoTituloModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_editar_nuevo_titulo') return false;

    const guildId = interaction.guildId;
    const nuevoTitulo = interaction.fields.getTextInputValue('nuevo_titulo_editado').trim();
    const viejoTitulo = activeEditingForms.get(interaction.user.id);
    if (!guildId || !nuevoTitulo || !viejoTitulo) return true;

    const formulario = await obtenerFormularioPorTitulo(guildId, viejoTitulo);
    if (!formulario) return true;

    await guardarFormulario(guildId, nuevoTitulo, formulario.canalRespuestas || null, formulario.preguntas);
    if (nuevoTitulo !== viejoTitulo) await eliminarFormulario(guildId, viejoTitulo);
    activeEditingForms.delete(interaction.user.id);

    await interaction.update({ content: `✅ ¡Título actualizado a **"${nuevoTitulo}"**!`, components: [] });
    return true;
}

// 12. Finalizar edición sin cambiar título
export async function handleEditFinishButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_titulo_no') return false;

    activeEditingForms.delete(interaction.user.id);
    await interaction.update({ content: `✅ ¡Edición finalizada con éxito!`, components: [] });
    return true;
}
