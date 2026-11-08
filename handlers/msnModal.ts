import { 
    ModalSubmitInteraction, 
    TextChannel,
    EmbedBuilder
} from 'discord.js';
import { buildModalImageAttachment } from './modalImageUpload';

export async function handleMsnModalSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('modal_msn_')) return false;

    // Recuperamos únicamente el ID del canal del customId
    const parts = interaction.customId.split('_');
    const canalId = parts[2];

    const guild = interaction.guild!;
    let texto = interaction.fields.getTextInputValue('input_msn_texto');
    const imagen = interaction.fields.getTextInputValue('input_msn_imagen').trim();
    const uploadedFile = interaction.fields.getUploadedFiles('input_msn_archivo')?.first() ?? null;

    try {
        const canalDestino = await guild.channels.fetch(canalId) as TextChannel;
        if (canalDestino) {
            // Buscamos menciones escritas a mano en el texto (ej: @palmero_gt7)
            const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
            const matches = [...texto.matchAll(mentionRegex)];

            for (const match of matches) {
                const fullMatch = match[0]; // ej: @palmero_gt7
                const query = match[1];      // ej: palmero_gt7
                const queryLower = query.toLowerCase();

                let replacement = fullMatch; // Si no encuentra nada, se queda igual

                // 1. Comprobar si coincide con un rol del servidor
                const foundRole = guild.roles.cache.find(r => r.name.toLowerCase() === queryLower);
                if (foundRole) {
                    replacement = foundRole.id === guild.id ? '@everyone' : `<@&${foundRole.id}>`;
                } else {
                    // 2. Buscar al miembro directamente en la API de Discord (soluciona el problema de la caché)
                    try {
                        const fetchedMembers = await guild.members.fetch({ query: query, limit: 5 });
                        const foundMember = fetchedMembers.find(m => 
                            m.user.username.toLowerCase() === queryLower ||
                            (m.user.globalName && m.user.globalName.toLowerCase() === queryLower) ||
                            (m.nickname && m.nickname.toLowerCase() === queryLower) ||
                            m.user.username.toLowerCase().includes(queryLower)
                        );

                        if (foundMember) {
                            replacement = `<@${foundMember.id}>`;
                        }
                    } catch (fetchError) {
                        console.error(`❌ Error al buscar el miembro ${query}:`, fetchError);
                    }
                }

                // Reemplazamos el texto plano por la mención real de Discord
                texto = texto.replace(fullMatch, replacement);
            }

            // Limpieza de seguridad: elimina la URL de la imagen del texto si se coló por error
            if (imagen) {
                texto = texto.replace(imagen, '').trim();
            }
            texto = texto.replace(/https?:\/\/\S*cdn\.discordapp\.com\S*/gi, '').trim();

            // Preparamos las opciones de envío con el texto limpio y la foto opcional.
            const mensajeOptions: any = {
                content: texto
            };

            const imagenAdjunta = await buildModalImageAttachment(uploadedFile);
            if (imagenAdjunta) {
                mensajeOptions.files = [imagenAdjunta];
            }

            // Si hay una imagen válida, la añadimos mediante un Embed limpio sin URLs de texto plano
            if (imagen) {
                if (imagen.startsWith('http')) {
                    const embedImagen = new EmbedBuilder()
                        .setImage(imagen)
                        .setColor(0xFF4500); // Color corporativo (puedes cambiar el HEX si lo deseas)
                    
                    mensajeOptions.embeds = [embedImagen];
                } else {
                    mensajeOptions.content += `\n\n📎 ${imagen}`;
                }
            }

            await canalDestino.send(mensajeOptions);
            await interaction.reply({
                content: '✅ ¡Mensaje enviado con éxito al canal seleccionado!',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ No se encontró el canal de destino.',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('❌ Error al enviar el mensaje personalizado:', error);
        await interaction.reply({
            content: error instanceof Error
                ? `❌ No se pudo enviar el mensaje: ${error.message}`
                : '❌ No se pudo enviar el mensaje o la imagen.',
            ephemeral: true
        });
    }

    return true;
}
