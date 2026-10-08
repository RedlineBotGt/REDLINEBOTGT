import { 
    Client, 
    TextChannel, 
    EmbedBuilder, 
    GuildMember, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ButtonInteraction, 
    ChannelSelectMenuInteraction, 
    ModalSubmitInteraction, 
    ChannelType, 
    MessageFlags 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let welcomeCollection: any = null;
export const welcomeSessions = new Map<string, { type?: 'welcome' | 'goodbye'; channelId?: string }>();

async function getWelcomeCollection() {
    if (!welcomeCollection) {
        await clientMongo.connect();
        welcomeCollection = clientMongo.db('redline_bot').collection('welcomes');
    }
    return welcomeCollection;
}

// 1. Inicializador del sistema que escucha las entradas y salidas
export function setupWelcomeSystem(client: Client) {
    console.log('👋 [System] Sistema de Bienvenidas y Despedidas activo.');

    client.on('guildMemberAdd', async (member: GuildMember) => {
        try {
            const col = await getWelcomeCollection();
            const config = await col.findOne({ guildId: member.guild.id, type: 'welcome' });
            if (!config || !config.channelId || !config.text) return;

            const channel = await member.guild.channels.fetch(config.channelId) as TextChannel;
            if (!channel) return;

            const formattedText = config.text
                .replace(/{user}/g, `<@${member.id}>`)
                .replace(/{server}/g, member.guild.name)
                .replace(/{avatar}/g, '')
                .replace(/{memberCount}/g, member.guild.memberCount.toString())
                .replace(/{count}/g, member.guild.memberCount.toString());

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🏁 ¡Nuevo Piloto en la Pista!')
                .setDescription(formattedText)
                .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
                .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined })
                .setTimestamp();

            await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en el evento guildMemberAdd:', error);
        }
    });

    client.on('guildMemberRemove', async (member: GuildMember) => {
        try {
            const col = await getWelcomeCollection();
            const config = await col.findOne({ guildId: member.guild.id, type: 'goodbye' });
            if (!config || !config.channelId || !config.text) return;

            const channel = await member.guild.channels.fetch(config.channelId) as TextChannel;
            if (!channel) return;

            const formattedText = config.text
                .replace(/{user}/g, member.user.tag)
                .replace(/{server}/g, member.guild.name)
                .replace(/{avatar}/g, '')
                .replace(/{memberCount}/g, member.guild.memberCount.toString())
                .replace(/{count}/g, member.guild.memberCount.toString());

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🏁 Un piloto ha abandonado el paddock')
                .setDescription(formattedText)
                .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
                .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en el evento guildMemberRemove:', error);
        }
    });
}

// 2. Botón desde el Dash -> Muestra el menú de selección de Bienvenida o Despedida
export async function handleDashWelcomeButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_welcome_config') return false;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('welcome_menu_bienvenida').setLabel('Configurar Bienvenida').setStyle(ButtonStyle.Success).setEmoji('👋'),
        new ButtonBuilder().setCustomId('welcome_menu_despedida').setLabel('Configurar Despedida').setStyle(ButtonStyle.Danger).setEmoji('🚪')
    );

    await interaction.reply({
        content: '⚙️ **Configuración de Bienvenidas y Despedidas**\nElige qué sistema deseas configurar:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 3. Menú de selección (Bienvenida o Despedida) -> Pide el canal
export async function handleWelcomeMenuButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'welcome_menu_bienvenida' && interaction.customId !== 'welcome_menu_despedida') return false;

    const type = interaction.customId === 'welcome_menu_bienvenida' ? 'welcome' : 'goodbye';
    welcomeSessions.set(interaction.user.id, { type });

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId(type === 'welcome' ? 'welcome_select_welcome_channel' : 'welcome_select_goodbye_channel')
        .setPlaceholder(`📢 Selecciona el canal para las ${type === 'welcome' ? 'bienvenidas' : 'despedidas'}...`)
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.update({
        content: `📢 Selecciona el canal donde se enviarán los mensajes de **${type === 'welcome' ? 'Bienvenida' : 'Despedida'}**:`,
        components: [row]
    });

    return true;
}

// 4. Canal de Bienvenida seleccionado -> Abre modal de texto
export async function handleWelcomeChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'welcome_select_welcome_channel') return false;

    const channelId = interaction.values[0];
    const session = welcomeSessions.get(interaction.user.id) || { type: 'welcome' };
    session.channelId = channelId;
    welcomeSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId('modal_welcome_text')
        .setTitle('Mensaje de Bienvenida');

    const textInput = new TextInputBuilder()
        .setCustomId('welcome_text_content')
        .setLabel('Texto (Usa {user}, {avatar}, {memberCount})')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Hola {user}\n{avatar}\nBienvenido a PADDOCK. Eres el miembro {memberCount}')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
    await interaction.showModal(modal);
    return true;
}

// 5. Canal de Despedida seleccionado -> Abre modal de texto
export async function handleGoodbyeChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'welcome_select_goodbye_channel') return false;

    const channelId = interaction.values[0];
    const session = welcomeSessions.get(interaction.user.id) || { type: 'goodbye' };
    session.channelId = channelId;
    welcomeSessions.set(interaction.user.id, session);

    const modal = new ModalBuilder()
        .setCustomId('modal_goodbye_text')
        .setTitle('Mensaje de Despedida');

    const textInput = new TextInputBuilder()
        .setCustomId('goodbye_text_content')
        .setLabel('Texto (Usa {user}, {server})')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('{user} ha abandonado {server}. ¡Hasta pronto!')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
    await interaction.showModal(modal);
    return true;
}

// 6. Guardar Bienvenida en MongoDB
export async function handleWelcomeModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_welcome_text') return false;

    const text = interaction.fields.getTextInputValue('welcome_text_content');
    const session = welcomeSessions.get(interaction.user.id);

    if (!session || !session.channelId || !interaction.guild) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const col = await getWelcomeCollection();
    await col.updateOne(
        { guildId: interaction.guild.id, type: 'welcome' },
        { $set: { channelId: session.channelId, text } },
        { upsert: true }
    );

    welcomeSessions.delete(interaction.user.id);

    await interaction.reply({
        content: `✅ **¡Mensaje de bienvenida configurado con éxito en <#${session.channelId}>!**`,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 7. Guardar Despedida en MongoDB
export async function handleGoodbyeModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_goodbye_text') return false;

    const text = interaction.fields.getTextInputValue('goodbye_text_content');
    const session = welcomeSessions.get(interaction.user.id);

    if (!session || !session.channelId || !interaction.guild) {
        await interaction.reply({ content: '❌ Sesión caducada.', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    const col = await getWelcomeCollection();
    await col.updateOne(
        { guildId: interaction.guild.id, type: 'goodbye' },
        { $set: { channelId: session.channelId, text } },
        { upsert: true }
    );

    welcomeSessions.delete(interaction.user.id);

    await interaction.reply({
        content: `✅ **¡Mensaje de despedida configurado con éxito en <#${session.channelId}>!**`,
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}
