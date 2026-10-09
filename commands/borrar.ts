import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    PermissionFlagsBits,
    MessageFlags 
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('borrar')
    .setDescription('Borra una cantidad específica de mensajes del canal.')
    .addIntegerOption(option =>
        option.setName('cantidad')
            .setDescription('Número de mensajes a borrar (entre 1 y 100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages); // Solo usuarios con permisos para gestionar mensajes

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar en canales de texto.', flags: [MessageFlags.Ephemeral] });
        return;
    }

    const cantidad = interaction.options.getInteger('cantidad', true);

    try {
        // Borra los mensajes filtrando automáticamente los de más de 14 días
        const mensajesBorrados = await interaction.channel.bulkDelete(cantidad, true);

        // Si el resultado está vacío, significa que no se pudo borrar nada del rango seleccionado
        if (mensajesBorrados.size === 0) {
            await interaction.reply({
                content: '❌ No se ha podido borrar ningún mensaje. Comprueba que no sean demasiado antiguos o que el rango sea válido.',
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        await interaction.reply({
            content: `🗑️ Se han borrado **${mensajesBorrados.size}** mensajes correctamente.`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error: any) {
        console.error('❌ Error al borrar mensajes:', error);

        // Si el error es por falta de permisos del bot en el canal (Código de Discord 50013)
        if (error.code === 50013) {
            await interaction.reply({
                content: '❌ El bot no tiene permisos de **Gestionar Mensajes** (Manage Messages) en este canal.',
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        await interaction.reply({
            content: '❌ Hubo un error al intentar borrar los mensajes en este canal.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}
