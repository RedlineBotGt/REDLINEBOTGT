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

// 4. Procesar Modal y Publicar Evento (Pregunta si desea repetir)
export async function handleEventModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_event_create') return false;

    const title = interaction.fields.getTextInputValue('event_title');
    const subtitle = interaction.fields.getTextInputValue('event_subtitle');
    const dateStr = interaction.fields.getTextInputValue('event_date');
    const timeStr = interaction.fields.getTextInputValue('event_time');
    const imageUrl = interaction.fields.getTextInputValue('event_image');

    const session = eventSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.roleId || !interaction.guild) {
        await interaction.reply({ content: '❌ Error: Sesión inválida o faltan datos.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const eventTimestamp = new Date(`${dateStr}T${timeStr}:00+02:00`).getTime();
    if (isNaN(eventTimestamp)) {
        await interaction.reply({ content: '❌ Formato de fecha u hora incorrecto. Usa AAAA-MM-DD y HH:MM.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const guild = interaction.guild;
        
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

        const embed = new EmbedBuilder()
            .setColor(0x0055FF)
            .setTitle(`🏁 ${title}`)
            .setDescription(`**${subtitle}**\n\n📅 **Fecha:** ${dateStr} a las **${timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (0):** Ninguno\n❔ **Dudas (0):** Ninguno\n❌ **No asisten (0):** Ninguno`)
            .setFooter({ text: 'REDLINE GT' })
            .setTimestamp();

        const validImageUrl = imageUrl && imageUrl.startsWith('http') ? imageUrl : null;
        if (validImageUrl) embed.setImage(validImageUrl);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Sí voy').setStyle(ButtonStyle.Success).setEmoji('🟢'),
            new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Quizás').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
            new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No voy').setStyle(ButtonStyle.Danger).setEmoji('❌')
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
            title,
            subtitle,
            dateStr,
            timeStr,
            eventTimestamp,
            roleId: session.roleId,
            asistenteRoleId: asistenteRole.id,
            imageUrl: validImageUrl,
            yes: [],
            maybe: [],
            no: [],
            reminderSent: false,
            completed: false
        });

        // Guardamos temporalmente en sesión por si quiere añadir repeticiones
        session.title = title;
        session.subtitle = subtitle;
        session.dateStr = dateStr;
        session.timeStr = timeStr;
        session.imageUrl = validImageUrl;
        session.eventTimestamp = eventTimestamp;
        session.asistenteRoleId = asistenteRole.id;
        eventSessions.set(interaction.user.id, session);

        // Botones para preguntar si desea repeticiones
        const repeatRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('event_repeat_yes').setLabel('Sí, programar repeticiones').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('event_repeat_no').setLabel('No, finalizar').setStyle(ButtonStyle.Secondary).setEmoji('✅')
        );

        await interaction.reply({
            content: `✅ **¡Evento creado con éxito en <#${channel.id}>!**\n¿Deseas programar repeticiones periódicas para este evento?`,
            components: [repeatRow],
            flags: [MessageFlags.Ephemeral]
        });

    } catch (error) {
        console.error('❌ Error al crear evento:', error);
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
        .setPlaceholder('Ej: 7 (para semanal), 14 (quincenal)')
        .setRequired(true);

    const countInput = new TextInputBuilder()
        .setCustomId('repeat_count')
        .setLabel('¿Cuántas veces se repite en total?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 4')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(intervalInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(countInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 5.1 Botón "No, finalizar"
export async function handleEventRepeatNoButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'event_repeat_no') return false;
    eventSessions.delete(interaction.user.id);
    await interaction.update({
        content: '✅ **¡Proceso finalizado con éxito! Evento configurado correctamente.**',
        components: []
    });
    return true;
}

// 6. Procesar Modal de Repeticiones y Generar Eventos Futuros
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
        const col = await getEventsCollection();

        let currentTimestamp = session.eventTimestamp!;
        let currentDateStr = session.dateStr!;

        for (let i = 0; i < repeatCount; i++) {
            // Sumar días en milisegundos
            currentTimestamp += intervalDays * 24 * 60 * 60 * 1000;
            
            const nextDateObj = new Date(currentTimestamp);
            const year = nextDateObj.getFullYear();
            const month = String(nextDateObj.getMonth() + 1).padStart(2, '0');
            const day = String(nextDateObj.getDate()).padStart(2, '0');
            currentDateStr = `${year}-${month}-${day}`;

            const embed = new EmbedBuilder()
                .setColor(0x0055FF)
                .setTitle(`🏁 ${session.title}`)
                .setDescription(`**${session.subtitle}**\n\n📅 **Fecha:** ${currentDateStr} a las **${session.timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (0):** Ninguno\n❔ **Dudas (0):** Ninguno\n❌ **No asisten (0):** Ninguno`)
                .setFooter({ text: 'REDLINE GT' })
                .setTimestamp();

            if (session.imageUrl) embed.setImage(session.imageUrl);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('event_rsvp_yes').setLabel('Sí voy').setStyle(ButtonStyle.Success).setEmoji('🟢'),
                new ButtonBuilder().setCustomId('event_rsvp_maybe').setLabel('Quizás').setStyle(ButtonStyle.Secondary).setEmoji('❔'),
                new ButtonBuilder().setCustomId('event_rsvp_no').setLabel('No voy').setStyle(ButtonStyle.Danger).setEmoji('❌')
            );

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

        await interaction.update({
            content: `✅ **¡Se han programado ${repeatCount} eventos recurrentes adicionales con éxito en <#${channel.id}>!**`,
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

    const oldEmbed = interaction.message.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed)
        .setDescription(`**${eventDoc.subtitle}**\n\n📅 **Fecha:** ${eventDoc.dateStr} a las **${eventDoc.timeStr} CET**\n⏱️ **Recordatorio:** 30 min antes.\n\n🟢 **Confirmados (${yes.length}):** ${yesText}\n\n❔ **Dudas (${maybe.length}):** ${maybeText}\n\n❌ **No asisten (${no.length}):** ${noText}`);

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
                    await col.updateOne({ messageId: ev.messageId }, { $set: { reminderSent: