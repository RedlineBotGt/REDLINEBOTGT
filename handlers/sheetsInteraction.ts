import { ChatInputCommandInteraction, ButtonInteraction, ChannelSelectMenuInteraction, RoleSelectMenuInteraction } from 'discord.js';
// Importa tus manejadores del panel de sheets
import { handleDashSheetsButton, handleSheetsChannelSelect, handleSheetsRoleSelect } from '../Handler/dashSheetsHandler';
import * as dashSheetsCommand from '../Handlers/dashSheets'; // O la ruta donde tengas el comando /dashsheets

export async function handleInteraction(interaction: any) {
    // 1. Manejo de Slash Commands (Ej: /dashsheets)
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'dashsheets') {
            await dashSheetsCommand.execute(interaction);
        }
        // ... otros comandos ...
    }

    // 2. Manejo de Botones del Panel de Sheets y Publicación
    if (interaction.isButton()) {
        const customId = interaction.customId;
        
        // Si es un botón del panel de sheets (comienza con sheets_) o los de publicar (pub_yes, pub_no)
        if (customId.startsWith('sheets_') || customId === 'pub_yes' || customId === 'pub_no') {
            await handleDashSheetsButton(interaction);
        }
        // ... otros botones ...
    }

    // 3. Manejo de Menús Desplegables de Canales
    if (interaction.isChannelSelectMenu()) {
        if (interaction.customId === 'sheets_select_channel') {
            await handleSheetsChannelSelect(interaction);
        }
    }

    // 4. Manejo de Menús Desplegables de Roles
    if (interaction.isRoleSelectMenu()) {
        if (interaction.customId === 'sheets_select_role') {
            await handleSheetsRoleSelect(interaction);
        }
    }
}
