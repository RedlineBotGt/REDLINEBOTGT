import * as msn from '../commands/msn';
import { handleMsnModalSubmit } from './msnModal';

// Dentro de handleChatInputCommand / isChatInputCommand():
else if (interaction.commandName === 'msn') {
    await msn.execute(interaction);
}

// Dentro de isModalSubmit():
else if (interaction.customId.startsWith('modal_msn_')) {
    await handleMsnModalSubmit(interaction);
}
