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
            // Buscamos menciones escritas a mano en el texto (ej: @palmero)
            const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
            const roles = guild.roles.cache;
            const members = guild.members.cache;

            texto = texto.replace(mentionRegex, (match, query) => {
                const queryLower = query.toLowerCase();

                // 1. Comprobar si coincide con un rol del servidor (se mantiene exacto para evitar conflictos)
                const foundRole = roles.find(r => r.name.toLowerCase() === queryLower);
                if (foundRole) {
                    return foundRole.id === guild.id ? '@everyone' : `<@&${foundRole.id}>`;
                }

                // 2. Comprobar si el texto está INCLUIDO en el nombre, apodo o nombre global del usuario
                const foundMember = members.find(m => 
                    m.user.username.toLowerCase().includes(queryLower) ||
                    (m.user.globalName && m.user.globalName.toLowerCase().includes(queryLower)) ||
                    (m.nickname && m.nickname.toLowerCase().includes(queryLower))
                );
                if (foundMember) {
                    return `<@${foundMember.id}>`;
                }

                // Si no coincide con nadie, se deja tal cual lo escribió
                return match;
            });

            let mensajeFinal = texto;
            if (imagen) {
                mensajeFinal += `\n${imagen}`;
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
