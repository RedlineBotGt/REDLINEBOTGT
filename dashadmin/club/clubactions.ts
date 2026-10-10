import { 
    Interaction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelSelectMenuBuilder, 
    ChannelType, 
    EmbedBuilder, 
    TextChannel,
    Message
} from 'discord.js';
import { 
    getClubSession, 
    resetClubSession, 
    addChallengeToSession, 
    recordUserTime,
    ClubChallenge 
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
            return `${medal} **#${idx + 1}** <@${entry.userId}> ➔ **\`${entry.timeStr}\`**`;
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
            resetClubSession(guildId);
            await showChallengeModal(interaction, 1);
            return true;
        }

        // 2. Recepción de Modales de creación
        if (interaction.isModalSubmit() && interaction.customId.startsWith('club_modal_create_')) {
            const title = interaction.fields.getTextInputValue('club_title').trim();
            const subtitle = interaction.fields.getTextInputValue('club_subtitle').trim();

            const challenge = addChallengeToSession(guildId, title, subtitle);
            await sendAddMorePrompt(interaction, challenge.id);
            return true;
        }

        // 3. Botón: "Añadir otro desafío"
        if (interaction.isButton() && interaction.customId === 'club_btn_add_another') {
            const session = getClubSession(guildId);
            const nextNum = session.challenges.length + 1;
            await showChallengeModal(interaction, nextNum);
            return true;
        }

        // 4. Botón: "Publicar Desafíos"
        if (interaction.isButton() && interaction.customId === 'club_btn_finish_setup') {
            await sendChannelSelectMenu(interaction);
            return true;
        }

        // 5. Selección de canal y publicación final
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
    // Ignorar mensajes enviados por bots o fuera de un servidor
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const session = getClubSession(guildId);

    // Solo actuar si hay una sesión activa y el mensaje está en el canal configurado
    if (!session.active || session.channelId !== message.channel.id) return;

    const content = message.content.trim();

    // Regex para detectar patrón: #1 01:23:456 o 1 01:23:456
    const regex = /^#?(\d+)\s+(\d{1,2}:[0-5]\d:\d{3})$/;
    const match = content.match(regex);

    if (!match) return; // Si no coincide con el formato de tiempo, no hace nada

    const challengeId = parseInt(match[1], 10);
    const timeStr = match[2];

    const challenge = session.challenges.find(c => c.id === challengeId);
    if (!challenge || !challenge.messageId) return;

    const userName = message.member?.displayName || message.author.username;
    const result = recordUserTime(guildId, challengeId, message.author.id, userName, timeStr);

    if (!result.success) return;

    // Reaccionar al mensaje del usuario para confirmar la lectura (el mensaje PERMANECE en el chat)
    await message.react('⏱️').catch(() => {});

    // Actualizar el Embed independiente del desafío correspondiente
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
