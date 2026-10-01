import { 
    Client, 
    GuildMember, 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    ChannelType, 
    MessageFlags 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let eventsCollection: any = null;
const eventSessions = new Map<string, { 
    channelId?: string; 
    roleId?: string;
    title?: string;
    subtitle?: string;
    dateStr?: string;
    timeStr?: string;
    imageUrl?: string | null;
    eventTimestamp?: number;
    asistenteRoleId?: string;
}>();

async function getEventsCollection() {
    if (!eventsCollection) {
        await clientMongo.connect();
        eventsCollection = clientMongo.db('redline_bot').collection('events');
    }
    return eventsCollection;
}

// 1. Iniciar flujo desde el Dash -> Muestra selector de canal
export async function handleDashEventButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_event_create') return false;

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('event_select_channel')
        .setPlaceholder('📢 Selecciona el canal donde se publicará el evento...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '📅 **Organizador de Eventos**\nPaso 1/2: Selecciona el canal de destino:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Canal seleccionado -> Muestra selector de rol a mencionar
export async function handleEventChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_channel') return false;

    const channelId = interaction.values[0];
    eventSessions.set(interaction.user.id, { channelId });

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('event_select_role')
        .setPlaceholder('👥 Selecciona el rol del campeonato a notificar...');

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);

    await interaction.update({
        content: '📅 **Organizador de Eventos**\nPaso 2/2: Selecciona el rol del campeonato que recibirá el aviso inicial:',
        components: [row]
    });

    return true;
}

// 3. Rol seleccionado -> Abre Modal de datos del evento
export async function handleEventRoleSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'event_select_role') return false;

    const roleId = interaction.values[0];
    const session = eventSessions.get(interaction.user.id);

    if (!session || !session.channelId) {
        await interaction.reply({ content: '❌ Sesión caducada. Empieza de nuevo desde el Dash.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.roleId = roleId;
    eventSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId('modal_event_create')
        .setTitle('Detalles del Evento');

    const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Título del Evento')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: GP de Monza - GT7')
        .setRequired(true);

    const subtitleInput = new TextInputBuilder()
        .setCustomId('event_subtitle')
        .setLabel('Subtítulo / Detalles / Circuito')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Gr.4 | 15 Vueltas (Opcional)')
        .setRequired(false);

    const dateInput = new TextInputBuilder()
        .setCustomId('event_date')
        .setLabel('Fecha (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 15/06/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_time')
        .setLabel('Hora (CET) (Formato 24h HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    const imageInput = new TextInputBuilder()
        .setCustomId('event_image')
        .setLabel('URL de la Imagen o Póster (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://i.imgur.com/tu-imagen.png')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(subtitleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 4. Procesar Modal: Guarda provisionalmente y pregunta si desea repetir (SIN publicar todavía)
export async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const title = interaction.fields.getTextInputValue('event_title');
    const subtitle = interaction.fields.getTextInputValue('event_subtitle') || '';
    const dateStr = interaction.fields.getTextInputValue('event_date');
    const timeStr = interaction.fields.getTextInputValue('event_time');
    const imageUrl = interaction.fields.getTextInputValue('event_image');

    const session = eventSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.roleId || !interaction.guild) {
        await interaction.reply({ content: '❌ Error: Sesión inválida o faltan datos.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) {
        await interaction.reply({ content: '❌ Formato de fecha incorrecto. Usa DD/MM/YYYY (Ej: 15/06/2026).', flags: [MessageFlags.Ephemeral] });
        return true;
    }
    const [dayInput, monthInput, yearInput] = dateParts.map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const eventTimestamp = new Date(yearInput, monthInput - 1, dayInput, hours, minutes).getTime();

    if (isNaN(eventTimestamp)) {
        await interaction.reply({ content: '❌ Formato de fecha u hora incorrecto. Usa DD/MM/YYYY y HH:MM.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const guild = interaction.guild;
        
        let asistenteRole = guild.roles.cache.find(r => r.name === '@asistente' || r.name === 'asistente');
        if (!asistenteRole) {
            asistenteRole = await guild.roles.create({
                name: '@asistente',
                color: 0x00FF00,
                reason: 'Rol temporal automático para eventos'
            });
        }

        const validImageUrl = imageUrl && imageUrl.startsWith('http') ? imageUrl : null;

        session.title = title;
        session.subtitle = subtitle;
        session.dateStr = dateStr;
        session.timeStr = timeStr;
        session.imageUrl = validImageUrl;
        session.eventTimestamp = eventTimestamp;
        session.asistenteRoleId = asistenteRole.id;
        eventSessions.set(interaction.user.id, session);

        const repeatRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_repeat_yes').setLabel('Sí, programar repeticiones').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('event_repeat_no').setLabel('No, publicar ahora').setStyle(ButtonStyle.Success).setEmoji('✅')
        );

        await interaction.reply({
            content: `📝 **Datos guardados temporalmente.**\n¿Deseas programar repeticiones periódicas para este evento antes de publicarlo?`,
            components: [repeatRow],
            flags: [MessageFlags.Ephemeral]
        });

    } catch (error) {
        console.error('❌ Error al procesar datos del evento:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al procesar el evento.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 5. Botón "Sí, programar repeticiones" -> Abre modal de repetición
export async function handleEventRepeatYesButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_repeat_yes') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_event_repeat')
        .setTitle('Configurar Repeticiones');

    const intervalInput = new TextInputBuilder()
        .setCustomId('repeat_interval')
        .setLabel('Intervalo (Días entre eventos)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 1 (diario), 7 (semanal)')
        .setRequired(true);

    const countInput = new TextInputBuilder()
        .setCustomId('repeat_count')
        .setLabel('¿Cuántas veces se repite en total?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 1')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(intervalInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(countInput)
    );

    await interaction.showModal(modal);
    return true;
}
// 5.1 Botón "No, publicar ahora" -> Publica única y exclusivamente el evento base
export async function handleEventRepeatNoButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_repeat_no') return false;

    const session = eventSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.roleId || !interaction.guild) {
        await interaction.reply({ content: '❌ Sesión caducada. Empieza de nuevo desde el Dash.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const guild = interaction.guild;
        const channel = await guild.channels.fetch(session.channelId) as TextChannel;
        if (!channel) {
            await interaction.reply({ content: '❌ No se pudo encontrar el canal seleccionado.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const descSubtitle = session.subtitle ? `**${session.subtitle}**\n\n` : '';

        const embed = new EmbedBuilder()
            .setColor(0x0055FF)
            .setTitle(`🏁 ${session.title}`)
            .setDescription(`${descSubtitle}📅 **Fecha:** ${session.dateStr} a las **${session.timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (0):** Ninguno\n❔ **Dudas (0):** Ninguno\n❌ **No asisten (0):** Ninguno`)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
            .setTimestamp();

        if (session.imageUrl) embed.setImage(session.imageUrl);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Sí voy').setStyle(ButtonStyle.Success).setEmoji('🟢'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Quizás').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No voy').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        const message = await channel.send({
            content: `📢 ¡Atención <@&${session.roleId}>! Nuevo evento programado:`,
            embeds: [embed],
            components: [row]
        });

        const col = await getEventsCollection();
        await col.insertOne({
            guildId: guild.id,
            channelId: channel.id,
            messageId: message.id,
            title: session.title,
            subtitle: session.subtitle,
            dateStr: session.dateStr,
            timeStr: session.timeStr,
            eventTimestamp: session.eventTimestamp,
            roleId: session.roleId,
            asistenteRoleId: session.asistenteRoleId,
            imageUrl: session.imageUrl,
            yes: [],
            maybe: [],
            no: [],
            reminderSent: false,
            completed: false
        });

        eventSessions.delete(interaction.user.id);

        await interaction.update({
            content: `✅ **¡Evento creado y publicado con éxito en <#${channel.id}>!**`,
            components: []
        });

    } catch (error) {
        console.error('❌ Error al publicar evento:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al publicar el evento.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 6. Procesar Modal de Repeticiones -> Usa suma de días natural por calendario para evitar errores de zona horaria
export async function handleEventRepeatModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_repeat') return false;

    const intervalDays = parseInt(interaction.fields.getTextInputValue('repeat_interval'));
    const repeatCount = parseInt(interaction.fields.getTextInputValue('repeat_count'));

    if (isNaN(intervalDays) || isNaN(repeatCount) || intervalDays <= 0 || repeatCount <= 0) {
        await interaction.reply({ content: '❌ Valores numéricos inválidos. Introduce números mayores que 0.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const session = eventSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.roleId || !interaction.guild) {
        await interaction.reply({ content: '❌ Sesión caducada. Crea el evento de nuevo.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const guild = interaction.guild;
        const channel = await guild.channels.fetch(session.channelId) as TextChannel;
        if (!channel) {
            await interaction.reply({ content: '❌ No se pudo encontrar el canal seleccionado.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const col = await getEventsCollection();
        const descSubtitle = session.subtitle ? `**${session.subtitle}**\n\n` : '';

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Sí voy').setStyle(ButtonStyle.Success).setEmoji('🟢'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Quizás').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No voy').setStyle(ButtonStyle.Danger).setEmoji('✖️')
        );

        // 1. Publicar el evento principal (base)
        const baseEmbed = new EmbedBuilder()
            .setColor(0x0055FF)
            .setTitle(`🏁 ${session.title}`)
            .setDescription(`${descSubtitle}📅 **Fecha:** ${session.dateStr} a las **${session.timeStr} CET**\n⏱ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (0):** Ninguno\n❔ **Dudas (0):** Ninguno\n❌ **No asisten (0):** Ninguno`)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
            .setTimestamp();

        if (session.imageUrl) baseEmbed.setImage(session.imageUrl);

        const baseMessage = await channel.send({
            content: `📢 ¡Atención <@&${session.roleId}>! Nuevo evento programado:`,
            embeds: [baseEmbed],
            components: [row]
        });

        await col.insertOne({
            guildId: guild.id,
            channelId: channel.id,
            messageId: baseMessage.id,
            title: session.title,
            subtitle: session.subtitle,
            dateStr: session.dateStr,
            timeStr: session.timeStr,
            eventTimestamp: session.eventTimestamp,
            roleId: session.roleId,
            asistenteRoleId: session.asistenteRoleId,
            imageUrl: session.imageUrl,
            yes: [],
            maybe: [],
            no: [],
            reminderSent: false,
            completed: false
        });

        // 2. Publicar todas las repeticiones usando cálculo de fecha natural de calendario
        const [baseDay, baseMonth, baseYear] = session.dateStr!.split('/').map(Number);
        const [hours, minutes] = session.timeStr!.split(':').map(Number);

        for (let i = 1; i <= repeatCount; i++) {
            const nextDate = new Date(baseYear, baseMonth - 1, baseDay);
            nextDate.setDate(nextDate.getDate() + (intervalDays * i));

            const day = String(nextDate.getDate()).padStart(2, '0');
            const month = String(nextDate.getMonth() + 1).padStart(2, '0');
            const year = nextDate.getFullYear();
            const currentDateStr = `${day}/${month}/${year}`;

            const currentTimestamp = new Date(year, month - 1, day, hours, minutes).getTime();

            const embed = new EmbedBuilder()
                .setColor(0x0055FF)
                .setTitle(`🏁 ${session.title}`)
                .setDescription(`${descSubtitle}📅 **Fecha:** ${currentDateStr} a las **${session.timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (0):** Ninguno\n❔ **Dudas (0):** Ninguno\n❌ **No asisten (0):** Ninguno`)
                .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
                .setTimestamp();

            if (session.imageUrl) embed.setImage(session.imageUrl);

            const message = await channel.send({
                content: `📢 ¡Atención <@&${session.roleId}>! Nuevo evento programado (Recurrente):`,
                embeds: [embed],
                components: [row]
            });

            await col.insertOne({
                guildId: guild.id,
                channelId: channel.id,
                messageId: message.id,
                title: session.title,
                subtitle: session.subtitle,
                dateStr: currentDateStr,
                timeStr: session.timeStr,
                eventTimestamp: currentTimestamp,
                roleId: session.roleId,
                asistenteRoleId: session.asistenteRoleId,
                imageUrl: session.imageUrl,
                yes: [],
                maybe: [],
                no: [],
                reminderSent: false,
                completed: false
            });
        }

        eventSessions.delete(interaction.user.id);

        const totalPublished = repeatCount + 1;
        await interaction.update({
            content: `✅ **¡Se han publicado ${totalPublished} eventos (principal + ${repeatCount} repeticiones) con éxito en <#${channel.id}>!**`,
            components: []
        });

    } catch (error) {
        console.error('❌ Error al programar repeticiones:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al crear los eventos recurrentes.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}
// 7. Manejar Clics en Botones RSVP (Verde, Interrogante, Rojo)
export async function handleEventRsvpButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(interaction.customId)) return false;

    await interaction.deferUpdate();

    const col = await getEventsCollection();
    const eventDoc = await col.findOne({ messageId: interaction.message.id });

    if (!eventDoc) {
        await interaction.followUp({ content: '❌ Este evento ya no está activo en la base de datos.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const userId = interaction.user.id;
    let { yes, maybe, no } = eventDoc;

    yes = yes.filter((id: string) => id !== userId);
    maybe = maybe.filter((id: string) => id !== userId);
    no = no.filter((id: string) => id !== userId);

    if (interaction.customId === 'event_rsvp_yes') yes.push(userId);
    if (interaction.customId === 'event_rsvp_maybe') maybe.push(userId);
    if (interaction.customId === 'event_rsvp_no') no.push(userId);

    try {
        const guild = interaction.guild;
        if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                const shouldHaveRole = yes.includes(userId) || maybe.includes(userId);
                if (shouldHaveRole) {
                    await member.roles.add(eventDoc.asistenteRoleId).catch(() => {});
                } else {
                    await member.roles.remove(eventDoc.asistenteRoleId).catch(() => {});
                }
            }
        }
    } catch (err) {
        console.error('❌ Error gestionando rol temporal de asistencia:', err);
    }

    await col.updateOne(
        { messageId: interaction.message.id },
        { $set: { yes, maybe, no } }
    );

    const yesText = yes.length > 0 ? yes.map((id: string) => `<@${id}>`).join(', ') : 'Ninguno';
    const maybeText = maybe.length > 0 ? maybe.map((id: string) => `<@${id}>`).join(', ') : 'Ninguno';
    const noText = no.length > 0 ? no.map((id: string) => `<@${id}>`).join(', ') : 'Ninguno';

    const descSubtitle = eventDoc.subtitle ? `**${eventDoc.subtitle}**\n\n` : '';

    const oldEmbed = interaction.message.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed)
        .setDescription(`${descSubtitle}📅 **Fecha:** ${eventDoc.dateStr} a las **${eventDoc.timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (${yes.length}):** ${yesText}\n\n❔ **Dudas (${maybe.length}):** ${maybeText}\n\n❌ **No asisten (${no.length}):** ${noText}`);

    if (eventDoc.imageUrl) {
        newEmbed.setImage(eventDoc.imageUrl);
    }

    await interaction.message.edit({ embeds: [newEmbed] });
    return true;
}

// 8. Worker en segundo plano (Revisa recordatorios y limpieza de roles al finalizar)
export function setupEventWorker(client: Client) {
    console.log('📅 [System] Worker de Eventos y Recordatorios activo.');

    setInterval(async () => {
        try {
            const col = await getEventsCollection();
            const now = Date.now();
            const thirtyMinutes = 30 * 60 * 1000;

            const activeEvents = await col.find({ completed: false }).toArray();

            for (const ev of activeEvents) {
                const timeRemaining = ev.eventTimestamp - now;

                if (!ev.reminderSent && timeRemaining <= thirtyMinutes && timeRemaining > 0) {
                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (guild) {
                        const channel = await guild.channels.fetch(ev.channelId).catch(() => null) as TextChannel;
                        if (channel) {
                            await channel.send({
                                content: `⏰ **¡RECORDATORIO DE CARRERA!** Quedan 30 minutos para **${ev.title}**. ¡Atención <@&${ev.asistenteRoleId}> a sus puestos!`
                            });
                        }
                    }
                    await col.updateOne({ messageId: ev.messageId }, { $set: { reminderSent: true } });
                }

                if (timeRemaining <= 0) {
                    const guild = await client.guilds.fetch(ev.guildId).catch(() => null);
                    if (guild) {
                        const allAttendees = [...ev.yes, ...ev.maybe];
                        for (const userId of allAttendees) {
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member) {
                                await member.roles.remove(ev.asistenteRoleId).catch(() => {});
                            }
                        }
                    }
                    await col.updateOne({ messageId: ev.messageId }, { $set: { completed: true } });
                }
            }
        } catch (error) {
            console.error('❌ Error en el worker de eventos:', error);
        }
    }, 60 * 1000);
}

// 9. Router unificado para todas las interacciones de eventos
export async function handleEventInteraction(interaction: any): Promise<boolean> {
    if (interaction.isButton()) {
        if (await handleDashEventButton(interaction)) return true;
        if (await handleEventRepeatYesButton(interaction)) return true;
        if (await handleEventRepeatNoButton(interaction)) return true;
        if (await handleEventRsvpButton(interaction)) return true;
    } else if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
        if (await handleEventChannelSelect(interaction)) return true;
        if (await handleEventRoleSelect(interaction)) return true;
    } else if (interaction.isModalSubmit()) {
        if (await handleEventModalSubmit(interaction)) return true;
        if (await handleEventRepeatModalSubmit(interaction)) return true;
    }
    return false;
}
