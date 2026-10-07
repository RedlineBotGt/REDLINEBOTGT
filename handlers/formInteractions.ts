import { 
    ButtonInteraction,
    StringSelectMenuInteraction, 
    ChannelSelectMenuInteraction,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    TextChannel,
    MessageFlags 
} from 'discord.js';
import { obtenerFormularios, obtenerFormularioPorTitulo, guardarFormulario, eliminarFormulario } from '../utils/formsStorage';

// Mapa temporal para recordar el título provisional de cada usuario mientras decide si lo renombra
export const recentUserForms = new Map<string, string>();
// Mapa temporal para recordar qué formulario y canal de publicación se están configurando durante el flujo de colocación
export const colocationContext = new Map<string, { titulo: string; canalPublicacionId: string }>();
// Mapa temporal para almacenar qué formulario se está editando actualmente por usuario
export const activeEditingForms = new Map<string, string>();

// 1. Maneja el clic en el botón "Formulario" (Colocar) del panel
export async function handleDashColocarButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_colocar_form') return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({
            content: '❌ No hay formularios guardados en este servidor para colocar.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('dash_select_colocar_form')
        .setPlaceholder('📌 Selecciona el formulario que deseas colocar...');

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
        content: '📌 **Colocar Formulario:** Selecciona de la lista el formulario que deseas publicar:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Maneja la selección del formulario y muestra el desplegable para elegir el canal de PUBLICACIÓN del botón
export async function handleDashColocarFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_colocar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`dash_channel_publi_${encodeURIComponent(tituloFormulario)}`)
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder('📺 Selecciona el canal donde se PUBLICARÁ el botón del formulario...');

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.update({
        content: `📌 Has seleccionado el formulario: **"${tituloFormulario}"**.\nAhora selecciona el canal donde se **enviará el botón** para que los usuarios lo pulsen:`,
        components: [row]
    });

    return true;
}

// 3. Maneja la selección del canal de publicación y pide el SEGUNDO canal para las RESPUESTAS
export async function handleDashColocarPubliChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('dash_channel_publi_')) return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const encodedTitle = interaction.customId.replace('dash_channel_publi_', '');
    const tituloFormulario = decodeURIComponent(encodedTitle);
    const canalPubliId = interaction.channels.first()?.id;

    if (!canalPubliId) {
        await interaction.update({ content: '❌ No se seleccionó ningún canal válido.', components: [] });
        return true;
    }

    colocationContext.set(interaction.user.id, { titulo: tituloFormulario, canalPublicacionId: canalPubliId });

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('dash_channel_respuestas_final')
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder('📥 Selecciona el canal donde llegarán las RESPUESTAS...');

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.update({
        content: `📺 Canal de publicación seleccionado (<#${canalPubliId}>).\n\n📌 **Paso final:** Selecciona el canal donde deseas que **lleguen las respuestas** enviadas por los usuarios:`,
        components: [row]
    });

    return true;
}

// 4. Maneja la selección del canal de respuestas, guarda todo en la BD y publica el botón en su sitio
export async function handleDashColocarRespuestasChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_channel_respuestas_final') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const context = colocationContext.get(interaction.user.id);
    if (!context) {
        await interaction.update({ content: '❌ Se perdió la sesión de colocación. Vuelve a iniciar el proceso.', components: [] });
        return true;
    }

    const canalRespuestasId = interaction.channels.first()?.id;
    if (!canalRespuestasId) {
        await interaction.update({ content: '❌ No se seleccionó un canal de respuestas válido.', components: [] });
        return true;
    }

    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, context.titulo);
    if (!formulario) {
        await interaction.update({
            content: '❌ El formulario seleccionado ya no existe en la base de datos.',
            components: []
        });
        return true;
    }

    const canalDestinoPubli = await interaction.guild?.channels.fetch(context.canalPublicacionId) as TextChannel;
    if (!canalDestinoPubli) {
        await interaction.update({
            content: '❌ No se pudo encontrar el canal de publicación seleccionado.',
            components: []
        });
        return true;
    }

    await guardarFormulario(
        interaction.guildId,
        context.titulo,
        canalRespuestasId,
        formulario.preguntas
    );

    colocationContext.delete(interaction.user.id);

    const serverName = interaction.guild?.name || 'Servidor';
    const botonAzul = new ButtonBuilder()
        .setCustomId(`open_form_${encodeURIComponent(context.titulo)}`)
        .setLabel(context.titulo.substring(0, 80))
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(botonAzul);
    const contenidoMensaje = `**FORMULARIOS**\n\n— *${serverName}*`;

    await canalDestinoPubli.send({
        content: contenidoMensaje,
        components: [row]
    });

    await interaction.update({
        content: `✅ ¡Formulario **"${context.titulo}"** colocado con éxito!\n- **Botón publicado en:** <#${context.canalPublicacionId}>\n- **Canal de respuestas:** <#${canalRespuestasId}>`,
        components: []
    });

    return true;
}

// 5. Maneja el clic en el botón del formulario publicado para abrir el modal al usuario
export async function handleFormButtonClick(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('open_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este botón solo se puede usar dentro de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('open_form_', ''));
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario || !formulario.preguntas) {
        await interaction.reply({
            content: '❌ Lo siento, este formulario ya no está disponible o ha sido eliminado en este servidor.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const preguntasValidas = formulario.preguntas.filter(
        (p): p is string => typeof p === 'string' && p.trim().length > 0
    );

    if (preguntasValidas.length === 0) {
        await interaction.reply({
            content: '❌ Este formulario no tiene preguntas válidas configuradas.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId(`submit_form_${encodeURIComponent(tituloFormulario)}`)
        .setTitle(formulario.titulo.substring(0, 45));

    preguntasValidas.slice(0, 5).forEach((pregunta, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`p_${index}`)
            .setLabel(pregunta.substring(0, 45))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    });

    await interaction.showModal(modal);
    return true;
}

// 6. Maneja el clic en "Crear F" (Abre el modal con las 5 preguntas exactas)
export async function handleDashCrearFormButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_crear_form') return false;

    try {
        const modal = new ModalBuilder()
            .setCustomId('modal_crear_5_preguntas')
            .setTitle('Crear Formulario (5 Preguntas)');

        for (let i = 1; i <= 5; i++) {
            const input = new TextInputBuilder()
                .setCustomId(`p${i}`)
                .setLabel(`Pregunta ${i} ${i === 1 ? '(Obligatoria)' : '(Opcional)'}`.substring(0, 45))
                .setStyle(TextInputStyle.Short)
                .setRequired(i === 1);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        }

        await interaction.showModal(modal);
    } catch (error) {
        console.error('❌ Error al abrir el modal de 5 preguntas:', error);
    }
    return true;
}

// 7. Maneja el envío del modal de 5 preguntas (Guarda provisionalmente y ofrece el botón de poner nombre)
export async function handleFormCreate5Modal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_crear_5_preguntas') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const preguntas: string[] = [];
        for (let i = 1; i <= 5; i++) {
            try {
                const val = interaction.fields.getTextInputValue(`p${i}`);
                if (val && val.trim().length > 0) {
                    preguntas.push(val.trim());
                }
            } catch {}
        }

        if (preguntas.length === 0) {
            await interaction.reply({ content: '❌ Debes añadir al menos una pregunta válida.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const provisionalTitle = `Formulario #${Math.floor(1000 + Math.random() * 9000)}`;
        recentUserForms.set(interaction.user.id, provisionalTitle);

        await guardarFormulario(guildId, provisionalTitle, null, preguntas);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('dash_btn_prompt_renombrar')
                .setLabel('¿Quieres ponerle nombre? (Sí)')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✏️')
        );

        await interaction.reply({
            content: `✅ ¡Formulario guardado con **${preguntas.length} preguntas**!\n- **Título provisional:** \`${provisionalTitle}\`\n\n¿Quieres ponerle un nombre personalizado ahora?`,
            components: [row],
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error al guardar el formulario de 5 preguntas:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al guardar el formulario.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 8. Maneja el clic en el botón "¿Quieres ponerle nombre?" (Abre el modal con 1 celda)
export async function handlePromptRenombrarButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_prompt_renombrar') return false;

    try {
        const modal = new ModalBuilder()
            .setCustomId('modal_renombrar_formulario')
            .setTitle('Personalizar Nombre del Formulario');

        const input = new TextInputBuilder()
            .setCustomId('nuevo_titulo_input')
            .setLabel('Título / Nombre del formulario')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ej: Inscripciones Temporada 3')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
    } catch (error) {
        console.error('❌ Error al abrir el modal de renombrar:', error);
    }
    return true;
}

// 9. Maneja el envío del modal de renombrar (Actualiza la BD con el título definitivo)
export async function handleRenombrarModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_renombrar_formulario') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const nuevoTitulo = interaction.fields.getTextInputValue('nuevo_titulo_input').trim();
        const viejoTitulo = recentUserForms.get(interaction.user.id);

        if (!nuevoTitulo) {
            await interaction.reply({ content: '❌ El título no puede estar vacío.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        if (!viejoTitulo) {
            await interaction.reply({ content: '❌ No se encontró el formulario provisional reciente.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const formActual = await obtenerFormularioPorTitulo(guildId, viejoTitulo);
        if (!formActual) {
            await interaction.reply({ content: '❌ El formulario provisional ya no existe en la base de datos.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        await guardarFormulario(guildId, nuevoTitulo, formActual.canalRespuestas || null, formActual.preguntas);
        await eliminarFormulario(guildId, viejoTitulo);

        recentUserForms.delete(interaction.user.id);

        await interaction.update({
            content: `✅ ¡Formulario renombrado y guardado con éxito como **"${nuevoTitulo}"**!`,
            components: [],
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error al renombrar el formulario:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al actualizar el nombre.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}
// 10. Maneja el clic en el botón "Editar F" del panel
export async function handleDashEditarFormButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_editar_form') return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({
            content: '❌ No hay formularios guardados en este servidor para editar.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('dash_select_editar_form')
        .setPlaceholder('✏️ Selecciona el formulario que deseas gestionar...');

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
        content: '✏️ **Gestionar Formulario:** Selecciona de la lista el formulario que deseas editar o borrar:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 11. Maneja la selección del formulario y pregunta si desea BORRARLO o SEGUIR EDITANDO
export async function handleDashEditarFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_editar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];
    activeEditingForms.set(interaction.user.id, tituloFormulario);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('edit_btn_borrar_si')
            .setLabel('Sí, borrar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder()
            .setCustomId('edit_btn_borrar_no')
            .setLabel('No, seguir editando')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️')
    );

    await interaction.update({
        content: `📌 Has seleccionado el formulario: **"${tituloFormulario}"**.\n\n¿Quieres **borrarlo** o prefieres **seguir editándolo**?`,
        components: [row]
    });

    return true;
}

// 12. Maneja la opción de BORRAR el formulario seleccionado
export async function handleEditDeleteButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_borrar_si') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = activeEditingForms.get(interaction.user.id);
    if (!tituloFormulario) {
        await interaction.update({ content: '❌ No se encontró el formulario seleccionado. Vuelve a iniciar la gestión.', components: [] });
        return true;
    }

    await eliminarFormulario(guildId, tituloFormulario);
    activeEditingForms.delete(interaction.user.id);

    await interaction.update({
        content: `✅ ¡Formulario **"${tituloFormulario}"** borrado con éxito de la base de datos!`,
        components: []
    });

    return true;
}

// 13. Maneja la opción de SEGUIR EDITANDO (Abre el modal de preguntas)
export async function handleEditContinueButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_borrar_no') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const tituloFormulario = activeEditingForms.get(interaction.user.id);
    if (!tituloFormulario) {
        await interaction.reply({ content: '❌ No se encontró el formulario seleccionado.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const formulario = await obtenerFormularioPorTitulo(guildId, tituloFormulario);
    if (!formulario) {
        await interaction.reply({ content: '❌ El formulario ya no existe.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId('modal_editar_formulario_preguntas')
        .setTitle(`Editar Preguntas: ${tituloFormulario.substring(0, 25)}`);

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

// 14. Maneja el envío del modal de edición de preguntas y pregunta si desea CAMBIAR EL TÍTULO
export async function handleEditarFormModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_editar_formulario_preguntas') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const tituloFormulario = activeEditingForms.get(interaction.user.id);
    if (!tituloFormulario) {
        await interaction.reply({
            content: '❌ Se perdió la referencia del formulario que estabas editando. Vuelve a intentarlo.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const formulario = await obtenerFormularioPorTitulo(guildId, tituloFormulario);
    if (!formulario) {
        await interaction.reply({
            content: '❌ El formulario ya no existe en la base de datos.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const nuevasPreguntas: string[] = [];
    for (let i = 0; i < 5; i++) {
        try {
            const val = interaction.fields.getTextInputValue(`p_${i}`);
            if (val && val.trim().length > 0) {
                nuevasPreguntas.push(val.trim());
            }
        } catch {}
    }

    await guardarFormulario(guildId, tituloFormulario, formulario.canalRespuestas || null, nuevasPreguntas);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('edit_btn_titulo_si')
            .setLabel('Sí, cambiar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId('edit_btn_titulo_no')
            .setLabel('No, finalizar edición')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✔️')
    );

    await interaction.reply({
        content: `✅ ¡Preguntas actualizadas con éxito en **"${tituloFormulario}"**!\n\n¿Quieres **cambiarle el título** o prefieres **finalizar la edición**?`,
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 15. Maneja el botón de SÍ cambiar el título (Abre modal de 1 celda)
export async function handleEditChangeTitleButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_titulo_si') return false;

    try {
        const modal = new ModalBuilder()
            .setCustomId('modal_editar_nuevo_titulo')
            .setTitle('Cambiar Título del Formulario');

        const input = new TextInputBuilder()
            .setCustomId('nuevo_titulo_editado')
            .setLabel('Nuevo título')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Escribe el nuevo nombre...')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
    } catch (error) {
        console.error('❌ Error al abrir el modal de cambio de título:', error);
    }
    return true;
}

// 16. Maneja el envío del modal con el nuevo título definitivo
export async function handleEditarNuevoTituloModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_editar_nuevo_titulo') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const nuevoTitulo = interaction.fields.getTextInputValue('nuevo_titulo_editado').trim();
        const viejoTitulo = activeEditingForms.get(interaction.user.id);

        if (!nuevoTitulo) {
            await interaction.reply({ content: '❌ El título no puede estar vacío.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        if (!viejoTitulo) {
            await interaction.reply({ content: '❌ No se encontró la sesión del formulario.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const formulario = await obtenerFormularioPorTitulo(guildId, viejoTitulo);
        if (!formulario) {
            await interaction.reply({ content: '❌ El formulario ya no existe.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        await guardarFormulario(guildId, nuevoTitulo, formulario.canalRespuestas || null, formulario.preguntas);
        if (nuevoTitulo !== viejoTitulo) {
            await eliminarFormulario(guildId, viejoTitulo);
        }

        activeEditingForms.delete(interaction.user.id);

        await interaction.update({
            content: `✅ ¡Formulario actualizado con éxito! Nuevo título: **"${nuevoTitulo}"**`,
            components: [],
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error al actualizar el título:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al actualizar el título.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 17. Maneja el botón de NO cambiar el título (Finaliza la edición)
export async function handleEditFinishButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'edit_btn_titulo_no') return false;

    activeEditingForms.delete(interaction.user.id);

    await interaction.update({
        content: `✅ ¡Edición finalizada y guardada con éxito!`,
        components: []
    });

    return true;
}

// 18. Maneja el envío de las respuestas del usuario final al canal de respuestas
export async function handleFormSubmitModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('submit_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este formulario solo se puede enviar dentro de un servidor.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('submit_form_', ''));
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario) {
        await interaction.reply({
            content: '❌ Error: No se encontró la configuración de este formulario en la base de datos de este servidor.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    if (!formulario.canalRespuestas) {
        await interaction.reply({
            content: '❌ Este formulario no tiene ningún canal de respuestas configurado actualmente. Contacta con un administrador.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    let resumen = `📥 **Nueva Respuesta de Formulario**\n`;
    resumen += `📋 **Formulario:** *${formulario.titulo}*\n`;
    resumen += `👤 **Usuario:** <@${interaction.user.id}>\n\n`;

    formulario.preguntas.forEach((pregunta, index) => {
        const respuesta = interaction.fields.getTextInputValue(`p_${index}`);
        resumen += `> **${pregunta}**\n${respuesta}\n\n`;
    });

    const serverName = interaction.guild?.name || 'Servidor';
    resumen += `— *${serverName}*`;

    try {
        const canalRespuestas = await interaction.guild?.channels.fetch(formulario.canalRespuestas) as TextChannel;

        if (canalRespuestas) {
            await canalRespuestas.send({ content: resumen });
            await interaction.reply({
                content: '✅ ¡Tus respuestas se han enviado correctamente al staff!',
                flags: [MessageFlags.Ephemeral]
            });
        } else {
            await interaction.reply({
                content: '❌ Las respuestas se han procesado, pero no se pudo encontrar el canal de respuestas configurado.',
                flags: [MessageFlags.Ephemeral]
            });
        }
    } catch (error) {
        console.error('❌ Error al enviar la respuesta al canal:', error);
        await interaction.reply({
            content: '❌ Las respuestas se procesaron, pero ocurrió un error al enviarlas al canal (es posible que el canal haya sido eliminado o el bot no tenga permisos).',
            flags: [MessageFlags.Ephemeral]
        });
    }

    return true;
}
// 19. Enrutador interno del módulo de formularios
export async function handleFormInteraction(interaction: any): Promise<boolean> {
    if (interaction.isButton()) {
        if (await handleDashColocarButton(interaction)) return true;
        if (await handleFormButtonClick(interaction)) return true;
        if (await handleDashCrearFormButton(interaction)) return true;
        if (await handlePromptRenombrarButton(interaction)) return true;
        if (await handleDashEditarFormButton(interaction)) return true;
        if (await handleEditDeleteButton(interaction)) return true;
        if (await handleEditContinueButton(interaction)) return true;
        if (await handleEditChangeTitleButton(interaction)) return true;
        if (await handleEditFinishButton(interaction)) return true;
    }
    if (interaction.isStringSelectMenu()) {
        if (await handleDashColocarFormSelect(interaction)) return true;
        if (await handleDashEditarFormSelect(interaction)) return true;
    }
    if (interaction.isChannelSelectMenu()) {
        if (await handleDashColocarPubliChannelSelect(interaction)) return true;
        if (await handleDashColocarRespuestasChannelSelect(interaction)) return true;
    }
    if (interaction.isModalSubmit()) {
        if (await handleFormCreate5Modal(interaction)) return true;
        if (await handleRenombrarModal(interaction)) return true;
        if (await handleEditarFormModalSubmit(interaction)) return true;
        if (await handleEditarNuevoTituloModalSubmit(interaction)) return true;
        if (await handleFormSubmitModal(interaction)) return true;
    }
    return false;
}