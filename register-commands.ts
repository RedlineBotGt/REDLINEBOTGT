import { REST, Routes } from 'discord.js';
import { data as dashCommand } from './commands/dash';
import { data as dashstaffCommand } from './commands/dashstaff';
import { data as msnCommand } from './commands/msn';
import { data as borrarCommand } from './commands/borrar';
import { data as dashsheetsCommand } from './dashsheet/dashsheet';
import { data as dadoCommand } from './commands/dado';
import { data as draftCommand } from './commands/draft';
import { data as listaCommand } from './commands/lista';
import { data as clubCommand } from './commands/club';
import { data as clubclasCommand } from './commands/clubclas';
import { data as transCommand } from './commands/trans';
import { data as titularesCommand } from './commands/titulares';
import { data as reservasCommand } from './commands/reservas';
import { data as eloCommand } from './commands/elo';

// ➔ Importar comandos exclusivos de LCS
import { data as alarmaCommand } from './LCS/alarma/alarma';
import { data as menuCommand } from './LCS/menu/menu'; // 👈 Importamos el comando /menu

const LCS_GUILD_ID = '1564967606295732304';

// 1. Comandos Globales
const globalCommandList = [
    { name: 'dash', data: dashCommand },
    { name: 'dashstaff', data: dashstaffCommand },
    { name: 'msn', data: msnCommand },
    { name: 'borrar', data: borrarCommand },
    { name: 'dashsheets', data: dashsheetsCommand },
    { name: 'dado', data: dadoCommand },
    { name: 'draft', data: draftCommand },
    { name: 'lista', data: listaCommand },
    { name: 'club', data: clubCommand },
    { name: 'clubclas', data: clubclasCommand },
    { name: 'trans', data: transCommand },
    { name: 'titulares', data: titularesCommand },
    { name: 'reservas', data: reservasCommand },
    { name: 'elo', data: eloCommand },
];

const globalCommands = globalCommandList.map(cmd => {
    if (!cmd.data || typeof cmd.data.toJSON !== 'function') {
        throw new Error(`❌ El comando global '${cmd.name}' no está exportando 'data' correctamente.`);
    }
    return cmd.data.toJSON();
});

// 2. Comandos Exclusivos de LCS (Se registran solo en el servidor LCS de forma instantánea)
const lcsCommandList = [
    { name: 'alarma', data: alarmaCommand },
    { name: 'menu', data: menuCommand }, // 👈 Añadido a los comandos exclusivos de LCS
];

const lcsCommands = lcsCommandList.map(cmd => {
    if (!cmd.data || typeof cmd.data.toJSON !== 'function') {
        throw new Error(`❌ El comando LCS '${cmd.name}' no está exportando 'data' correctamente.`);
    }
    return cmd.data.toJSON();
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('🔄 Registrando comandos activos en la API de Discord...');

        // Registrar comandos globales
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: globalCommands },
        );
        console.log('✅ ¡Comandos globales actualizados con éxito!');

        // Registrar comandos exclusivos del servidor LCS (Instantáneo)
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, LCS_GUILD_ID),
            { body: lcsCommands },
        );
        console.log('✅ ¡Comandos exclusivos de LCS registrados en el servidor con éxito!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
        process.exit(1);
    }
})();
