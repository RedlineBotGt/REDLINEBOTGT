import { ModalSubmitInteraction } from 'discord.js';
import { pendingFormCreations } from '../commands/forms'; 
import { guardarFormulario } from '../utils/formsStorage'; 

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

    const { guildId, titulo, canalRespuestasId } = pendingData;

    // Recogemos las preguntas de forma segura (capturando si algún campo viniera vacío)
    const preguntas: string[] = [];
    for (let i = 1; i <= 5; i++) {
        try {
            const val = interaction.fields.getTextInputValue(`p${i}`);
            if (val && val.trim().length > 0) {
                preguntas.push(val.trim());
            }
        } catch {
            // Si el campo no existe o está vacío, simplemente se omite
        }
    }

    // Guardamos en la base de datos de MongoDB pasando el guildId
    await guardarFormulario(guildId, titulo, canalRespuestasId, preguntas);

    // Limpiamos la memoria temporal
    pendingFormCreations.delete(interaction.user.id);

    // Respondemos de forma privada confirmando el guardado
    await interaction.reply({
        content: `✅ ¡Formulario **"${titulo}"** guardado con éxito en la base de datos de este servidor!\n- **Canal de respuestas:** <#${canalRespuestasId}>\n- **Preguntas válidas configuradas:** ${preguntas.length}\n\n*(Ya está listo para ser lanzado cuando quieras con /colocarform).*`,
        ephemeral: true
    });

    return true;
}
