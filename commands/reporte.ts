
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits 
} from 'discord.js';
import fs from 'fs';
import path from 'path';

// Ruta para guardar la configuración de canales y roles por servidor
const configPath = path.join(process.cwd(), 'reportConfig.json');

function saveConfig(guildId: string, data: any) {
    let configs: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
        configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    configs[guildId] = data;
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
}

export const data = new SlashCommandBuilder()
    .setName('setup-reporte')
    .setDescription('Asistente de configuración paso a paso para el sistema de reportes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
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

            // Guardamos la configuración en el archivo JSON local del servidor
            saveConfig(guildId, configData);

            // Creamos el panel oficial de reportes con el botón
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

            // Enviamos el panel al canal público
            await interaction.channel?.send({
                embeds: [embedPanel],
                components: [rowPanel]
            });

            await i.update({
                content: '✅ ¡Configuración completada con éxito! Canales y roles guardados, y panel de reportes desplegado.',
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
                    content: '⏰ El tiempo de configuración ha expirado. Vuelve a ejecutar `/setup-reporte`.',
                    embeds: [],
                    components: []
                });
            } catch {}
        }
    });
}
