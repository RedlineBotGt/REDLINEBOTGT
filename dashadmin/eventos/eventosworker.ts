import { Client, TextChannel, Role } from 'discord.js';
import { getEventsCollection } from './eventosstorage';

/**
 * Obtiene o crea el rol 'asistente' asegurándose de que esté disponible y sea mencionable.
 */
async function getOrCreateAsistenteRole(guild: any): Promise<Role | null> {
    try {
        await guild.roles.fetch();
        let role = guild.roles.cache.find((r: Role) => r.name.toLowerCase() === 'asistente');

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

export function setupEventWorker(client: Client) {
    console.log('📅 [Worker] Sistema de eventos y campeonatos activo en segundo plano.');

    setInterval(async () => {
        try {
            const col = await getEventsCollection();
            const now = new Date();

            // 1. Recordatorio 30 minutos antes (con buffer de seguridad para evitar saltos)
            const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);
            const bufferTime = new Date(now.getTime() - 5 * 60 * 1000);

            const upcomingEvents = await col.find({
                status: { $in: ['pending', 'sent'] },
                reminderSent: { $ne: true },
                scheduledAt: { $lte: thirtyMinsLater,$gte: bufferTime }
            }).toArray();

            for (const ev of upcomingEvents) {
                try {
                    if (ev.status === 'cancelled') continue;

                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (!guild) continue;

                    const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;
                    if (!channel || !channel.isTextBased()) continue;

                    const asistenteRole = await getOrCreateAsistenteRole(guild);
                    const roleMention = asistenteRole ? `<@&${asistenteRole.id}>` : '@asistente';

                    await channel.send({
                        content: `⏰ **¡Atención!** El evento **"${ev.title}"** comienza en **30 minutos**. ${roleMention}`,
                        allowedMentions: { roles: asistenteRole ? [asistenteRole.id] : [] }
                    });

                    await col.updateOne({ _id: ev._id }, { $set: { reminderSent: true } });
                    console.log(`⏰ [Worker] Recordatorio de 30 min enviado para: "${ev.title}"`);
                } catch (remErr) {
                    console.error('❌ Error enviando recordatorio de evento:', remErr);
                }
            }

            // 2. Llegada de la hora exacta del evento -> Anuncio de inicio + Despojo de rol asistente
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
                        const roleMention = asistenteRole ? `<@&${asistenteRole.id}>` : '@asistente';

                        // ➔ PRIMERO: Enviar el mensaje de inicio mencionando correctamente al rol
                        if (channel && channel.isTextBased()) {
                            await channel.send({
                                content: `🏁 **¡El evento "${ev.title}" COMIENZA AHORA!** ${roleMention}`,
                                allowedMentions: { roles: asistenteRole ? [asistenteRole.id] : [] }
                            }).catch(() => {});
                        }

                        // ➔ SEGUNDO: Una vez enviado el mensaje, retirar el rol a todos los usuarios
                        if (asistenteRole) {
                            await guild.members.fetch();
                            for (const [, member] of guild.members.cache) {
                                if (member.roles.cache.has(asistenteRole.id)) {
                                    await member.roles.remove(asistenteRole).catch(() => {});
                                }
                            }
                            console.log(`🧹 [Worker] Rol asistente retirado tras el inicio de: "${ev.title}"`);
                        }
                    }

                    if (ev.repeats && ev.remainingTimes > 1) {
                        const nextScheduledAt = new Date(new Date(ev.scheduledAt).getTime() + ev.intervalMs);

                        await col.updateOne(
                            { _id: ev._id },
                            { 
                                $set: {                                      scheduledAt: nextScheduledAt,                                      messageId: undefined,                                      reminderSent: false,                                      rsvps: { yes: [], maybe: [], no: [] }                                  },$inc: { remainingTimes: -1 } 
                            }
                        );
                    } else {
                        await col.updateOne(
                            { _id: ev._id },
                            { $set: { status: 'completed', completedAt: new Date() } }
                        );
                        console.log(`✅ [Worker] Evento "${ev.title}" completado y archivado.`);
                    }

                } catch (err) {
                    console.error(`❌ [Worker] Error finalizando evento ID ${ev._id}:`, err);
                }
            }

        } catch (error) {
            console.error('❌ Error general en el worker de eventos:', error);
        }
    }, 60000);
}
