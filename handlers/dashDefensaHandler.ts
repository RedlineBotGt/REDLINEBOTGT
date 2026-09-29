import { 
    ButtonInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
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

// Función exportada para que el modal consulte la configuración
export async function getDefensaConfigFromDB(guildId: string) {
    try {
        const col = await getDefensaCollection();
        return await col.findOne({ guildId });
    } catch (error) {
        console.error('❌ Error al leer la configuración de defensas de MongoDB:', error);
        return null;
    }
}

// 1. Iniciar el asistente de 4 pasos al pulsar el botón de setup en el dash
export async function handleDashDefensaButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_setup_defensa') return false;

    const guildId = interaction.guildId!;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ CONFIGURACIÓN DE DEFENSAS (1/4)')
        .setDescription('Paso 1: Selecciona el **Canal Destino 1** (Opcional - Registro, o pulsa "Saltar").')
        .setColor(0xFF4500)
        .setFooter({ text: interaction.guild?.name || 'DISCORDBOT' });

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('def_setup_canal_1')
            .setPlaceholder('Selecciona Canal Destino 1...')
            .addChannelTypes(ChannelType.GuildText)
    );

    const rowSkip1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('def_skip_canal_1')
            .setLabel('Saltar Canal 1')
            .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
        embeds: [embed],
        components: [row, rowSkip1],
        ephemeral: true,
        fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300_000 // 5 minutos
    });

    const configData: { canal1?: string | null; rol1?: string | null; canal2?: string; rol2?: string } = {};

    collector.on('collect', async (i) => {
        if (i.customId === 'def_setup_canal_1' || i.customId === 'def_skip_canal_1') {
            configData.canal1 = i.customId === 'def_skip_canal_1' ? null : i.values[0];

            const embed2 = new EmbedBuilder()
                .setTitle('🛡️ CONFIGURACIÓN DE DEFENSAS (2/4)')
                .setDescription('Paso 2: Selecciona la **Mención 1** (Rol que se alertará en el Canal 1. Opcional).')
                .setColor(0xFF4500)
                .setFooter({ text: interaction.guild?.name || 'DISCORDBOT' });

            const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('def_setup_rol_1')
                    .setPlaceholder('Selecciona el Rol de Mención 1...')
            );

            const rowSkip2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('def_skip_rol_1')
                    .setLabel('Saltar Mención 1')
                    .setStyle(ButtonStyle.Secondary)
            );

            await i.update({ embeds: [embed2], components: [row2, rowSkip2] });

        } else if (i.customId === 'def_setup_rol_1' || i.customId === 'def_skip_rol_1') {
            configData.rol1 = i.customId === 'def_skip_rol_1' ? null : i.values[0];

            const embed3 = new EmbedBuilder()
                .setTitle('🛡️ CONFIGURACIÓN DE DEFENSAS (3/4)')
                .setDescription('Paso 3: Selecciona el **Canal Destino 2** (Donde están los hilos de los reportes para buscar el ID).')
                .setColor(0xFF4500)
                .setFooter({ text: interaction.guild?.name || 'DISCORDBOT' });

            const row3 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('def_setup_canal_2')
                    .setPlaceholder('Selecciona el canal de los hilos de reporte...')
                    .addChannelTypes(ChannelType.GuildText)
            );

            await i.update({ embeds: [embed3], components: [row3] });

        } else if (i.customId === 'def_setup_canal_2') {
            configData.canal2 = i.values[0];

            const embed4 = new EmbedBuilder()
                .setTitle('🛡️ CONFIGURACIÓN DE DEFENSAS (4/4)')
                .setDescription('Paso 4: Selecciona la **Mención 2** (Rol que se alertará dentro del hilo del reporte).')
                .setColor(0xFF4500)
                .setFooter({ text: interaction.guild?.name || 'DISCORDBOT' });

            const row4 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('def_setup_rol_2')
                    .setPlaceholder('Selecciona el Rol de Mención 2...')
            );

            await i.update({ embeds: [embed4], components: [row4] });

        } else if (i.customId === 'def_setup_rol_2') {
            configData.rol2 = i.values[0];

            // 💾 Guardamos de forma persistente en MongoDB
            await saveConfigToDB(guildId, configData);

            const embedPanel = new EmbedBuilder()
                .setTitle('⚖️ DEFENSA DE RECLAMACIONES')
                .setDescription('¿Tienes una reclamación activa? Pincha en el botón inferior para presentar tu defensa oficial de equipo.')
                .setColor(0xFF4500)
                .setFooter({ text: interaction.guild?.name || 'DISCORDBOT' });

            const botonDefensa = new ButtonBuilder()
                .setCustomId('btn_abrir_defensa')
                .setLabel('DEFENSA')
                .setStyle(ButtonStyle.Secondary);

            const rowPanel = new ActionRowBuilder<ButtonBuilder>().addComponents(botonDefensa);

            // Desplegamos el panel en el canal actual
            await interaction.channel?.send({
                embeds: [embedPanel],
                components: [rowPanel]
            });

            await i.update({
                content: '✅ ¡Configuración de defensas completada con éxito! Canales y roles guardados en MongoDB y panel desplegado.',
                embeds: [],
                components: []
            });

            collector.stop();
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            try {
                await interaction.editReply({
                    content: '⏰ El tiempo de configuración ha expirado. Vuelve a iniciar el asistente desde el panel.',
                    embeds: [],
                    components: []
                });
            } catch {}
        }
    });

    return true;
}
