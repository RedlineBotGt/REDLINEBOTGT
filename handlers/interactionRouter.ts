import { Interaction } from 'discord.js';

export async function handleInteraction(interaction: Interaction) {
    // Si no es un comando de barra, salimos
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // De momento, un aviso temporal para cuando probemos comandos
    if (commandName === 'dash') {
        await interaction.reply({ 
            content: '🚀 Panel DASH en construcción modular...', 
            ephemeral: true 
        });
    } else {
        await interaction.reply({ 
            content: '❌ Comando no reconocido o en desarrollo.', 
            ephemeral: true 
        });
    }
}
