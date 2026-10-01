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
const eventSessions = new Map<string, { channelId?: string; roleId?: string }>();

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
        content: '📅 **Organizador de Eventos REDLINE GT**\nPaso 1/2: Selecciona el canal de destino:',
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
        content: '📅 **Organizador de Eventos REDLINE GT**\nPaso 2/2: Selecciona el rol del campeonato que recibirá el aviso inicial:',
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
        .setPlaceholder('Ej: Gr.4 | 15 Vueltas | Desgaste x2')
        .setRequired(true);

    const dateInput = new TextInputBuilder()
        .setCustomId('event_date')
        .setLabel('Fecha (AAAA-MM-DD)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 2026-06-15')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('event_time')
        .setLabel('Hora (CET) (Formato 24h HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(subtitleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 4. Procesar Modal y Publicar Evento
export async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const title = interaction.fields.getTextInputValue('event_title');
    const subtitle = interaction.fields.getTextInputValue('event_subtitle');
    const dateStr = interaction.fields.getTextInputValue('event_date');
    const timeStr = interaction.fields.getTextInputValue('event_time');

    const session = eventSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.roleId || !interaction.guild) {
        await interaction.reply({ content: '❌ Error: Sesión inválida o faltan datos.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    // Calcular timestamp exacto en milisegundos (CET)
    const eventTimestamp = new Date(`${dateStr}T${timeStr}:00+02:00`).getTime();
    if (isNaN(eventTimestamp)) {
        await interaction.reply({ content: '❌ Formato de fecha u hora incorrecto. Usa AAAA-MM-DD y HH:MM.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const guild = interaction.guild;
        
        // Comprobar/Crear rol temporal @asistente
        let asistenteRole = guild.roles.cache.find(r => r.name === '@asistente' || r.name === 'asistente');
        if (!asistenteRole) {
            asistenteRole = await guild.roles.create({
                name: '@asistente',
                color: 0x00FF00,
                reason: 'Rol temporal automático para eventos de REDLINE GT'
            });
        }

        const channel = await guild.channels.fetch(session.channelId) as TextChannel;
        if (!channel) {
            await interaction.reply({ content: '❌ No se pudo encontrar el canal seleccionado.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        // Construir Embed y Botones
        const embed = new EmbedBuilder()
            .setColor(0x0055FF)
            .setTitle(`🏁 ${title}`)
            .setDescription(`**${subtitle}**\n\n📅 **Fecha:** ${dateStr} a las **${timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (0):** Ninguno\n❔ **Dudas (0):** Ninguno\n❌ **No asisten (0):** Ninguno`)
            .setFooter({ text: 'REDLINE GT' })
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Sí voy').setStyle(ButtonStyle.Success).setEmoji('🟢'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Quizás').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No voy').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        // Enviar mensaje al canal con mención al rol del campeonato
        const message = await channel.send({
            content: `📢 ¡Atención <@&${session.roleId}>! Nuevo evento programado:`,
            embeds: [embed],
            components: [row]
        });

        // Guardar en MongoDB para persistencia ante deploys
        const col = await getEventsCollection();
        await col.insertOne({
            guildId: guild.id,
            channelId: channel.id,
            messageId: message.id,
            title,
            subtitle,
            dateStr,
            timeStr,
            eventTimestamp,
            roleId: session.roleId,
            asistenteRoleId: asistenteRole.id,
            yes: [],
            maybe: [],
            no: [],
            reminderSent: false,
            completed: false
        });

        eventSessions.delete(interaction.user.id);

        await interaction.reply({
            content: `✅ **¡Evento creado y publicado con éxito en <#${channel.id}>!**`,
            flags: [MessageFlags.Ephemeral]
        });

    } catch (error) {
        console.error('❌ Error al crear evento:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al procesar el evento.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 5. Manejar Clics en Botones RSVP (Verde, Interrogante, Rojo)
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

    // Eliminar de todas las listas previas
    yes = yes.filter((id: string) => id !== userId);
    maybe = maybe.filter((id: string) => id !== userId);
    no = no.filter((id: string) => id !== userId);

    // Añadir a la lista correspondiente
    if (interaction.customId === 'event_rsvp_yes') yes.push(userId);
    if (interaction.customId === 'event_rsvp_maybe') maybe.push(userId);
    if (interaction.customId === 'event_rsvp_no') no.push(userId);

    // Gestionar Rol Temporal @asistente
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

    // Actualizar MongoDB
    await col.updateOne(
        { messageId: interaction.message.id },
        { $set: { yes, maybe, no } }
    );

    // Reconstruir texto de listas para el Embed
    const yesText = yes.length > 0 ? yes.map((id: string) => `<@${id}>`).join(', ') : 'Ninguno';
    const maybeText = maybe.length > 0 ? maybe.map((id: string) => `<@${id}>`).join(', ') : 'Ninguno';
    const noText = no.length > 0 ? no.map((id: string) => `<@${id}>`).join(', ') : 'Ninguno';

    const oldEmbed = interaction.message.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed)
        .setDescription(`**${eventDoc.subtitle}**\n\n📅 **Fecha:** ${eventDoc.dateStr} a las **${eventDoc.timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (${yes.length}):** ${yesText}\n\n❔ **Dudas (${maybe.length}):** ${maybeText}\n\n❌ **No asisten (${no.length}):** ${noText}`);

    await interaction.message.edit({ embeds: [newEmbed] });
    return true;
}

// 6. Worker en segundo plano (Revisa recordatorios y limpieza de roles al finalizar)
export function setupEventWorker(client: Client) {
    console.log('📅 [System] Worker de Eventos y Recordatorios activo.');

    setInterval(async () => {
        try {
            const col = await getEventsCollection();
            const now = Date.now();
            const thirtyMinutes = 30 * 60 * 1000;

            // Buscar eventos futuros no completados
            const activeEvents = await col.find({ completed: false }).toArray();

            for (const ev of activeEvents) {
                const timeRemaining = ev.eventTimestamp - now;

                // 1. Enviar recordatorio 30 minutos antes
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

                // 2. Al finalizar el evento (cuando pasa la hora exacta), limpiar rol temporal a todos
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
                    // Marcar como completado para que el worker no vuelva a procesarlo
                    await col.updateOne({ messageId: ev.messageId }, { $set: { completed: true } });
                }
            }
        } catch (error) {
            console.error('❌ Error en el worker de eventos:', error);
        }
    }, 60 * 1000); // Se ejecuta cada 1 minuto
}
