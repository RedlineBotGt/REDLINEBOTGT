import {
    Client,
    TextChannel,
    Role,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import { getEventsCollection } from './eventosstorage';
import { buildEventEmbedAndRows } from './eventosmanager';

/**
 * Obtiene o crea el rol 'asistente' asegurándose de que esté disponible y sea mencionable.
 */
async function getOrCreateAsistenteRole(guild: any): Promise<Role | null> {
    try {
        await guild.roles.fetch();

        let role = guild.roles.cache.find(
            (r: Role) => r.name.toLowerCase() === 'asistente'
        );

        if (!role) {
            role = await guild.roles.create({
                name: 'asistente',
                color: 0x00FF00,
                mentionable: true,
                reason: 'Rol automático creado para gestión de asistencias a eventos.'
            });
        } else if (!role.mentionable) {
            await role.setMentionable(true).catch(() => {});
        }

        return role;
    } catch (err) {
        console.error('❌ Error gestionando rol asistente en el worker:', err);
        return null;
    }
}

/**
 * Genera menciones individuales de los pilotos de una lista.
 * No utiliza @asistente, para poder separar titulares y reservas.
 */
function crearMencionesPilotos(userIds: string[]): string {
    return userIds
        .filter((id: string) => typeof id === 'string' && id.length > 0)
        .map((id: string) => `<@${id}>`)
        .join(', ');
}

export function setupEventWorker(client: Client) {
    console.log('📅 [Worker] Sistema de eventos y campeonatos (Titulares y Reservas) activo en segundo plano.');

    setInterval(async () => {
        try {
            const col = await getEventsCollection();
            const now = new Date();

            // -------------------------------------------------------------
            // TAREA 0: Completar metadatos de eventos ya existentes
            // No se recrean eventos ni se modifican sus mensajes.
            // -------------------------------------------------------------
            const eventsWithoutMetadata = await col.find({
                status: 'sent',
                $or: [
                    { channelName: { $exists: false } },
                    { remainingRepetitions: { $exists: false } }
                ]
            }).toArray();

            for (const ev of eventsWithoutMetadata) {
                try {
                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (!guild) continue;

                    const channel = await guild.channels.fetch(ev.channelId).catch(() => null);

                    const fieldsToUpdate: any = {
                        updatedAt: new Date()
                    };

                    if (ev.channelName === undefined || ev.channelName === null) {
                        if (channel && 'name' in channel) {
                            fieldsToUpdate.channelName = channel.name;
                        }
                    }

                    if (ev.remainingRepetitions === undefined || ev.remainingRepetitions === null) {
                        fieldsToUpdate.remainingRepetitions = ev.repeats
                            ? Math.max(Number(ev.remainingTimes || 1) - 1, 0)
                            : 0;
                    }

                    if (Object.keys(fieldsToUpdate).length > 1) {
                        await col.updateOne(
                            { _id: ev._id, status: 'sent' },
                            { $set: fieldsToUpdate }
                        );

                        console.log(
                            `📝 [Worker] Metadatos actualizados para "${ev.title}".`
                        );
                    }
                } catch (metadataErr) {
                    console.error(
                        `❌ Error actualizando metadatos del evento ${ev._id}:`,
                        metadataErr
                    );
                }
            }

            // -------------------------------------------------------------
            // TAREA 1: Publicación Programada de Tarjetas de Evento
            // -------------------------------------------------------------
            const pendingPublishEvents = await col.find({
                status: 'pending_publish',
                publishAt: { $lte: now }
            }).toArray();

            for (const ev of pendingPublishEvents) {
                try {
                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (!guild) continue;

                    const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;

                    if (!channel || !channel.isTextBased()) continue;

                    if (!ev.rsvps) {
                        ev.rsvps = {
                            yes: [],
                            reserve: [],
                            maybe: [],
                            no: []
                        };
                    }

                    if (!ev.rsvps.reserve) ev.rsvps.reserve = [];

                    const dummyEventDoc = {
                        title: ev.title,
                        date: ev.date,
                        time: ev.time,
                        description: ev.description,
                        image: ev.image,
                        status: 'sent',
                        rsvps: ev.rsvps
                    };

                    const { embed, components } = await buildEventEmbedAndRows(dummyEventDoc, guild);

                    const sentMessage = await channel.send({
                        content: `<@&${ev.roleId}>`,
                        embeds: [embed],
                        components
                    });

                    const remainingTimes = Number(ev.remainingTimes || 1);

                    await col.updateOne(
                        { _id: ev._id },
                        {
                            $set: {
                                messageId: sentMessage.id,
                                status: 'sent',
                                channelName: channel.name,
                                remainingRepetitions: ev.repeats
                                    ? Math.max(remainingTimes - 1, 0)
                                    : 0,
                                rsvps: ev.rsvps,
                                updatedAt: new Date()
                            }
                        }
                    );

                    console.log(
                        `🚀 [Worker] Evento "${ev.title}" publicado automáticamente.`
                    );

                } catch (pubErr) {
                    console.error(
                        `❌ [Worker] Error al publicar evento programado ID ${ev._id}:`,
                        pubErr
                    );
                }
            }
            // -------------------------------------------------------------
            // TAREA 2: Recordatorio T-30 + Promoción Automática de Reservas
            // -------------------------------------------------------------
            const thirtyMinsLater = new Date(
                now.getTime() + 30 * 60 * 1000
            );

            const bufferTime = new Date(
                now.getTime() - 5 * 60 * 1000
            );

            const upcomingEvents = await col.find({
                status: { $in: ['pending', 'sent'] },
                reminderSent: { $ne: true },
                scheduledAt: {
                    $lte: thirtyMinsLater,
                    $gte: bufferTime
                }
            }).toArray();

            for (const ev of upcomingEvents) {
                try {
                    if (ev.status === 'cancelled') continue;

                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (!guild) continue;

                    const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;

                    if (!channel || !channel.isTextBased()) continue;

                    if (!ev.rsvps) {
                        ev.rsvps = {
                            yes: [],
                            reserve: [],
                            maybe: [],
                            no: []
                        };
                    }

                    if (!ev.rsvps.reserve) ev.rsvps.reserve = [];

                    // 🔄 AUTOMATIZACIÓN T-30
                    // Máximo de 15 titulares.
                    // Las reservas que no entran permanecen en reserva.
                    const MAX_TITULARES = 15;

                    const huecosLibres = Math.max(
                        MAX_TITULARES - ev.rsvps.yes.length,
                        0
                    );

                    let promovidosCount = 0;

                    if (huecosLibres > 0 && ev.rsvps.reserve.length > 0) {
                        const aPromover = ev.rsvps.reserve.splice(0, huecosLibres);

                        ev.rsvps.yes.push(...aPromover);

                        promovidosCount = aPromover.length;

                        console.log(
                            `🔃 [Worker] T-30: Se han promovido ${promovidosCount} pilotos de reserva a titulares para "${ev.title}".`
                        );
                    }

                    // Guardar las listas definitivas antes de enviar los avisos.
                    await col.updateOne(
                        { _id: ev._id },
                        {
                            $set: {
                                rsvps: ev.rsvps,
                                reminderSent: true,
                                updatedAt: new Date()
                            }
                        }
                    );

                    // Actualizar visualmente la tarjeta en Discord.
                    if (ev.messageId) {
                        const message = await channel.messages.fetch(ev.messageId).catch(() => null);

                        if (message) {
                            const { embed, components } = await buildEventEmbedAndRows(ev, guild);

                            await message.edit({
                                embeds: [embed],
                                components
                            }).catch(() => {});
                        }
                    }

                    // -----------------------------------------------------
                    // AVISO 1: TITULARES CONFIRMADOS
                    // Incluye los titulares originales y los promocionados.
                    // -----------------------------------------------------
                    const titulares = crearMencionesPilotos(ev.rsvps.yes);

                    if (titulares) {
                        await channel.send({
                            content:
                                `⏰ **¡Confirmación de titulares!**\n` +
                                `El evento **"${ev.title}"** comienza en **30 minutos**.\n\n` +
                                `🏁 Estos son los pilotos que tienen plaza y correrán:\n${titulares}`,
                            allowedMentions: {
                                users: ev.rsvps.yes
                            }
                        });
                    }

                    // -----------------------------------------------------
                    // AVISO 2: RESERVAS QUE SIGUEN EN ESPERA
                    // Permanecen en reserva por si se produce una baja.
                    // -----------------------------------------------------
                    const reservas = crearMencionesPilotos(ev.rsvps.reserve);

                    if (reservas) {
                        await channel.send({
                            content:
                                `📋 **Lista de reservas - "${ev.title}"**\n` +
                                `El evento comienza en **30 minutos**.\n\n` +
                                `Estos pilotos continúan en reserva y todavía no tienen plaza:\n${reservas}\n\n` +
                                `⚠️ **Permaneced atentos:** si se produce una baja de última hora, podréis entrar por orden de inscripción.`,
                            allowedMentions: {
                                users: ev.rsvps.reserve
                            }
                        });
                    }

                    console.log(
                        `⏰ [Worker] T-30 completado para "${ev.title}". Titulares: ${ev.rsvps.yes.length}. Reservas pendientes: ${ev.rsvps.reserve.length}. Promocionados: ${promovidosCount}.`
                    );

                } catch (remErr) {
                    console.error(
                        '❌ Error en el proceso T-30 del evento:',
                        remErr
                    );
                }
            }

            // -------------------------------------------------------------
            // TAREA 3: Llegada de la hora exacta
            // Anuncio + Limpieza + Cierre de tarjeta + Recurrencia
            // -------------------------------------------------------------
            const dueEvents = await col.find({
                status: { $in: ['pending', 'sent'] },
                scheduledAt: { $lte: now }
            }).toArray();

            for (const ev of dueEvents) {
                try {
                    if (ev.status === 'cancelled') continue;

                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);

                    if (guild) {
                        const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;

                        const asistenteRole = await getOrCreateAsistenteRole(guild);

                        if (channel && channel.isTextBased()) {
                            await channel.send({
                                content: `🏁 **¡El evento "${ev.title}" COMIENZA AHORA!**`
                            }).catch(() => {});
                        }

                        // 🧹 Limpieza completa del rol asistente.
                        // Se mantiene el comportamiento actual.
                        if (asistenteRole) {
                            const members = await guild.members.fetch().catch(() => null);

                            if (members) {
                                for (const [, member] of members) {
                                    if (member.roles.cache.has(asistenteRole.id)) {
                                        await member.roles.remove(asistenteRole).catch(() => {});
                                    }
                                }
                            }

                            console.log(
                                `🧹 [Worker] Rol asistente retirado tras el inicio de: "${ev.title}"`
                            );
                        }

                        // 🔒 Bloquear botones y cerrar tarjeta visual en Discord.
                        if (ev.channelId && ev.messageId) {
                            const channelEdit = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;

                            if (channelEdit && channelEdit.isTextBased()) {
                                const message = await channelEdit.messages.fetch(ev.messageId).catch(() => null);

                                if (message) {
                                    const embedClosed = EmbedBuilder
                                        .from(message.embeds[0] || {})
                                        .setTitle(`🔒 [FINALIZADO] ${ev.title}`)
                                        .setColor(0x808080);

                                    const rowDisabledRsvp = new ActionRowBuilder<ButtonBuilder>()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setCustomId('event_rsvp_yes')
                                                .setLabel('Asistiré')
                                                .setStyle(ButtonStyle.Success)
                                                .setEmoji('✅')
                                                .setDisabled(true),

                                            new ButtonBuilder()
                                                .setCustomId('event_rsvp_reserve')
                                                .setLabel('Reserva')
                                                .setStyle(ButtonStyle.Primary)
                                                .setEmoji('®️')
                                                .setDisabled(true),

                                            new ButtonBuilder()
                                                .setCustomId('event_rsvp_maybe')
                                                .setLabel('Duda')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setEmoji('❓')
                                                .setDisabled(true),

                                            new ButtonBuilder()
                                                .setCustomId('event_rsvp_no')
                                                .setLabel('No puedo')
                                                .setStyle(ButtonStyle.Danger)
                                                .setEmoji('✖️')
                                                .setDisabled(true)
                                        );

                                    await message.edit({
                                        embeds: [embedClosed],
                                        components: [rowDisabledRsvp]
                                    }).catch(() => {});
                                }
                            }
                        }
                    }

                    // -----------------------------------------------------
                    // RECURRENCIA
                    // -----------------------------------------------------
                    if (ev.repeats && Number(ev.remainingTimes) > 1) {
                        const nextScheduledAt = new Date(
                            new Date(ev.scheduledAt).getTime() + ev.intervalMs
                        );

                        const nextPublishAt = ev.publishAt
                            ? new Date(
                                new Date(ev.publishAt).getTime() + ev.intervalMs
                            )
                            : nextScheduledAt;

                        const nextRemainingTimes = Number(ev.remainingTimes) - 1;

                        await col.updateOne(
                            { _id: ev._id },
                            {
                                $set: {
                                    scheduledAt: nextScheduledAt,
                                    publishAt: nextPublishAt,
                                    status: 'pending_publish',
                                    messageId: null,
                                    reminderSent: false,
                                    remainingRepetitions: nextRemainingTimes,
                                    rsvps: {
                                        yes: [],
                                        reserve: [],
                                        maybe: [],
                                        no: []
                                    },
                                    updatedAt: new Date()
                                },
                                $inc: {
                                    remainingTimes: -1
                                }
                            }
                        );

                        console.log(
                            `🔄 [Worker] Evento recurrente "${ev.title}" cerrado y reprogramado. Quedan ${nextRemainingTimes} envíos pendientes.`
                        );

                    } else {
                        await col.updateOne(
                            { _id: ev._id },
                            {
                                $set: {
                                    status: 'completed',
                                    remainingRepetitions: 0,
                                    completedAt: new Date(),
                                    updatedAt: new Date()
                                }
                            }
                        );

                        console.log(
                            `✅ [Worker] Evento "${ev.title}" archivado y cerrado.`
                        );
                    }

                } catch (err) {
                    console.error(
                        `❌ [Worker] Error finalizando evento ID ${ev._id}:`,
                        err
                    );
                }
            }

        } catch (error) {
            console.error(
                '❌ Error general en el worker de eventos:',
                error
            );
        }

    }, 60000);
}