import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ChannelSelectMenuBuilder,
    ChannelType, 
    PermissionFlagsBits 
} from 'discord.js';
import { obtenerFormularios } from '../utils/formsStorage';

export const data = new SlashCommandBuilder()
    .setName('dash')
    .setDescription('Muestra el panel de control centralizado de REDLINE GT')
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
        .setDescription('Bienvenido al centro de administración centralizado. Gestiona formularios, anuncios oficiales y herramientas del servidor desde aquí.')
        .addFields(
            { 
                name: '📋 Formularios Activos', 
                value: titulos.length > 0 ? titulos.map(t => `• **${t}** (Canal: <#${formularios[t].canalRespuestas}>)`).join('\n') : '*No hay formularios creados. Usa `/forms`.*', 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'REDLINE GT Dashboard' });

    const components: ActionRowBuilder<any>[] = [];

    // 1. Fila de Formularios (si existen)
    if (titulos.length > 0) {
        const selectForm = new StringSelectMenuBuilder()
            .setCustomId('dash_select_eliminar_form')
            .setPlaceholder('🗑️ [Formularios] Selecciona uno para eliminar...')
            .addOptions(
                titulos.slice(0, 25).map(titulo => ({
                    label: titulo.substring(0, 100),
                    value: titulo.substring(0, 100),
                    description: 'Eliminar este formulario de forma permanente'
                }))
            );
        components.push(new ActionRowBuilder().addComponents(selectForm));
    }

    // 2. Fila para MSN (Selector de canal directo para enviar anuncio oficial)
    const selectMsnChannel = new ChannelSelectMenuBuilder()
        .setCustomId('dash_select_msn_channel')
        .setPlaceholder('📢 [MSN] Selecciona un canal para enviar anuncio...')
        .addChannelTypes(ChannelType.GuildText);
    
    components.push(new ActionRowBuilder().addComponents(selectMsnChannel));

    await interaction.reply({
        embeds: [embed],
        components,
        ephemeral: true
    });
}
