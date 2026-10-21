import { Guild } from 'discord.js';
import { getSheetData } from '../sheetsService';

export async function procesarAsignacionTitulares(guild: Guild): Promise<{ success: number; errors: number; notFound: number }> {
    const rows = await getSheetData('PQ2!K2:K16');
    
    let success = 0;
    let errors = 0;
    let notFound = 0;

    const rolTitular = guild.roles.cache.find(r => r.name.toLowerCase().trim() === 'titular');
    if (!rolTitular) {
        throw new Error('No se encontró el rol "Titular" en el servidor.');
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
                if (!member.roles.cache.has(rolTitular.id)) {
                    await member.roles.add(rolTitular);
                }
                success++;
            } else {
                notFound++;
            }
        } catch (err) {
            errors++;
            console.error(`Error asignando rol Titular al usuario ${userId}:`, err);
        }
    }

    return { success, errors, notFound };
}
