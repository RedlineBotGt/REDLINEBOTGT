import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    ModalSubmitInteraction, 
    Client,
    TextChannel, 
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let eventsCollection: any = null;

async function getEventsCollection() {
    if (!eventsCollection) {
        await clientMongo.connect();
        eventsCollection = clientMongo.db('redline_bot').collection('event_jobs');
        console.log('📅 [MongoDB] Conectado al sistema de eventos de simracing.');
    }
    return eventsCollection;
}

const eventSessions = new Map<string, any>();

// 1. Botón del Dashboard para iniciar la creación de un Evento
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

// 2. Procesar modal de creación y pedir canal
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

// 3. Canal seleccionado -> Pide rol del campeonato
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
        content: `📢 Canal seleccionado (<#${channelId}>).\n**Paso 3/4:** Selecciona el rol del campeonato a mencionar:`,
        components: [rowRole, rowSkip]
    });

    return true;
}

// 4. Rol seleccionado o saltado -> Pregunta si se desea configurar intervalo y repetición
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

    const rowRepeat = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('event_repeat_yes').setLabel('🔄 Sí, configurar intervalo y repetición').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('event_repeat_no').setLabel('⚡ Enviar / Programar única vez').setStyle(ButtonStyle.Secondary)
    );

    const contentMsg = '📅 **Paso 4/4:** ¿Deseas programar este evento para una fecha específica o configurarlo con intervalo recurrente?';

    if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
        await interaction.followUp({ content: contentMsg, components: [rowRepeat], flags: [MessageFlags.Ephemeral] });
    } else if (interaction.isRepliable()) {
        await interaction.update({ content: contentMsg, components: [rowRepeat] });
    }

    return true;
}

// 5A. Si pulsa NO repetir -> Pide fecha y hora única mediante modal rápido
export async function handleEventRepeatNoButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_repeat_no') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_single_datetime')
        .setTitle('Fecha y Hora del Evento');

    const dateInput = new TextInputBuilder()
        .setCustomId('event_date')
        .setLabel('Fecha (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 15/10/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_time')
        .setLabel('Hora peninsular (HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 5B. Si pulsa SÍ repetir -> Abre el Modal con la 1ª publicación + Intervalo (Días, Horas, Minutos) + Nº total
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

    const daysInput = new TextInputBuilder()
        .setCustomId('event_interval_days')
        .setLabel('Intervalo: Días')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 0')
        .setRequired(false);

    const hoursInput = new TextInputBuilder()
        .setCustomId('event_interval_hours')
        .setLabel('Intervalo: Horas')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 2')
        .setRequired(false);

    const minutesInput = new TextInputBuilder()
        .setCustomId('event_interval_minutes')
        .setLabel('Intervalo: Minutos')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 30')
        .setRequired(false);

    const timesInput = new TextInputBuilder()
        .setCustomId('event_repeat_times')
        .setLabel('Nº total de envíos (ej: 3)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 3 (Mínimo 2)')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(hoursInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(minutesInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
    );

    await interaction.showModal(modal);
    return true;
}
// 🌍 Funciones auxiliares para calcular hora en Madrid
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
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);

    const [datePart, timePart] = madridDateStr.split(', ');
    const [m, d, y] = datePart.split('/').map(Number);
    const [h, min] = timePart.split(':').map(Number);

    const asUTC = Date.UTC(y, m - 1, d, h, min, 0);
    const diffMs = asUTC - date.getTime();
    return Math.round(diffMs / (1000 * 60));
}

// 6. Guardar Evento de Única Vez
export async function handleEventSingleDatetimeSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_single_datetime') return false;

    const dateStr = interaction.fields.getTextInputValue('event_date').trim();
    const timeStr = interaction.fields.getTextInputValue('event_time').trim();

    const session = eventSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const scheduledAt = parseMadridDateTime(dateStr, timeStr);
    if (!scheduledAt || isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        await interaction.reply({ content: '❌ Fecha u hora inválida o en el pasado. Usa `DD/MM/YYYY` y `HH:MM`.', flags: [MessageFlags.Ephemeral] });
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
            repeats: false,
            status: 'pending',
            createdAt: new Date()
        });

        eventSessions.delete(interaction.user.id);

        await interaction.reply({
            content: `✅ **¡Evento programado con éxito!**\nSe publicará el **${dateStr}** a las **${timeStr}** (hora peninsular).`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error guardando evento único:', error);
        await interaction.reply({ content: '❌ Error al guardar en base de datos.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 7. Guardar Evento Recurrente con Intervalo (Días, Horas, Minutos)
export async function handleEventRepeatModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_repeat') return false;

    const dateStr = interaction.fields.getTextInputValue('event_first_date').trim();
    const timeStr = interaction.fields.getTextInputValue('event_first_time').trim();
    const daysStr = interaction.fields.getTextInputValue('event_interval_days').trim();
    const hoursStr = interaction.fields.getTextInputValue('event_interval_hours').trim();
    const minutesStr = interaction.fields.getTextInputValue('event_interval_minutes').trim();
    const timesStr = interaction.fields.getTextInputValue('event_repeat_times').trim();

    const days = daysStr ? parseInt(daysStr, 10) : 0;
    const hours = hoursStr ? parseInt(hoursStr, 10) : 0;
    const minutes = minutesStr ? parseInt(minutesStr, 10) : 0;
    const totalTimes = parseInt(timesStr, 10);

    const scheduledAt = parseMadridDateTime(dateStr, timeStr);
    if (!scheduledAt || isNaN(scheduledAt.getTime())) {
        await interaction.reply({ content: '❌ Fecha u hora de la 1ª publicación inválida.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const intervalMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
    if (isNaN(intervalMs) || intervalMs <= 0) {
        await interaction.reply({ content: '❌ Debes configurar un intervalo válido mayor a 0 (días, horas o minutos).', flags: [MessageFlags.Ephemeral] });
        return true;
    }

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
            createdAt: new Date()
        });

        eventSessions.delete(interaction.user.id);

        let parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        await interaction.reply({
            content: `✅ **¡Evento recurrente configurado!**\n• 1ª Publicación: **${dateStr}** a las **${timeStr}**\n• Intervalo: Cada **${parts.join(' ')}**\n• Total de envíos: **${totalTimes}**`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error guardando evento recurrente:', error);
        await interaction.reply({ content: '❌ Error al guardar en base de datos.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 8. Manejador de botones RSVP (Asistencia: Sí, Quizás, No)
export async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;
    if (!['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(customId)) return false;

    await interaction.reply({
        content: `✅ ¡Tu asistencia (**${customId === 'event_rsvp_yes' ? 'Asistiré' : customId === 'event_rsvp_maybe' ? 'Quizás' : 'No asistiré'}**) ha quedado registrada!`,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 9. ⏰ WORKER EN SEGUNDO PLANO (Con antídoto contra doble envío instantáneo)
export function setupEventWorker(client: Client) {
    console.log('📅 [Worker] Sistema de eventos y campeonatos activo en segundo plano.');

    setInterval(async () => {
        try {
            const col = await getEventsCollection();
            const now = new Date();

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

                    if (ev.image) {
                        embed.setImage(ev.image);
                    }

                    const rowRsvp = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Asistiré').setStyle(ButtonStyle.Success).setEmoji('✅'),
                        new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Quizás').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
                        new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No Asistiré').setStyle(ButtonStyle.Danger).setEmoji('❌')
                    );

                    const messageOptions = {
                        content: ev.roleId ? `<@&${ev.roleId}>` : undefined,
                        embeds: [embed],
                        components: [rowRsvp]
                    };

                    await channel.send(messageOptions);

                    // 🛡️ Antídoto contra doble envío: Calcula el siguiente intervalo basándose estrictamente en el tiempo actual o futuro
                    if (ev.repeats && ev.remainingTimes > 1) {
                        const baseTime = Math.max(now.getTime(), new Date(ev.scheduledAt).getTime());
                        const nextDate = new Date(baseTime + ev.intervalMs);

                        await col.updateOne(
                            { _id: ev._id },
                            { 
                                $set: { scheduledAt: nextDate },$inc: { remainingTimes: -1 } 
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
