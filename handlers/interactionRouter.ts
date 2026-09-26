import { Interaction } from 'discord.js';
import * as dashCommand from '../commands/dash';

export async function handleInteraction(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'dash') {
        await dashCommand.execute(interaction);
    } else {
        await interaction.reply({ 
            content: '❌ Comando no reconocido.', 
            ephemeral: true 
        });
    }
}
