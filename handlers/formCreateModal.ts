import { ModalSubmitInteraction } from 'discord.js';
import { pendingFormCreations } from '../commands/forms'; // <-- ¡Corregido aquí para subir a la carpeta commands!
import { guardarFormulario } from '../utils/formsStorage'; // Importamos la función del Paso 1

export async function handleFormCreateModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_crear_formulario_preguntas') return false;

    // Recuperamos los datos temporales del admin que inició el comando
    const pendingData = pendingFormCreations.get(interaction.user.id);
    if (!pendingData) {
        await interaction.reply({
            content: '❌ No se encontraron los datos temporales de este formulario. Por favor, vuelve a ejecutar `/forms`.',
            ephemeral: true
        });
        return true;
    }

    const { titulo, canalRespuestasId } = pendingData;

    // Recogemos las 5 preguntas del modal
    const preguntas = [
        interaction.fields.getTextInputValue('p1'),
        interaction.fields.getTextInputValue('p2'),
        interaction.fields.getTextInputValue('p3'),
        interaction.fields.getTextInputValue('p4'),
        interaction.fields.getTextInputValue('p5')
    ];

    // Guardamos en el archivo .json usando el Título como clave única (Paso 1)
    guardarFormulario(titulo, canalRespuestasId, preguntas);

    // Limpiamos la memoria temporal
    pendingFormCreations.delete(interaction.user.id);

    // Respondemos de forma privada (recordando que NO publica nada todavía, solo guarda)
    await interaction.reply({
        content: `✅ ¡Formulario **"${titulo}"** guardado con éxito en la base de datos!\n- **Canal de respuestas:** <#${canalRespuestasId}>\n- **Preguntas configuradas:** 5\n\n*(Ya está listo para ser lanzado cuando quieras).*`,
        ephemeral: true
    });

    return true;
}
