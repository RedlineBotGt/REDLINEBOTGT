import { REST, Routes } from 'discord.js';
import { data as dashCommand } from './commands/dash';
import { data as dashstaffCommand } from './commands/dashstaff';
import { data as msnCommand } from './commands/msn';
import { data as formsCommand } from './commands/forms';
import { data as borrarCommand } from './commands/borrar';
import { data as dashsheetsCommand } from './commands/dashSheets';
import { data as dadoCommand } from './commands/dado';

// Mapeamos únicamente los comandos activos que quieres que aparezcan en Discord
const commandList = [
    { name: 'dash', data: dashCommand },
    { name: 'dashstaff', data: dashstaffCommand },
    { name: 'msn', data: msnCommand },
    { name: 'forms', data: formsCommand },
    { name: 'borrar', data: borrarCommand },
    { name: 'dashsheets', data: dashsheetsCommand },
    { name: 'dado', data: dadoCommand },
];

const commands = commandList.map(cmd => {
    if (!cmd.data || typeof cmd.data.toJSON !== 'function') {
        throw new Error(`❌ El comando en './commands/${cmd.name}' no está exportando 'data' correctamente (export const data = ...). Revisa ese archivo.`);
    }
    return cmd.data.toJSON();
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('🔄 Registrando comandos activos en la API de Discord...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: commands },
        );

        console.log('✅ ¡Comandos actualizados y registrados con éxito!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
        process.exit(1);
    }
})();
