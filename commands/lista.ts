import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('lista')
    .setDescription('Muestra los usuarios con un rol específico separados por tabulador para pegar en Sheets.')
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
        await guild.members.fetch();

        const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(role.id));

        if (membersWithRole.size === 0) {
            await interaction.editReply({ content: `❌ No se encontraron usuarios con el rol **${role.name}**.` });
            return;
        }

        // Usamos \t (Tabulador) para separar la Columna 1 de la Columna 2
        const listLines = membersWithRole.map(m => {
            const displayName = m.displayName || m.user.username;
            return `${displayName}\t<@${m.user.id}>`;
        }).join('\n');

        const responseText = `📋 **Lista para Google Sheets del rol @${role.name} (${membersWithRole.size}):**\n\n\`\`\`text\n${listLines}\n\`\`\``;

        await interaction.editReply({ content: responseText });

    } catch (error) {
        console.error('❌ Error al obtener la lista de usuarios por rol:', error);
        await interaction.editReply({ content: '❌ Hubo un error al obtener la lista de miembros.' });
    }
}
