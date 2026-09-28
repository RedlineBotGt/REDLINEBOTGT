import { StringSelectMenuInteraction } from 'discord.js';
import { eliminarFormulario } from '../utils/formsStorage';

export async function handleDashDeleteFormSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_eliminar_form') return false;

    if (!interaction.guildId) {
        await interaction.update({ content: '❌ Acción no válida fuera de un servidor.', components: [] });
        return true;
    }

    const tituloFormulario = interaction.values[0];

    // Eliminamos el formulario vinculado al servidor actual
    await eliminarFormulario(interaction.guildId, tituloFormulario);

    await interaction.update({
        content: `🗑️ ¡El formulario **"${tituloFormulario}"** ha sido eliminado correctamente de este servidor! Vuelve a ejecutar \`/dash\` para ver el panel actualizado.`,
        components: []
    });

    return true;
}
