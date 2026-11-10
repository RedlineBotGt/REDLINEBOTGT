import {
    ActionRowBuilder,
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
    Guild
} from 'discord.js';


const NAME_CACHE_DURATION = 60 * 60 * 1000;
const NAME_ERROR_CACHE_DURATION = 60 * 1000;

const participantNameCache = new Map<string, {
    name: string;
    expiresAt: number;
}>();

const participantNamePending = new Map<string, Promise<string>>();

async function resolveParticipantName(
    userId: string,
    guild?: Guild | null
): Promise<string> {
    const guildId = guild?.id || "unknown";
    const cacheKey = `${guildId}:${userId}`;
    const cached = participantNameCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) return cached.name;

    const pending = participantNamePending.get(cacheKey);
    if (pending) return pending;

    const request = (async () => {
        let name = "";

        if (guild) {
            // 1. Apodo del miembro en el servidor.
            let member = guild.members.cache.get(userId) || null;

            if (!member) {
                member = await guild.members.fetch(userId).catch(() => null);
            }

            if (member) {
                name =
                    member.nickname ||
                    member.user.globalName ||
                    member.user.username ||
                    "";
            }

            // 2. Si no se obtiene el miembro, consultar el usuario global.
            if (!name) {
                const user = await guild.client.users.fetch(userId).catch(() => null);

                if (user) {
                    name = user.globalName || user.username || "";
                }
            }
        }

        // Último recurso, igual que en WEBLINEGT.
        return name || userId;
    })().then(name => {
        participantNameCache.set(cacheKey, {
            name,
            expiresAt: Date.now() + (
                name === userId ? NAME_ERROR_CACHE_DURATION : NAME_CACHE_DURATION
            )
        });
        return name;
    }).catch(error => {
        console.error(`No se pudo resolver el nombre del participante ${userId}:`, error);
        participantNameCache.set(cacheKey, {
            name: userId,
            expiresAt: Date.now() + NAME_ERROR_CACHE_DURATION
        });
        return userId;
    }).finally(() => {
        participantNamePending.delete(cacheKey);
    });

    participantNamePending.set(cacheKey, request);
    return request;
}

async function resolveParticipantNames(
    ids: string[],
    guild?: Guild | null
): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(ids.map(id => String(id)))];
    const names = new Map<string, string>();
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < uniqueIds.length) {
            const index = nextIndex++;
            const userId = uniqueIds[index];
            names.set(userId, await resolveParticipantName(userId, guild));
        }
    };

    await Promise.all(
        Array.from({ length: Math.min(4, uniqueIds.length) }, () => worker())
    );

    return names;
}

export async function buildEventEmbedAndRows(ev: any, guild?: Guild | null) {
    const rsvps = ev.rsvps || {};
    const yesList: string[] = Array.isArray(rsvps.yes) ? rsvps.yes : [];
    const reserveList: string[] = Array.isArray(rsvps.reserve) ? rsvps.reserve : [];
    const maybeList: string[] = Array.isArray(rsvps.maybe) ? rsvps.maybe : [];
    const noList: string[] = Array.isArray(rsvps.no) ? rsvps.no : [];

    const allParticipantIds = [
        ...yesList,
        ...reserveList,
        ...maybeList,
        ...noList
    ];

    const participantNames = await resolveParticipantNames(
        allParticipantIds,
        guild
    );

    // Mismo orden de nombres que WEBLINEGT: apodo > nombre global > username > ID.
    // Se muestran como texto normal, sin menciones.
    const formatVerticalList = (ids: string[]) => {
        if (!ids || ids.length === 0) return 'Ninguno';

        return ids
            .map(id => participantNames.get(String(id)) || String(id))
            .join('\n');
    };

    const isClosed = ev.status === 'completed' || ev.status === 'cancelled';

    const updatedTime = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());

    const embed = new EmbedBuilder()
        .setColor(isClosed ? 0x808080 : 0x0055FF)
        .setTitle(isClosed ? `🔒 [FINALIZADO] ${ev.title}` : `🏁 ${ev.title}`)
        .setDescription(`📅 **Fecha:** ${ev.date || 'Por determinar'} a las ${ev.time || '00:00'} CET\\n\\n${ev.description || 'Sin descripción'}`);

    if (ev.image && typeof ev.image === 'string' && ev.image.startsWith('http')) {
        embed.setImage(ev.image);
    }

    embed.addFields(
        {
            name: '\u200B',
            value: `**🕒 ACTUALIZADO · HOY A LAS ${updatedTime}**`,
            inline: false
        },
        {
            name: `✅ Titulares (${yesList.length}/15)`,
            value: formatVerticalList(yesList),
            inline: false
        },
        {
            name: `🔃 Reservas (${reserveList.length}/11)`,
            value: formatVerticalList(reserveList),
            inline: false
        },
        {
            name: `❔ Duda (${maybeList.length})`,
            value: formatVerticalList(maybeList),
            inline: false
        },
        {
            name: `❌ No puedo (${noList.length})`,
            value: formatVerticalList(noList),
            inline: false
        }
    );

    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_rsvp_yes')
            .setLabel('Titulares')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(isClosed),

        new ButtonBuilder()
            .setCustomId('event_rsvp_reserve')
            .setLabel('Reserva')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔃')
            .setDisabled(isClosed),

        new ButtonBuilder()
            .setCustomId('event_rsvp_maybe')
            .setLabel('Duda')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓')
            .setDisabled(isClosed),

        new ButtonBuilder()
            .setCustomId('event_rsvp_no')
            .setLabel('No puedo')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️')
            .setDisabled(isClosed)
    );

    const rowAdmin = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('event_admin_manage')
            .setLabel('Gestión Admin')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️')
            .setDisabled(isClosed)
    );

    return {
        embed,
        components: isClosed ? [rowRsvp] : [rowRsvp, rowAdmin]
    };
}
