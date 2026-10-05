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
    MessageFlags
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

// 1. Iniciar encuesta desde el panel staff -> Muestra el modal limpio
export async function handleEncuestaStart(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_encuesta_create') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_encuesta_create')
        .setTitle('📊 Crear Nueva Encuesta');

    const titleInput = new TextInputBuilder()
        .setCustomId('encuesta_title')
        .setLabel('Línea 1: Título de la encuesta')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: ¿Qué circuito corrimos la próxima semana?')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('encuesta_desc')
        .setLabel('Línea 2: Descripción detallada')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe los detalles o contexto de la votación...')
        .setRequired(true);

    const optionsInput = new TextInputBuilder()
        .setCustomId('encuesta_options_block')
        .setLabel('Cajón 3: Opciones (Escribe una por línea)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('🟢 Monza\n🔴 Spa-Francorchamps\n🟡 Silverstone\n🔵 Nürburgring')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(optionsInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Procesar el formulario -> Guarda temporalmente en MongoDB y pide Canal de Publicación
export async function handleEncuestaCreateSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_encuesta_create') return false;

    const title = interaction.fields.getTextInputValue('encuesta_title');
    const description = interaction.fields.getTextInputValue('encuesta_desc');
    const optionsRaw = interaction.fields.getTextInputValue('encuesta_options_block');
    
    const lines = optionsRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
        await interaction.reply({ 
            content: '❌ Debes introducir al menos **2 opciones** (una por línea).', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    const { pendingPollsCol } = await getCollections();

    // Guardar en MongoDB (persistente ante reinicios)
    await pendingPollsCol.updateOne(
        { userId: interaction.user.id },
        { 
            $set: { 
                userId: interaction.user.id,
                guildId: interaction.guildId,
                title, 
                description, 
                options: lines, 
                createdAt: new Date() 
            } 
        },
        { upsert: true }
    );

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_select_channel')
        .setPlaceholder('📢 Selecciona el canal de publicación de la encuesta...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '📢 **Paso 1/3 (Canal de publicación):** Selecciona el canal de destino donde se enviará la encuesta:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 3. Canal de publicación seleccionado -> Pide Rol opcional
export async function handleEncuestaChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'encuesta_select_channel') return false;

    const publishChannelId = interaction.values[0];
    const { pendingPollsCol } = await getCollections();

    await pendingPollsCol.updateOne(
        { userId: interaction.user.id },
        { $set: { publishChannelId } }
    );

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('encuesta_select_role')
        .setPlaceholder('🏷️ Selecciona un rol a mencionar (Opcional)...');

    const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const rowSkip = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('encuesta_skip_role').setLabel('Omitir mención de rol').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
        content: `📢 Canal de publicación seleccionado (<#${publishChannelId}>).\n**Paso 2/3 (Mención):** Selecciona un rol si deseas mencionarlo al publicar, o pulsa omitir:`,
        components: [rowRole, rowSkip]
    });

    return true;
}

// 4. Rol seleccionado o saltado -> Pide Canal de Respuestas (Logs)
export async function handleEncuestaRoleSelection(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'encuesta_select_role' && interaction.customId !== 'encuesta_skip_role') return false;

    let roleId = null;
    if (interaction.isRoleSelectMenu()) {
        roleId = interaction.values[0];
    }

    const { pendingPollsCol } = await getCollections();
    await pendingPollsCol.updateOne(
        { userId: interaction.user.id },
        { $set: { roleId } }
    );

    const selectLogChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_select_log_channel')
        .setPlaceholder('📥 Selecciona el canal de respuestas / registro de votos...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectLogChannel);

    await interaction.update({
        content: '📥 **Paso 3/3 (Canal de respuestas):** Selecciona el canal donde el bot registrará y avisará cada vez que alguien vote:',
        components: [row]
    });

    return true;
}

// 5. Canal de respuestas seleccionado -> Publica la encuesta, añade reacciones y guarda en BD definitiva
export async function handleEncuestaLogChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'encuesta_select_log_channel') return false;

    const logChannelId = interaction.values[0];
    const { pendingPollsCol, activePollsCol } = await getCollections();

    const pollData = await pendingPollsCol.findOne({ userId: interaction.user.id });
    if (!pollData || !interaction.guild) {
        await interaction.update({ content: '❌ Sesión no encontrada. Vuelve a iniciar la encuesta desde el panel.', components: [] });
        return true;
    }

    try {
        const publishChannel = await interaction.guild.channels.fetch(pollData.publishChannelId) as TextChannel;
        if (!publishChannel || !publishChannel.isTextBased()) {
            await interaction.update({ content: '❌ El canal de publicación seleccionado no es válido.', components: [] });
            return true;
        }

        const parsedOptions = pollData.options.map((optStr: string) => {
            const match = optStr.match(/^(\p{Extended_Pictographic}|\p{Emoji_Component}|\p{Symbol})+/u);
            const emoji = match ? match[0] : '📌';
            const text = optStr.replace(emoji, '').trim();
            return { raw: optStr, emoji, text };
        });

        const embed = new EmbedBuilder()
            .setColor(0x00AAFF)
            .setTitle(`📊 ${pollData.title}`)
            .setDescription(`${pollData.description}\n\n` + parsedOptions.map((o: any) => `${o.emoji} ➔ ${o.text}`).join('\n\n'))
            .setFooter({ text: `Encuesta creada por ${interaction.user.tag}` })
            .setTimestamp();

        let messageContent = pollData.roleId ? `<@&${pollData.roleId}>\n\n` : undefined;

        const pollMessage = await publishChannel.send({
            content: messageContent,
            embeds: [embed]
        });

        for (const o of parsedOptions) {
            try {
                await pollMessage.react(o.emoji);
            } catch (err) {
                console.error(`❌ No se pudo añadir la reacción ${o.emoji}:`, err);
            }
        }

        // Guardar en la colección definitiva de encuestas activas
        await activePollsCol.insertOne({
            guildId: interaction.guildId,
            messageId: pollMessage.id,
            logChannelId: logChannelId,
            title: pollData.title,
            options: parsedOptions,
            createdAt: new Date()
        });

        // Borrar el registro temporal pendiente
        await pendingPollsCol.deleteOne({ userId: interaction.user.id });

        await interaction.update({
            content: `✅ **¡Encuesta publicada con éxito en <#${pollData.publishChannelId}>!**\nLos votos se auditarán en el canal de respuestas <#${logChannelId}>.`,
            components: []
        });

    } catch (error) {
        console.error('❌ Error al publicar la encuesta:', error);
        await interaction.update({ content: '❌ Hubo un error al publicar la encuesta o guardar en la base de datos.', components: [] });
    }

    return true;
}

// 6. 🗳️ LISTENER DE REACCIONES (Canal de respuestas / Logs)
export async function handleEncuestaReactionAdd(reaction: any, user: any) {
    try {
        if (user.bot) return;

        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const { activePollsCol } = await getCollections();
        const poll = await activePollsCol.findOne({ messageId: reaction.message.id });
        if (!poll) return;

        const emojiString = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        const matchedOption = poll.options.find((o: any) => o.emoji === emojiString || o.emoji === reaction.emoji.name);

        if (!matchedOption) return;

        const guild = reaction.message.guild;
        if (!guild) return;

        const logChannel = await guild.channels.fetch(poll.logChannelId).catch(() => null) as TextChannel;
        if (!logChannel || !logChannel.isTextBased()) return;

        const logEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('📥 Nuevo Voto Registrado')
            .setDescription(`**Encuesta:** ${poll.title}\n**Usuario:** <@${user.id}> (${user.tag})\n**Ha votado por:** ${matchedOption.emoji} ${matchedOption.text}`)
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });

    } catch (error) {
        console.error('❌ Error al registrar voto de encuesta:', error);
    }
}
