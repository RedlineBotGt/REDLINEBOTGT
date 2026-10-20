import { 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    MessageFlags 
} from 'discord.js';
import { processImagesWithOCR, pendingIngresoCache } from './octservice';
import { getSheetData } from '../sheetsService'; 

export async function handleIngresoCommand(interaction: ChatInputCommandInteraction) {
    const foto1 = interaction.options.getAttachment('foto1');
    const foto2 = interaction.options.getAttachment('foto2');
    const sesion = interaction.options.getString('sesion', true).toUpperCase().trim();

    if (!foto1) {
        return interaction.editReply({
            content: '❌ Debes adjuntar al menos una imagen de los resultados.'
        });
    }

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }

    try {
        let pilotosBD: string[] = [];
        try {
            const rawBD = await getSheetData('BD2!L2:L');
            if (rawBD) {
                pilotosBD = rawBD.map(r => String(r[0] || '').trim()).filter(p => p !== '');
            }
        } catch (err) {
            console.error('❌ Error al cargar pilotos de BD2!L2:L:', err);
        }

        const imageUrls = [foto1.url];
        if (foto2) imageUrls.push(foto2.url);

        const parsedResults = await processImagesWithOCR(imageUrls, pilotosBD);

        if (!parsedResults || parsedResults.length === 0) {
            return interaction.editReply({
                content: '❌ No se han podido extraer datos válidos de las capturas de pantalla.'
            });
        }

        // 🔑 Clave única en memoria usando el ID de usuario y la sesión
        const cacheKey = `${interaction.user.id}_${sesion}`;
        pendingIngresoCache.set(cacheKey, parsedResults);

        const selectJornada = new StringSelectMenuBuilder()
            .setCustomId(`ingreso_select_jornada:${sesion}`) // Usamos dos puntos para separar la acción de los datos
            .setPlaceholder('🏁 Selecciona la Jornada para volcar estos datos...');

        for (let i = 1; i <= 6; i++) {
            const esCarrera = sesion.startsWith('C');
            const baseJornada = (i - 1) * 40;
            const filaInicio = esCarrera ? 22 + baseJornada : 2 + baseJornada;
            const filaFin = filaInicio + 15;

            selectJornada.addOptions({
                label: `Jornada ${i} (${sesion} ➔ Ingreso2!${filaInicio}:${filaFin})`,
                value: `${i}`,
                description: `Volcar datos en las filas ${filaInicio} a ${filaFin}`
            });
        }

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectJornada);

        const previewLines = parsedResults.map(r => 
            `Pos: ${r.position.padStart(2, ' ')} | Piloto: ${r.pilot.padEnd(14, ' ')} | Tiempo: ${r.totalTime} | VR: ${r.bestLap}`
        );
        const previewText = '```text\n' + previewLines.join('\n') + '\n```';

        const embed = new EmbedBuilder()
            .setTitle(`📸 Vista Previa de Transcripción — Sesión: ${sesion}`)
            .setDescription(`Se han detectado **${parsedResults.length} pilotos**.\n\n${previewText}\nSelecciona abajo a qué **Jornada** deseas enviar estos datos:`)
            .setImage(foto1.url)
            .setColor(0x0099ff)
            .setFooter({ text: 'REDLINE GT' });

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });

    } catch (error) {
        console.error('❌ Error en el manejador del comando ingreso:', error);
        await interaction.editReply({
            content: '❌ Ocurrió un error al procesar las imágenes o conectar con la hoja de cálculo.'
        });
    }
}
