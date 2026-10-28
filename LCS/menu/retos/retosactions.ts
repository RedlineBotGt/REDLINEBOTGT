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
import { MongoClient } from 'mongodb';

// Conexión a la colección de retos / puntos en MongoDB
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'redlinebot'; 
const CATEGORIA_MATES_ID = '1564998683496550573';

async function getRetosCollection() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    return client.db(DB_NAME).collection('lcs_retos_puntos');
}

/**
 * Manejador principal para las interacciones del Módulo de Retos
 */
export async function handleRetosInteraction(interaction: Interaction): Promise<boolean> {
    if (!interaction.isButton() && !interaction.isChannelSelectMenu() && !interaction.isStringSelectMenu()) {
        return false;
    }

    const customId = interaction.customId;

    // 1. Botón principal de RETOS en el menú (o el botón viejo del panel)
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
            ephemeral: true 
        });
        return true;
    }

    // 1.1 Mostrar el Ranking dinámico desde MongoDB
    if (customId === 'lcs_retos_ranking_ver') {
        const collection = await getRetosCollection();
        const ranking = await collection.find({}).sort({ puntos: -1 }).limit(10).toArray();

        let rankingTexto = '🏆 **Clasificación General - Academia LCS**\n\n';
        if (ranking.length === 0) {
            rankingTexto += 'ℹ️ Aún no hay participantes registrados. ¡Sé el primero en resolver un reto!';
        } else {
            rankingTexto += ranking.map((r, index) => {
                const medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
                return `${medalla} **${index + 1}.** <@${r.userId}> - ⭐️ **${r.puntos}** aciertos`;
            }).join('\n');
        }

        await interaction.reply({ 
            content: rankingTexto, 
            ephemeral: true 
        });
        return true;
    }

    // 2. Botón para iniciar Retos de Mates -> Despliega el selector de canales filtrado por la categoría
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
            ephemeral: true
        });
        return true;
    }

    // 3. Capturar la selección del canal y lanzar el primer reto de mates ahí
    if (interaction.isChannelSelectMenu() && interaction.customId === 'select_canal_reto_mates') {
        const canalId = interaction.values[0];
        const canalMates = interaction.guild?.channels.cache.get(canalId) as TextChannel;

        if (!canalMates) {
            await interaction.reply({ content: '❌ No se pudo encontrar el canal seleccionado.', ephemeral: true });
            return true;
        }

        const nivelActual = 1; 
        const reto = generarRetoMates(nivelActual);

        const rowOpciones = new ActionRowBuilder<ButtonBuilder>();
        reto.opciones.forEach((op, index) => {
            const customIdResp = `lcs_reto_resp_${op.esCorrecta ? 'si' : 'no'}_${index}`;
            rowOpciones.addComponents(
                new ButtonBuilder()
                    .setCustomId(customIdResp)
                    .setLabel(op.texto)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const mensajeReto = `🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${nivelActual})\n\n📌 **${reto.pregunta}**`;

        // Enviar el reto al canal elegido
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

    // 4. Botón para saltar al siguiente reto (dentro del canal)
    if (customId === 'lcs_reto_siguiente') {
        const nivelActual = 1; 
        const reto = generarRetoMates(nivelActual);

        const rowOpciones = new ActionRowBuilder<ButtonBuilder>();
        reto.opciones.forEach((op, index) => {
            const customIdResp = `lcs_reto_resp_${op.esCorrecta ? 'si' : 'no'}_${index}`;
            rowOpciones.addComponents(
                new ButtonBuilder()
                    .setCustomId(customIdResp)
                    .setLabel(op.texto)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const mensajeReto = `🎯 **¡Nuevo Reto de Matemáticas!** (Nivel ${nivelActual})\n\n📌 **${reto.pregunta}**`;

        await interaction.update({
            content: mensajeReto,
            components: [rowOpciones]
        });
        return true;
    }

    // 5. Capturar las respuestas de los botones del reto y sumar puntos en MongoDB
    if (customId.startsWith('lcs_reto_resp_')) {
        const esCorrecta = customId.includes('_si_');
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
            // Guardar o actualizar puntos en MongoDB
            const collection = await getRetosCollection();
            await collection.updateOne(
                { userId: userId },
                { 
                    $inc: { puntos: 1 },
                    $set: { username: interaction.user.username }
                },
                { upsert: true }
            );

            const rowSiguiente = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('lcs_reto_siguiente')
                    .setLabel('➡️ ¡Siguiente Reto!')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.update({
                content: `${interaction.message.content}\n\n🎉 **¡Respuesta Correcta de <@${userId}>! (+1 punto)** 🌟`,
                components: [rowDeshabilitada, rowSiguiente]
            });
        } else {
            await interaction.update({
                content: `${interaction.message.content}\n\n❌ **Vaya, <@${userId}>, esa no es. ¡Prueba otra vez!** 💪`,
                components: [rowDeshabilitada]
            });
        }
        return true;
    }

    return false;
}
