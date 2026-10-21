import { CommandInteraction, MessageFlags } from 'discord.js';
import { procesarAsignacionTitulares } from './titularesService';
import { procesarAsignacionReservas } from './reservasService';

export async function handlePQ2Interactions(interaction: CommandInteraction): Promise<boolean> {
    if (!interaction.isChatInputCommand()) return false;

    if (!['titulares', 'reservas'].includes(interaction.commandName)) return false;

    if (!interaction.guild) {
        await interaction.reply({ 
            content: '❌ Este comando solo se puede ejecutar dentro de un servidor.', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
        let result;
        if (interaction.commandName === 'titulares') {
            result = await procesarAsignacionTitulares(interaction.guild);
        } else if (interaction.commandName === 'reservas') {
            result = await procesarAsignacionReservas(interaction.guild);
        }

        if (result) {
            await interaction.editReply({
                content: `✅ **Sincronización de ${interaction.commandName.toUpperCase()} completada:**\n- 🟢 Roles asignados: **${result.success}**\n- ⚠️ No encontrados en el servidor: **${result.notFound}**\n- ❌ Errores: **${result.errors}**`
            });
        }
    } catch (error: any) {
        console.error(`Error procesando /${interaction.commandName}:`, error);
        await interaction.editReply({
            content: `❌ Ocurrió un error en la sincronización: ${error.message || error}`
        });
    }

    return true;
}
