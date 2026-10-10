import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('lista')
    .setDescription('Muestra los usuarios con un rol específico listos para copiar a Sheets.')
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

        // Construcción de filas: Nombre + Tabulador (\t) + <@ID>
        const listLines = membersWithRole.map(m => {
            const displayName = m.displayName || m.user.username;
            return `${displayName}\t<@${m.user.id}>`;
        }).join('\n');

        // ➔ TEXTO CAMBIADO AQUÍ SEGÚN LA CAPTURA:
        const responseText = `📋 **LISTA EN ORDEN DE ELECCIÓN (${membersWithRole.size}):**\n\n\`\`\`tsv\n${listLines}\n\`\`\``;

        await interaction.editReply({ content: responseText });

    } catch (error) {
        console.error('❌ Error al obtener la lista de usuarios por rol:', error);
        await interaction.editReply({ content: '❌ Hubo un error al obtener la lista de miembros.' });
    }
}
