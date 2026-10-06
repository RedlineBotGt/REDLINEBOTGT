import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ChannelType, 
    ModalSubmitInteraction, 
    MessageFlags
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let eventsCollection: any = null;

export async function getEventsCollection() {
    if (!eventsCollection) {
        await clientMongo.connect();
        eventsCollection = clientMongo.db('redline_bot').collection('event_jobs');
        console.log('📅 [MongoDB] Conectado al sistema de eventos de simracing.');
    }
    return eventsCollection;
}

export const eventSessions = new Map<string, any>();

export async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_event_create') return false;

    eventSessions.set(interaction.user.id, {});

    const modal = new ModalBuilder()
        .setCustomId('modal_event_create')
        .setTitle('📅 Crear Evento / Campeonato (1/4)');

    const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Título del Evento')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: GP de España - F1 / GT3...')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('event_desc')
        .setLabel('Descripción / Detalles del Evento')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Horarios, normativa, circuitos...')
        .setRequired(true);

    const imageInput = new TextInputBuilder()
        .setCustomId('event_image')
        .setLabel('URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://...')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );

    await interaction.showModal(modal);
    return true;
}

export async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const title = interaction.fields.getTextInputValue('event_title');
    const description = interaction.fields.getTextInputValue('event_desc');
    const image = interaction.fields.getTextInputValue('event_image').trim();

    eventSessions.set(interaction.user.id, { title, description, image: image || null });

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('event_select_channel')
        .setPlaceholder('📢 Selecciona el canal para publicar el evento...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '📅 **Organizador de Eventos (2/4):** Selecciona el canal de destino:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
import { 
    RoleSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    MessageFlags,
    TextChannel,
    EmbedBuilder
} from 'discord.js';

export async function handleEventChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_channel') return false;

    const channelId = interaction.values[0];
    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    session.channelId = channelId;

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('event_select_role')
        .setPlaceholder('🏷️ Selecciona el rol del campeonato a mencionar...');

    const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const rowSkip = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_skip_role').setLabel('Omitir mención de rol').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
        content: `📢 Canal seleccionado (<#${channelId}>).\n**Paso 3/3:** Selecciona el rol del campeonato a mencionar:`,
        components: [rowRole, rowSkip]
    });

    return true;
}

export async function handleEventRoleSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_role' && interaction.customId !== 'event_skip_role') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        if (interaction.isRepliable()) {
            await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        }
        return true;
    }

    if (interaction.isRoleSelectMenu()) {
        session.roleId = interaction.values[0];
    } else {
        session.roleId = null;
    }

    // 🚀 Solo 2 botones: Publicar Directamente y Repetir / Intervalo
    const rowModes = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_publish_now').setLabel('🚀 Publicar Directamente').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('event_repeat_yes').setLabel('🔄 Repetir / Intervalo').setStyle(ButtonStyle.Primary)
    );

    const contentMsg = '📅 **Paso Final:** ¿Cómo deseas publicar este evento?';

    if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
        await interaction.followUp({ content: contentMsg, components: [rowModes], flags: [MessageFlags.Ephemeral] });
    } else if (interaction.isRepliable()) {
        await interaction.update({ content: contentMsg, components: [rowModes] });
    }

    return true;
}

export async function handleEventPublishNowButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_publish_now') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada o ya procesada. Vuelve a iniciar el formulario.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply({ content: '❌ Error: Servidor no encontrado.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const channel = await guild.channels.fetch(session.channelId).catch(() => null) as TextChannel;
    if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: '❌ Canal de destino no válido o no accesible.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const embed = new EmbedBuilder()
            .setColor(0x0055FF)
            .setTitle(`🏁 ${session.title}`)
            .setDescription(session.description)
            .setTimestamp();

        if (session.image && typeof session.image === 'string' && session.image.startsWith('http')) {
            embed.setImage(session.image);
        }

        embed.addFields(
            { name: '✔️ Me Apunto (0)', value: 'Ninguno', inline: false },
            { name: '❔ Duda (0)', value: 'Ninguno', inline: false },
            { name: '✖️ No puedo (0)', value: 'Ninguno', inline: false }
        );

        const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Me Apunto').setStyle(ButtonStyle.Success).setEmoji('✔️'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        let contentToSend: string | undefined = undefined;
        if (session.roleId && typeof session.roleId === 'string' && session.roleId !== 'null' && session.roleId !== 'undefined' && /^\d+$/.test(session.roleId)) {
            contentToSend = `<@&${session.roleId}>`;
        }

        const sentMessage = await channel.send({
            content: contentToSend,
            embeds: [embed],
            components: [rowRsvp]
        });

        const col = await getEventsCollection();
        await col.insertOne({
            guildId: guild.id,
            userId: interaction.user.id,
            title: session.title,
            description: session.description,
            image: session.image,
            channelId: session.channelId,
            roleId: session.roleId,
            scheduledAt: new Date(),
            status: 'sent',
            messageId: sentMessage.id,
            sentAt: new Date(),
            rsvps: { yes: [], maybe: [], no: [] },
            createdAt: new Date()
        });

        eventSessions.delete(interaction.user.id);

        await interaction.update({
            content: `🚀 **¡Evento publicado directamente con éxito en <#${session.channelId}>!**`,
            components: []
        });
    } catch (error) {
        console.error('❌ Error publicando evento directamente:', error);
        await interaction.update({
            content: '❌ Error al publicar el evento en el canal.',
            components: []
        }).catch(() => {});
    }

    return true;
}
import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ModalSubmitInteraction, 
    EmbedBuilder 
} from 'discord.js';

export async function handleEventRepeatYesButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_repeat_yes') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_repeat')
        .setTitle('Configurar Evento con Intervalo');

    const dateInput = new TextInputBuilder()
        .setCustomId('event_first_date')
        .setLabel('📅 Fecha 1ª publicación (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 15/10/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_first_time')
        .setLabel('⏰ Hora 1ª publicación (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    const intervalInput = new TextInputBuilder()
        .setCustomId('event_interval_hm')
        .setLabel('Intervalo (Horas:Minutos o Días:Horas)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 2:30 (o bien 1:0:0)')
        .setRequired(true);

    const timesInput = new TextInputBuilder()
        .setCustomId('event_repeat_times')
        .setLabel('Nº total de envíos (ej: 3)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 3')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(intervalInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
    );

    await interaction.showModal(modal);
    return true;
}

function parseMadridDateTime(dateStr: string, timeStr: string): Date | null {
    try {
        const [day, month, year] = dateStr.split('/').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);

        if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return null;

        const targetString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
        const tempDate = new Date(targetString);
        if (isNaN(tempDate.getTime())) return null;

        const madridOffsetMinutes = getMadridOffsetMinutes(tempDate);
        const finalTimestamp = tempDate.getTime() - (madridOffsetMinutes * 60 * 1000);

        const targetDate = new Date(finalTimestamp);
        return isNaN(targetDate.getTime()) ? null : targetDate;
    } catch (error) {
        console.error('❌ Error al parsear fecha de Madrid:', error);
        return null;
    }
}

function getMadridOffsetMinutes(date: Date): number {
    const madridDateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);

    const [datePart, timePart] = madridDateStr.split(', ');
    const [m, d, y] = datePart.split('/').map(Number);
    const [h, min] = timePart.split(':').map(Number);

    const asUTC = Date.UTC(y, m - 1, d, h, min, 0);
    const diffMs = asUTC - date.getTime();
    return Math.round(diffMs / (1000 * 60));
}

export async function handleEventRepeatModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_repeat') return false;

    const dateStr = interaction.fields.getTextInputValue('event_first_date').trim();
    const timeStr = interaction.fields.getTextInputValue('event_first_time').trim();
    const intervalStr = interaction.fields.getTextInputValue('event_interval_hm').trim();
    const timesStr = interaction.fields.getTextInputValue('event_repeat_times').trim();

    const scheduledAt = parseMadridDateTime(dateStr, timeStr);
    if (!scheduledAt || isNaN(scheduledAt.getTime())) {
        await interaction.reply({ content: '❌ Fecha u hora de la 1ª publicación inválida.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const parts = intervalStr.split(':').map(Number);
    let intervalMs = 0;

    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        intervalMs = (parts[0] * 3600000) + (parts[1] * 60000);
    } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        intervalMs = (parts[0] * 86400000) + (parts[1] * 3600000) + (parts[2] * 60000);
    }

    if (intervalMs <= 0) {
        await interaction.reply({ content: '❌ Formato de intervalo inválido. Usa por ejemplo `2:30`.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const totalTimes = parseInt(timesStr, 10);
    if (isNaN(totalTimes) || totalTimes < 2) {
        await interaction.reply({ content: '❌ Indica un número total de envíos válido (al menos 2).', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const col = await getEventsCollection();
        await col.insertOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            title: session.title,
            description: session.description,
            image: session.image,
            channelId: session.channelId,
            roleId: session.roleId,
            scheduledAt,
            date: dateStr,
            time: timeStr,
            repeats: true,
            intervalMs,
            remainingTimes: totalTimes,
            status: 'pending',
            rsvps: { yes: [], maybe: [], no: [] },
            createdAt: new Date()
        });

        eventSessions.delete(interaction.user.id);

        await interaction.reply({
            content: `✅ **¡Evento recurrente configurado con éxito!**\n• 1ª Publicación: **${dateStr}** a las **${timeStr}**\n• Intervalo: Cada **${intervalStr}**\n• Total de envíos: **${totalTimes}**`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error guardando evento recurrente:', error);
        await interaction.reply({ content: '❌ Error al guardar en base de datos.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

export async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;
    if (!['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(customId)) return false;

    const userId = interaction.user.id;
    const messageId = interaction.message.id;
    const guild = interaction.guild;

    if (!guild) return true;

    const col = await getEventsCollection();
    const eventDoc = await col.findOne({ messageId });

    if (!eventDoc) {
        await interaction.reply({
            content: '❌ Este evento ya no está activo o no se encuentra registrado en la base de datos.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    if (!eventDoc.rsvps) {
        eventDoc.rsvps = { yes: [], maybe: [], no: [] };
    }

    eventDoc.rsvps.yes = eventDoc.rsvps.yes.filter((id: string) => id !== userId);
    eventDoc.rsvps.maybe = eventDoc.rsvps.maybe.filter((id: string) => id !== userId);
    eventDoc.rsvps.no = eventDoc.rsvps.no.filter((id: string) => id !== userId);

    const asistenteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'asistente');
    const member = await guild.members.fetch(userId).catch(() => null);

    let statusText = '';
    if (customId === 'event_rsvp_yes') {
        eventDoc.rsvps.yes.push(userId);
        statusText = 'Me Apunto';
        if (asistenteRole && member) {
            await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (customId === 'event_rsvp_maybe') {
        eventDoc.rsvps.maybe.push(userId);
        statusText = 'Duda';
        if (asistenteRole && member) {
            await member.roles.add(asistenteRole).catch(() => {});
        }
    } else if (customId === 'event_rsvp_no') {
        eventDoc.rsvps.no.push(userId);
        statusText = 'No puedo';
        if (asistenteRole && member && member.roles.cache.has(asistenteRole.id)) {
            await member.roles.remove(asistenteRole).catch(() => {});
        }
    }

    await col.updateOne({ messageId }, { $set: { rsvps: eventDoc.rsvps } });

    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setTitle(`🏁 ${eventDoc.title}`)
        .setDescription(eventDoc.description)
        .setTimestamp();

    if (eventDoc.image) {
        embed.setImage(eventDoc.image);
    }

    const formatList = (ids: string[]) => ids.length > 0 ? ids.map(id => `<@${id}>`).join(', ') : 'Ninguno';

    embed.addFields(
        { name: `✔️ Me Apunto (${eventDoc.rsvps.yes.length})`, value: formatList(eventDoc.rsvps.yes), inline: false },
        { name: `❔ Duda (${eventDoc.rsvps.maybe.length})`, value: formatList(eventDoc.rsvps.maybe), inline: false },
        { name: `✖️ No puedo (${eventDoc.rsvps.no.length})`, value: formatList(eventDoc.rsvps.no), inline: false }
    );

    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Me Apunto').setStyle(ButtonStyle.Success).setEmoji('✔️'),
        new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
    );

    await interaction.message.edit({ embeds: [embed], components: [rowRsvp] }).catch(() => {});

    await interaction.reply({
        content: `✅ ¡Tu asistencia (**${statusText}**) ha quedado registrada y el evento se ha actualizado!`,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function setupEventWorker(client: Client) {
    console.log('📅 [Worker] Sistema de eventos y campeonatos activo en segundo plano.');

    setInterval(async () => {
        try {
            const col = await getEventsCollection();
            const now = new Date();

            // 1. ⏰ GESTIÓN DE RECORDATORIOS (30 minutos antes)
            const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);
            const upcomingEvents = await col.find({
                status: 'pending',
                reminderSent: { $ne: true },
                scheduledAt: { $lte: thirtyMinsLater,$gt: now }
            }).toArray();

            for (const ev of upcomingEvents) {
                try {
                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (!guild) continue;

                    const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;
                    if (!channel || !channel.isTextBased()) continue;

                    const asistenteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'asistente');
                    const roleMention = asistenteRole ? `<@&${asistenteRole.id}>` : '@asistente';

                    await channel.send({
                        content: `⏰ **¡Atención!** El evento **"${ev.title}"** comienza en **30 minutos**. ${roleMention}`
                    });

                    await col.updateOne({ _id: ev._id }, { $set: { reminderSent: true } });
                    console.log(`⏰ [Worker] Recordatorio de 30 min enviado para el evento "${ev.title}".`);
                } catch (remErr) {
                    console.error('❌ Error enviando recordatorio de evento:', remErr);
                }
            }

            // 2. 🚀 GESTIÓN DE PUBLICACIÓN DE EVENTOS RECURRENTES PROGRAMADOS
            const pendingEvents = await col.find({
                status: 'pending',
                scheduledAt: { $lte: now }
            }).toArray();

            if (pendingEvents.length === 0) return;

            for (const ev of pendingEvents) {
                try {
                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (!guild) {
                        await col.updateOne({ _id: ev._id }, { $set: { status: 'guild_not_found' } });
                        continue;
                    }

                    const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;
                    if (!channel || !channel.isTextBased()) {
                        await col.updateOne({ _id: ev._id }, { $set: { status: 'channel_not_found' } });
                        continue;
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x0055FF)
                        .setTitle(`🏁 ${ev.title}`)
                        .setDescription(ev.description)
                        .setTimestamp();

                    if (ev.image && typeof ev.image === 'string' && ev.image.startsWith('http')) {
                        embed.setImage(ev.image);
                    }

                    embed.addFields(
                        { name: '✔️ Me Apunto (0)', value: 'Ninguno', inline: false },
                        { name: '❔ Duda (0)', value: 'Ninguno', inline: false },
                        { name: '✖️ No puedo (0)', value: 'Ninguno', inline: false }
                    );

                    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Me Apunto').setStyle(ButtonStyle.Success).setEmoji('✔️'),
                        new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Duda').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
                        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No puedo').setStyle(ButtonStyle.Danger).setEmoji('✖️')
                    );

                    let contentToSend: string | undefined = undefined;
                    if (ev.roleId && typeof ev.roleId === 'string' && ev.roleId !== 'null' && ev.roleId !== 'undefined' && /^\d+$/.test(ev.roleId)) {
                        contentToSend = `<@&${ev.roleId}>`;
                    }

                    const sentMessage = await channel.send({
                        content: contentToSend,
                        embeds: [embed],
                        components: [rowRsvp]
                    });

                    const asistenteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'asistente');
                    if (asistenteRole) {
                        try {
                            await guild.members.fetch();
                            for (const [, member] of guild.members.cache) {
                                if (member.roles.cache.has(asistenteRole.id)) {
                                    await member.roles.remove(asistenteRole).catch(() => {});
                                }
                            }
                        } catch (roleCleanErr) {
                            console.error('❌ Error barriendo rol asistente:', roleCleanErr);
                        }
                    }

                    await col.updateOne({ _id: ev._id }, { $set: { messageId: sentMessage.id } });

                    if (ev.repeats && ev.remainingTimes > 1) {
                        const baseTime = Math.max(now.getTime(), new Date(ev.scheduledAt).getTime());
                        const nextDate = new Date(baseTime + ev.intervalMs);

                        await col.updateOne(
                            { _id: ev._id },
                            { 
                                $set: { scheduledAt: nextDate, messageId: undefined, reminderSent: false, rsvps: { yes: [], maybe: [], no: [] } },$inc: { remainingTimes: -1 } 
                            }
                        );
                        console.log(`🔄 [Worker] Evento recurrente reprogramado para: ${nextDate}. Quedan ${ev.remainingTimes - 1} envíos.`);
                    } else {
                        await col.updateOne(
                            { _id: ev._id },
                            { $set: { status: 'sent', sentAt: new Date() } }
                        );
                        console.log(`✅ [Worker] Evento "${ev.title}" finalizado.`);
                    }

                } catch (err) {
                    console.error(`❌ [Worker] Error enviando evento ID ${ev._id}:`, err);
                }
            }

        } catch (error) {
            console.error('❌ [Worker] Error general en el worker de eventos:', error);
        }
    }, 60000);
}
