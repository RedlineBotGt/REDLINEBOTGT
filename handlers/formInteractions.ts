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
    TextChannel 
} from 'discord.js';
import { obtenerFormularios, obtenerFormularioPorTitulo, guardarFormulario } from '../utils/formsStorage';
import { activeFormTitles } from '../commands/forms';

// 1. Maneja el clic en el botón "Formulario" del panel de staff (/dashstaff)
export async function handleDashColocarButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_colocar_form') return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', ephemeral: true });
        return true;
    }

    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({
            content: '❌ No hay formularios guardados en este servidor para colocar.',
            ephemeral: true
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
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del formulario y muestra el desplegable para elegir el canal de destino
export async function handleDashColocarFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_colocar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`dash_channel_colocar_${encodeURIComponent(tituloFormulario)}`)
        .setChannelTypes(ChannelType.GuildText)
        .setPlaceholder('📺 Selecciona el canal donde se enviará el formulario...');

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.update({
        content: `📌 Has seleccionado el formulario: **"${tituloFormulario}"**.\nAhora selecciona el canal de destino:`,
        components: [row]
    });

    return true;
}

// 3. Maneja la selección del canal, actualiza el canal asignado en la BD y publica el formulario
export async function handleDashColocarChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('dash_channel_colocar_')) return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const encodedTitle = interaction.customId.replace('dash_channel_colocar_', '');
    const tituloFormulario = decodeURIComponent(encodedTitle);
    const canalId = interaction.channels.first()?.id;

    if (!canalId) {
        await interaction.update({ content: '❌ No se seleccionó ningún canal válido.', components: [] });
        return true;
    }

    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);
    if (!formulario) {
        await interaction.update({
            content: '❌ El formulario seleccionado ya no existe en la base de datos.',
            components: []
        });
        return true;
    }

    const canalDestino = await interaction.guild?.channels.fetch(canalId) as TextChannel;
    if (!canalDestino) {
        await interaction.update({
            content: '❌ No se pudo encontrar el canal de destino seleccionado.',
            components: []
        });
        return true;
    }

    await guardarFormulario(
        interaction.guildId,
        tituloFormulario,
        canalId,
        formulario.preguntas
    );

    const serverName = interaction.guild?.name || 'Servidor';

    const botonAzul = new ButtonBuilder()
        .setCustomId(`open_form_${encodeURIComponent(tituloFormulario)}`)
        .setLabel(tituloFormulario.substring(0, 80))
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(botonAzul);
    const contenidoMensaje = `**FORMULARIOS**\n\n— *${serverName}*`;

    await canalDestino.send({
        content: contenidoMensaje,
        components: [row]
    });

    await interaction.update({
        content: `✅ ¡Formulario **"${tituloFormulario}"** colocado con éxito en <#${canalId}>!`,
        components: []
    });

    return true;
}

// 4. Maneja el clic en el botón del formulario publicado para abrir el modal al usuario
export async function handleFormButtonClick(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('open_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este botón solo se puede usar dentro de un servidor.', ephemeral: true });
        return true;
    }

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('open_form_', ''));
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario || !formulario.preguntas) {
        await interaction.reply({
            content: '❌ Lo siento, este formulario ya no está disponible o ha sido eliminado en este servidor.',
            ephemeral: true
        });
        return true;
    }

    const preguntasValidas = formulario.preguntas.filter(
        (p): p is string => typeof p === 'string' && p.trim().length > 0
    );

    if (preguntasValidas.length === 0) {
        await interaction.reply({
            content: '❌ Este formulario no tiene preguntas válidas configuradas.',
            ephemeral: true
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

// 5. Maneja el envío del modal de creación de preguntas
export async function handleFormCreateModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_crear_formulario_preguntas') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return true;
    }

    const titulo = activeFormTitles.get(interaction.user.id);
    if (!titulo) {
        await interaction.reply({
            content: '❌ No se encontró el título activo para este formulario. Vuelve a iniciar la creación.',
            ephemeral: true
        });
        return true;
    }

    const preguntas: string[] = [];
    for (let i = 1; i <= 5; i++) {
        try {
            const val = interaction.fields.getTextInputValue(`p${i}`);
            if (val && val.trim().length > 0) {
                preguntas.push(val.trim());
            }
        } catch {
            // Si el campo no existe se omite
        }
    }

    await guardarFormulario(guildId, titulo, null, preguntas);
    activeFormTitles.delete(interaction.user.id);

    await interaction.reply({
        content: `✅ ¡Formulario **"${titulo}"** guardado con éxito en la base de datos de este servidor!\n- **Preguntas válidas configuradas:** ${preguntas.length}\n\n*(Ya está listo para ser lanzado cuando quieras con /colocarform).*`,
        ephemeral: true
    });

    return true;
}

// 6. Maneja el envío de las respuestas del usuario final al canal de respuestas
export async function handleFormSubmitModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('submit_form_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este formulario solo se puede enviar dentro de un servidor.', ephemeral: true });
        return true;
    }

    const tituloFormulario = decodeURIComponent(interaction.customId.replace('submit_form_', ''));
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);

    if (!formulario) {
        await interaction.reply({
            content: '❌ Error: No se encontró la configuración de este formulario en la base de datos de este servidor.',
            ephemeral: true
        });
        return true;
    }

    if (!formulario.canalRespuestas) {
        await interaction.reply({
            content: '❌ Este formulario no tiene ningún canal de respuestas configurado actualmente. Contacta con un administrador.',
            ephemeral: true
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
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ Las respuestas se han procesado, pero no se pudo encontrar el canal de respuestas configurado.',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('❌ Error al enviar la respuesta al canal:', error);
        await interaction.reply({
            content: '❌ Las respuestas se procesaron, pero ocurrió un error al enviarlas al canal (es posible que el canal haya sido eliminado o el bot no tenga permisos).',
            ephemeral: true
        });
    }

    return true;
}

// 7. Enrutador interno del módulo de formularios (Para que el interactionRouter lo llame)
export async function handleFormInteraction(interaction: any): Promise<boolean> {
    if (interaction.isButton()) {
        if (await handleDashColocarButton(interaction)) return true;
        if (await handleFormButtonClick(interaction)) return true;
    }
    if (interaction.isStringSelectMenu()) {
        if (await handleDashColocarFormSelect(interaction)) return true;
    }
    if (interaction.isChannelSelectMenu()) {
        if (await handleDashColocarChannelSelect(interaction)) return true;
    }
    if (interaction.isModalSubmit()) {
        if (await handleFormCreateModal(interaction)) return true;
        if (await handleFormSubmitModal(interaction)) return true;
    }
    return false;
}
