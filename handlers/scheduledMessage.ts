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
    EmbedBuilder 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let scheduledCollection: any = null;

async function getScheduledCollection() {
    if (!scheduledCollection) {
        await client.connect();
        scheduledCollection = client.db('redline_bot').collection('scheduled_messages');
        console.log('⏰ [MongoDB] Conectado al sistema de mensajes programados.');
    }
    return scheduledCollection;
}

// 🌍 Función para convertir la hora local de España (Madrid) a un objeto UTC Date real
function parseMadridDateTime(dateStr: string, timeStr: string): Date | null {
    try {
        const [day, month, year] = dateStr.split('/').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);

        if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return null;

        const tentativeUtc = Date.UTC(year, month - 1, day, hour, minute);
        
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Madrid',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });

        const tempDate = new Date(tentativeUtc);
        const parts = formatter.formatToParts(tempDate);
        const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
        
        const madridYear = getPart('year');
        const madridMonth = getPart('month');
        const madridDay = getPart('day');
        const madridHour = getPart('hour') === 24 ? 0 : getPart('hour');
        const madridMinute = getPart('minute');

        const madridAsUtc = Date.UTC(madridYear, madridMonth - 1, madridDay, madridHour, madridMinute);
        const offsetMs = madridAsUtc - tentativeUtc;

        return new Date(tentativeUtc - offsetMs);
    } catch (error) {
        console.error('❌ Error al parsear fecha y hora:', error);
        return null;
    }
}

// Estructura temporal para almacenar los datos mientras el usuario avanza en el asistente
const scheduledSessions = new Map<string, any>();

// 1. Botón del Dashboard para iniciar la programación
export async function handleDashScheduledButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_scheduled_msg') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_sched_content')
        .setTitle('📅 Programar Mensaje (1/3: Contenido)');

    const inputTexto = new TextInputBuilder()
        .setCustomId('sched_text')
        .setLabel('💬 Contenido del mensaje')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe tu anuncio (admite Discord Markdown y menciones)...')
        .setRequired(true);

    const inputImagen = new TextInputBuilder()
        .setCustomId('sched_image')
        .setLabel('🖼 URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://... (dejar en blanco si no hay imagen)')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputTexto),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputImagen)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Procesar el contenido y pasar a la selección de canal
export async function handleSchedContentSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_sched_content') return false;

    const text = interaction.fields.getTextInputValue('sched_text');
    const image = interaction.fields.getTextInputValue('sched_image').trim();

    scheduledSessions.set(interaction.user.id, { text, image: image || null });

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('sched_select_channel')
        .setPlaceholder('📢 Selecciona el canal de destino...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '📅 **Programador (2/5):** Selecciona a continuación el canal donde se enviará el mensaje:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 3. Seleccionar canal y pasar a la selección de rol
export async function handleSchedChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'sched_select_channel') return false;

    const channelId = interaction.values[0];
    const session = scheduledSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada. Vuelve a iniciar el proceso.', components: [], embeds: [] });
        return true;
    }

    session.channelId = channelId;

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('sched_select_role')
        .setPlaceholder('👥 Selecciona rol a mencionar (Opcional)...');

    const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const rowSkip = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('sched_skip_role').setLabel('Saltar Mención de Rol').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
        content: '📅 **Programador (3/5):** ¿Quieres mencionar algún rol al enviar el mensaje?',
        components: [rowRole, rowSkip]
    });

    return true;
}

// 4. Seleccionar rol (o saltar) y pedir fecha/hora mediante modal
export async function handleSchedRoleSelection(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'sched_select_role' && interaction.customId !== 'sched_skip_role') return false;

    const session = scheduledSessions.get(interaction.user.id);
    if (!session) {
        if (interaction.isRepliable()) {
            await interaction.update({ content: '❌ Sesión caducada.', components: [], embeds: [] });
        }
        return true;
    }

    if (interaction.isRoleSelectMenu()) {
        session.roleId = interaction.values[0];
    } else {
        session.roleId = null;
    }

    // Lanzamos modal para Fecha y Hora
    const modal = new ModalBuilder()
        .setCustomId('modal_sched_datetime')
        .setTitle('📅 Programar Mensaje (4/5: Fecha y Hora)');

    const inputDate = new TextInputBuilder()
        .setCustomId('sched_date')
        .setLabel('📅 Fecha de envío (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 15/10/2026')
        .setRequired(true);

    const inputTime = new TextInputBuilder()
        .setCustomId('sched_time')
        .setLabel('⏰ Hora peninsular (Formato 24h HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputDate),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputTime)
    );

    await interaction.showModal(modal);
    return true;
}

// 5. Guardar fecha/hora traducida y preguntar por repetición
export async function handleSchedDatetimeSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_sched_datetime') return false;

    const dateStr = interaction.fields.getTextInputValue('sched_date').trim();
    const timeStr = interaction.fields.getTextInputValue('sched_time').trim();

    const session = scheduledSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', ephemeral: true });
        return true;
    }

    // Convertimos la hora peninsular a UTC exacto
    const targetDate = parseMadridDateTime(dateStr, timeStr);
    if (!targetDate || isNaN(targetDate.getTime())) {
        await interaction.reply({
            content: '❌ Formato de fecha u hora inválido. Usa estrictamente `DD/MM/YYYY` para la fecha y `HH:MM` para la hora. Vuelve a intentarlo.',
            ephemeral: true
        });
        return true;
    }

    session.scheduledAt = targetDate;
    session.date = dateStr;
    session.time = timeStr;

    // Preguntamos si desea repetir
    const rowRepeat = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('sched_repeat_yes').setLabel('🔄 Sí, configurar repetición').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sched_repeat_no').setLabel('❌ No repetir (Única vez)').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        content: `📅 **Programador (5/5):** Fecha programada para el **${dateStr} a las ${timeStr}** (Hora Peninsular).\n¿Deseas que este mensaje se repita automáticamente?`,
        components: [rowRepeat],
        ephemeral: true
    });

    return true;
}

// 6A. Finalizar si selecciona NO repetir
export async function handleSchedFinalizeNo(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'sched_repeat_no') return false;

    const session = scheduledSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [], embeds: [] });
        return true;
    }

    try {
        const col = await getScheduledCollection();
        await col.insertOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            text: session.text,
            image: session.image,
            channelId: session.channelId,
            roleId: session.roleId,
            date: session.date,
            time: session.time,
            scheduledAt: session.scheduledAt,
            repeats: false,
            status: 'pending',
            createdAt: new Date()
        });

        scheduledSessions.delete(interaction.user.id);

        await interaction.update({
            content: `✅ **¡Mensaje programado con éxito!**\nSe enviará el **${session.date}** a las **${session.time}** (hora peninsular).`,
            components: [],
            embeds: []
        });
    } catch (error) {
        console.error('❌ Error al guardar mensaje programado:', error);
        await interaction.update({
            content: '❌ Hubo un error al guardar el mensaje programado en MongoDB.',
            components: [],
            embeds: []
        });
    }

    return true;
}

// 6B. Si selecciona SÍ repetir -> Abre el Modal para días, horas y número de veces
export async function handleSchedRepeatYes(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'sched_repeat_yes') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_sched_repeat')
        .setTitle('Configurar Frecuencia de Repetición');

    const daysInput = new TextInputBuilder()
        .setCustomId('sched_repeat_days')
        .setLabel('¿Cada cuántos días?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 7 (Opcional)')
        .setRequired(false);

    const hoursInput = new TextInputBuilder()
        .setCustomId('sched_repeat_hours')
        .setLabel('¿Cada cuántas horas?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 12 (Opcional)')
        .setRequired(false);

    const timesInput = new TextInputBuilder()
        .setCustomId('sched_repeat_times')
        .setLabel('Nº de repeticiones (contando el 1º)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 5 (Mínimo 2)')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(hoursInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 6C. Procesa el Modal de Repetición, valida y guarda en MongoDB
export async function handleSchedRepeatModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_sched_repeat') return false;

    const daysStr = interaction.fields.getTextInputValue('sched_repeat_days').trim();
    const hoursStr = interaction.fields.getTextInputValue('sched_repeat_hours').trim();
    const timesStr = interaction.fields.getTextInputValue('sched_repeat_times').trim();

    const days = daysStr ? parseInt(daysStr, 10) : 0;
    const hours = hoursStr ? parseInt(hoursStr, 10) : 0;
    const totalTimes = timesStr ? parseInt(timesStr, 10) : 0;

    // Validación: Ambos opcionales, pero mínimo 1 marcado y mayor que 0
    if ((isNaN(days) || days < 0) || (isNaN(hours) || hours < 0) || (days === 0 && hours === 0)) {
        await interaction.reply({ 
            content: '❌ Debes indicar al menos un valor válido mayor a 0 (en días o en horas) para que la repetición funcione.', 
            ephemeral: true 
        });
        return true;
    }

    // Validación de número de repeticiones (mínimo 2, contando el primer envío)
    if (isNaN(totalTimes) || totalTimes < 2) {
        await interaction.reply({ 
            content: '❌ El número total de repeticiones debe ser al menos 2 (contando el primer envío).', 
            ephemeral: true 
        });
        return true;
    }

    const session = scheduledSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', ephemeral: true });
        return true;
    }

    try {
        const col = await getScheduledCollection();
        await col.insertOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            text: session.text,
            image: session.image,
            channelId: session.channelId,
            roleId: session.roleId,
            date: session.date,
            time: session.time,
            scheduledAt: session.scheduledAt,
            repeats: true,
            repeatDays: days,
            repeatHours: hours,
            remainingTimes: totalTimes, // Guardamos las veces totales restantes
            status: 'pending',
            createdAt: new Date()
        });

        scheduledSessions.delete(interaction.user.id);

        let repeatText = [];
        if (days > 0) repeatText.push(`${days} día(s)`);
        if (hours > 0) repeatText.push(`${hours} hora(s)`);

        await interaction.reply({
            content: `✅ **¡Mensaje programado y recurrente configurado!**\n• Primer envío: **${session.date}** a las **${session.time}**\n• Se repetirá cada: **${repeatText.join(' y ')}**\n• Total de envíos: **${totalTimes}**\n• Guardado en MongoDB Atlas.`,
            ephemeral: true
        });
    } catch (error) {
        console.error('❌ Error al guardar mensaje programado recurrente:', error);
        await interaction.reply({ content: '❌ Error al guardar en la base de datos.', ephemeral: true });
    }

    return true;
}

// 7. ⏰ WORKER EN SEGUNDO PLANO (Para enviar los mensajes automáticamente a su hora)
export function startScheduledWorker(client: Client) {
    console.log('⏰ [Worker] Sistema de mensajes programados iniciado en segundo plano.');

    setInterval(async () => {
        try {
            const col = await getScheduledCollection();
            const now = new Date();

            const pendingMessages = await col.find({
                status: 'pending',
                scheduledAt: { $lte: now }
            }).toArray();

            if (pendingMessages.length === 0) return;

            for (const msg of pendingMessages) {
                try {
                    const guild = await client.guilds.fetch(msg.guildId).catch(() => null);
                    if (!guild) {
                        await col.updateOne({ _id: msg._id }, { $set: { status: 'guild_not_found' } });
                        continue;
                    }

                    const channel = await guild.channels.fetch(msg.channelId).catch(() => null) as TextChannel;
                    if (!channel || !channel.isTextBased()) {
                        await col.updateOne({ _id: msg._id }, { $set: { status: 'channel_not_found' } });
                        continue;
                    }

                    let finalContent = msg.text;
                    let messageOptions: any = {};

                    if (msg.image) {
                        const embed = new EmbedBuilder()
                            .setDescription(finalContent)
                            .setImage(msg.image)
                            .setColor(0xED4245);
                        
                        messageOptions = {
                            content: msg.roleId ? `<@&${msg.roleId}>` : undefined,
                            embeds: [embed]
                        };
                    } else {
                        if (msg.roleId) {
                            finalContent = `<@&${msg.roleId}>\n\n${finalContent}`;
                        }
                        messageOptions = { content: finalContent };
                    }

                    await channel.send(messageOptions);

                    // Si se repite y aún le quedan envíos pendientes (remainingTimes > 1)
                    if (msg.repeats && msg.remainingTimes > 1) {
                        const currentScheduled = new Date(msg.scheduledAt);
                        const addDays = (msg.repeatDays || 0) * 24 * 60 * 60 * 1000;
                        const addHours = (msg.repeatHours || 0) * 60 * 60 * 1000;
                        const nextDate = new Date(currentScheduled.getTime() + addDays + addHours);

                        await col.updateOne(
                            { _id: msg._id },
                            { 
                                $set: { scheduledAt: nextDate },$inc: { remainingTimes: -1 } // Restamos 1 al contador restante
                            }
                        );
                        console.log(`🔄 [Worker] Mensaje repetitivo reprogramado para: ${nextDate}. Quedan ${msg.remainingTimes - 1} envíos.`);
                    } else {
                        // Última repetición o mensaje único completado
                        await col.updateOne(
                            { _id: msg._id },
                            { $set: { status: 'sent', sentAt: new Date() } }
                        );
                        console.log(`✅ [Worker] Mensaje programado finalizado (completadas todas las repeticiones) en ${guild.name}`);
                    }

                } catch (err) {
                    console.error(`❌ [Worker] Error enviando mensaje ID ${msg._id}:`, err);
                }
            }

        } catch (error) {
            console.error('❌ [Worker] Error general en el bucle de mensajes programados:', error);
        }
    }, 60000);
}
