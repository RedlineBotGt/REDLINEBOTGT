import {
    AuditLogEvent,
    GuildMember
} from 'discord.js';

export async function getRoleOriginLabel(
    member: GuildMember,
    roleId: string
): Promise<string> {
    try {
        let entry: any = null;

        // Discord puede tardar un instante en publicar la entrada de auditoría.
        for (let attempt = 0; attempt < 3 && !entry; attempt++) {
            const logs = await member.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberRoleUpdate,
                limit: 10
            });

            entry = logs.entries.find(item => {
                if (item.target?.id !== member.id) return false;
                if (Date.now() - item.createdTimestamp > 20000) return false;

                const added = item.changes?.some(change =>
                    change.key === '$add' &&
                    Array.isArray(change.new) &&
                    change.new.some((role: any) => role.id === roleId)
                );

                return Boolean(added);
            }) || null;

            if (!entry && attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 700));
            }
        }

        if (!entry) return 'Manual · responsable no disponible';

        // Las asignaciones realizadas por el bot incluyen el canal de origen
        // en el motivo de auditoría.
        if (entry.executor?.id === member.client.user?.id) {
            const match = entry.reason?.match(/Canal ID:\s*(\d+)/i);
            if (match) {
                const channel = await member.guild.channels.fetch(match[1]).catch(() => null);
                if (channel) return `#${'name' in channel ? channel.name : 'canal'}`;
            }

            return 'Automático';
        }

        if (!entry.executor) return 'Manual · responsable no disponible';

        const executor = await member.guild.members.fetch(entry.executor.id).catch(() => null);
        const name = executor?.displayName || entry.executor?.globalName || entry.executor?.username;

        return name ? `Manual · ${name}` : 'Manual · responsable no disponible';
    } catch (error) {
        console.warn('[AVISOS] No se pudo consultar el origen del rol:', error);
        return 'Manual · responsable no disponible';
    }
}
