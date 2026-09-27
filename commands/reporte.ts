import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('setup-reporte')
    .setDescription('Despliega el panel oficial de reportes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    // 1. Creamos el Embed Rojo con tus textos exactos
    const embedReporte = new EmbedBuilder()
        .setTitle('🚨 REPORTES DE CARRERA')
        .setDescription('¿Quieres Reportar una acción en carrera?\nPincha en el botón Rojo y rellena el formulario')
        .setColor(0xFF0000) // Rojo corporativo de alerta
        .setFooter({ text: 'DISCORDBOT' });

    // 2. Creamos el Botón Rojo interactivo
    const botonReporte = new ButtonBuilder()
        .setCustomId('btn_abrir_reporte')
        .setLabel('REPORTE')
        .setStyle(ButtonStyle.Danger) // Color rojo de Discord
        

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(botonReporte);

    // 3. Respondemos al admin de forma privada y enviamos el panel al canal
    await interaction.reply({
        content: '✅ Panel de reportes generado con éxito.',
        ephemeral: true
    });

    await interaction.channel?.send({
        embeds: [embedReporte],
        components: [row]
    });
}
