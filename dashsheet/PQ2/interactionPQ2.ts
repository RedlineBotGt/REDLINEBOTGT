import { CommandInteraction, MessageFlags } from 'discord.js';
import { procesarAsignacionTitulares } from './titularesService';

export async function handlePQ2Interactions(interaction: CommandInteraction): Promise<boolean> {
    if (!interaction.isChatInputCommand()) return false;

    if (interaction.commandName !== 'titulares') return false;

    if (!interaction.guild) {
        await interaction.reply({ 
            content: '❌ Este comando solo se puede ejecutar dentro de un servidor.', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
        const result = await procesarAsignacionTitulares(interaction.guild);

        await interaction.editReply({
            content: `✅ **Sincronización de TITULARES completada:**\n- 🟢 Roles asignados: **${result.success}**\n- ⚠️ No encontrados en el servidor: **${result.notFound}**\n- ❌ Errores: **${result.errors}**`
        });
    } catch (error: any) {
        console.error('Error procesando /titulares:', error);
        await interaction.editReply({
            content: `❌ Ocurrió un error en la sincronización: ${error.message || error}`
        });
    }

    return true;
}
