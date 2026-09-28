import { REST, Routes } from 'discord.js';
import { data as dashCommand } from './commands/dash';
import { data as reporteCommand } from './commands/reporte';
import { data as setupdefensaCommand } from './commands/setupdefensa';
import { data as veredictoCommand } from './commands/veredicto';
import { data as msnCommand } from './commands/msn';
import { data as formsCommand } from './commands/forms';
import { data as colocarFormCommand } from './commands/ColocarForm';

const commands = [
    dashCommand.toJSON(),
    reporteCommand.toJSON(),
    setupdefensaCommand.toJSON(),
    veredictoCommand.toJSON(),
    msnCommand.toJSON(),
    formsCommand.toJSON(),
    colocarFormCommand.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('🔄 Registrando comandos en la API de Discord...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: commands },
        );

        console.log('✅ ¡Comandos registrados con éxito!');
        process.exit(0); // Cierra el proceso para que Render termine el build con éxito
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
        process.exit(1); // Sale con error si falla
    }
})();
