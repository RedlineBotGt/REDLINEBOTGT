import { 
    Client, 
    GuildMember, 
    TextChannel, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    ButtonInteraction, 
    ChannelSelectMenuInteraction, 
    ChannelType, 
    MessageFlags 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let avisosCollection: any = null;

async function getAvisosCollection() {
    if (!avisosCollection) {
        await clientMongo.connect();
        avisosCollection = clientMongo.db('redline_bot').collection('avisos_logs');
    }
    return avisosCollection;
}

// 1. Inicializador de los eventos de Avisos
export function setupAvisosSystem(client: Client) {
    console.log('📋 [System] Sistema de Avisos activo.');

    // Evento: Usuario nuevo entra
    client.on('guildMemberAdd', async (member: GuildMember) => {
        try {
            const col = await getAvisosCollection();
            const config = await col.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;

            const channel = await member.guild.channels.fetch(config.channelId) as TextChannel;
            if (!channel) return;

            const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📥 Nuevo Piloto en el Paddock')
                .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
                .setDescription(`• **Piloto:** <@${member.id}> (${member.user.tag})\n• **Cuenta creada:** <t:${createdTimestamp}:R>`)
                .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en avisos guildMemberAdd:', error);
        }
    });

    // Evento: Usuario abandona el servidor
    client.on('guildMemberRemove', async (member: GuildMember) => {
        try {
            const col = await getAvisosCollection();
            const config = await col.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;

            const channel = await member.guild.channels.fetch(config.channelId) as TextChannel;
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('📤 Un Piloto ha abandonado el Servidor')
                .setThumbnail(member.user.displayAvatarURL({ forceStatic: false }))
                .setDescription(`• **Piloto:** <@${member.id}> (${member.user.tag})`)
                .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error en avisos guildMemberRemove:', error);
        }
    });

    // Evento: Usuario recibe un nuevo rol
    client.on('guildMemberUpdate', async (oldMember: GuildMember, newMember: GuildMember) => {
        try {
            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;

            // Detectar si se añadió algún rol nuevo
            const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
            if (addedRoles.size === 0) return;

            const col = await getAvisosCollection();
            const config = await col.findOne({ guildId: newMember.guild.id });
            if (!config || !config.channelId) return;

            const channel = await newMember.guild.channels.fetch(config.channelId) as TextChannel;
            if (!channel) return;

            for (const role of addedRoles.values()) {
                const embed = new EmbedBuilder()
                    .setColor(0x00AAFF)
                    .setTitle('🏷️ Rol Asignado')
                    .setDescription(`• **Piloto:** <@${newMember.id}>\n• **Rol recibido:** **${role.name}**`)
                    .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() || undefined })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('❌ Error en avisos guildMemberUpdate:', error);
        }
    });
}

// 2. Botón desde el /dash -> Muestra selector de canal para Avisos
export async function handleDashAvisosButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_avisos_config') return false;

    const selectChannel = new ChannelSelectMenuBuilder()
        .setCustomId('avisos_select_channel')
        .setPlaceholder('📢 Selecciona el canal para los avisos...')
        .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(selectChannel);

    await interaction.reply({
        content: '⚙️ **Configuración de Avisos**\nSelecciona el canal donde el bot enviará los registros de entradas, salidas y roles:',
        components: [row],
        flags: [MessageFlags.Ephemeral]
    });

    return true;
}

// 3. Canal de avisos seleccionado -> Guarda en MongoDB
export async function handleAvisosChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<boolean> {
    if (interaction.customId !== 'avisos_select_channel') return false;

    const channelId = interaction.values[0];
    if (!interaction.guild) return true;

    const col = await getAvisosCollection();
    await col.updateOne(
        { guildId: interaction.guild.id },
        { $set: { channelId } },
        { upsert: true }
    );

    await interaction.update({
        content: `✅ **¡Canal de avisos configurado con éxito en <#${channelId}>!**`,
        components: []
    });

    return true;
}
