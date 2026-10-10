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

async function obtenerTraduccion(texto: string, idiomaDestino: string) {
    const encodedText = encodeURIComponent(texto);
    
    // Endpoints optimizados para evitar bloqueos y textos incompletos
    const urls = [
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaDestino}&dt=t&q=${encodedText}`,
        `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${idiomaDestino}&q=${encodedText}`
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                
                // Procesar respuesta del Endpoint 1 (Unir todos los bloques de texto para evitar mensajes cortados)
                if (Array.isArray(data) && Array.isArray(data[0])) {
                    const textoTraducido = data[0]
                        .filter((item: any) => Array.isArray(item) && typeof item[0] === 'string')
                        .map((item: any) => item[0])
                        .join('');
                    
                    const idiomaDetectado = (typeof data[2] === 'string') ? data[2] : 'es';
                    
                    if (textoTraducido.trim().length > 0) {
                        return { textoTraducido, idiomaDetectado };
                    }
                } 
                // Procesar respuesta del Endpoint 2
                else if (Array.isArray(data) && typeof data[0] === 'string') {
                    return { textoTraducido: data[0], idiomaDetectado: 'es' };
                }
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error('No se pudo obtener la traducción completa.');
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply();

        const idiomaDestino = interaction.options.getString('idioma', true);
        const textoOriginal = interaction.options.getString('texto', true);

        const { textoTraducido, idiomaDetectado } = await obtenerTraduccion(textoOriginal, idiomaDestino);

        // Selección de banderas según el idioma detectado y de destino
        const banderaOrigen = idiomaDetectado.toLowerCase().startsWith('en') ? '🇬🇧' : '🇪🇸';
        const banderaDestino = idiomaDestino === 'en' ? '🇬🇧' : '🇪🇸';

        // Formato final en texto plano
        const mensajeFinal = `${banderaOrigen} **Original:** ${textoOriginal}\n${banderaDestino} **Traducción:** ${textoTraducido}`;

        await interaction.editReply({ content: mensajeFinal });
    } catch (error) {
        console.error('❌ Error al traducir el texto:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Ocurrió un error al procesar la traducción completa.' });
        } else {
            await interaction.reply({ content: '❌ Ocurrió un error al procesar la traducción completa.', ephemeral: true });
        }
    }
}
