import { 
    Interaction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelSelectMenuBuilder, 
    StringSelectMenuBuilder,
    ChannelType, 
    EmbedBuilder, 
    TextChannel,
    Message
} from 'discord.js';
import { 
    getClubSession, 
    resetClubSession, 
    addChallengeToSession, 
    editChallengeInSession,
    deleteChallengeFromSession,
    recordUserTime,
    ClubChallenge,
    ClubSession
} from './clubmanager';

/**
 * Función auxiliar para construir el Embed individual de un desafío
 */
export function buildChallengeEmbed(challenge: ClubChallenge): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0xE60000)
        .setTitle(`🏎️ DESAFÍO #${challenge.id}: ${challenge.title}`)
        .setDescription(`📝 **Consigna:** ${challenge.subtitle}\n\n💬 *Responde a este canal con \`#${challenge.id} mm:ss:xxx\` para registrar tu tiempo.*`)
        .setTimestamp()
        .setFooter({ text: 'REDLINE GT' });

    if (challenge.times.length === 0) {
        embed.addFields({
            name: '🏆 CLASIFICACIÓN',
            value: '*Aún no hay tiempos registrados. ¡Sé el primero en marcar una vuelta!*',
            inline: false
        });
    } else {
        const rankingText = challenge.times.map((entry, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⏱️';
            const ptsText = entry.points ? ` *(${entry.points} pts)*` : '';
            return `${medal} **#${idx + 1}** <@${entry.userId}> ➔ **\`${entry.timeStr}\`**${ptsText}`;
        }).join('\n');

        embed.addFields({
            name: '🏆 CLASIFICACIÓN',
            value: rankingText,
            inline: false
        });
    }

    return embed;
}

/**
 * Construye el Embed con el formato limpio de la Clasificación General
 */
export function buildGeneralStandingsEmbed(session: ClubSession): EmbedBuilder {
    const standingsMap = new Map<string, number>();

    // Acumular puntos de todos los desafíos de la sesión
    for (const challenge of session.challenges) {
        for (const entry of challenge.times) {
            const currentPoints = standingsMap.get(entry.userId) || 0;
            standingsMap.set(entry.userId, currentPoints + (entry.points || 0));
        }
    }

    // Ordenar de mayor a menor puntuación
    const sortedStandings = Array.from(standingsMap.entries())
        .sort((a, b) => b[1] - a[1]);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 CLASIFICACIÓN GENERAL - GT CLUB')
        .setTimestamp()
        .setFooter({ text: 'REDLINE GT' });

    if (sortedStandings.length === 0) {
        embed.setDescription('*Aún no hay puntos acumulados en ningún desafío.*');
    } else {
        const rankingText = sortedStandings.map(([userId, points], idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '4️⃣';
            return `${medal} <@${userId}> ➔ **${points} pts**`;
        }).join('\n');

        embed.setDescription(rankingText);
    }

    return embed;
}

/**
 * Muestra el panel principal de control cuando ya existen desafíos
 */
export async function showClubControlPanel(interaction: any): Promise<void> {
    const session = getClubSession(interaction.guildId!);

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('⚙️ GT CLUB - PANEL DE CONTROL')
        .setDescription(`Estado: **${session.active ? '🟢 Activo' : '🟠 En configuración'}**\nDesafíos registrados: **${session.challenges.length}**\n\nElige una opción para gestionar la sesión:`)
        .setFooter({ text: 'REDLINE GT' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('club_btn_panel_add')
            .setLabel('➕ Añadir Desafío')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('club_btn_panel_edit_select')
            .setLabel('✏️ Editar / Borrar Desafío')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(session.challenges.length === 0),
        new ButtonBuilder()
            .setCustomId('club_btn_panel_reset')
            .setLabel('🔄 Reiniciar Sesión')
            .setStyle(ButtonStyle.Danger)
    );

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
}

/**
 * Abre el Modal para crear un nuevo desafío (Título + Subtítulo)
 */
export async function showChallengeModal(interaction: any, challengeNum: number): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(`club_modal_create_${challengeNum}`)
        .setTitle(`GT Club - Desafío #${challengeNum}`);

    const titleInput = new TextInputBuilder()
        .setCustomId('club_title')
        .setLabel('Título del Desafío')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Porsche 911 en Spa')
        .setRequired(true);

    const subtitleInput = new TextInputBuilder()
        .setCustomId('club_subtitle')
        .setLabel('Subtítulo / Consigna')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: Contrarreloj con neumáticos duros')
        .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(subtitleInput);

    modal.addComponents(row1, row2);
    await interaction.showModal(modal);
}

/**
 * Modal para editar un desafío existente
 */
export async function showEditChallengeModal(interaction: any, challenge: ClubChallenge): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(`club_modal_edit_${challenge.id}`)
        .setTitle(`Editar Desafío #${challenge.id}`);

    const titleInput = new TextInputBuilder()
        .setCustomId('club_title')
        .setLabel('Título del Desafío')
        .setStyle(TextInputStyle.Short)
        .setValue(challenge.title)
        .setRequired(true);

    const subtitleInput = new TextInputBuilder()
        .setCustomId('club_subtitle')
        .setLabel('Subtítulo / Consigna')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(challenge.subtitle)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(subtitleInput)
    );

    await interaction.showModal(modal);
}

/**
 * Muestra el desplegable para seleccionar qué desafío editar o borrar
 */
export async function sendEditChallengeSelect(interaction: any): Promise<void> {
    const session = getClubSession(interaction.guildId!);

    const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('✏️ Selecciona un Desafío')
        .setDescription('Elige de la lista el desafío que deseas modificar o eliminar:')
        .setFooter({ text: 'REDLINE GT' });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('club_select_edit_target')
        .setPlaceholder('Selecciona un desafío...')
        .addOptions(
            session.challenges.map(ch => ({
                label: `Desafío #${ch.id}: ${ch.title.substring(0, 50)}`,
                description: ch.subtitle.substring(0, 80),
                value: ch.id.toString()
            }))
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.update({ embeds: [embed], components: [row] });
}

/**
 * Muestra las opciones de gestión (Editar / Borrar) para un desafío específico
 */
export async function sendChallengeManageOptions(interaction: any, challengeId: number): Promise<void> {
    const session = getClubSession(interaction.guildId!);
    const challenge = session.challenges.find(c => c.id === challengeId);

    if (!challenge) return;

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`🛠️ Gestionar Desafío #${challenge.id}`)
        .setDescription(`**Título:** ${challenge.title}\n**Consigna:** ${challenge.subtitle}\n**Tiempos registrados:** ${challenge.times.length}`)
        .setFooter({ text: 'REDLINE GT' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`club_btn_do_edit_${challenge.id}`)
            .setLabel('✏️ Editar Textos')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`club_btn_do_delete_${challenge.id}`)
            .setLabel('🗑️ Borrar Desafío')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [embed], components: [row] });
}

/**
 * Muestra el menú de confirmación tras añadir un desafío ("¿Añadir otro?")
 */
async function sendAddMorePrompt(interaction: any, challengeCount: number): Promise<void> {
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Desafío Registrado')
        .setDescription(`Se ha añadido el **Desafío #${challengeCount}** correctamente.\n\n¿Deseas añadir otro desafío a esta sesión?`)
        .setFooter({ text: 'REDLINE GT' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('club_btn_add_another')
            .setLabel('➕ Añadir otro desafío')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('club_btn_finish_setup')
            .setLabel('🚀 Publicar Desafíos')
            .setStyle(ButtonStyle.Success)
    );

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
}

/**
 * Muestra el desplegable para seleccionar el canal donde publicar los Embeds
 */
async function sendChannelSelectMenu(interaction: any): Promise<void> {
    const session = getClubSession(interaction.guildId!);

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📍 Selecciona el Canal')
        .setDescription(`Has configurado **${session.challenges.length} desafío(s)**.\nSelecciona el canal donde el bot publicará los Embeds independientes.`)
        .setFooter({ text: 'REDLINE GT' });

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('club_channel_select')
        .setPlaceholder('Selecciona un canal de texto...')
        .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.update({ embeds: [embed], components: [row] });
}
/**
 * Manejador principal de interacciones para el módulo GT Club
 */
export async function handleClubInteractions(interaction: Interaction): Promise<boolean> {
    try {
        const guildId = interaction.guildId;
        if (!guildId) return false;

        // 1. Ejecución del comando Slash /club
        if (interaction.isChatInputCommand() && interaction.commandName === 'club') {
            const session = getClubSession(guildId);
            if (session.challenges.length > 0) {
                await showClubControlPanel(interaction);
            } else {
                resetClubSession(guildId);
                await showChallengeModal(interaction, 1);
            }
            return true;
        }

        // 2. Botón: Abrir panel de Añadir
        if (interaction.isButton() && interaction.customId === 'club_btn_panel_add') {
            const session = getClubSession(guildId);
            const nextNum = session.challenges.length + 1;
            await showChallengeModal(interaction, nextNum);
            return true;
        }

        // 3. Botón: Abrir menú de selección de edición/borrado
        if (interaction.isButton() && interaction.customId === 'club_btn_panel_edit_select') {
            await sendEditChallengeSelect(interaction);
            return true;
        }

        // 4. Seleccionar desafío a editar/borrar
        if (interaction.isStringSelectMenu() && interaction.customId === 'club_select_edit_target') {
            const challengeId = parseInt(interaction.values[0], 10);
            await sendChallengeManageOptions(interaction, challengeId);
            return true;
        }

        // 5. Botón: Confirmar Edición de textos
        if (interaction.isButton() && interaction.customId.startsWith('club_btn_do_edit_')) {
            const challengeId = parseInt(interaction.customId.replace('club_btn_do_edit_', ''), 10);
            const session = getClubSession(guildId);
            const challenge = session.challenges.find(c => c.id === challengeId);
            if (challenge) {
                await showEditChallengeModal(interaction, challenge);
            }
            return true;
        }

        // 6. Botón: Confirmar Borrado de desafío
        if (interaction.isButton() && interaction.customId.startsWith('club_btn_do_delete_')) {
            const challengeId = parseInt(interaction.customId.replace('club_btn_do_delete_', ''), 10);
            const result = await deleteChallengeFromSession(guildId, challengeId);

            if (result.success) {
                const session = getClubSession(guildId);

                // Borrar mensaje en el canal de Discord si existía
                if (session.channelId && result.deletedMessageId) {
                    try {
                        const channel = await interaction.guild?.channels.fetch(session.channelId) as TextChannel;
                        if (channel) {
                            const msg = await channel.messages.fetch(result.deletedMessageId);
                            await msg.delete();
                        }
                    } catch (err) {
                        console.error('❌ No se pudo eliminar el mensaje del desafío en Discord:', err);
                    }
                }

                // Re-publicar / actualizar todos los Embeds restantes para reflejar la re-indexación (#1, #2...)
                if (session.active && session.channelId) {
                    const channel = await interaction.guild?.channels.fetch(session.channelId) as TextChannel;
                    if (channel) {
                        for (const ch of session.challenges) {
                            if (ch.messageId) {
                                try {
                                    const msg = await channel.messages.fetch(ch.messageId);
                                    await msg.edit({ embeds: [buildChallengeEmbed(ch)] });
                                } catch (e) {}
                            }
                        }
                    }
                }

                await interaction.update({
                    content: `✅ **Desafío #${challengeId} eliminado.** Los desafíos restantes han sido reordenados automáticamente.`,
                    embeds: [],
                    components: []
                });
            }
            return true;
        }

        // 7. Botón: Reiniciar Sesión
        if (interaction.isButton() && interaction.customId === 'club_btn_panel_reset') {
            resetClubSession(guildId);
            await showChallengeModal(interaction, 1);
            return true;
        }

        // 8. Recepción de Modales de creación
        if (interaction.isModalSubmit() && interaction.customId.startsWith('club_modal_create_')) {
            const title = interaction.fields.getTextInputValue('club_title').trim();
            const subtitle = interaction.fields.getTextInputValue('club_subtitle').trim();

            const challenge = addChallengeToSession(guildId, title, subtitle);
            const session = getClubSession(guildId);

            // Si la sesión ya estaba activa, publicar inmediatamente el nuevo desafío en el canal
            if (session.active && session.channelId) {
                const channel = await interaction.guild?.channels.fetch(session.channelId) as TextChannel;
                if (channel) {
                    const embed = buildChallengeEmbed(challenge);
                    const sentMsg = await channel.send({ embeds: [embed] });
                    challenge.messageId = sentMsg.id;
                }
                await interaction.reply({
                    content: `✅ **Desafío #${challenge.id}** creado y publicado directamente en <#${session.channelId}>.`,
                    ephemeral: true
                });
            } else {
                await sendAddMorePrompt(interaction, challenge.id);
            }
            return true;
        }

        // 9. Recepción de Modal: Editar Desafío
        if (interaction.isModalSubmit() && interaction.customId.startsWith('club_modal_edit_')) {
            const challengeId = parseInt(interaction.customId.replace('club_modal_edit_', ''), 10);
            const title = interaction.fields.getTextInputValue('club_title').trim();
            const subtitle = interaction.fields.getTextInputValue('club_subtitle').trim();

            const updatedChallenge = await editChallengeInSession(guildId, challengeId, title, subtitle);
            const session = getClubSession(guildId);

            if (updatedChallenge && session.active && session.channelId && updatedChallenge.messageId) {
                try {
                    const channel = await interaction.guild?.channels.fetch(session.channelId) as TextChannel;
                    if (channel) {
                        const targetMsg = await channel.messages.fetch(updatedChallenge.messageId);
                        await targetMsg.edit({ embeds: [buildChallengeEmbed(updatedChallenge)] });
                    }
                } catch (err) {
                    console.error('❌ Error actualizando el Embed editado:', err);
                }
            }

            await interaction.reply({
                content: `✅ **Desafío #${challengeId} actualizado correctamente.**`,
                ephemeral: true
            });
            return true;
        }

        // 10. Botón: "Añadir otro desafío"
        if (interaction.isButton() && interaction.customId === 'club_btn_add_another') {
            const session = getClubSession(guildId);
            const nextNum = session.challenges.length + 1;
            await showChallengeModal(interaction, nextNum);
            return true;
        }

        // 11. Botón: "Publicar Desafíos"
        if (interaction.isButton() && interaction.customId === 'club_btn_finish_setup') {
            await sendChannelSelectMenu(interaction);
            return true;
        }

        // 12. Selección de canal y publicación final
        if (interaction.isChannelSelectMenu() && interaction.customId === 'club_channel_select') {
            await interaction.deferUpdate();

            const selectedChannelId = interaction.values[0];
            const channel = await interaction.guild?.channels.fetch(selectedChannelId) as TextChannel;

            if (!channel || !channel.isTextBased()) {
                await interaction.followUp({ content: '❌ Canal no válido.', ephemeral: true });
                return true;
            }

            const session = getClubSession(guildId);
            session.channelId = channel.id;
            session.active = true;

            // Publicar Embeds independientes por cada desafío
            for (const challenge of session.challenges) {
                const embed = buildChallengeEmbed(challenge);
                const sentMessage = await channel.send({ embeds: [embed] });
                challenge.messageId = sentMessage.id;
            }

            await interaction.editReply({
                content: `✅ **¡GT Club activado!** Se han publicado ${session.challenges.length} desafío(s) en <#${selectedChannelId}>.`,
                embeds: [],
                components: []
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en handleClubInteractions:', error);
        return false;
    }
}

/**
 * Escuchador de mensajes para registrar tiempos de los usuarios
 */
export async function handleClubMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const session = getClubSession(guildId);

    if (!session.active || session.channelId !== message.channel.id) return;

    const content = message.content.trim();
    const regex = /^#?(\d+)\s+(\d{1,2}:[0-5]\d:\d{3})$/;
    const match = content.match(regex);

    if (!match) return;

    const challengeId = parseInt(match[1], 10);
    const timeStr = match[2];

    const challenge = session.challenges.find(c => c.id === challengeId);
    if (!challenge || !challenge.messageId) return;

    const userName = message.member?.displayName || message.author.username;
    const result = await recordUserTime(guildId, challengeId, message.author.id, userName, timeStr);

    if (!result.success) return;

    await message.react('⏱️').catch(() => {});

    try {
        const channel = message.channel as TextChannel;
        const targetMessage = await channel.messages.fetch(challenge.messageId);

        if (targetMessage) {
            const updatedEmbed = buildChallengeEmbed(challenge);
            await targetMessage.edit({ embeds: [updatedEmbed] });
        }
    } catch (err) {
        console.error('❌ Error actualizando el Embed del desafío:', err);
    }
}
