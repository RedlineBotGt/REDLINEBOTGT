import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} from 'discord.js';
import { obtenerFormularios } from '../utils/formsStorage';

export const data = new SlashCommandBuilder()
    .setName('dash')
    .setDescription('Panel de Control Centralizado de REDLINE GT')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return;
    }

    // Obtenemos los formularios de este servidor
    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    const embed = new EmbedBuilder()
        .setColor(0x0055FF)
        .setTitle('🏁 REDLINE GT — Panel de Control')
        .setDescription('Bienvenido al centro de administración centralizado. Selecciona una opción a continuación para gestionar formularios, anuncios o herramientas del servidor.')
        .addFields(
            { 
                name: '📋 Formularios Activos', 
                value: titulos.length > 0 ? titulos.map(t => `• **${t}** (Canal: <#${formularios[t].canalRespuestas}>)`).join('\n') : '*No hay formularios creados. Usa los botones inferiores.*', 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'REDLINE GT Dashboard' });

    // Fila 1: Gestión de Formularios
    const rowForms = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_crear_form').setLabel('Crear').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('dash_btn_editar_form').setLabel('Editar').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('dash_btn_borrar_form').setLabel('Borrar').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId('dash_btn_colocar_form').setLabel('Colocar').setStyle(ButtonStyle.Success).setEmoji('📌')
    );

    // Fila 2: Comunicaciones (Mensaje y Canal)
    const rowMsn = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_msn_mensaje').setLabel('Mensaje').setStyle(ButtonStyle.Primary).setEmoji('💬'),
        new ButtonBuilder().setCustomId('dash_btn_msn_canal').setLabel('Canal').setStyle(ButtonStyle.Secondary).setEmoji('📺')
    );

    // Fila 3: Sistema de Comisarios (Reporte, Defensa y Veredicto)
    const rowComisarios = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('dash_btn_setup_reporte').setLabel('Reporte').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
        new ButtonBuilder().setCustomId('dash_btn_setup_defensa').setLabel('Defensa').setStyle(ButtonStyle.Primary).setEmoji('⚖️'),
        new ButtonBuilder().setCustomId('dash_btn_veredicto').setLabel('Veredicto').setStyle(ButtonStyle.Success).setEmoji('📜')
    );

    await interaction.reply({
        embeds: [embed],
        components: [rowForms, rowMsn, rowComisarios],
        ephemeral: true
    });
}
