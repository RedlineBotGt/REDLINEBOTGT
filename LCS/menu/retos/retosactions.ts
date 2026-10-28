import { 
    Interaction, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextChannel,
    ComponentType,
    ChannelSelectMenuBuilder,
    ChannelType 
} from 'discord.js';
import { generarRetoMates } from './mates/mates';
import { MongoClient, Db } from 'mongodb';

// Reutilización segura de cliente MongoDB utilizando MONGO_URI (nombre correcto en Render)
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
let cachedDb: Db | null = null;

async function getRetosCollection() {
    if (!MONGO_URI) {
        throw new Error('❌ La variable MONGO_URI no está definida en las variables de entorno de Render.');
    }
    if (!cachedDb) {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        cachedDb = client.db('redlinebot');
    }
    return cachedDb.collection('lcs_retos_puntos');
}

/**
 * Manejador principal para las interacciones del Módulo de Retos
 */
export async function handleRetosInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;

    // 1. Botón principal de RETOS / Menú de opciones (Ranking y Mates)
    if (customId === 'lcs_menu_retos' || customId === 'lcs_retos_ranking') {
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lcs_retos_ranking_ver')
                    .setLabel('🏆 Ranking')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('lcs_retos_mates_crear')
                    .setLabel('📐 Retos de Mates')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.reply({ 
            content: '🎯 **Academia LCS - Menú Principal**\nSelecciona una opción:', 
            components: [row], 
            flags: [1 << 6] // Reemplazo limpio de ephemeral para evitar warning
        });
        return true;
    }

    // 1.1 Mostrar el Ranking dinámico desde MongoDB
    if (customId === 'lcs_retos_ranking_ver') {
        try {
            const collection = await getRetosCollection();
            const ranking = await collection.find({}).sort({ puntos: -1 }).limit(10).toArray();

            let rankingTexto = '🏆 **Clasificación General - Academia LCS**\n\n';
            if (ranking.length === 0) {
                rankingTexto += 'ℹ️ Aún no hay participantes registrados. ¡Sé el primero en resolver un reto!';
            } else {
                rankingTexto += ranking.map((r, index) => {
                    const medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
                    return `${medalla} **${index + 1}.** <@${r.userId}> - ⭐️ **${r.puntos}** puntos`;
                }).join('\n');
            }

            await interaction.reply({ 
                content: rankingTexto, 
                flags: [1 << 6] 
            });
        } catch (err) {
            console.error('❌ Error al consultar ranking en MongoDB:', err);
            await interaction.reply({
                content: '❌ Error al conectar con la base de datos para obtener el ranking.',
                flags: [1 << 6]
            });
        }
        return true;
    }

    // 2. Botón para iniciar Retos de Mates -> Despliega el selector de canales
    if (customId === 'lcs_retos_mates_crear') {
        const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('select_canal_reto_mates')
                .setPlaceholder('Selecciona el canal de Mates para enviar el reto')
                .addChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
        );

        await interaction.reply({
            content: '📐 **Retos de Mates**\nSelecciona el canal de destino dentro de la categoría de Mates:',
            components: [row],
            flags: [1 << 6]
        });
        return true;
    }

    // 3. Capturar la selección del canal y lanzar el primer reto (Nivel 1)
    if (interaction.isChannelSelectMenu() && interaction.customId === 'select_canal_reto_mates') {
        const canalId = interaction.values[0];
        const canalMates = interaction.guild?.channels.cache.get(canalId) as TextChannel;

        if (!canalMates) {
            await interaction.reply({ content: '❌ No se pudo encontrar el canal seleccionado.', flags: [1 << 6] });
            return true;
        }

        const nivelInicial = 1; 
        const reto = generarRetoMates(nivelInicial);

        const rowOpciones = new ActionRowBuilder<ButtonBuilder>();
        reto.opciones.forEach((op, index) => {
            const customIdResp = `lcs_reto_resp_${op.esCorrecta ? 'si' : 'no'}_${nivelInicial}_${index}`;
            rowOpciones.addComponents(
                new ButtonBuilder()
                    .setCustomId(customIdResp)
                    .setLabel(op.texto)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const mensajeReto = `🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${nivelInicial})\n\n📌 **${reto.pregunta}**`;

        await canalMates.send({
            content: mensajeReto,
            components: [rowOpciones]
        });

        await interaction.update({ 
            content: `✅ ¡Reto de Mates lanzado con éxito al canal <#${canalId}>!`, 
            components: [] 
        });
        return true;
    }

    // 4. Capturar las respuestas de los botones y guardar/avanzar
    if (customId.startsWith('lcs_reto_resp_')) {
        const partes = customId.split('_');
        const esCorrecta = partes[3] === 'si';
        const nivelActual = parseInt(partes[4]) || 1;
        const userId = interaction.user.id;

        const rowDeshabilitada = new ActionRowBuilder<ButtonBuilder>();
        interaction.message.components.forEach(row => {
            row.components.forEach(component => {
                if (component.type === ComponentType.Button) {
                    const button = ButtonBuilder.from(component);
                    button.setDisabled(true);
                    if (component.customId?.includes('_si_')) {
                        button.setStyle(ButtonStyle.Success);
                    } else if (component.customId === customId && !esCorrecta) {
                        button.setStyle(ButtonStyle.Danger);
                    }
                    rowDeshabilitada.addComponents(button);
                }
            });
        });

        if (esCorrecta) {
            try {
                const collection = await getRetosCollection();
                await collection.updateOne(
                    { userId: userId },
                    { 
                        $inc: { puntos: 1 },
                        $set: { username: interaction.user.username }
                    },
                    { upsert: true }
                );
            } catch (err) {
                console.error('❌ Error al guardar puntos en MongoDB:', err);
            }

            await interaction.update({
                content: `${interaction.message.content}\n\n🎉 **¡Respuesta Correcta de <@${userId}>! (+1 punto)** 🌟`,
                components: [rowDeshabilitada]
            });

            // Siguiente reto automático
            const siguienteNivel = nivelActual + 1;
            const nuevoReto = generarRetoMates(siguienteNivel);

            const rowNuevasOpciones = new ActionRowBuilder<ButtonBuilder>();
            nuevoReto.opciones.forEach((op, index) => {
                const customIdResp = `lcs_reto_resp_${op.esCorrecta ? 'si' : 'no'}_${siguienteNivel}_${index}`;
                rowNuevasOpciones.addComponents(
                    new ButtonBuilder()
                        .setCustomId(customIdResp)
                        .setLabel(op.texto)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            const canalActual = interaction.channel as TextChannel;
            if (canalActual) {
                await canalActual.send({
                    content: `📈 **¡Nivel Superado! Subimos la dificultad:**\n\n🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${siguienteNivel})\n\n📌 **${nuevoReto.pregunta}**`,
                    components: [rowNuevasOpciones]
                });
            }

        } else {
            await interaction.update({
                content: `${interaction.message.content}\n\n❌ **Vaya, <@${userId}>, esa no es. ¡Prueba otra vez en el siguiente!** 💪`,
                components: [rowDeshabilitada]
            });
        }
        return true;
    }

    return false;
}
