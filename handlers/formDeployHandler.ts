import { 
    StringSelectMenuInteraction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextChannel 
} from 'discord.js';
import { obtenerFormularioPorTitulo } from '../utils/formsStorage';

export async function handleFormDeploySelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('select_form_deploy_')) return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Este comando solo se puede usar dentro de un servidor.', components: [] });
        return true;
    }

    const canalId = interaction.customId.replace('select_form_deploy_', '');
    const tituloFormulario = interaction.values[0];

    // Buscamos el formulario pasando el guildId y el título
    const formulario = await obtenerFormularioPorTitulo(interaction.guildId, tituloFormulario);
    if (!formulario) {
        await interaction.update({
            content: '❌ El formulario seleccionado ya no existe en la base de datos de este servidor.',
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

    // Obtenemos el nombre real del servidor de forma dinámica
    const serverName = interaction.guild?.name || 'Servidor';

    // Creamos el Botón Azul con el título exacto del formulario
    const botonAzul = new ButtonBuilder()
        .setCustomId(`open_form_${encodeURIComponent(tituloFormulario)}`)
        .setLabel(tituloFormulario.substring(0, 80))
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(botonAzul);

    // Mensaje con el nombre del servidor dinámico
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
