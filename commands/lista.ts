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

    if (!guild) {
        await interaction.reply({ content: '❌ Este comando solo puede usarse en un servidor.', flags: [MessageFlags.Ephemeral] });
        return;
    }

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

        // Texto plano sin bloques de código ni embeds
        const responseText = `📋 **LISTA DE MENCIONES (${membersWithRole.size}):**\n\n${listMentions}`;

        await interaction.editReply({ content: responseText });

    } catch (error) {
        console.error('❌ Error al obtener la lista de usuarios por rol:', error);
        await interaction.editReply({ content: '❌ Hubo un error al obtener la lista de miembros.' });
    }
}
