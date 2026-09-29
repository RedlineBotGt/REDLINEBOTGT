import { 
    ButtonInteraction,
    StringSelectMenuInteraction, 
    ChannelSelectMenuInteraction,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    TextChannel 
} from 'discord.js';
import { obtenerFormularios, obtenerFormularioPorTitulo, guardarFormulario } from '../utils/formsStorage';

// 1. Maneja el clic en el botón "Colocar" del panel /dash (Muestra la lista de formularios)
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

    // Guardar o actualizar el formulario guardando el canal de respuestas asignado
    await guardarFormulario(
        interaction.guildId,
        tituloFormulario,
        canalId,
        formulario.preguntas
    );

    const serverName = interaction.guild?.name || 'Servidor';

    // Creamos el Botón Azul con el título exacto del formulario
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
