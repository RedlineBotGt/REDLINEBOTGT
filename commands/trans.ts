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
    
    // Proteger menciones
    const textoProtegido = texto.replace(mentionRegex, (match) => {
        mentions.push(match);
        return `__TAG${mentions.length - 1}__`;
    });

    // Endpoint MyMemory (Autodetect -> idiomaDestino)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textoProtegido)}&langpair=autodetect|${idiomaDestino}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
    }

    const data = await res.json();

    if (!data.responseData || !data.responseData.translatedText) {
        throw new Error('No se pudo obtener la traducción.');
    }

    let textoTraducido = data.responseData.translatedText;
    
    // Detectar idioma desde los datos de MyMemory o defecto
    let idiomaDetectado = 'es';
    if (data.matches && data.matches.length > 0 && data.matches[0].created_by) {
        idiomaDetectado = data.responseData.detectedLanguage || 'es';
    }

    // Restaurar menciones
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
