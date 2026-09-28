import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} from 'discord.js';
import { obtenerFormularioPorTitulo } from '../utils/formsStorage';

export async function handleFormButtonClick(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('open_form_')) return false;

    // Extraemos el título del formulario desde el customId del botón
    const tituloFormulario = decodeURIComponent(interaction.customId.replace('open_form_', ''));
    const formulario = await obtenerFormularioPorTitulo(tituloFormulario); // <-- Añadido el await aquí

    if (!formulario || !formulario.preguntas) {
        await interaction.reply({
            content: '❌ Lo siento, este formulario ya no está disponible o ha sido eliminado.',
            ephemeral: true
        });
        return true;
    }

    // Filtramos estrictamente solo las preguntas que tengan texto real (evita etiquetas vacías que crashean Discord)
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

    // Creamos el modal dinámicamente solo con las preguntas válidas (máximo 5 por límite de Discord)
    const modal = new ModalBuilder()
        .setCustomId(`submit_form_${encodeURIComponent(tituloFormulario)}`)
        .setTitle(formulario.titulo.substring(0, 45)); // Límite de título de modal en Discord

    preguntasValidas.slice(0, 5).forEach((pregunta, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`p_${index}`)
            .setLabel(pregunta.substring(0, 45)) // Límite de caracteres de etiqueta
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    });

    await interaction.showModal(modal);
    return true;
}
