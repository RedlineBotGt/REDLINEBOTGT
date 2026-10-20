import { 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    MessageFlags 
} from 'discord.js';
import { processImagesWithOCR } from './octservice';
// Ajusta la ruta relativa hacia tu servicio de hojas según la estructura de tu proyecto
import { getSheetData } from '../../sheetsService'; 

export async function handleIngresoCommand(interaction: ChatInputCommandInteraction) {
    const foto1 = interaction.options.getAttachment('foto1');
    const foto2 = interaction.options.getAttachment('foto2');
    const sesion = interaction.options.getString('sesion', true).toUpperCase();

    if (!foto1) {
        return interaction.editReply({
            content: '❌ Debes adjuntar al menos una imagen de los resultados.'
        });
    }

    // Deferir respuesta ya que el OCR y la lectura de Sheets pueden tomar unos segundos
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }

    try {
        // 1. Cargar la base de datos oficial de pilotos (BD2!L2:L) para validar apodos
        let pilotosBD: string[] = [];
        try {
            const rawBD = await getSheetData('BD2!L2:L');
            if (rawBD) {
                pilotosBD = rawBD.map(r => String(r[0] || '').trim()).filter(p => p !== '');
            }
        } catch (err) {
            console.error('❌ Error al cargar pilotos de BD2!L2:L:', err);
        }

        // 2. Recopilar URLs de las imágenes adjuntas
        const imageUrls = [foto1.url];
        if (foto2) imageUrls.push(foto2.url);

        // 3. Procesar imágenes mediante el servicio OCR
        const parsedResults = await processImagesWithOCR(imageUrls, pilotosBD);

        if (!parsedResults || parsedResults.length === 0) {
            return interaction.editReply({
                content: '❌ No se han podido extraer datos válidos de las capturas de pantalla.'
            });
        }

        // 4. Crear el menú desplegable para seleccionar la Jornada (1 a 6)
        const selectJornada = new StringSelectMenuBuilder()
            .setCustomId(`ingreso_select_jornada_${sesion}`)
            .setPlaceholder('🏁 Selecciona la Jornada para volcar estos datos...');

        for (let i = 1; i <= 6; i++) {
            const esCarrera = sesion.startsWith('C');
            const baseJornada = (i - 1) * 40;
            const filaInicio = esCarrera ? 22 + baseJornada : 2 + baseJornada;
            const filaFin = filaInicio + 15; // Bloque de 16 filas por sesión

            selectJornada.addOptions({
                label: `Jornada ${i} (${sesion} ➔ Ingreso2!${filaInicio}:${filaFin})`,
                value: `${i}`,
                description: `Volcar datos en las filas ${filaInicio} a ${filaFin}`
            });
        }

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectJornada);

        // 5. Generar vista previa en texto plano dentro del Embed
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
