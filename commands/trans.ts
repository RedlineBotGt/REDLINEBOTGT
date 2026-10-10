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

// Función auxiliar para consultar la API de traducción probando endpoint primario y secundario
async function obtenerTraduccion(texto: string, idiomaDestino: string) {
    const encodedText = encodeURIComponent(texto);
    
    // Lista de endpoints públicos alternativos de Google Translate
    const urls = [
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaDestino}&dt=t&q=${encodedText}`,
        `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${idiomaDestino}&q=${encodedText}`
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                
                // Formato de respuesta para endpoint 1 (gtx)
                if (Array.isArray(data[0])) {
                    const textoTraducido = data[0].map((item: any) => item[0]).join('');
                    const idiomaDetectado = data[2] || 'es';
                    return { textoTraducido, idiomaDetectado };
                } 
                // Formato de respuesta para endpoint 2 (dict-chrome-ex)
                else if (Array.isArray(data) && typeof data[0] === 'string') {
                    return { textoTraducido: data[0], idiomaDetectado: 'es' };
                }
            }
        } catch (e) {
            // Si falla una URL, continúa con la siguiente
            continue;
        }
    }

    throw new Error('No se pudo obtener la traducción de ningún servidor.');
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply();

        const idiomaDestino = interaction.options.getString('idioma', true);
        const textoOriginal = interaction.options.getString('texto', true);

        const { textoTraducido, idiomaDetectado } = await obtenerTraduccion(textoOriginal, idiomaDestino);

        // Banderas dinámicas
        const banderaOrigen = idiomaDetectado.startsWith('en') ? '🇬🇧' : '🇪🇸';
        const banderaDestino = idiomaDestino === 'en' ? '🇬🇧' : '🇪🇸';

        const mensajeFinal = `${banderaOrigen} **Original:** ${textoOriginal}\n${banderaDestino} **Traducción:** ${textoTraducido}`;

        await interaction.editReply({ content: mensajeFinal });
    } catch (error) {
        console.error('❌ Error al traducir el texto:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Ocurrió un error al intentar traducir el texto (Límite de peticiones alcanzado).' });
        } else {
            await interaction.reply({ content: '❌ Ocurrió un error al intentar traducir el texto.', ephemeral: true });
        }
    }
}
