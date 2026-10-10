import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

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

        // Petición directa al endpoint libre de Google Translate para evitar límites de IP en Render
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaDestino}&dt=t&q=${encodeURIComponent(textoOriginal)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Extraer y unir las partes traducidas
        const textoTraducido = data[0].map((item: any) => item[0]).join('');

        const bandera = idiomaDestino === 'en' ? '🇬🇧' : '🇪🇸';

        // Mensaje de texto plano sin Embed para permitir pings y menciones reales
        const mensajeFinal = `${bandera} **Original:** ${textoOriginal}\n**Traducción:** ${textoTraducido}`;

        await interaction.editReply({ content: mensajeFinal });
    } catch (error) {
        console.error('❌ Error al traducir el texto:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Ocurrió un error al intentar traducir el texto.' });
        } else {
            await interaction.reply({ content: '❌ Ocurrió un error al intentar traducir el texto.', ephemeral: true });
        }
    }
}
