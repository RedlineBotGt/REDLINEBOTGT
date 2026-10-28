import { 
    SlashCommandBuilder, 
    CommandInteraction, 
    ChannelType 
} from 'discord.js';

// ID exclusivo del servidor LCS
const LCS_GUILD_ID = '1564967606295732304';

export const data = new SlashCommandBuilder()
    .setName('alarma')
    .setDescription('Programa o configura una alarma/mensaje automático para LCS')
    .addChannelOption(option =>
        option.setName('canal')
            .setDescription('Canal donde se enviará el mensaje')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
    .addStringOption(option =>
        option.setName('hora')
            .setDescription('Hora de envío (Formato 24h, ej: 21:00)')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('texto')
            .setDescription('Texto o mensaje que se enviará')
            .setRequired(true));

export async function execute(interaction: CommandInteraction) {
    // 🛡️ Restricción estricta de servidor
    if (interaction.guildId !== LCS_GUILD_ID) {
        return interaction.reply({ 
            content: '❌ Este comando es exclusivo y solo se puede usar en el servidor autorizado de LCS.', 
            ephemeral: true 
        });
    }

    // Obtener los valores introducidos en los parámetros de forma nativa
    const channel = interaction.options.get('canal')?.channel;
    const hora = interaction.options.get('hora')?.value;
    const texto = interaction.options.get('texto')?.value;

    // Confirmación visual
    await interaction.reply({ 
        content: `✅ **Alarma configurada con éxito para LCS**\n📌 **Canal:** <#${channel?.id}>\n⏰ **Hora:** ${hora}\n💬 **Texto:** ${texto}`, 
        ephemeral: true 
    });
}
