import { 
    ButtonInteraction, 
    ChannelSelectMenuInteraction, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType 
} from 'discord.js';
import { MongoClient } from 'mongodb';

// Configuración de MongoDB
const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoClient(uri);

let defensaCollection: any = null;

async function getDefensaCollection() {
    if (!defensaCollection) {
        await client.connect();
        defensaCollection = client.db('redline_bot').collection('defensaConfig');
        console.log('⚖️ [MongoDB] Conectado a la colección de defensas con éxito.');
    }
    return defensaCollection;
}

// Función para guardar la configuración en MongoDB
async function saveConfigToDB(guildId: string, data: any) {
    try {
        const col = await getDefensaCollection();
        await col.updateOne(
            { guildId },
            { $set: { guildId, ...data } },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Error al guardar la configuración de defensas en MongoDB:', error);
    }
}

// Función exportada por si el modal de defensas necesita consultar la configuración
export async function getDefensaConfigFromDB(guildId: string) {
    try {
        const col = await getDefensaCollection();
        return await col.findOne({ guildId });
    } catch (error) {
        console.error('❌ Error al leer la configuración de defensas de MongoDB:', error);
        return null;
    }
}

// 1. Maneja el clic en el botón "Defensa" del panel /dash
export async function handleDashDefensaButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_setup_defensa') return false;

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('dash_select_defensa_channel')
        .setPlaceholder('📢 Selecciona el canal para el panel de defensas...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

    await interaction.reply({
        content: '⚖️ **Sistema de Defensas:** Selecciona el canal donde se publicará el panel oficial de defensas:',
        components: [row],
        ephemeral: true
    });

    return true;
}

// 2. Maneja la selección del canal y despliega el panel
export async function handleDashDefensaChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_select_defensa_channel') return false;

    const channelId = interaction.values[0];
    const guildId = interaction.guildId!;

    // 💾 Guardamos la configuración de forma persistente en MongoDB
    await saveConfigToDB(guildId, { channelId });

    const canalDestino = interaction.guild?.channels.cache.get(channelId);
    if (canalDestino && canalDestino.isTextBased()) {
        const embedPanel = new EmbedBuilder()
            .setTitle('⚖️ DEFENSA DE RECLAMACIONES')
            .setDescription('¿Tienes una reclamación activa? Pincha en el botón inferior para presentar tu defensa oficial de equipo.')
            .setColor(0xFF4500)
            .setFooter({ text: interaction.guild.name });

        const botonDefensa = new ButtonBuilder()
            .setCustomId('btn_abrir_defensa')
            .setLabel('DEFENSA')
            .setStyle(ButtonStyle.Secondary);

        const rowPanel = new ActionRowBuilder<ButtonBuilder>().addComponents(botonDefensa);

        await canalDestino.send({
            embeds: [embedPanel],
            components: [rowPanel]
        });
    }

    await interaction.update({
        content: '✅ ¡Panel de defensas configurado, guardado en MongoDB y desplegado con éxito en el canal seleccionado!',
        components: []
    });

    return true;
}
