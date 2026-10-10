import { SlashCommandBuilder, ChatInputCommandInteraction, AllowedMentionsTypes } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('trans')
    .setDescription('Traduce un texto al inglés, castellano o portugués')
    .addStringOption(option =>
        option.setName('idioma')
            .setDescription('Idioma al que deseas traducir')
            .setRequired(true)
            .addChoices(
                { name: '🇬🇧 Inglés', value: 'en' },
                { name: '🇪🇸 Castellano', value: 'es' },
                { name: '🇵🇹 Portugués', value: 'pt' }
            )
    )
    .addStringOption(option =>
        option.setName('texto')
            .setDescription('Texto que quieres traducir')
            .setRequired(true)
    );

async function obtenerTraduccion(texto: string, idiomaDestino: string) {
    const mentionRegex = /<@[!&]?\d+>|<#\d+>/g;
    const mentions: string[] = [];
    
    // Proteger menciones solo si existen
    const textoProtegido = texto.replace(mentionRegex, (match) => {
        mentions.push(match);
        return `__TAG${mentions.length - 1}__`;
    });

    const encodedText = encodeURIComponent(textoProtegido);
    
    const urls = [
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaDestino}&dt=t&q=${encodedText}`,
        `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${idiomaDestino}&q=${encodedText}`
    ];

    let textoTraducido = '';
    let idiomaDetectado = 'es';
    let success = false;

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                
                if (Array.isArray(data)) {
                    if (Array.isArray(data[0])) {
                        const partes = data[0]
                            .filter((item: any) => Array.isArray(item) && typeof item[0] === 'string')
                            .map((item: any) => item[0]);

                        if (partes.length > 0) {
                            textoTraducido = partes.join('');
                            idiomaDetectado = (typeof data[2] === 'string') ? data[2] : 'es';
                            success = true;
                            break;
                        }
                    } else if (typeof data[0] === 'string') {
                        textoTraducido = data[0];
                        success = true;
                        break;
                    }
                }
            }
        } catch (e) {
            continue;
        }
    }

    if (!success) {
        throw new Error('No se pudo obtener la traducción.');
    }

    // Restaurar menciones únicamente si se detectó alguna originalmente
    if (mentions.length > 0) {
        mentions.forEach((mention, index) => {
            textoTraducido = textoTraducido.replace(new RegExp(`__TAG${index}__`, 'gi'), mention);
        });
    }

    return { textoTraducido: textoTraducido.trim(), idiomaDetectado };
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({
            allowedMentions: {
                parse: [AllowedMentionsTypes.User, AllowedMentionsTypes.Role, AllowedMentionsTypes.Everyone]
            }
        });

        const idiomaDestino = interaction.options.getString('idioma', true);
        const textoOriginal = interaction.options.getString('texto', true);

        const { textoTraducido, idiomaDetectado } = await obtenerTraduccion(textoOriginal, idiomaDestino);

        const obtenerBandera = (lang: string) => {
            const l = lang.toLowerCase();
            if (l.startsWith('en')) return '🇬🇧';
            if (l.startsWith('pt')) return '🇵🇹';
            return '🇪🇸';
        };

        const banderaOrigen = obtenerBandera(idiomaDetectado);
        const banderaDestino = obtenerBandera(idiomaDestino);

        const mensajeFinal = `${banderaOrigen} **Original:** ${textoOriginal}\n${banderaDestino} **Traducción:** ${textoTraducido}`;

        await interaction.editReply({ 
            content: mensajeFinal,
            allowedMentions: {
                parse: [AllowedMentionsTypes.User, AllowedMentionsTypes.Role, AllowedMentionsTypes.Everyone]
            }
        });
    } catch (error) {
        console.error('❌ Error al traducir el texto:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Ocurrió un error al procesar la traducción.' });
        } else {
            await interaction.reply({ content: '❌ Ocurrió un error al procesar la traducción.', ephemeral: true });
        }
    }
}
