import { Client, GuildMember } from 'discord.js';

// 🛠️ CONFIGURACIÓN DE ROLES Y PREFIJOS
const ROLE_IDS = {
    admin: '1553478496343429150',
    staff: '1555295354377998408',
    comisario: '1553479676704592022'
};

const PREFIXES = {
    admin: 'Admin | ',
    staff: 'Staff | ',
    comisario: 'Comisario | '
};

const allPrefixes = Object.values(PREFIXES);

/**
 * Inicializa el sistema de apodos automáticos escuchando el evento guildMemberUpdate.
 */
export function setupNicknameSystem(client: Client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
            // Asegurarnos de que el miembro esté cacheado correctamente
            const oldMemberObj = oldMember as GuildMember;
            const newMemberObj = newMember as GuildMember;

            const oldRoles = oldMemberObj.roles.cache;
            const newRoles = newMemberObj.roles.cache;

            // Comprobamos si alguno de los 3 roles ha cambiado
            const rolesChanged = 
                oldRoles.has(ROLE_IDS.admin) !== newRoles.has(ROLE_IDS.admin) ||
                oldRoles.has(ROLE_IDS.staff) !== newRoles.has(ROLE_IDS.staff) ||
                oldRoles.has(ROLE_IDS.comisario) !== newRoles.has(ROLE_IDS.comisario);

            if (!rolesChanged) return;

            // Determinamos el prefijo según la jerarquía (Admin > Staff > Comisario)
            let targetPrefix = '';
            if (newRoles.has(ROLE_IDS.admin)) {
                targetPrefix = PREFIXES.admin;
            } else if (newRoles.has(ROLE_IDS.staff)) {
                targetPrefix = PREFIXES.staff;
            } else if (newRoles.has(ROLE_IDS.comisario)) {
                targetPrefix = PREFIXES.comisario;
            }

            // Obtenemos el apodo actual o el nombre de usuario si no tiene apodo
            const currentNick = newMemberObj.nickname || newMemberObj.user.username;

            // Limpiamos cualquier prefijo previo gestionado por este sistema
            let baseName = currentNick;
            for (const prefix of allPrefixes) {
                if (baseName.startsWith(prefix)) {
                    baseName = baseName.slice(prefix.length);
                    break;
                }
            }

            // Construimos el apodo deseado
            const desiredNick = targetPrefix ? `${targetPrefix}${baseName}` : baseName;

            // Si el apodo resultante es diferente al actual, lo aplicamos
            if (currentNick !== desiredNick) {
                let finalNick = desiredNick;
                
                // Discord limita los apodos a un máximo de 32 caracteres
                if (finalNick.length > 32) {
                    const maxBaseLength = 32 - targetPrefix.length;
                    finalNick = `${targetPrefix}${baseName.slice(0, maxBaseLength)}`;
                }

                await newMemberObj.setNickname(finalNick);
                console.log(`✨ Apodo actualizado automáticamente para ${newMemberObj.user.tag}: "${finalNick}"`);
            }
        } catch (error) {
            console.error(`❌ Error al actualizar el apodo de ${newMember?.user?.tag || 'usuario'}:`, error);
        }
    });

    console.log('🏷️ [NicknameSystem] Sistema de apodos automáticos iniciado correctamente.');
}
