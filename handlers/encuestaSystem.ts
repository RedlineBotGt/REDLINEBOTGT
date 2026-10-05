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
    StringSelectMenuBuilder,
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

// 1. Iniciar encuesta -> Muestra los 4 selectores y el botón
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

    const selectDuration = new StringSelectMenuBuilder()
        .setCustomId('encuesta_pre_duration')
        .setPlaceholder('Duración de la encuesta (1 a 7 días)...')
        .addOptions([
            { label: '1 Día', value: '1' },
            { label: '2 Días', value: '2' },
            { label: '3 Días', value: '3' },
            { label: '4 Días', value: '4' },
            { label: '5 Días', value: '5' },
            { label: '6 Días', value: '6' },
            { label: '7 Días', value: '7' },
        ]);

    const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('encuesta_btn_open_modal')
            .setLabel('Siguiente: Rellenar Título y Opciones')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
        content: 'Configuración de Encuesta: Selecciona el canal de publicación, el rol, el canal de respuestas y los días de duración, y luego pulsa el botón:',
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectPublishChannel),
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole),
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectLogChannel),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectDuration),
            rowButton
        ],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Guardar selecciones de los menús en MongoDB temporalmente
export async function handleEncuestaPreSelections(interaction: any): Promise<boolean> {
    if (!['encuesta_pre_publish_channel', 'encuesta_pre_role', 'encuesta_pre_log_channel', 'encuesta_pre_duration'].includes(interaction.customId)) {
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
    } else if (interaction.customId === 'encuesta_pre_duration') {
        updateData.durationDays = parseInt(interaction.values[0], 10);
    }

    await pendingPollsCol.updateOne(
        { userId: interaction.user.id },
        { $set: { userId: interaction.user.id, guildId: interaction.guildId, ...updateData } },
        { upsert: true }
    );

    await interaction.update({ content: 'Selección guardada correctamente. Continúa con los demás campos o pulsa el botón.' });
    return true;
}

// 3. Botón "Siguiente" -> Valida que estén los campos antes de abrir el modal
export async function handleEncuestaOpenModalButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'encuesta_btn_open_modal') return false;

    const { pendingPollsCol } = await getCollections();
    const pollData = await pendingPollsCol.findOne({ userId: interaction.user.id });

    if (!pollData || !pollData.publishChannelId || !pollData.logChannelId || !pollData.durationDays) {
        await interaction.reply({
            content: 'Debes seleccionar obligatoriamente el Canal de publicación, el Canal de respuestas y la Duración (días) en los menús antes de abrir el formulario.',
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
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Qué circuito corremos la próxima semana?')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('encuesta_desc')
        .setLabel('Descripción detallada')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe los detalles o contexto de la votación...')
        .setRequired(true);

    const optionsInput = new TextInputBuilder()
        .setCustomId('encuesta_options_block')
        .setLabel('Opciones (Una por línea con emoji)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Monza\nSpa-Francorchamps\nSilverstone\nNürburgring')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(optionsInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 4. Procesar el envío del modal -> Publicar encuesta definitiva
export async function handleEncuestaFinalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_encuesta_final') return false;

    const title = interaction.fields.getTextInputValue('encuesta_title');
    const description = interaction.fields.getTextInputValue('encuesta_desc');
    const optionsRaw = interaction.fields.getTextInputValue('encuesta_options_block');

    const lines = optionsRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
        await interaction.reply({ 
            content: 'Debes introducir al menos 2 opciones (una por línea).', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    const { pendingPollsCol, activePollsCol } = await getCollections();
    const pollData = await pendingPollsCol.findOne({ userId: interaction.user.id });

    if (!pollData || !pollData.publishChannelId || !pollData.logChannelId || !pollData.durationDays || !interaction.guild) {
        await interaction.reply({
            content: 'Faltan datos de configuración. Por favor, vuelve a iniciar la encuesta desde el panel.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    try {
        const publishChannel = await interaction.guild.channels.fetch(pollData.publishChannelId) as TextChannel;
        if (!publishChannel || !publishChannel.isTextBased()) {
            await interaction.reply({ content: 'El canal de publicación seleccionado no es válido.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const parsedOptions = lines.map((optStr: string) => {
            const match = optStr.match(/^(\p{Extended_Pictographic}|\p{Emoji_Component}|\p{Symbol})+/u);
            const emoji = match ? match[0] : '📌';
            const text = optStr.replace(emoji, '').trim();
            return { raw: optStr, emoji, text };
        });

        const durationDays = pollData.durationDays;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);
        const unixTimestamp = Math.floor(expiresAt.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setColor(0x00AAFF)
            .setTitle(title)
            .setDescription(
                `${description}\n\n` +
                `🕒 **Duración:** ${durationDays} ${durationDays === 1 ? 'día' : 'días'} (Expira: <t:${unixTimestamp}:R>)\n\n` +
                parsedOptions.map((o: any) => `${o.emoji} ➔ ${o.text}`).join('\n\n')
            )
            .setFooter({ text: `Encuesta creada por ${interaction.guild?.name}` })
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
                console.error(`No se pudo añadir la reacción ${o.emoji}:`, err);
            }
        }

        await activePollsCol.insertOne({
            guildId: interaction.guildId,
            messageId: pollMessage.id,
            publishChannelId: pollData.publishChannelId, // 👈 Guardamos el canal de publicación para el cierre automático
            logChannelId: pollData.logChannelId,
            title: title,
            options: parsedOptions,
            durationDays: durationDays,
            expiresAt: expiresAt,
            closed: false,
            createdAt: new Date()
        });

        await pendingPollsCol.deleteOne({ userId: interaction.user.id });

        await interaction.reply({
            content: `Encuesta publicada con éxito. Durará ${durationDays} días y publicará el resultado al finalizar.`,
            flags: [MessageFlags.Ephemeral]
        });

    } catch (error) {
        console.error('Error al publicar la encuesta:', error);
        await interaction.reply({ content: 'Hubo un error al publicar la encuesta o guardar en la base de datos.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 5. 🗳️ LISTENER DE REACCIONES (Canal de respuestas / Logs)
export async function handleEncuestaReactionAdd(reaction: any, user: any) {
    try {
        if (user.bot) return;

        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const { activePollsCol } = await getCollections();
        const poll = await activePollsCol.findOne({ messageId: reaction.message.id });
        if (!poll || poll.closed) return; // Si ya está cerrada o no existe, ignorar

        if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
            return; 
        }

        const emojiValue = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        
        const matchedOption = poll.options.find((o: any) => 
            o.emoji === emojiValue || 
            o.emoji === reaction.emoji.name || 
            emojiValue.includes(o.emoji) ||
            o.emoji.includes(reaction.emoji.name)
        );

        if (!matchedOption) return;

        const guild = reaction.message.guild;
        if (!guild) return;

        const logChannel = await guild.channels.fetch(poll.logChannelId).catch(() => null) as TextChannel;
        if (!logChannel || !logChannel.isTextBased()) return;

        const logEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Nuevo Voto Registrado')
            .setDescription(`**Encuesta:** ${poll.title}\n**Usuario:** <@${user.id}> (${user.tag})\n**Ha votado por:** ${matchedOption.emoji} ${matchedOption.text}`)
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });

    } catch (error) {
        console.error('Error al registrar voto de encuesta:', error);
    }
}

// 6. 🕒 WORKER AUTOMÁTICO: Cierra las encuestas expiradas y publica los resultados finales
export function startPollsWorker(client: Client) {
    setInterval(async () => {
        try {
            const { activePollsCol } = await getCollections();
            const now = new Date();
            
            const expiredPolls = await activePollsCol.find({
                expiresAt: { $lte: now },
                closed: { $ne: true }
            }).toArray();

            for (const poll of expiredPolls) {
                try {
                    const guild = await client.guilds.fetch(poll.guildId).catch(() => null);
                    if (!guild) {
                        await activePollsCol.updateOne({ _id: poll._id }, { $set: { closed: true } });
                        continue;
                    }

                    const publishChannel = await guild.channels.fetch(poll.publishChannelId).catch(() => null) as TextChannel;
                    const logChannel = await guild.channels.fetch(poll.logChannelId).catch(() => null) as TextChannel;

                    // Conteo de votos reales mediante las reacciones del mensaje
                    const results = [];
                    if (publishChannel) {
                        const message = await publishChannel.messages.fetch(poll.messageId).catch(() => null);
                        if (message) {
                            for (const opt of poll.options) {
                                const reaction = message.reactions.cache.get(opt.emoji);
                                let voteCount = 0;
                                if (reaction) {
                                    const users = await reaction.users.fetch();
                                    voteCount = users.filter(u => !u.bot).size; // Excluimos al bot
                                }
                                results.push({ ...opt, votes: voteCount });
                            }

                            // Ordenar de mayor a menor número de votos
                            results.sort((a, b) => b.votes - a.votes);
                            const winner = results[0];

                            // Embed final de encuesta cerrada
                            const finalEmbed = new EmbedBuilder()
                                .setColor(0xFF5500)
                                .setTitle(`🔴 [ENCUESTA CERRADA] ${poll.title}`)
                                .setDescription(
                                    `La votación ha finalizado.\n\n` +
                                    `🏆 **Opción Ganadora:** ${winner.emoji} ${winner.text} (${winner.votes} ${winner.votes === 1 ? 'voto' : 'votos'})\n\n` +
                                    `**📊 Resultados finales:**\n` +
                                    results.map(o => `${o.emoji} ➔ ${o.text}: **${o.votes}** ${o.votes === 1 ? 'voto' : 'votos'}`).join('\n')
                                )
                                .setFooter({ text: `Encuesta finalizada automáticamente` })
                                .setTimestamp();

                            await message.edit({ content: null, embeds: [finalEmbed] }).catch(() => {});
                        }
                    }

                    // Enviar aviso al canal de logs
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0xFF5500)
                            .setTitle('🔴 Encuesta Finalizada')
                            .setDescription(`La encuesta **"${poll.title}"** ha terminado automáticamente y se han publicado los resultados.`)
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                    }

                    // Marcar como cerrada en MongoDB
                    await activePollsCol.updateOne(
                        { _id: poll._id },
                        { $set: { closed: true } }
                    );

                } catch (pollErr) {
                    console.error(`Error procesando cierre de encuesta ${poll.messageId}:`, pollErr);
                }
            }
        } catch (error) {
            console.error('Error crítico en el worker de encuestas:', error);
        }
    }, 60 * 1000); // Revisa cada 1 minuto
}
