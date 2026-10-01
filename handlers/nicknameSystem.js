export function setupNicknameSystem(client) {
    // 🛠️ CONFIGURA AQUÍ LAS IDS DE TUS ROLES
    const ROLE_IDS = {
        admin: 'ID_DEL_ROL_ADMIN',
        staff: 'ID_DEL_ROL_STAFF',
        comisario: 'ID_DEL_ROL_COMISARIO'
    };

    const PREFIXES = {
        admin: 'Admin | ',
        staff: 'Staff | ',
        comisario: 'Comisario | '
    };

    const allPrefixes = Object.values(PREFIXES);

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // Comprobamos si alguno de los 3 roles ha cambiado para no disparar en vano
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        
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
        const currentNick = newMember.nickname || newMember.user.username;

        // Limpiamos cualquier prefijo previo gestionado por este sistema para aislar el nombre base
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
            try {
                // Discord limita los apodos a un máximo de 32 caracteres
                let finalNick = desiredNick;
                if (finalNick.length > 32) {
                    const maxBaseLength = 32 - targetPrefix.length;
                    finalNick = `${targetPrefix}${baseName.slice(0, maxBaseLength)}`;
                }

                await newMember.setNickname(finalNick);
                console.log(`✨ Apodo actualizado automáticamente para ${newMember.user.tag}: "${finalNick}"`);
            } catch (error) {
                console.error(`❌ Error al actualizar el apodo de ${newMember.user.tag} (Revisa la jerarquía de roles del bot):`, error);
            }
        }
    });
}
