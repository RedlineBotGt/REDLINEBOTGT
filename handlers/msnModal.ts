import { 
    ModalSubmitInteraction, 
    TextChannel 
} from 'discord.js';

export async function handleMsnModalSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith('modal_msn_')) return false;

    // Recuperamos únicamente el ID del canal del customId
    const parts = interaction.customId.split('_');
    const canalId = parts[2];

    const guild = interaction.guild!;
    let texto = interaction.fields.getTextInputValue('input_msn_texto');
    const imagen = interaction.fields.getTextInputValue('input_msn_imagen').trim();

    // Respondemos de forma privada al emisor
    await interaction.reply({
        content: `✅ ¡Mensaje enviado con éxito al canal seleccionado!`,
        ephemeral: true
    });

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

            let mensajeFinal = texto;
            if (imagen) {
                // Si es una URL válida, la ocultamos de forma limpia con Markdown
                if (imagen.startsWith('http')) {
                    mensajeFinal += `\n\n[📎 Ver imagen adjunta](${imagen})`;
                } else {
                    mensajeFinal += `\n\n📎 ${imagen}`;
                }
            }

            await canalDestino.send({
                content: mensajeFinal
            });
        }
    } catch (error) {
        console.error('❌ Error al enviar el mensaje personalizado:', error);
    }

    return true;
}
