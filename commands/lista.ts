import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('lista')
    .setDescription('Muestra la lista de menciones de los usuarios con un rol específico.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option => 
        option.setName('rol')
            .setDescription('Selecciona el rol para obtener los usuarios')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getRole('rol', true);
    const guild = interaction.guild;

    if (!guild || !interaction.channel) {
        await interaction.reply({ content: '❌ Este comando solo puede usarse en un servidor.', flags: [MessageFlags.Ephemeral] });
        return;
    }

    // Defer efímero para procesar en segundo plano
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
        // Cargar todos los miembros del servidor
        await guild.members.fetch();

        // Filtrar los miembros con el rol seleccionado
        const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(role.id));

        if (membersWithRole.size === 0) {
            await interaction.editReply({ content: `❌ No se encontraron usuarios con el rol **${role.name}**.` });
            return;
        }

        // Formatear únicamente con las menciones
        const listMentions = membersWithRole.map(m => `<@${m.user.id}>`).join('\n');

        // Título con el nombre del rol y el número total de usuarios
        const responseText = `📋 **LISTADO DE ${role.name.toUpperCase()} (${membersWithRole.size}):**\n\n${listMentions}`;

        // Mensaje limpio en el canal (sin la etiqueta de "usó /lista")
        await interaction.channel.send({ content: responseText });

        // Confirmación privada para quien ejecuta el comando
        await interaction.editReply({ content: `✅ El listado de **${role.name}** (${membersWithRole.size} usuarios) se ha publicado correctamente.` });

    } catch (error) {
        console.error('❌ Error al obtener la lista de usuarios por rol:', error);
        await interaction.editReply({ content: '❌ Hubo un error al obtener la lista de miembros.' });
    }
}
