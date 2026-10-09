import { 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder,
    MessageFlags 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';
import { handleScheduledActions } from './interactionscheduledactions';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoDriver(uri);

let schedTemplatesCollection: any = null;
let scheduledJobsCollection: any = null;

export async function getSchedCollections() {
    if (!schedTemplatesCollection || !scheduledJobsCollection) {
        await client.connect();
        const db = client.db('redline_bot');
        schedTemplatesCollection = db.collection('scheduled_templates');
        scheduledJobsCollection = db.collection('scheduled_messages');
        console.log('⏰ [MongoDB] Conectado al sistema de plantillas y mensajes programados (Interaction).');
    }
    return { templates: schedTemplatesCollection, jobs: scheduledJobsCollection };
}

export const scheduledSessions = new Map<string, any>();

export async function handleScheduledInteractions(interaction: any): Promise<boolean> {
    try {
        // --- 1. BOTONES PRINCIPALES DE ENTRADA ---
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId === 'dash_btn_scheduled_msg') {
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('sched_btn_new').setLabel('Crear Nuevo').setStyle(ButtonStyle.Success).setEmoji('➕'),
                    new ButtonBuilder().setCustomId('sched_btn_existing').setLabel('Usar Plantilla').setStyle(ButtonStyle.Primary).setEmoji('📂'),
                    new ButtonBuilder().setCustomId('sched_btn_list').setLabel('Ver Historial / Programados').setStyle(ButtonStyle.Secondary).setEmoji('📋')
                );

                await interaction.reply({
                    content: '📅 **Sistema de Mensajes Programados**\n¿Qué deseas hacer?',
                    components: [row],
                    flags: [MessageFlags.Ephemeral]
                });
                return true;
            }

            if (customId === 'sched_btn_list') {
                if (!interaction.guildId) return true;

                const { jobs } = await getSchedCollections();
                const allJobs = await jobs.find({ guildId: interaction.guildId }).toArray();

                if (allJobs.length === 0) {
                    await interaction.reply({
                        content: '❌ No hay ningún registro de mensajes en la base de datos para este servidor.',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return true;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x00AAFF)
                    .setTitle('📋 Historial Completo de Mensajes Programados')
                    .setDescription(`Se encontraron **${allJobs.length}** registro(s) en total:`)
                    .setTimestamp();

                allJobs.forEach((job: any, index: number) => {
                    const previewText = job.text ? job.text.substring(0, 45) + '...' : '[Sin texto]';
                    let statusEmoji = '⏳ Pendiente';
                    if (job.status === 'sent') statusEmoji = '✅ Enviado';
                    else if (job.status) statusEmoji = `📌 ${job.status}`;

                    embed.addFields({
                        name: `🆔 Trabajo #${index + 1} [${statusEmoji}]`,
                        value: `📢 Canal: <#${job.channelId}>\n📅 Fecha: **${job.date \vert{}\vert{} 'N/A'} a las${job.time || 'N/A'}**\n💬 Texto: *${previewText}*\n🔄 Repite: ${job.repeats ? 'Sí' : 'No'}`,
                        inline: false
                    });
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('sched_delete_job_select')
                    .setPlaceholder('🗑️ Selecciona un registro para borrarlo...')
                    .addOptions(allJobs.map((job: any, index: number) => ({
                        label: `Borrar #${index + 1} (${job.date \vert{}\vert{} 'S/F'} -${job.status || 'pend.'})`,
                        description: (job.text ? job.text.substring(0, 75) : 'Sin texto'),
                        value: job._id.toString()
                    })));

                const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    flags: [MessageFlags.Ephemeral]
                });
                return true;
            }

            if (customId === 'sched_btn_new') {
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

            if (customId === 'sched_btn_existing') {
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
        }

        // --- 2. DELEGAR EL RESTO DE ACCIONES A LA PARTE 2 ---
        const handledByActions = await handleScheduledActions(interaction);
        if (handledByActions) return true;

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador principal de Scheduled:', error);
        return false;
    }
}
