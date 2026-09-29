import { ModalSubmitInteraction } from 'discord.js';
import { activeFormTitles } from '../commands/forms'; 
import { guardarFormulario } from '../utils/formsStorage'; 

export async function handleFormCreateModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_crear_formulario_preguntas') return false;

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return true;
    }

    // Recuperamos el título activo del usuario
    const titulo = activeFormTitles.get(interaction.user.id);
    if (!titulo) {
        await interaction.reply({
            content: '❌ No se encontró el título activo para este formulario. Vuelve a iniciar la creación.',
            ephemeral: true
        });
        return true;
    }

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

    // Actualizamos el documento en MongoDB con las preguntas definitivas
    await guardarFormulario(guildId, titulo, null, preguntas);

    // Limpiamos la memoria temporal
    activeFormTitles.delete(interaction.user.id);

    // Respondemos de forma privada confirmando el guardado
    await interaction.reply({
        content: `✅ ¡Formulario **"${titulo}"** guardado con éxito en la base de datos de este servidor!\n- **Preguntas válidas configuradas:** ${preguntas.length}\n\n*(Ya está listo para ser lanzado cuando quieras con /colocarform).*`,
        ephemeral: true
    });

    return true;
}
