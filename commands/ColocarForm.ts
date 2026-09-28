import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChatInputCommandInteraction, 
    ChannelType, 
    ActionRowBuilder, 
    StringSelectMenuBuilder 
} from 'discord.js';
import { obtenerFormularios } from '../utils/formsStorage';

export const data = new SlashCommandBuilder()
    .setName('colocarform')
    .setDescription('Publica un formulario guardado en un canal mediante un botón (Solo Admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
        option.setName('canal')
            .setDescription('Canal de destino donde se ubicará el botón de formularios')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
        return;
    }

    const canalDestino = interaction.options.getChannel('canal', true);
    // Pasamos el guildId para obtener solo los formularios de este servidor
    const formularios = await obtenerFormularios(interaction.guildId);
    const titulos = Object.keys(formularios);

    if (titulos.length === 0) {
        await interaction.reply({
            content: '❌ No hay ningún formulario guardado en la base de datos de este servidor. Crea uno primero con `/forms`.',
            ephemeral: true
        });
        return;
    }

    // Creamos el menú desplegable con los títulos de los formularios guardados
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_form_deploy_${canalDestino.id}`)
        .setPlaceholder('Selecciona el formulario que deseas colocar...')
        .addOptions(
            titulos.slice(0, 25).map(titulo => ({ // Límite de 25 opciones de Discord
                label: titulo.substring(0, 100),
                value: titulo.substring(0, 100)
            }))
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
        content: `📋 Selecciona del siguiente menú desplegable qué formulario deseas publicar en <#${canalDestino.id}>:`,
        components: [row],
        ephemeral: true
    });
}
