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
            .setMaxLength(6000)
    );

const LIMITE_TRADUCCION = 450;
const LIMITE_DISCORD = 2000;

function dividirTexto(texto: string, limite: number): string[] {
    const partes: string[] = [];
    let restante = texto;

    while (restante.length > limite) {
        let corte = restante.lastIndexOf('\n', limite);
        if (corte < limite * 0.5) corte = restante.lastIndexOf('. ', limite);
        if (corte < limite * 0.5) corte = restante.lastIndexOf('! ', limite);
        if (corte < limite * 0.5) corte = restante.lastIndexOf('? ', limite);
        if (corte < limite * 0.5) corte = restante.lastIndexOf(' ', limite);
        if (corte <= 0) corte = limite;

        // Mantener el separador en el fragmento para no perder espacios ni saltos.
        if (restante[corte] === ' ' || restante[corte] === '\n') corte += 1;
        else if (restante[corte] === '.' || restante[corte] === '!' || restante[corte] === '?') corte += 1;

        partes.push(restante.slice(0, corte));
        restante = restante.slice(corte);
    }

    if (restante.length > 0) partes.push(restante);
    return partes;
}

function dividirMensajeDiscord(texto: string): string[] {
    return dividirTexto(texto, LIMITE_DISCORD);
}

async function obtenerTraduccion(texto: string, idiomaDestino: string) {
    // Se protegen menciones, emojis personalizados, enlaces y marcas Markdown.
    const patronesProtegidos = /<@[!&]?\d+>|<#\d+>|<a?:[a-zA-Z0-9_]+:\d+>|https?:\/\/[^\s<>]+|\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*|__|~~|\|\||`{1,3}/g;
    const elementosProtegidos: string[] = [];
    const textoProtegido = texto.replace(patronesProtegidos, (elemento) => {
        const indice = elementosProtegidos.push(elemento) - 1;
        return `ZXQPROTECTEDTOKEN${indice}QXZ`;
    });

    const fragmentos = dividirTexto(textoProtegido, LIMITE_TRADUCCION);
    const traducciones: string[] = [];
    let idiomaDetectado = 'es';

    // Consultas secuenciales para evitar saturar el servicio gratuito.
    for (const fragmento of fragmentos) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(fragmento)}&langpair=autodetect|${idiomaDestino}`;
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`HTTP Error: ${res.status}`);
        }

        const data = await res.json() as {
            responseData?: { translatedText?: string; detectedLanguage?: string };
            matches?: Array<{ created_by?: string }>;
        };

        if (!data.responseData?.translatedText) {
            throw new Error('No se pudo obtener la traducción.');
        }

        traducciones.push(data.responseData.translatedText);

        if (traducciones.length === 1) {
            idiomaDetectado = data.responseData.detectedLanguage || 'es';
        }
    }

    let textoTraducido = traducciones.join('');

    // Restaurar exactamente las menciones, emojis personalizados, enlaces y formato.
    elementosProtegidos.forEach((elemento, indice) => {
        textoTraducido = textoTraducido.replaceAll(`ZXQPROTECTEDTOKEN${indice}QXZ`, elemento);
    });

    return { textoTraducido: textoTraducido.trim(), idiomaDetectado };
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({
            allowedMentions: { parse: [] }
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
        const mensajes = dividirMensajeDiscord(mensajeFinal);

        await interaction.editReply({
            content: mensajes[0],
            allowedMentions: {
                parse: [AllowedMentionsTypes.User, AllowedMentionsTypes.Role, AllowedMentionsTypes.Everyone]
            }
        });

        for (const mensaje of mensajes.slice(1)) {
            await interaction.followUp({
                content: mensaje,
                allowedMentions: {
                    parse: [AllowedMentionsTypes.User, AllowedMentionsTypes.Role, AllowedMentionsTypes.Everyone]
                }
            });
        }
    } catch (error) {
        console.error('❌ Error al traducir el texto:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Ocurrió un error al procesar la traducción.' });
        } else {
            await interaction.reply({ content: '❌ Ocurrió un error al procesar la traducción.', ephemeral: true });
        }
    }
}
