
import { REST, Routes } from 'discord.js';

import { data as dashCommand } from './commands/dash';
import { data as dashstaffCommand } from './commands/dashstaff';
import { data as msnCommand } from './commands/msn';
import { data as borrarCommand } from './commands/borrar';
import { data as dashsheetsCommand } from './dashsheet/dashsheet';
import { data as clasificacionCommand } from './commands/clasificacion';
import { data as dadoCommand } from './commands/dado';
import { data as draftCommand } from './commands/draft';
import { data as listaCommand } from './commands/lista';
import { data as transCommand } from './commands/trans';
import { data as titularesCommand } from './commands/titulares';
import { data as reservasCommand } from './commands/reservas';
import { data as eloCommand } from './commands/elo';

// Servidor donde estaban publicados los comandos exclusivos de LCS.
const LCS_GUILD_ID = '1564967606295732304';

// =====================================================
// COMANDOS GLOBALES ACTIVOS
// =====================================================

const globalCommands = [
    dashCommand,
    dashstaffCommand,
    msnCommand,
    borrarCommand,
    dashsheetsCommand,
    clasificacionCommand,
    dadoCommand,
    draftCommand,
    listaCommand,
    transCommand,
    titularesCommand,
    reservasCommand,
    eloCommand
].map(command => {
    if (!command || typeof command.toJSON !== 'function') {
        throw new Error(
            '❌ Hay un comando global que no exporta correctamente data.'
        );
    }

    return command.toJSON();
});

// =====================================================
// CONEXIÓN CON DISCORD
// =====================================================

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
    throw new Error(
        '❌ Faltan DISCORD_TOKEN o CLIENT_ID para registrar comandos.'
    );
}

const rest = new REST({ version: '10' }).setToken(token);

// =====================================================
// REGISTRO Y LIMPIEZA
// =====================================================

(async () => {
    try {
        console.log(
            '🔄 Actualizando los comandos globales de REDLINE...'
        );

        // Sustituye la lista global anterior por la lista activa.
        await rest.put(
            Routes.applicationCommands(clientId),
            {
                body: globalCommands
            }
        );

        console.log(
            '✅ Comandos globales actualizados correctamente.'
        );

        console.log(
            '🧹 Eliminando los comandos exclusivos antiguos de LCS...'
        );

        // Una lista vacía elimina todos los comandos de esa guild.
        await rest.put(
            Routes.applicationGuildCommands(
                clientId,
                LCS_GUILD_ID
            ),
            {
                body: []
            }
        );

        console.log(
            '✅ Comandos exclusivos de LCS eliminados.'
        );

        console.log(
            '🎉 Limpieza de comandos completada.'
        );

        process.exit(0);

    } catch (error) {
        console.error(
            '❌ Error al actualizar los comandos de Discord:',
            error
        );

        process.exit(1);
    }
})();
