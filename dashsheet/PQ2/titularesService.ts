import { Guild } from 'discord.js';
import { readSheetData } from '../sheetsService'; // Ajusta la ruta relativa según tu estructura

export async function procesarAsignacionTitulares(guild: Guild): Promise<{ success: number; errors: number; notFound: number }> {
    // Leemos el rango K2:K16 de la pestaña PQ2
    const rows = await readSheetData('PQ2!K2:K16');
    
    let success = 0;
    let errors = 0;
    let notFound = 0;

    // Buscar el rol 'Titular' en el servidor
    const rolTitular = guild.roles.cache.find(r => r.name.toLowerCase() === 'titular');
    if (!rolTitular) {
        throw new Error('No se encontró el rol "Titular" en el servidor.');
    }

    if (!rows || rows.length === 0) {
        return { success, errors, notFound };
    }

    for (const row of rows) {
        const cellValue = row[0] || ''; // Columna K
        
        // Extraer el ID de usuario si viene en formato <@123456789> o como ID numérico puro
        const match = cellValue.match(/<@!?(\d+)>/) || cellValue.match(/^(\d+)$/);
        if (!match) continue;

        const userId = match[1];

        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                if (!member.roles.cache.has(rolTitular.id)) {
                    await member.roles.add(rolTitular);
                }
                success++;
            } else {
                notFound++;
            }
        } catch (err) {
            errors++;
            console.error(`Error asignando rol al usuario ${userId}:`, err);
        }
    }

    return { success, errors, notFound };
}
