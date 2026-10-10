import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

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

        // Petición directa al endpoint público para evitar bloqueo de IP por la librería
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaDestino}&dt=t&q=${encodeURIComponent(textoOriginal)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Extraer y unir los fragmentos traducidos
        const textoTraducido = data[0].map((item: any) => item[0]).join('');

        const nombreIdioma = idiomaDestino === 'en' ? 'Inglés' : 'Castellano';
        const bandera = idiomaDestino === 'en' ? '🇬🇧' : '🇪🇸';

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`${bandera} Traducción a ${nombreIdioma}`)
            .addFields(
                { name: '📥 Texto Original', value: textoOriginal },
                { name: '📤 Traducción', value: textoTraducido }
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
