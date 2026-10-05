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

let pollsCollection: any = null;
const encuestaSessions = new Map<string, any>();

async function getPollsCollection() {
    if (!pollsCollection) {
        await clientMongo.connect();
        pollsCollection = clientMongo.db('redline_bot').collection('active_polls');
        console.log('📊 [MongoDB] Conectado al sistema de encuestas.');
    }
    return pollsCollection;
}

// 1. Iniciar encuesta desde el panel staff -> Muestra el modal con Título, Descripción y Opciones en bloque
export async function handleEncuestaStart(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_encuesta_create') return false;

    encuestaSessions.set(interaction.user.id, {});

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

// 2. Procesar el formulario -> Guarda Título, Desc y parsea las opciones línea por línea, luego pide Canal de Publicación
export async function handleEncuestaCreateSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_encuesta_create') return false;

    const session = encuestaSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.title = interaction.fields.getTextInputValue('encuesta_title');
    session.description = interaction.fields.getTextInputValue('encuesta_desc');
    
    const optionsRaw = interaction.fields.getTextInputValue('encuesta_options_block');
    
    // Separar por saltos de línea y limpiar líneas vacías
    const lines = optionsRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
        await interaction.reply({ 
            content: '❌ Debes introducir al menos **2 opciones** (una por línea).', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    session.options = lines;
    encuestaSessions.set(interaction.user.id, session);

    // Siguiente paso: Pedir Canal de Publicación
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

    const session = encuestaSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    session.publishChannelId = interaction.values[0];
    encuestaSessions.set(interaction.user.id, session);

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('encuesta_select_role')
        .setPlaceholder('🏷️ Selecciona un rol a mencionar (Opcional)...');

    const rowRole = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);
    const rowSkip = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('encuesta_skip_role').setLabel('Omitir mención de rol').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
        content: `📢 Canal de publicación seleccionado (<#${session.publishChannelId}>).\n**Paso 2/3 (Mención):** Selecciona un rol si deseas mencionarlo al publicar, o pulsa omitir:`,
        components: [rowRole, rowSkip]
    });

    return true;
}

// 4. Rol seleccionado o saltado -> Pide Canal de Respuestas (Logs)
export async function handleEncuestaRoleSelection(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'encuesta_select_role' && interaction.customId !== 'encuesta_skip_role') return false;

    const session = encuestaSessions.get(interaction.user.id);
    if (!session) {
        if (interaction.isRepliable()) await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    if (interaction.isRoleSelectMenu()) {
        session.roleId = interaction.values[0];
    } else {
        session.roleId = null;
    }
    encuestaSessions.set(interaction.user.id, session);

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

// 5. Canal de respuestas seleccionado -> Publica la encuesta, añade reacciones y guarda en BD
export async function handleEncuestaLogChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'encuesta_select_log_channel') return false;

    const session = encuestaSessions.get(interaction.user.id);
    if (!session || !interaction.guild) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    session.logChannelId = interaction.values[0];

    try {
        const publishChannel = await interaction.guild.channels.fetch(session.publishChannelId) as TextChannel;
        if (!publishChannel || !publishChannel.isTextBased()) {
            await interaction.update({ content: '❌ El canal de publicación seleccionado no es válido.', components: [] });
            return true;
        }

        // Parsear cada línea extraorndo el emoji del inicio
        const parsedOptions = session.options.map((optStr: string) => {
            const match = optStr.match(/^(\p{Extended_Pictographic}|\p{Emoji_Component}|\p{Symbol})+/u);
            const emoji = match ? match[0] : '📌';
            const text = optStr.replace(emoji, '').trim();
            return { raw: optStr, emoji, text };
        });

        const embed = new EmbedBuilder()
            .setColor(0x00AAFF)
            .setTitle(`📊 ${session.title}`)
            .setDescription(`${session.description}\n\n` + parsedOptions.map((o: any) => `${o.emoji} ➔ ${o.text}`).join('\n\n'))
            .setFooter({ text: `Encuesta creada por ${interaction.user.tag}` })
            .setTimestamp();

        let messageContent = session.roleId ? `<@&${session.roleId}>\n\n` : undefined;

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

        const col = await getPollsCollection();
        await col.insertOne({
            guildId: interaction.guildId,
            messageId: pollMessage.id,
            logChannelId: session.logChannelId,
            title: session.title,
            options: parsedOptions,
            createdAt: new Date()
        });

        encuestaSessions.delete(interaction.user.id);

        await interaction.update({
            content: `✅ **¡Encuesta publicada con éxito en <#${session.publishChannelId}>!**\nLos votos se auditarán en el canal de respuestas <#${session.logChannelId}>.`,
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

        const col = await getPollsCollection();
        const poll = await col.findOne({ messageId: reaction.message.id });
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
