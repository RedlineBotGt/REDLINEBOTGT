import { Guild } from 'discord.js';
import { readSheetData } from '../sheetsService';

export async function procesarAsignacionReservas(guild: Guild): Promise<{ success: number; errors: number; notFound: number }> {
    const rows = await readSheetData('PQ2!K22:K37');
    
    let success = 0;
    let errors = 0;
    let notFound = 0;

    const rolReserva = guild.roles.cache.find(r => r.name.toLowerCase().trim() === 'reserva');
    if (!rolReserva) {
        throw new Error('No se encontró el rol "Reserva" en el servidor.');
    }

    if (!rows || rows.length === 0) {
        return { success, errors, notFound };
    }

    for (const row of rows) {
        const cellValue = row[0] || '';
        
        const match = cellValue.match(/<@!?(\d+)>/) || cellValue.match(/^(\d+)$/);
        if (!match) continue;

        const userId = match[1];

        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                if (!member.roles.cache.has(rolReserva.id)) {
                    await member.roles.add(rolReserva);
                }
                success++;
            } else {
                notFound++;
            }
        } catch (err) {
            errors++;
            console.error(`Error asignando rol Reserva al usuario ${userId}:`, err);
        }
    }

    return { success, errors, notFound };
}
