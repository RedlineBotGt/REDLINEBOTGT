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
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'defensaConfig.json');

function saveConfig(guildId: string, data: any) {
    let configs: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
        configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    configs[guildId] = data;
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
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

    // Guardamos la configuración local
    saveConfig(guildId, { channelId });

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
        content: '✅ ¡Panel de defensas configurado y desplegado con éxito en el canal seleccionado!',
        components: []
    });

    return true;
}
