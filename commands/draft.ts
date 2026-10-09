// commands/draft.ts
import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    MessageFlags 
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('draft')
    .setDescription('Inicia el sistema de selección de coches (Draft) para el campeonato')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ 
                content: '❌ Solo los administradores pueden iniciar el draft.', 
                flags: [MessageFlags.Ephemeral] 
            });
            return;
        }

        const channelSelectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('draft_select_channel')
                .setPlaceholder('📂 Selecciona el canal público para el Draft')
                .addChannelTypes(ChannelType.GuildText)
        );

        await interaction.reply({
            content: '🏁 **Sistema de Draft:** Selecciona el canal de texto donde se publicará el panel oficial del draft:',
            components: [channelSelectRow],
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('❌ Error al ejecutar el comando /draft:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Hubo un error al iniciar el comando.', flags: [MessageFlags.Ephemeral] });
        }
    }
}
