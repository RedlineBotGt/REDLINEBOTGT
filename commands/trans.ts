import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { translate } from '@vitalets/google-translate-api';

export const data = new SlashCommandBuilder()
    .setName('trans')
    .setDescription('Traduce un texto al inglés o al castellano')
    .addStringOption(option =>
        option.setName('idioma')
            .setDescription('Idioma al que deseas traducir')
            .setRequired(true)
            .addChoices(
                { name: '🇬🇧 Inglés', value: 'en' },
                { name: '🇪🇸 Castellano', value: 'es' }
            )
    )
    .addStringOption(option =>
        option.setName('texto')
            .setDescription('Texto que quieres traducir')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply();

        const idiomaDestino = interaction.options.getString('idioma', true);
        const textoOriginal = interaction.options.getString('texto', true);

        // Traducción usando la API
        const res = await translate(textoOriginal, { to: idiomaDestino });

        const nombreIdioma = idiomaDestino === 'en' ? 'Inglés' : 'Castellano';
        const bandera = idiomaDestino === 'en' ? '🇬🇧' : '🇪🇸';

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`${bandera} Traducción a ${nombreIdioma}`)
            .addFields(
                { name: '📥 Texto Original', value: textoOriginal },
                { name: '📤 Traducción', value: res.text }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('❌ Error al traducir el texto:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Ocurrió un error al intentar traducir el texto.' });
        } else {
            await interaction.reply({ content: '❌ Ocurrió un error al intentar traducir el texto.', ephemeral: true });
        }
    }
}
