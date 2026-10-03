import { REST, Routes } from 'discord.js';
import { data as dashCommand } from './commands/dash';
import { data as dashstaffCommand } from './commands/dashstaff'; // ⚡ ¡Importamos el comando de staff!
import { data as reporteCommand } from './commands/reporte';
import { data as setupdefensaCommand } from './commands/setupdefensa';
import { data as veredictoCommand } from './commands/veredicto';
import { data as msnCommand } from './commands/msn';
import { data as formsCommand } from './commands/forms';
import { data as colocarFormCommand } from './commands/ColocarForm';
import { data as borrarCommand } from './commands/borrar'; // 🗑️ Importamos el comando borrar
import { data as dashsheetsCommand } from './commands/dashSheets'; // 📊 ¡Importamos el comando dashSheets!

// Mapeamos los comandos con su nombre para validar que ninguno llegue undefined
const commandList = [
    { name: 'dash', data: dashCommand },
    { name: 'dashstaff', data: dashstaffCommand }, // ⚡ ¡Lo añadimos a la lista de registro!
    { name: 'reporte', data: reporteCommand },
    { name: 'setupdefensa', data: setupdefensaCommand },
    { name: 'veredicto', data: veredictoCommand },
    { name: 'msn', data: msnCommand },
    { name: 'forms', data: formsCommand },
    { name: 'colocarForm', data: colocarFormCommand },
    { name: 'borrar', data: borrarCommand }, // 🗑️ Lo añadimos a la lista de registro
    { name: 'dashsheets', data: dashsheetsCommand }, // 📊 ¡Añadido el comando dashsheets aquí!
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
