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

        // Petición directa al endpoint libre de Google Translate
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaDestino}&dt=t&q=${encodeURIComponent(textoOriginal)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Extraer el texto traducido y el idioma detectado por Google
        const textoTraducido = data[0].map((item: any) => item[0]).join('');
        const idiomaDetectado = data[2] || 'es'; // Idioma origen detectado

        // Asignar la bandera correcta al origen según lo detectado
        const banderaOrigen = idiomaDetectado.startsWith('en') ? '🇬🇧' : '🇪🇸';
        // Asignar la bandera correcta al destino elegido
        const banderaDestino = idiomaDestino === 'en' ? '🇬🇧' : '🇪🇸';

        // Mensaje limpio con su respectiva bandera en cada línea
        const mensajeFinal = `${banderaOrigen} **Original:** ${textoOriginal}\n${banderaDestino} **Traducción:** ${textoTraducido}`;

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
