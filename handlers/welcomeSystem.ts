import { 
    ButtonInteraction, 
    ChannelSelectMenuBuilder, 
    ActionRowBuilder, 
    ChannelType, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ModalSubmitInteraction,
    Client, 
    GuildMember, 
    TextChannel, 
    EmbedBuilder 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let settingsCollection: any = null;
const welcomeSessions = new Map<string, any>();

async function getSettingsCollection() {
    if (!settingsCollection) {
        await clientMongo.connect();
        settingsCollection = clientMongo.db('redline_bot').collection('server_settings');
    }
    return settingsCollection;
}

// 1. Botón del Dash para iniciar la configuración
export async function handleDashWelcomeButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_welcome_config') return false;

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('welcome_select_welcome_channel')
        .setPlaceholder('📢 Selecciona el canal de BIENVENIDA...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '👋 **Asistente (Paso 1/4):** Selecciona el canal donde se publicarán las **bienvenidas**:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Selecciona canal de bienvenida -> Pide texto de bienvenida mediante modal
export async function handleWelcomeChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'welcome_select_welcome_channel') return false;

    const channelId = interaction.values[0];
    welcomeSessions.set(interaction.user.id, { welcomeChannelId: channelId });

    const modal = new ModalBuilder()
        .setCustomId('modal_welcome_text')
        .setTitle('👋 Mensaje de Bienvenida (Paso 2/4)');

    const inputMsg = new TextInputBuilder()
        .setCustomId('welcome_text_input')
        .setLabel('💬 Texto (usa {user}, {server}, {memberCount})')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('¡Bienvenido/a a {server}, {user}! Ya somos {memberCount} pilotos.')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(inputMsg));
    await interaction.showModal(modal);
    return true;
}

// 3. Recibe texto de bienvenida -> Pide canal de despedidas
export async function handleWelcomeModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_welcome_text') return false;

    const welcomeMessage = interaction.fields.getTextInputValue('welcome_text_input');
    const session = welcomeSessions.get(interaction.user.id);

    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', ephemeral: true });
        return true;
    }

    session.welcomeMessage = welcomeMessage;

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('welcome_select_goodbye_channel')
        .setPlaceholder('⚠️ Selecciona el canal de DESPEDIDAS...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '👋 **Asistente (Paso 3/4):** Selecciona ahora el canal donde se publicarán las **despedidas**:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 4. Selecciona canal de despedidas -> Pide texto de despedida mediante modal
export async function handleGoodbyeChannelSelect(interaction: any): Promise<boolean> {
    if (interaction.customId !== 'welcome_select_goodbye_channel') return false;

    const channelId = interaction.values[0];
    const session = welcomeSessions.get(interaction.user.id);
    if (!session) {
        await interaction.update({ content: '❌ Sesión caducada.', components: [] });
        return true;
    }

    session.goodbyeChannelId = channelId;

    const modal = new ModalBuilder()
        .setCustomId('modal_goodbye_text')
        .setTitle('⚠️ Mensaje de Despedida (Paso 4/4)');

    const inputMsg = new TextInputBuilder()
        .setCustomId('goodbye_text_input')
        .setLabel('💬 Texto (usa {user}, {server})')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('El piloto {user} ha abandonado {server}. ¡Hasta pronto!')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(inputMsg));
    await interaction.showModal(modal);
    return true;
}

// 5. Recibe texto de despedida -> Guarda toda la configuración unificada en MongoDB
export async function handleGoodbyeModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== 'modal_goodbye_text') return false;

    const goodbyeMessage = interaction.fields.getTextInputValue('goodbye_text_input');
    const session = welcomeSessions.get(interaction.user.id);

    if (!session) {
        await interaction.reply({ content: '❌ Sesión caducada.', ephemeral: true });
        return true;
    }

    try {
        const col = await getSettingsCollection();
        await col.updateOne(
            { guildId: interaction.guildId },
            { 
                $set: { 
                    welcomeChannelId: session.welcomeChannelId,
                    welcomeMessage: session.welcomeMessage,
                    goodbyeChannelId: session.goodbyeChannelId,
                    goodbyeMessage: goodbyeMessage 
                } 
            },
            { upsert: true }
        );

        welcomeSessions.delete(interaction.user.id);

        await interaction.reply({
            content: '✅ **¡Configuración guardada con éxito!**\nTanto las bienvenidas como las despedidas han quedado configuradas y activas en la base de datos.',
            ephemeral: true
        });
    } catch (error) {
        console.error('❌ Error al guardar configuración de bienvenida/despedida:', error);
        await interaction.reply({ content: '❌ Error al guardar en la base de datos.', ephemeral: true });
    }

    return true;
}

// 6. Eventos automáticos de Discord (Worker de entradas y salidas)
export function setupWelcomeSystem(client: Client) {
    console.log('👋 [System] Sistema de Bienvenidas y Despedidas activo.');

    client.on('guildMemberAdd', async (member: GuildMember) => {
        try {
            const col = await getSettingsCollection();
            const settings = await col.findOne({ guildId: member.guild.id });
            
            if (!settings || !settings.welcomeChannelId) return;

            const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null) as TextChannel;
            if (!channel || !channel.isTextBased()) return;

            let text = settings.welcomeMessage || `¡Bienvenido/a a **{server}**, {user}! 🏎️`;
            text = text
                .replace(/{user}/g, `<@${member.id}>`)
                .replace(/{server}/g, member.guild.name)
                .replace(/{memberCount}/g, member.guild.memberCount.toString());

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('🏁 ¡Nuevo Piloto en la Pista!')
                .setDescription(text)
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .setFooter({ text: 'REDLINE GT' })
                .setTimestamp();

            await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en guildMemberAdd:', error);
        }
    });

    client.on('guildMemberRemove', async (member: GuildMember) => {
        try {
            const col = await getSettingsCollection();
            const settings = await col.findOne({ guildId: member.guild.id });
            
            if (!settings || !settings.goodbyeChannelId) return;

            const channel = await member.guild.channels.fetch(settings.goodbyeChannelId).catch(() => null) as TextChannel;
            if (!channel || !channel.isTextBased()) return;

            let text = settings.goodbyeMessage || `El piloto **{user}** ha abandonado el servidor.`;
            text = text
                .replace(/{user}/g, member.user.tag)
                .replace(/{server}/g, member.guild.name);

            const embed = new EmbedBuilder()
                .setColor(0x2f3136)
                .setTitle('⚠️ Baja en el Circuito')
                .setDescription(text)
                .setFooter({ text: 'REDLINE GT' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en guildMemberRemove:', error);
        }
    });
}
