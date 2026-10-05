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
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    MessageFlags
} from 'discord.js';
import { MongoClient as MongoDriver, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let schedTemplatesCollection: any = null;
let scheduledJobsCollection: any = null;

async function getSchedCollections() {
    if (!schedTemplatesCollection || !scheduledJobsCollection) {
        await client.connect();
        const db = client.db('redline_bot');
        schedTemplatesCollection = db.collection('scheduled_templates');
        scheduledJobsCollection = db.collection('scheduled_messages');
        console.log('⏰ [MongoDB] Conectado al sistema de plantillas y mensajes programados.');
    }
    return { templates: schedTemplatesCollection, jobs: scheduledJobsCollection };
}

const scheduledSessions = new Map<string, any>();

// 1. Botón principal del Dashboard ("Prog. Mensaje") -> Muestra los dos botones de elección
export async function handleDashScheduledButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_scheduled_msg') return false;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('sched_btn_new').setLabel('Crear Nuevo Mensaje').setStyle(ButtonStyle.Success).setEmoji('➕'),
        new ButtonBuilder().setCustomId('sched_btn_existing').setLabel('Usar Mensaje Existente').setStyle(ButtonStyle.Primary).setEmoji('📂')
    );

    await interaction.reply({
        content: '📅 **Sistema de Mensajes Programados**\n¿Qué deseas hacer con tus plantillas de mensajes?',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Botón "Crear Nuevo Mensaje" -> Abre modal para título, contenido e imagen
export async function handleSchedNewButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'sched_btn_new') return false;

    scheduledSessions.set(interaction.user.id, {});

    const modal = new ModalBuilder()
        .setCustomId('modal_sched_new')
        .setTitle('Crear Plantilla de Mensaje');

    const titleInput = new TextInputBuilder()
        .setCustomId('sched_title_input')
        .setLabel('Título / Identificador interno')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Aviso de Carrera, Sanciones...')
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('sched_content_input')
        .setLabel('Contenido del mensaje')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe el texto que enviará el bot...')
        .setRequired(true);

    const imageInput = new TextInputBuilder()
        .setCustomId('sched_image_input')
        .setLabel('URL de la imagen (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://... (dejar en blanco si no hay)')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 3. Botón "Usar Mensaje Existente" -> Muestra selector con las plantillas guardadas
export async function handleSchedExistingButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'sched_btn_existing') return false;
    if (!interaction.guildId) return true;

    const { templates } = await getSchedCollections();
    const allTemplates = await templates.find({ guildId: interaction.guildId }).toArray();

    if (allTemplates.length === 0) {
        await interaction.update({
            content: '❌ No hay ninguna plantilla de mensaje guardada todavía. ¡Crea una nueva!',
            components: []
        });
        return true;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('sched_select_existing')
        .setPlaceholder('📂 Selecciona una plantilla guardada...')
        .addOptions(allTemplates.map(t => ({
            label: t.title.substring(0, 100),
            description: (t.content ? t.content.substring(0, 90) : '') + '...',
            value: t._id.toString()
        })));

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.update({
        content: '📂 **Selecciona la plantilla que deseas programar o editar:**',
        components: [row]
    });

    return true;
}

// 4. Seleccionar una plantilla existente -> Muestra opciones y previsualización con imagen si la tiene
export async function handleSchedExistingSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'sched_select_existing') return false;

    const templateId = interaction.values[0];
    const { templates } = await getSchedCollections();
    const template = await templates.findOne({ _id: new ObjectId(templateId) });

    if (!template) {
        await interaction.update({ content: '❌ Plantilla no encontrada.', components: [] });
        return true;
    }

    scheduledSessions.set(interaction.user.id, { templateId, text: template.content, image: template.image || null });

    const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle(`📄 Plantilla: ${template.title}`)
        .setDescription(template.content || '')
        .setTimestamp();

    if (template.image) {
        embed.setImage(template.image);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`sched_action_schedule_${templateId}`).setLabel('Programar / Enviar').setStyle(ButtonStyle.Success).setEmoji('⏰'),
        new ButtonBuilder().setCustomId(`sched_action_edit_${templateId}`).setLabel('Editar Contenido').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
        new ButtonBuilder().setCustomId(`sched_action_delete_${templateId}`).setLabel('Borrar Plantilla').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await interaction.update({
        content: '⚙️ **¿Qué deseas hacer con esta plantilla?**',
        embeds: [embed],
        components: [row]
    });

    return true;
}

// 5. Guardar nueva plantilla o edición desde modal (incluyendo imagen)
export async function handleSchedModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_sched_new' && interaction.customId !== 'modal_sched_edit') return false;
    if (!interaction.guildId) return true;

    const title = interaction.fields.getTextInputValue('sched_title_input');
    const content = interaction.fields.getTextInputValue('sched_content_input');
    const image = interaction.fields.getTextInputValue('sched_image_input').trim();
    const session = scheduledSessions.get(interaction.user.id) || {};
    const { templates } = await getSchedCollections();

    if (interaction.customId === 'modal_sched_new') {
        await templates.insertOne({
            guildId: interaction.guildId,
            title,
            content,
            image: image || null,
            createdAt: new Date()
        });
        await interaction.reply({
            content: `✅ **¡Plantilla "${title}" creada y guardada en la base de datos con éxito!**`,
            flags: [MessageFlags.Ephemeral]
        });
    } else if (interaction.customId === 'modal_sched_edit' && session.templateId) {
        await templates.updateOne(
            { _id: new ObjectId(session.templateId) },
            { $set: { title, content, image: image || null } }
        );
        await interaction.reply({
            content: `✅ **¡Plantilla "${title}" actualizada con éxito!**`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    scheduledSessions.delete(interaction.user.id);
    return true;
}
// 6. Botones de acción sobre la plantilla existente (Editar, Borrar, Programar)
export async function handleSchedActionButtons(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;

    if (customId.startsWith('sched_action_edit_')) {
        const templateId = customId.replace('sched_action_edit_', '');
        const { templates } = await getSchedCollections();
        const template = await templates.findOne({ _id: new ObjectId(templateId) });
        if (!template) return true;

        scheduledSessions.set(interaction.user.id, { templateId });

        const modal = new ModalBuilder()
            .setCustomId('modal_sched_edit')
            .setTitle('Editar Plantilla');

        const titleInput = new TextInputBuilder()
            .setCustomId('sched_title_input')
            .setLabel('Título / Identificador')
            .setStyle(TextInputStyle.Short)
            .setValue(template.title)
            .setRequired(true);

        const contentInput = new TextInputBuilder()
            .setCustomId('sched_content_input')
            .setLabel('Contenido del mensaje')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(template.content || '')
            .setRequired(true);

        const imageInput = new TextInputBuilder()
            .setCustomId('sched_image_input')
            .setLabel('URL de la imagen (Opcional)')
            .setStyle(TextInputStyle.Short)
            .setValue(template.image || '')
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput)
        );

        await interaction.showModal(modal);
        return true;
    }

    if (customId.startsWith('sched_action_delete_')) {
        const templateId = customId.replace('sched_action_delete_', '');
        const { templates } = await getSchedCollections();
        await templates.deleteOne({ _id: new ObjectId(templateId) });

        await interaction.update({
            content: '✅ **¡Plantilla borrada de la base de datos con éxito!**',
            embeds: [],
            components: []
        });
        return true;
    }

    if (customId.startsWith('sched_action_schedule_')) {
        const templateId = customId.replace('sched_action_schedule_', '');
        const { templates } = await getSchedCollections();
        const template = await templates.findOne({ _id: new ObjectId(templateId) });
        if (!template) return true;

        const session = scheduledSessions.get(interaction.user.id) || {};
        session.templateId = templateId;
        session.text = template.content;
        session.image = template.image || null;
        scheduledSessions.set(interaction.user.id, session);

        const selectChannel = new ChannelSelectMenuBuilder()
            .setCustomId('sched_select_channel')
            .setPlaceholder('📢 Selecciona el canal donde se enviará el mensaje...')
            .addChannelTypes(ChannelType.GuildText);

        const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

        await interaction.update({
            content: '📢 **Paso 1/3:** Selecciona el canal de destino para este mensaje:',
            embeds: [],
            components: [row]
        });
        return true;
    }

    return false;
}

// 7. Canal seleccionado -> Pide Rol opcional
export async function handleSchedChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'sched_select_channel') return false;

    const channelId = interaction.values[0];
    const session = scheduledSessions.get(interaction.user.id) || {};
    session.channelId = channelId;
    scheduledSessions.set(interaction.user.id, session);

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('sched_select_role')
        .setPlaceholder('🏷️ Selecciona un rol a mencionar (Opcional)...');

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const skipRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('sched_skip_role').setLabel('Omitir mención de rol').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
        content: `📢 Canal seleccionado (<#${channelId}>).\n**Paso 2/3:** Selecciona un rol si deseas mencionarlo al enviar el mensaje, o pulsa omitir:`,
        components: [row, skipRow]
    });

    return true;
}

// 8. Rol seleccionado o saltado -> Pide Fecha y Hora
export async function handleSchedRoleSelection(interaction: any): Promise<boolean> {
    if (interaction.isRoleSelectMenu() && interaction.customId !== 'sched_select_role') return false;
    if (interaction.isButton() && interaction.customId !== 'sched_skip_role') return false;

    const session = scheduledSessions.get(interaction.user.id) || {};
    if (interaction.isRoleSelectMenu()) {
        session.roleId = interaction.values[0];
    } else {
        session.roleId = null;
    }
    scheduledSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId('modal_sched_datetime')
        .setTitle('Fecha y Hora de Envío');

    const dateInput = new TextInputBuilder()
        .setCustomId('sched_date')
        .setLabel('Fecha de envío (DD/MM/YYYY)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 15/10/2026')
        .setRequired(true);

    const timeInput = new TextInputBuilder()
        .setCustomId('sched_time')
        .setLabel('Hora peninsular (Formato 24h HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 21:30')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
    );

    if (interaction.isRepliable()) {
        await interaction.showModal(modal);
    }
    return true;
}

// 🌍 Funciones de hora de Madrid
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
        console.error('❌ Error al parsear fecha y hora de Madrid:', error);
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

// 9. Guardar fecha/hora y preguntar por repetición
export async function handleSchedDatetimeSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_sched_datetime') return false;

    const dateStr = interaction.fields.getTextInputValue('sched_date').trim();
    const timeStr = interaction.fields.getTextInputValue('sched_time').trim();

    const session = scheduledSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.text) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const targetDate = parseMadridDateTime(dateStr, timeStr);
    if (!targetDate || isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
        await interaction.reply({
            content: '❌ Fecha u hora inválida, o es una hora que ya ha pasado. Usa `DD/MM/YYYY` y `HH:MM`.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    session.scheduledAt = targetDate;
    session.date = dateStr;
    session.time = timeStr;

    const rowRepeat = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('sched_repeat_yes').setLabel('🔄 Sí, configurar repetición').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sched_repeat_no').setLabel('❌ No repetir (Única vez)').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        content: `📅 **Programador (5/5):** Fecha programada para el **${dateStr} a las ${timeStr}** (Hora Peninsular).\n¿Deseas que este mensaje se repita automáticamente?`,
        components: [rowRepeat],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 10A. Finalizar si selecciona NO repetir
export async function handleSchedFinalizeNo(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'sched_repeat_no') return false;

    const session = scheduledSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [], embeds: [] });
        return true;
    }

    try {
        const { jobs } = await getSchedCollections();
        await jobs.insertOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            text: session.text,
            image: session.image || null,
            channelId: session.channelId,
            roleId: session.roleId || null,
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
        await interaction.update({ content: '❌ Hubo un error al guardar en MongoDB.', components: [] });
    }

    return true;
}

// 10B. Si selecciona SÍ repetir -> Abre el Modal para días, horas y número de veces
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
        .setPlaceholder('Ej: 1 (Opcional)')
        .setRequired(false);

    const timesInput = new TextInputBuilder()
        .setCustomId('sched_repeat_times')
        .setLabel('Nº de repeticiones (contando el 1º)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 2 (Mínimo 2)')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(hoursInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(timesInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 10C. Procesa el Modal de Repetición, valida y guarda en MongoDB
export async function handleSchedRepeatModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_sched_repeat') return false;

    const daysStr = interaction.fields.getTextInputValue('sched_repeat_days').trim();
    const hoursStr = interaction.fields.getTextInputValue('sched_repeat_hours').trim();
    const timesStr = interaction.fields.getTextInputValue('sched_repeat_times').trim();

    const days = daysStr ? parseInt(daysStr, 10) : 0;
    const hours = hoursStr ? parseInt(hoursStr, 10) : 0;
    const totalTimes = timesStr ? parseInt(timesStr, 10) : 0;

    if ((isNaN(days) || days < 0) || (isNaN(hours) || hours < 0) || (days === 0 && hours === 0)) {
        await interaction.reply({ content: '❌ Debes indicar al menos un valor válido mayor a 0 (en días o en horas).', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    if (isNaN(totalTimes) || totalTimes < 2) {
        await interaction.reply({ content: '❌ El número total de repeticiones debe ser al menos 2.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const session = scheduledSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const { jobs } = await getSchedCollections();
        await jobs.insertOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            text: session.text,
            image: session.image || null,
            channelId: session.channelId,
            roleId: session.roleId || null,
            date: session.date,
            time: session.time,
            scheduledAt: session.scheduledAt,
            repeats: true,
            repeatDays: days,
            repeatHours: hours,
            remainingTimes: totalTimes,
            status: 'pending',
            createdAt: new Date()
        });

        scheduledSessions.delete(interaction.user.id);

        let repeatText = [];
        if (days > 0) repeatText.push(`${days} día(s)`);
        if (hours > 0) repeatText.push(`${hours} hora(s)`);

        await interaction.reply({
            content: `✅ **¡Mensaje programado y recurrente configurado!**\n• Primer envío: **${session.date}** a las **${session.time}**\n• Se repetirá cada: **${repeatText.join(' y ')}**\n• Total de envíos: **${totalTimes}**`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error al guardar mensaje repetitivo:', error);
        await interaction.reply({ content: '❌ Error al guardar en la base de datos.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 11. ⏰ WORKER EN SEGUNDO PLANO (Soporta texto e imagen en Embed)
export function startScheduledWorker(client: Client) {
    console.log('⏰ [Worker] Sistema de mensajes programados iniciado en segundo plano.');

    setInterval(async () => {
        try {
            const { jobs } = await getSchedCollections();
            const now = new Date();

            const pendingMessages = await jobs.find({
                status: 'pending',
                scheduledAt: { $lte: now }
            }).toArray();

            if (pendingMessages.length === 0) return;

            for (const msg of pendingMessages) {
                try {
                    const guild = await client.guilds.fetch(msg.guildId).catch(() => null);
                    if (!guild) {
                        await jobs.updateOne({ _id: msg._id }, { $set: { status: 'guild_not_found' } });
                        continue;
                    }

                    const channel = await guild.channels.fetch(msg.channelId).catch(() => null) as TextChannel;
                    if (!channel || !channel.isTextBased()) {
                        await jobs.updateOne({ _id: msg._id }, { $set: { status: 'channel_not_found' } });
                        continue;
                    }

                    let messageOptions: any = {};

                    if (msg.image) {
                        const embed = new EmbedBuilder()
                            .setDescription(msg.text || '')
                            .setImage(msg.image)
                            .setColor(0xED4245);

                        messageOptions = {
                            content: msg.roleId ? `<@&${msg.roleId}>` : undefined,
                            embeds: [embed]
                        };
                    } else {
                        let finalContent = msg.text || '';
                        if (msg.roleId) {
                            finalContent = `<@&${msg.roleId}>\n\n` + finalContent;
                        }
                        messageOptions = { content: finalContent };
                    }

                    await channel.send(messageOptions);

                    if (msg.repeats && msg.remainingTimes > 1) {
                        const currentScheduled = new Date(msg.scheduledAt);
                        const addDays = (msg.repeatDays || 0) * 24 * 60 * 60 * 1000;
                        const addHours = (msg.repeatHours || 0) * 60 * 60 * 1000;
                        const nextDate = new Date(currentScheduled.getTime() + addDays + addHours);

                        await jobs.updateOne(
                            { _id: msg._id },
                            { 
                                $set: { scheduledAt: nextDate },$inc: { remainingTimes: -1 } 
                            }
                        );
                        console.log(`🔄 [Worker] Mensaje repetitivo reprogramado para: ${nextDate}. Quedan ${msg.remainingTimes - 1} envíos.`);
                    } else {
                        await jobs.updateOne(
                            { _id: msg._id },
                            { $set: { status: 'sent', sentAt: new Date() } }
                        );
                        console.log(`✅ [Worker] Mensaje programado finalizado en ${guild.name}`);
                    }

                } catch (err) {
                    console.error(`❌ [Worker] Error enviando mensaje ID ${msg._id}:`, err);
                }
            }

        } catch (error) {
            console.error('❌ [Worker] Error general en el bucle:', error);
        }
    }, 60000);
}
