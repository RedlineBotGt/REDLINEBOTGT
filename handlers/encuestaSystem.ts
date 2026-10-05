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
    TextChannel, 
    EmbedBuilder,
    MessageFlags,
    Client 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let pendingPollsCol: any = null;
let activePollsCol: any = null;

async function getCollections() {
    if (!clientMongo.topology || !clientMongo.topology.isConnected()) {
        await clientMongo.connect();
    }
    const db = clientMongo.db('redline_bot');
    pendingPollsCol = db.collection('pending_polls');
    activePollsCol = db.collection('active_polls');
    return { pendingPollsCol, activePollsCol };
}

// 1. Iniciar encuesta -> Muestra los 3 selectores limpios y el botón
export async function handleEncuestaStart(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_encuesta_create') return false;

    const selectPublishChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_publish_channel')
        .setPlaceholder('Canal de publicación...')
        .addChannelTypes(ChannelType.GuildText);

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('encuesta_pre_role')
        .setPlaceholder('Rol a mencionar (Opcional)...');

    const selectLogChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_log_channel')
        .setPlaceholder('Canal de respuestas / logs...');

    const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('encuesta_btn_open_modal')
            .setLabel('Siguiente: Rellenar Título, Opciones y Duración')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
        content: 'Configuración de Encuesta: Selecciona el canal de publicación, el rol y el canal de respuestas, y luego pulsa el botón:',
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectPublishChannel),
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole),
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectLogChannel),
            rowButton
        ],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Guardar selecciones de los menús en MongoDB temporalmente
export async function handleEncuestaPreSelections(interaction: any): Promise<boolean> {
    if (!['encuesta_pre_publish_channel', 'encuesta_pre_role', 'encuesta_pre_log_channel'].includes(interaction.customId)) {
        return false;
    }

    const { pendingPollsCol } = await getCollections();
    const updateData: any = {};

    if (interaction.customId === 'encuesta_pre_publish_channel') {
        updateData.publishChannelId = interaction.values[0];
    } else if (interaction.customId === 'encuesta_pre_role') {
        updateData.roleId = interaction.values[0];
    } else if (interaction.customId === 'encuesta_pre_log_channel') {
        updateData.logChannelId = interaction.values[0];
    }

    await pendingPollsCol.updateOne(
        { userId: interaction.user.id },
        { $set: { userId: interaction.user.id, guildId: interaction.guildId, ...updateData } },
        { upsert: true }
    );

    await interaction.update({ content: 'Selección guardada correctamente. Continúa con los demás campos o pulsa el botón.' });
    return true;
}

// 3. Botón "Siguiente" -> Valida que estén los canales antes de abrir el modal
export async function handleEncuestaOpenModalButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'encuesta_btn_open_modal') return false;

    const { pendingPollsCol } = await getCollections();
    const pollData = await pendingPollsCol.findOne({ userId: interaction.user.id });

    if (!pollData || !pollData.publishChannelId || !pollData.logChannelId) {
        await interaction.reply({
            content: 'Debes seleccionar obligatoriamente el Canal de publicación y el Canal de respuestas en los menús antes de abrir el formulario.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId('modal_encuesta_final')
        .setTitle('Detalles de la Encuesta');

    const titleInput = new TextInputBuilder()
        .setCustomId('encuesta_title')
        .setLabel('Título de la encuesta')
