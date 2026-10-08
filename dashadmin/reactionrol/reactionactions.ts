import { 
    ButtonInteraction, 
    GuildMember,
    MessageFlags 
} from 'discord.js';
import { getReactionCollection } from './reactionstorage';

// Asignación / Retirada de Rol cuando los usuarios pulsan el botón publicado
export async function handleRrButtonClick(interaction: ButtonInteraction): Promise<boolean> {
    // Verificamos si el customId empieza por el prefijo de acción de rol o coincide exactamente con el botón registrado
    const col = await getReactionCollection();
    
    // Buscamos si el botón pulsado está registrado en la base de datos (por buttonId exacto o empezando por el prefijo dinámico)
    let config = await col.findOne({ buttonId: interaction.customId });
    
    if (!config && interaction.customId.startsWith('rr_action_role_')) {
        // Fallback por si acaso el ID contiene marcas de tiempo dinámicas
        const parts = interaction.customId.replace('rr_action_role_', '').split('_');
        const roleId = parts[0];
        if (roleId) {
            config = await col.findOne({ roleId });
        }
    }

    if (!config) return false;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply({ content: '❌ Acción no válida fuera de un servidor.' });
            return true;
        }

        const member = await guild.members.fetch(interaction.user.id);
        const role = await guild.roles.fetch(config.roleId);

        if (!role) {
            await interaction.editReply({ content: '❌ El rol configurado ya no existe en este servidor.' });
            return true;
        }

        const botMember = guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
            await interaction.editReply({ content: '❌ No tengo permisos suficientes para gestionar este rol (está por encima de mi rol más alto).' });
            return true;
        }

        if (member.roles.cache.has(config.roleId)) {
            await member.roles.remove(config.roleId);
            await interaction.editReply({ content: `❌ Se te ha **retirado** el rol **${role.name}**.` });
        } else {
            await member.roles.add(config.roleId);
            await interaction.editReply({ content: `✅ ¡Se te ha **asignado** el rol **${role.name}** correctamente!` });
        }

    } catch (error) {
        console.error('❌ Error al gestionar rol por botón:', error);
        await interaction.editReply({ content: '❌ Ocurrió un error al intentar asignar o quitar el rol.' });
    }

    return true;
}
