import { 
    ButtonInteraction, 
    StringSelectMenuInteraction, 
    StringSelectMenuBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';
import { obtenerFormularios, eliminarFormulario } from '../utils/formsStorage';

// 1. Maneja el clic en el botón "Borrar" del panel /dash (Muestra el menú desplegable)
export async function handleDashDeleteButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_borrar_form') return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', ephemeral: true });
        return true;
    }

    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({
            content: '❌ No hay formularios guardados en este servidor para borrar.',
            ephemeral: true
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('dash_select_eliminar_form')
        .setPlaceholder('🗑️ Selecciona el formulario que deseas borrar...');

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
        content: '⚠️ **Borrar Formulario:** Selecciona de la lista el formulario que deseas eliminar:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del formulario del menú y pide confirmación
export async function handleDashDeleteFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_eliminar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];

    const confirmButton = new ButtonBuilder()
        .setCustomId(`dash_confirm_borrar_${encodeURIComponent(tituloFormulario)}`)
        .setLabel('Sí, eliminar definitivamente')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);

    await interaction.update({
        content: `⚠️ **¿Estás seguro de que deseas eliminar el formulario "${tituloFormulario}"?**\nEsta acción no se puede deshacer.`,
        components: [row]
    });

    return true;
}

// 3. Maneja el botón de confirmación y borra de verdad en MongoDB
export async function handleDashDeleteConfirmButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('dash_confirm_borrar_')) return false;

    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Acción no válida fuera de un servidor.', ephemeral: true });
        return true;
    }

    const encodedTitle = interaction.customId.replace('dash_confirm_borrar_', '');
    const tituloFormulario = decodeURIComponent(encodedTitle);

    await eliminarFormulario(interaction.guildId, tituloFormulario);

    await interaction.update({
        content: `🗑️ ¡El formulario **"${tituloFormulario}"** ha sido eliminado correctamente de este servidor!`,
        components: []
    });

    return true;
}
