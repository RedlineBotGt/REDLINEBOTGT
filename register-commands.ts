import { REST, Routes } from 'discord.js';
import { data as dashCommand } from './commands/dash';
import { data as reporteCommand } from './commands/reporte';

const commands = [
    dashCommand.toJSON(),
    reporteCommand.toJSON()
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
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();
