import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    PermissionFlagsBits 
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
        await interaction.reply({ content: '❌ Este comando solo se puede usar en canales de texto.', ephemeral: true });
        return;
    }

    const cantidad = interaction.options.getInteger('cantidad', true);

    try {
        // Borra los mensajes (el parámetro true filtra automáticamente los mensajes de más de 14 días para evitar errores de Discord)
        const mensajesBorrados = await interaction.channel.bulkDelete(cantidad, true);

        await interaction.reply({
            content: `🗑️ Se han borrado **${mensajesBorrados.size}** mensajes correctamente.`,
            ephemeral: true
        });
    } catch (error) {
        console.error('❌ Error al borrar mensajes:', error);
        await interaction.reply({
            content: '❌ Hubo un error al intentar borrar los mensajes. Recuerda que Discord no permite eliminar por lote mensajes que tengan más de 14 días de antigüedad.',
            ephemeral: true
        });
    }
}
