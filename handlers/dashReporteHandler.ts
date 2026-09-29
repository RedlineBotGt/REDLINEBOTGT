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

// Configuración de MongoDB (misma conexión que usas en el proyecto)
const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const client = new MongoClient(uri);

let reportCollection: any = null;

async function getReportCollection() {
    if (!reportCollection) {
        await client.connect();
        reportCollection = client.db('redline_bot').collection('reportConfig');
        console.log('📋 [MongoDB] Conectado a la colección de reportes con éxito.');
    }
    return reportCollection;
}

// Funciones para guardar y leer la configuración en MongoDB
async function saveConfigToDB(guildId: string, data: any) {
    try {
        const col = await getReportCollection();
        await col.updateOne(
            { guildId },
            { $set: { guildId, ...data } },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Error al guardar la configuración de reportes en MongoDB:', error);
    }
}

export async function getConfigFromDB(guildId: string) {
    try {
        const col = await getReportCollection();
        return await col.findOne({ guildId });
    } catch (error) {
        console.error('❌ Error al leer la configuración de reportes de MongoDB:', error);
        return null;
    }
}

export async function handleDashReporteButton(interaction: ButtonInteraction): Promise<boolean> {
    if (interaction.customId !== 'dash_btn_setup_reporte') return false;

    const guildId = interaction.guildId!;

    const embed = new EmbedBuilder()
        .setTitle('⚙️ CONFIGURACIÓN DE REPORTES (1/4)')
        .setDescription('Paso 1: Selecciona el **Canal Destino 1** (Opcional, o pulsa "Saltar").')
        .setColor(0xFF0000)
        .setFooter({ text: 'DISCORDBOT' });

    const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('setup_canal_1')
            .setPlaceholder('Selecciona Canal Destino 1...')
            .addChannelTypes(ChannelType.GuildText)
    );

    const rowSkip1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('skip_canal_1')
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
        time: 300_000 // 5 minutos de tiempo límite
    });

    const configData: { canal1?: string | null; rol1?: string | null; canal2?: string; rol2?: string } = {};

    collector.on('collect', async (i) => {
        if (i.customId === 'setup_canal_1' || i.customId === 'skip_canal_1') {
            configData.canal1 = i.customId === 'skip_canal_1' ? null : i.values[0];

            const embed2 = new EmbedBuilder()
                .setTitle('⚙️ CONFIGURACIÓN DE REPORTES (2/4)')
                .setDescription('Paso 2: Selecciona la **Mención 1** (Rol que se alertará en el Canal 1. Opcional).')
                .setColor(0xFF0000)
                .setFooter({ text: 'DISCORDBOT' });

            const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('setup_rol_1')
                    .setPlaceholder('Selecciona el Rol de Mención 1...')
            );

            const rowSkip2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('skip_rol_1')
                    .setLabel('Saltar Mención 1')
                    .setStyle(ButtonStyle.Secondary)
            );

            await i.update({ embeds: [embed2], components: [row2, rowSkip2] });

        } else if (i.customId === 'setup_rol_1' || i.customId === 'skip_rol_1') {
            configData.rol1 = i.customId === 'skip_rol_1' ? null : i.values[0];

            const embed3 = new EmbedBuilder()
                .setTitle('⚙️ CONFIGURACIÓN DE REPORTES (3/4)')
                .setDescription('Paso 3: Selecciona el **Canal Destino 2** (Donde se creará el hilo automático).')
                .setColor(0xFF0000)
                .setFooter({ text: 'DISCORDBOT' });

            const row3 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_canal_2')
                    .setPlaceholder('Selecciona Canal Destino 2...')
                    .addChannelTypes(ChannelType.GuildText)
            );

            await i.update({ embeds: [embed3], components: [row3] });

        } else if (i.customId === 'setup_canal_2') {
            configData.canal2 = i.values[0];

            const embed4 = new EmbedBuilder()
                .setTitle('⚙️ CONFIGURACIÓN DE REPORTES (4/4)')
                .setDescription('Paso 4: Selecciona la **Mención 2** (Rol que se alertará en el Canal 2).')
                .setColor(0xFF0000)
                .setFooter({ text: 'DISCORDBOT' });

            const row4 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('setup_rol_2')
                    .setPlaceholder('Selecciona el Rol de Mención 2...')
            );

            await i.update({ embeds: [embed4], components: [row4] });

        } else if (i.customId === 'setup_rol_2') {
            configData.rol2 = i.values[0];

            // 💾 Guardamos de forma persistente en MongoDB
            await saveConfigToDB(guildId, configData);

            const embedPanel = new EmbedBuilder()
                .setTitle('🚨 REPORTES DE CARRERA')
                .setDescription('¿Quieres reportar una acción en carrera?\nPincha en el botón rojo y rellena el formulario.')
                .setColor(0xFF0000)
                .setFooter({ text: 'DISCORDBOT' });

            const botonReporte = new ButtonBuilder()
                .setCustomId('btn_abrir_reporte')
                .setLabel('REPORTE')
                .setStyle(ButtonStyle.Danger);

            const rowPanel = new ActionRowBuilder<ButtonBuilder>().addComponents(botonReporte);

            await interaction.channel?.send({
                embeds: [embedPanel],
                components: [rowPanel]
            });

            await i.update({
                content: '✅ ¡Configuración completada con éxito! Canales y roles guardados en MongoDB y panel de reportes desplegado.',
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
