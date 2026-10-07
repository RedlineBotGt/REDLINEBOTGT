import { 
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
const welcomeSessions = new Map<string, { type?: 'welcome' | 'goodbye'; channelId?: string }>();

async function getWelcomeCollection() {
    if (!welcomeCollection) {
        await clientMongo.connect();
        welcomeCollection = clientMongo.db('redline_bot').collection('welcomes');
    }
    return welcomeCollection;
}

// Enrutador interno para las interacciones de bienvenida
export async function handleWelcomeInteraction(interaction: any): Promise<boolean> {
    try {
        // 1. Botón inicial desde el /dash (Edit Hola/Adiós)
        if (interaction.isButton() && interaction.customId === 'dash_btn_welcome_config') {
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

        // 2. Botones de selección (Bienvenida o Despedida) -> Pide el canal
        if (interaction.isButton() && (interaction.customId === 'welcome_menu_bienvenida' || interaction.customId === 'welcome_menu_despedida')) {
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

        // 3. Menús desplegables de canales seleccionados -> Abre el modal correspondiente
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'welcome_select_welcome_channel') {
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

            if (interaction.customId === 'welcome_select_goodbye_channel') {
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
        }

        // 4. Envíos de Modales (Guardar en MongoDB)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_welcome_text') {
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

            if (interaction.customId === 'modal_goodbye_text') {
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
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el manejador de interacciones de bienvenida:', error);
        return false;
    }
}
