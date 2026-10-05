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
const encuestaSessions = new Map<string, any>(); // 👈 Variable de sesiones declarada correctamente aquí

async function getPollsCollection() {
    if (!pollsCollection) {
        await clientMongo.connect();
        pollsCollection = clientMongo.db('redline_bot').collection('active_polls');
        console.log('📊 [MongoDB] Conectado al sistema de encuestas.');
    }
    return pollsCollection;
}

// 1. Iniciar encuesta desde el botón del dashstaff -> Pide Título y Descripción (Modal 1)
export async function handleEncuestaStart(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_encuesta_create') return false;

    encuestaSessions.set(interaction.user.id, { options: [] });

    const modal = new ModalBuilder()
        .setCustomId('modal_encuesta_step1')
        .setTitle('📊 Crear Encuesta (1/3)');

    const titleInput = new TextInputBuilder()
        .setCustomId('encuesta_title')
        .setLabel('Título de la encuesta')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: ¿Qué circuito corrimos la próxima semana?')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('encuesta_desc')
        .setLabel('Descripción / Pregunta detallada')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe los detalles o contexto de la votación...')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 2. Procesar Título/Desc -> Abre Modal para las primeras 3 Opciones (Modal 2)
export async function handleEncuestaStep1Submit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_encuesta_step1') return false;

    const session = encuestaSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.title = interaction.fields.getTextInputValue('encuesta_title');
    session.description = interaction.fields.getTextInputValue('encuesta_desc');
    encuestaSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId('modal_encuesta_step2')
        .setTitle('📊 Opciones de la Encuesta (2/3)');

    const opt1 = new TextInputBuilder()
        .setCustomId('encuesta_opt1')
        .setLabel('Opción 1 (Emoji y texto)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🟢 Monza')
        .setRequired(true);

    const opt2 = new TextInputBuilder()
        .setCustomId('encuesta_opt2')
        .setLabel('Opción 2 (Emoji y texto)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🔴 Spa-Francorchamps')
        .setRequired(true);

    const opt3 = new TextInputBuilder()
        .setCustomId('encuesta_opt3')
        .setLabel('Opción 3 (Emoji y texto)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🟡 Silverstone')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(opt1),
        new ActionRowBuilder<TextInputBuilder>().addComponents(opt2),
        new ActionRowBuilder<TextInputBuilder>().addComponents(opt3)
    );

    await interaction.showModal(modal);
    return true;
}

// 3. Procesar Opciones 1, 2 y 3 -> Muestra panel para añadir más o continuar
export async function handleEncuestaStep2Submit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_encuesta_step2') return false;

    const session = encuestaSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const o1 = interaction.fields.getTextInputValue('encuesta_opt1').trim();
    const o2 = interaction.fields.getTextInputValue('encuesta_opt2').trim();
    const o3 = interaction.fields.getTextInputValue('encuesta_opt3').trim();

    session.options = [o1, o2, o3];
    encuestaSessions.set(interaction.user.id, session);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('encuesta_add_more').setLabel('➕ Añadir otra opción').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('encuesta_options_done').setLabel('✅ Continuar con la configuración').setStyle(ButtonStyle.Success)
    );

    let listText = session.options.map((opt: string, idx: number) => `**${idx + 1}.** ${opt}`).join('\n');

    await interaction.reply({
        content: `📊 **Opciones actuales añadidas:**\n${listText}\n\n¿Deseas añadir más opciones o prefieres continuar al siguiente paso?`,
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 4. Botón "Añadir otra opción" -> Abre mini modal para una opción extra
export async function handleEncuestaAddMoreButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'encuesta_add_more') return false;

    const modal = new ModalBuilder()
        .setCustomId('modal_encuesta_add_single')
        .setTitle('➕ Añadir Opción Extra');

    const extraOpt = new TextInputBuilder()
        .setCustomId('encuesta_extra_opt')
        .setLabel('Nueva Opción (Emoji y texto)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: 🔵 Nürburgring')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(extraOpt));
    await interaction.showModal(modal);
    return true;
}

// 5. Procesar opción extra y volver a mostrar botones
export async function handleEncuestaAddSingleSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_encuesta_add_single') return false;

    const session = encuestaSessions.get(interaction.user.id);
    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const extra = interaction.fields.getTextInputValue('encuesta_extra_opt').trim();
    session.options.push(extra);
    encuestaSessions.set(interaction.user.id, session);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('encuesta_add_more').setLabel('➕ Añadir otra opción').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('encuesta_options_done').setLabel('✅ Continuar con la configuración').setStyle(ButtonStyle.Success)
    );

    let listText = session.options.map((opt: string, idx: number) => `**${idx + 1}.** ${opt}`).join('\n');

    await interaction.update({
        content: `📊 **Opciones actuales añadidas:**\n${listText}\n\n¿Deseas añadir más opciones o prefieres continuar al siguiente paso?`,
        components: [row]
    });

    return true;
}

// 6. Botón "Continuar" -> Pide Canal de Publicación
export async function handleEncuestaOptionsDoneButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'encuesta_options_done') return false;

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_select_channel')
        .setPlaceholder('📢 Selecciona el canal donde se publicará la encuesta...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.update({
        content: '📢 **Paso 3/3 (Canal de publicación):** Selecciona el canal de destino para la encuesta:',
        components: [row]
    });

    return true;
}

// 7. Canal de publicación seleccionado -> Pide Rol a mencionar
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
        content: `📢 Canal seleccionado (<#${session.publishChannelId}>).\n**Paso extra:** Selecciona un rol si deseas mencionarlo al publicar, o pulsa omitir:`,
        components: [rowRole, rowSkip]
    });

    return true;
}

// 8. Rol seleccionado o saltado -> Pide Canal de Reacciones (Logs)
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
        .setPlaceholder('📥 Selecciona el canal donde caerán los avisos de votos...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectLogChannel);

    await interaction.update({
        content: '📥 **Paso final:** Selecciona el canal de reacciones/logs donde el bot avisará cada vez que alguien vote:',
        components: [row]
    });

    return true;
}

// 9. Canal de logs seleccionado -> Publica la encuesta y la guarda en BD
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
            content: `✅ **¡Encuesta publicada con éxito en <#${session.publishChannelId}>!**\nLos avisos de votos se registrarán en <#${session.logChannelId}>.`,
            components: []
        });

    } catch (error) {
        console.error('❌ Error al publicar la encuesta:', error);
        await interaction.update({ content: '❌ Hubo un error al publicar la encuesta o guardar en la base de datos.', components: [] });
    }

    return true;
}

// 10. 🗳️ LISTENER DE REACCIONES
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
            .setTitle('📥 Nuevo Voto en Encuesta')
            .setDescription(`**Encuesta:** ${poll.title}\n**Usuario:** <@${user.id}> (${user.tag})\n**Ha votado:** ${matchedOption.emoji} ${matchedOption.text}`)
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });

    } catch (error) {
        console.error('❌ Error al registrar voto de encuesta:', error);
    }
}
