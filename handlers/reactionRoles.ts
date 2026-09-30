import { 
    Client, 
    MessageReaction, 
    User, 
    PartialMessageReaction, 
    PartialUser, 
    ButtonInteraction, 
    StringSelectMenuInteraction,
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    StringSelectMenuBuilder,
    ChannelType, 
    ModalSubmitInteraction,
    TextChannel, 
    EmbedBuilder,
    MessageFlags 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let reactionCollection: any = null;

async function getReactionCollection() {
    if (!reactionCollection) {
        await clientMongo.connect();
        reactionCollection = clientMongo.db('redline_bot').collection('reaction_roles');
        console.log('🎭 [MongoDB] Conectado a la colección de roles por reacción.');
    }
    return reactionCollection;
}

// Sesión temporal para el asistente interactivo de creación por pasos
const reactionSessions = new Map<string, any>();

// 1. SINCRONIZACIÓN Y CACHÉ: Se ejecuta al encender el bot para que reviva tras los deploys
export async function initReactionRoles(client: Client) {
    try {
        const col = await getReactionCollection();
        const configs = await col.find({}).toArray();

        if (configs.length === 0) {
            console.log('🎭 [ReactionRoles] No hay roles por reacción configurados todavía.');
            return;
        }

        for (const conf of configs) {
            try {
                const guild = await client.guilds.fetch(conf.guildId).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(conf.channelId).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;

                // Forzamos el fetch del mensaje para que Discord lo guarde en memoria y detecte eventos
                await channel.messages.fetch(conf.messageId);
            } catch (err) {
                console.error(`❌ [ReactionRoles] Error al hacer fetch del mensaje ID ${conf.messageId}:`, err);
            }
        }

        console.log(`🎭 [ReactionRoles] Sincronizados ${configs.length} mensajes de roles por reacción con éxito.`);
    } catch (error) {
        console.error('❌ [ReactionRoles] Error al inicializar el sistema:', error);
    }
}

// ---------------------------------------------------------------------------
// PANEL DE GESTIÓN Y BASE DE DATOS (DASH)
// ---------------------------------------------------------------------------

// 1. Al pulsar el botón del Dash -> Muestra la lista de mensajes guardados y opción de crear nuevo
export async function handleDashRrButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_btn_create') return false;

    const col = await getReactionCollection();
    const savedConfigs = await col.find({ guildId: interaction.guildId }).toArray();

    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setTitle('🎭 Gestión de Roles por Reacción')
        .setDescription(
            savedConfigs.length > 0 
                ? `Tienes **${savedConfigs.length}** mensajes registrados en la base de datos de este servidor.\n\nSelecciona uno abajo para ver sus detalles o eliminarlo de la base de datos (ideal para limpiar errores 10008), o haz clic en **Crear Nuevo**.`
                : 'No hay mensajes de roles por reacción guardados en este servidor.\nHaz clic en **Crear Nuevo** para configurar el primero.'
        )
        .setFooter({ text: 'REDLINE GT' })
        .setTimestamp();

    const components: any[] = [];

    // Si hay mensajes guardados, mostramos el menú desplegable con ellos
    if (savedConfigs.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('rr_select_existing_message')
            .setPlaceholder('📂 Selecciona un mensaje guardado en la BD...');

        savedConfigs.forEach((cfg) => {
            const previewText = cfg.text ? cfg.text.substring(0, 80) : `Mensaje ID: ${cfg.messageId}`;
            selectMenu.addOptions({
                label: previewText,
                description: `Canal ID: ${cfg.channelId} \vert{} Emoji:${cfg.emoji}`,
                value: cfg.messageId
            });
        });

        components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    // Botón para iniciar el flujo de creación nuevo
    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('rr_btn_start_create')
            .setLabel('Crear Nuevo')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕')
    );
    components.push(rowButtons);

    await interaction.reply({
        embeds: [embed],
        components: components,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 2. Al seleccionar un mensaje existente del desplegable -> Muestra datos y botón de borrar
export async function handleRrExistingSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_select_existing_message') return false;

    const messageId = interaction.values[0];
    const col = await getReactionCollection();
    const config = await col.findOne({ guildId: interaction.guildId, messageId });

    if (!config) {
        await interaction.update({ content: '❌ No se encontró esta configuración en la base de datos.', embeds: [], components: [] });
        return true;
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚙️ Detalle del Rol por Reacción')
        .addFields(
            { name: '🆔 ID del Mensaje', value: `\`${config.messageId}\``, inline: false },
            { name: '📢 Canal Destino', value: `<#${config.channelId}>`, inline: false },
            { name: '⭐ Emoji', value: config.emoji, inline: true },
            { name: '👥 Rol Asociado', value: `<@&${config.roleId}>`, inline: true },
            { name: '💬 Texto Registrado', value: config.text || 'Sin texto', inline: false }
        )
        .setFooter({ text: 'REDLINE GT' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`rr_btn_delete_config_${messageId}`)
            .setLabel('Eliminar de la Base de Datos')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder()
            .setCustomId('rr_btn_create')
            .setLabel('Volver al Menú')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
    );

    await interaction.update({
        embeds: [embed],
        components: [row]
    });

    return true;
}

// 3. Borrar configuración huérfana o antigua de la base de datos (Soluciona error 10008)
export async function handleRrDeleteConfig(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('rr_btn_delete_config_')) return false;

    const messageId = interaction.customId.replace('rr_btn_delete_config_', '');
    const col = await getReactionCollection();

    await col.deleteOne({ guildId: interaction.guildId, messageId });

    await interaction.update({
        content: `✅ **Configuración eliminada de la base de datos.** El bot ya no intentará buscar el mensaje \`${messageId}\` al encender.`,
        embeds: [],
        components: []
    });

    return true;
}

// 4. Botón "Crear Nuevo" -> Abre el modal original de texto y emoji
export async function handleRrStartCreate(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_btn_start_create') return false;

    const modal = new ModalBuilder()
        .setCustomId('rr_modal_content')
        .setTitle('🎭 Rol por Reacción (1/3: Mensaje y Emoji)');

    const inputMsg = new TextInputBuilder()
        .setCustomId('rr_text')
        .setLabel('💬 Mensaje que se publicará')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe el texto del anuncio de roles...')
        .setRequired(true);

    const inputEmoji = new TextInputBuilder()
        .setCustomId('rr_emoji')
        .setLabel('⭐ Emoji obligatorio (Ej: 🏎️️)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('🏎️')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputMsg),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputEmoji)
    );

    await interaction.showModal(modal);
    return true;
}

// ---------------------------------------------------------------------------
// ASISTENTE INTERACTIVO (PASOS DE CREACIÓN)
// ---------------------------------------------------------------------------

// Paso 2: Al enviar el Modal -> Guarda texto/emoji temporalmente y muestra Desplegable de Canales
export async function handleRrContentSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_modal_content') return false;

    const text = interaction.fields.getTextInputValue('rr_text');
    const emoji = interaction.fields.getTextInputValue('rr_emoji').trim();

    reactionSessions.set(interaction.user.id, { text, emoji });

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('rr_select_channel')
        .setPlaceholder('📢 Selecciona el canal donde colocar el mensaje...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '🎭 **Roles por Reacción (2/3):** Selecciona el canal de destino:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// Paso 3: Al seleccionar el canal -> Guarda canal y muestra Desplegable de Roles
export async function handleRrChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'rr_select_channel') return false;

    const channelId = interaction.values[0];
    const session = reactionSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada. Vuelve a iniciar el proceso.', components: [] });
        return true;
    }

    session.channelId = channelId;

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('rr_select_role')
        .setPlaceholder('👥 Selecciona el rol que se otorgará...');

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);

    await interaction.update({
        content: '🎭 **Roles por Reacción (3/3):** Selecciona el rol que se asignará al reaccionar:',
        components: [row]
    });

    return true;
}

// Paso 4: Al seleccionar el rol -> Publica el mensaje, reacciona y guarda en MongoDB
export async function handleRrRoleSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'rr_select_role') return false;

    const roleId = interaction.values[0];
    const session = reactionSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    const guild = interaction.guild;
    if (!guild) return true;

    try {
        const channel = await guild.channels.fetch(session.channelId).catch(() => null) as TextChannel;
        if (!channel || !channel.isTextBased()) {
            await interaction.update({ content: '❌ El canal seleccionado ya no es válido.', components: [] });
            return true;
        }

        // 1. Publicar mensaje en el canal elegido
        const sentMessage = await channel.send({ content: session.text });

        // 2. Añadir el emoji obligatorio automáticamente
        await sentMessage.react(session.emoji).catch(() => {});

        // 3. Guardar de forma persistente en MongoDB
        const col = await getReactionCollection();
        await col.insertOne({
            guildId: guild.id,
            channelId: session.channelId,
            messageId: sentMessage.id,
            emoji: session.emoji,
            roleId: roleId,
            text: session.text,
            createdAt: new Date()
        });

        reactionSessions.delete(interaction.user.id);

        await interaction.update({
            content: `✅ **¡Rol por reacción configurado y publicado con éxito!**\n• Canal: <#${session.channelId}>\n• Emoji: ${session.emoji}\n• Rol: <@&${roleId}>\n\n*Guardado de forma permanente en MongoDB.*`,
            components: []
        });

    } catch (error) {
        console.error('❌ Error al finalizar la creación del rol por reacción:', error);
        await interaction.update({ content: '❌ Hubo un error al publicar el mensaje o guardar en MongoDB.', components: [] });
    }

    return true;
}

// ---------------------------------------------------------------------------
// EVENTOS DE REACCIÓN (Añadir / Quitar Rol)
// ---------------------------------------------------------------------------

export async function handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    const col = await getReactionCollection();
    const emojiIdentifier = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

    const config = await col.findOne({
        messageId: reaction.message.id,
        $or: [
            { emoji: reaction.emoji.name },
            { emoji: reaction.emoji.id },
            { emoji: emojiIdentifier }
        ]
    });

    if (!config) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    try {
        const member = await guild.members.fetch(user.id);
        if (!member.roles.cache.has(config.roleId)) {
            await member.roles.add(config.roleId);
            console.log(`✅ [ReactionRoles] Rol ${config.roleId} asignado a ${member.user.tag}`);
        }
    } catch (error) {
        console.error('❌ [ReactionRoles] Error al asignar el rol:', error);
    }
}

export async function handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    const col = await getReactionCollection();
    const emojiIdentifier = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

    const config = await col.findOne({
        messageId: reaction.message.id,
        $or: [
            { emoji: reaction.emoji.name },
            { emoji: reaction.emoji.id },
            { emoji: emojiIdentifier }
        ]
    });

    if (!config) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    try {
        const member = await guild.members.fetch(user.id);
        if (member.roles.cache.has(config.roleId)) {
            await member.roles.remove(config.roleId);
            console.log(`❌ [ReactionRoles] Rol ${config.roleId} retirado a ${member.user.tag}`);
        }
    } catch (error) {
        console.error('❌ [ReactionRoles] Error al retirar el rol:', error);
    }
}
