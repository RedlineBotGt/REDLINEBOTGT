import { 
    Client, 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ButtonInteraction, 
    StringSelectMenuInteraction, 
    ChannelSelectMenuInteraction, 
    RoleSelectMenuInteraction, 
    ModalSubmitInteraction, 
    MessageFlags 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let reactionCollection: any = null;
const rrSessions = new Map<string, {
    channelId?: string;
    roleId?: string;
    content?: string;
}>();

async function getReactionCollection() {
    if (!reactionCollection) {
        await clientMongo.connect();
        reactionCollection = clientMongo.db('redline_bot').collection('reaction_roles');
    }
    return reactionCollection;
}

// Inicializador con limpieza automática (Purga el error 10008 de MongoDB)
export async function initReactionRoles(client: Client) {
    try {
        const col = await getReactionCollection();
        const configs = await col.find({}).toArray();

        let synchronizedCount = 0;
        for (const config of configs) {
            try {
                const channel = await client.channels.fetch(config.channelId) as TextChannel;
                if (channel) {
                    await channel.messages.fetch(config.messageId);
                    synchronizedCount++;
                }
            } catch (error: any) {
                if (error.code === 10008) {
                    console.warn(`⚠️ [ReactionRoles] El mensaje ${config.messageId} ya no existe en Discord. Limpiando de la base de datos...`);
                    await col.deleteOne({ messageId: config.messageId });
                } else {
                    console.error(`❌ [ReactionRoles] Error al verificar mensaje ${config.messageId}:`, error.message);
                }
            }
        }
        console.log(`🎭 [ReactionRoles] Sincronizados ${synchronizedCount} mensajes de roles por reacción con éxito.`);
    } catch (error) {
        console.error('❌ Error al inicializar Reaction Roles:', error);
    }
}

export async function handleDashRrButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_btn_create') return false;

    const col = await getReactionCollection();
    const configs = await col.find({ guildId: interaction.guildId }).toArray();

    let description = '🎭 **Gestor de Autoroles (Roles por Reacción)**\n\nSelecciona una opción para gestionar los botones de roles de tu servidor:';
    
    const rows: ActionRowBuilder<any>[] = [];

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rr_btn_start_create').setLabel('Crear Nuevo Autorol').setStyle(ButtonStyle.Primary).setEmoji('➕')
    );
    rows.push(actionRow);

    if (configs.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('rr_select_existing_message')
            .setPlaceholder('🗑️ Selecciona un mensaje para eliminar su configuración...');

        for (const cfg of configs.slice(0, 25)) {
            selectMenu.addOptions({
                label: `Canal: ${cfg.channelId.substring(0, 10)}... (Rol: ${cfg.roleId.substring(0, 10)}...)`,
                description: cfg.content ? cfg.content.substring(0, 50) : 'Sin texto',
                value: cfg.messageId
            });
        }
        rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    await interaction.reply({
        content: description,
        components: rows,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

export async function handleRrStartCreate(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_btn_start_create') return false;

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('rr_select_channel')
        .setPlaceholder('📢 Selecciona el canal donde se enviará el autorol...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.update({
        content: '🎭 **Paso 1/3:** Selecciona el canal de destino para el mensaje de autorol:',
        components: [row]
    });

    return true;
}

export async function handleRrChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_select_channel') return false;

    const channelId = interaction.values[0];
    rrSessions.set(interaction.user.id, { channelId });

    const selectRole = new RoleSelectMenuBuilder()
        .setCustomId('rr_select_role')
        .setPlaceholder('👥 Selecciona el rol que se otorgará...');

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(selectRole);

    await interaction.update({
        content: '🎭 **Paso 2/3:** Selecciona el rol que los usuarios obtendrán al pulsar el botón:',
        components: [row]
    });

    return true;
}

export async function handleRrRoleSelect(interaction: RoleSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_select_role') return false;

    const roleId = interaction.values[0];
    const session = rrSessions.get(interaction.user.id);

    if (!session || !session.channelId) {
        await interaction.reply({ content: '❌ Sesión caducada. Empieza de nuevo desde el Dash.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    session.roleId = roleId;
    rrSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId('modal_rr_content')
        .setTitle('Configurar Mensaje de Autorol');

    const contentInput = new TextInputBuilder()
        .setCustomId('rr_content_text')
        .setLabel('Texto del Mensaje / Embed')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ej: ¡Pulsa el botón de abajo para obtener tu rol de piloto!')
        .setRequired(true);

    const labelInput = new TextInputBuilder()
        .setCustomId('rr_button_label')
        .setLabel('Texto del Botón (Ej: Reclamar Rol)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ej: Obtener Rol')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(labelInput)
    );

    await interaction.showModal(modal);
    return true;
}

export async function handleRrContentSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_rr_content') return false;

    const contentText = interaction.fields.getTextInputValue('rr_content_text');
    const buttonLabel = interaction.fields.getTextInputValue('rr_button_label');

    const session = rrSessions.get(interaction.user.id);
    if (!session || !session.channelId || !session.roleId || !interaction.guild) {
        await interaction.reply({ content: '❌ Sesión caducada. Empieza de nuevo.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    try {
        const guild = interaction.guild;
        const channel = await guild.channels.fetch(session.channelId) as TextChannel;
        if (!channel) {
            await interaction.reply({ content: '❌ Canal no encontrado.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const customButtonId = `rr_claim_${Date.now()}`;

        const embed = new EmbedBuilder()
            .setColor(0x0055FF)
            .setTitle('🎭 Asignación de Roles')
            .setDescription(contentText)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(customButtonId)
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✨')
        );

        const message = await channel.send({
            embeds: [embed],
            components: [row]
        });

        const col = await getReactionCollection();
        await col.insertOne({
            guildId: guild.id,
            channelId: channel.id,
            messageId: message.id,
            buttonId: customButtonId,
            roleId: session.roleId,
            content: contentText
        });

        rrSessions.delete(interaction.user.id);

        await interaction.reply({
            content: `✅ **¡Autorol creado y publicado con éxito en <#${channel.id}>!**`,
            flags: [MessageFlags.Ephemeral]
        });

    } catch (error) {
        console.error('❌ Error al crear autorol:', error);
        await interaction.reply({ content: '❌ Ocurrió un error al crear el autorol.', flags: [MessageFlags.Ephemeral] });
    }

    return true;
}

export async function handleRrExistingSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'rr_select_existing_message') return false;

    const messageId = interaction.values[0];
    const col = await getReactionCollection();

    await col.deleteOne({ messageId });

    await interaction.update({
        content: '🗑️ **Configuración de autorol eliminada de la base de datos con éxito.**',
        components: []
    });

    return true;
}

export async function handleRrButtonClick(interaction: ButtonInteraction): Promise<boolean> {
    const col = await getReactionCollection();
    const config = await col.findOne({ buttonId: interaction.customId });

    if (!config) return false;

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
        const guild = interaction.guild;
        if (!guild) return true;

        const member = await guild.members.fetch(interaction.user.id);
        const role = await guild.roles.fetch(config.roleId);

        if (!role) {
            await interaction.editReply({ content: '❌ El rol configurado ya no existe en este servidor.' });
            return true;
        }

        if (member.roles.cache.has(config.roleId)) {
            await member.roles.remove(config.roleId);
            await interaction.editReply({ content: `❌ Te he **quitado** el rol **${role.name}**.` });
        } else {
            await member.roles.add(config.roleId);
            await interaction.editReply({ content: `✅ ¡Te he **asignado** el rol **${role.name}**!` });
        }

    } catch (error) {
        console.error('❌ Error al gestionar rol por reacción/botón:', error);
        await interaction.editReply({ content: '❌ Ocurrió un error al intentar asignar o quitar el rol.' });
    }

    return true;
}

export async function handleRrDeleteConfig(interaction: ButtonInteraction): Promise<boolean> {
    if (!interaction.customId.startsWith('rr_btn_delete_config_')) return false;
    const messageId = interaction.customId.replace('rr_btn_delete_config_', '');
    
    const col = await getReactionCollection();
    await col.deleteOne({ messageId });

    await interaction.update({
        content: '✅ Configuración eliminada correctamente.',
        components: []
    });
    return true;
}
