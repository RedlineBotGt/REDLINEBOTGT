 import { 
    ButtonInteraction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    StringSelectMenuBuilder,
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

// 1. Paso inicial: Menús desplegables para configuración previa
export async function handleEncuestaStart(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_encuesta_create') return false;

    const selectPublishChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_publish_channel')
        .setPlaceholder('Canal destino de la encuesta...')
        .addChannelTypes(ChannelType.GuildText);

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('encuesta_pre_role')
        .setPlaceholder('Rol a mencionar (Opcional)...');

    const selectLogChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_log_channel')
        .setPlaceholder('Canal destino respuestas...');

    const selectAvisoChannel = new ChannelSelectMenuBuilder()
        .setCustomId('encuesta_pre_aviso_channel')
        .setPlaceholder('Canal avisos (reacciones)...');

    const selectDuration = new StringSelectMenuBuilder()
        .setCustomId('encuesta_pre_duration')
        .setPlaceholder('Duración (en días hasta 15)...')
        .addOptions(
            Array.from({ length: 15 }, (_, i) => ({
                label: `${i + 1} ${i === 0 ? 'día' : 'días'}`,
                value: String(i + 1)
            }))
        );

    const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('encuesta_btn_open_modal')
            .setLabel('Siguiente: Rellenar Título, Descripción y Opciones')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
        content: '📊 **Configuración de Encuesta:** Selecciona las opciones en los menús desplegables y pulsa el botón:',
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectPublishChannel),
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole),
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectLogChannel),
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectAvisoChannel),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectDuration),
            rowButton
        ],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Maneja las selecciones de los menús previos
export async function handleEncuestaPreSelections(interaction: any): Promise<boolean> {
    if (!['encuesta_pre_publish_channel', 'encuesta_pre_role', 'encuesta_pre_log_channel', 'encuesta_pre_aviso_channel', 'encuesta_pre_duration'].includes(interaction.customId)) {
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
    } else if (interaction.customId === 'encuesta_pre_aviso_channel') {
        updateData.avisoChannelId = interaction.values[0];
    } else if (interaction.customId === 'encuesta_pre_duration') {
        updateData.durationDays = parseInt(interaction.values[0], 10);
    }

    await pendingPollsCol.updateOne(
        { userId: interaction.user.id },
        { $set: { userId: interaction.user.id, guildId: interaction.guildId, ...updateData } },
        { upsert: true }
    );

    await interaction.update({ content: '✅ Selección guardada correctamente. Continúa con los demás menús o pulsa el botón.' });
    return true;
}

// 3. Abre el formulario modal para el contenido de la encuesta
export async function handleEncuestaOpenModalButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'encuesta_btn_open_modal') return false;

    const { pendingPollsCol } = await getCollections();
    const pollData = await pendingPollsCol.findOne({ userId: interaction.user.id });

    if (!pollData || !pollData.publishChannelId || !pollData.logChannelId || !pollData.avisoChannelId || !pollData.durationDays) {
        await interaction.reply({
            content: '❌ Debes configurar obligatoriamente todos los campos en los menús desplegables (Canal de publicación, Canal de respuestas, Canal de avisos y Duración) antes de abrir el formulario.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const modal = new ModalBuilder()
        .setCustomId('modal_encuesta_final')
        .setTitle('Formulario de Encuesta');

    const titleInput = new TextInputBuilder()
        .setCustomId('encuesta_title')
        .setLabel('Título')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Qué circuito corremos la próxima semana?')
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('encuesta_desc')
        .setLabel('Descripción')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe los detalles o contexto de la votación...')
        .setRequired(true);

    const optionsInput = new TextInputBuilder()
        .setCustomId('encuesta_options_block')
        .setLabel('Opciones (Icono + espacio + opción por fila)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('1️⃣ Monza\n2️⃣ Spa-Francorchamps\n3️⃣ Silverstone')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(optionsInput)
    );

    await interaction.showModal(modal);
    return true;
}

// 4. Procesa el envío del modal, publica el mensaje y programa la encuesta
export async function handleEncuestaFinalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_encuesta_final') return false;

    const title = interaction.fields.getTextInputValue('encuesta_title');
    const description = interaction.fields.getTextInputValue('encuesta_desc');
    const optionsRaw = interaction.fields.getTextInputValue('encuesta_options_block');

    const { pendingPollsCol, activePollsCol } = await getCollections();
    const pollData = await pendingPollsCol.findOne({ userId: interaction.user.id });

    if (!pollData || !pollData.publishChannelId || !pollData.logChannelId || !pollData.avisoChannelId || !pollData.durationDays || !interaction.guild) {
        await interaction.reply({
            content: '❌ Faltan datos de configuración. Por favor, vuelve a iniciar la encuesta desde el panel.',
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    const lines = optionsRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) {
        await interaction.reply({ 
            content: '❌ Debes introducir al menos 2 opciones (formato: [icono] [espacio] [opción] por cada fila).', 
            flags: [MessageFlags.Ephemeral] 
        });
        return true;
    }

    try {
        const publishChannel = await interaction.guild.channels.fetch(pollData.publishChannelId) as TextChannel;
        if (!publishChannel || !publishChannel.isTextBased()) {
            await interaction.reply({ content: '❌ El canal de publicación seleccionado no es válido.', flags: [MessageFlags.Ephemeral] });
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
                parsedOptions.map((o: any) => `${o.emoji} ${o.text}`).join('\n\n')
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
            publishChannelId: pollData.publishChannelId,
            logChannelId: pollData.logChannelId,
            avisoChannelId: pollData.avisoChannelId,
            title: title,
            options: parsedOptions,
            durationDays: durationDays,
            expiresAt: expiresAt,
            closed: false,
            createdAt: new Date()
        });

        await pendingPollsCol.deleteOne({ userId: interaction.user.id });

        await interaction.reply({
            content: `✅ ¡Encuesta publicada con éxito! Estará activa durante ${durationDays} días.`,
            flags: [MessageFlags.Ephemeral]
        });

    } catch (error) {
        console.error('Error al publicar la encuesta:', error);
        await interaction.reply({ content: '❌ Hubo un error al publicar la encuesta o guardar en la base de datos.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

// 5. Maneja las reacciones de los usuarios y envía aviso al canal de avisos seleccionado
export async function handleEncuestaReactionAdd(reaction: any, user: any) {
    try {
        if (user.bot) return;

        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const { activePollsCol } = await getCollections();
        const poll = await activePollsCol.findOne({ messageId: reaction.message.id });
        if (!poll || poll.closed) return;

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

        const avisoChannel = await guild.channels.fetch(poll.avisoChannelId).catch(() => null) as TextChannel;
        if (!avisoChannel || !avisoChannel.isTextBased()) return;

        const avisoEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🔔 Nuevo Voto Registrado')
            .setDescription(`**Encuesta:** ${poll.title}\n**Usuario:** <@${user.id}> (${user.tag})\n**Ha votado por:** ${matchedOption.emoji} ${matchedOption.text}`)
            .setTimestamp();

        await avisoChannel.send({ embeds: [avisoEmbed] });

    } catch (error) {
        console.error('Error al registrar voto de encuesta:', error);
    }
}

// 6. Worker que evalúa el cierre de encuestas, calcula porcentajes, empates y publica resultados
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

                    const results = [];
                    let totalVotes = 0;

                    if (publishChannel) {
                        const message = await publishChannel.messages.fetch(poll.messageId).catch(() => null);
                        if (message) {
                            for (const opt of poll.options) {
                                const reaction = message.reactions.cache.get(opt.emoji);
                                let voteCount = 0;
                                if (reaction) {
                                    const users = await reaction.users.fetch();
                                    voteCount = users.filter(u => !u.bot).size;
                                }
                                totalVotes += voteCount;
                                results.push({ ...opt, votes: voteCount });
                            }

                            // Calcular porcentajes
                            const resultsWithPercentage = results.map(o => {
                                const percentage = totalVotes > 0 ? ((o.votes / totalVotes) * 100).toFixed(1) : '0.0';
                                return { ...o, percentage };
                            });

                            resultsWithPercentage.sort((a, b) => b.votes - a.votes);

                            // Detectar ganadores y empates
                            const maxVotes = Math.max(...resultsWithPercentage.map(o => o.votes));
                            const winners = resultsWithPercentage.filter(o => o.votes === maxVotes);

                            let winnerText = '';
                            if (maxVotes === 0) {
                                winnerText = '❌ No se registraron votos.';
                            } else if (winners.length > 1) {
                                winnerText = `🤝 **¡Empate!** (${winners.map(w => `${w.emoji}${w.text}`).join(', ')}) con **${maxVotes}** votos (${winners[0].percentage}%)`;
                            } else {
                                winnerText = `🏆 **${winners[0].emoji} ${winners[0].text}** (${winners[0].votes} votos - **${winners[0].percentage}%**)`;
                            }

                            const finalEmbed = new EmbedBuilder()
                                .setColor(0xFF5500)
                                .setTitle(`🔴 [RESULTADOS FINALES] ${poll.title}`)
                                .setDescription(
                                    `La votación ha finalizado.\n\n` +
                                    `📊 **Total de votos:** ${totalVotes}\n\n` +
                                    `✨ **Opción Ganadora:**\n${winnerText}\n\n` +
                                    `📋 **Desglose completo:**\n` +
                                    resultsWithPercentage.map(o => `${o.emoji} ➔ ${o.text}: **${o.votes}** votos (**${o.percentage}%**)`.trim()).join('\n')
                                )
                                .setFooter({ text: `Encuesta finalizada automáticamente` })
                                .setTimestamp();

                            // Envía un nuevo embed con los resultados al mismo canal donde se publicó
                            await publishChannel.send({ embeds: [finalEmbed] }).catch(() => {});
                        }
                    }

                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0xFF5500)
                            .setTitle('🔴 Encuesta Finalizada')
                            .setDescription(`La encuesta **"${poll.title}"** ha terminado y se han publicado los resultados finales.`)
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                    }

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
    }, 60 * 1000);
}

// 7. Enrutador central del módulo de encuestas
export async function handleEncuestaInteraction(interaction: any): Promise<boolean> {
    try {
        // Clic en el botón inicial del panel /dashstaff
        if (interaction.isButton() && interaction.customId === 'dash_btn_encuesta_create') {
            return await handleEncuestaStart(interaction);
        }

        // Selección en los menús desplegables previos (canales, rol, duración)
        if (
            (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu()) &&
            ['encuesta_pre_publish_channel', 'encuesta_pre_role', 'encuesta_pre_log_channel', 'encuesta_pre_aviso_channel', 'encuesta_pre_duration'].includes(interaction.customId)
        ) {
            return await handleEncuestaPreSelections(interaction);
        }

        // Clic en el botón para abrir el formulario modal final
        if (interaction.isButton() && interaction.customId === 'encuesta_btn_open_modal') {
            return await handleEncuestaOpenModalButton(interaction);
        }

        // Envío del modal con los datos de la encuesta
        if (interaction.isModalSubmit() && interaction.customId === 'modal_encuesta_final') {
            return await handleEncuestaFinalSubmit(interaction);
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el manejador de interacciones de encuesta:', error);
        return false;
    }
}
