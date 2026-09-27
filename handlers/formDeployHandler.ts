import { 
    StringSelectMenuInteraction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextChannel 
} from 'discord.js';
import { obtenerFormularioPorTitulo } from '../utils/formsStorage'; // Ajusta la ruta

export async function handleFormDeploySelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('select_form_deploy_')) return false;

    const canalId = interaction.customId.replace('select_form_deploy_', '');
    const tituloFormulario = interaction.values[0];

    // Verificamos que exista el formulario
    const formulario = obtenerFormularioPorTitulo(tituloFormulario);
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

    // Definimos el pie de página con {Server} (puedes adaptarlo a tu variable de servidor)
    const serverFooter = "REDLINE GT"; // O tu constante de servidor habitual

    // Creamos el Botón Azul con el título exacto del formulario
    const botonAzul = new ButtonBuilder()
        .setCustomId(`open_form_${encodeURIComponent(tituloFormulario)}`)
        .setLabel(tituloFormulario.substring(0, 80)) // Límite de caracteres de etiqueta de botón
        .setStyle(ButtonStyle.Primary); // ¡Botón azul!

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(botonAzul);

    // Mensaje final pactado: Texto "FORMULARIOS" + Botón azul + Pie de página
    const contenidoMensaje = `**FORMULARIOS**\n\n— *${serverFooter}*`;

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
