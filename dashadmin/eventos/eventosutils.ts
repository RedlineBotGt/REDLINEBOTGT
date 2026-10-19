// --- PARSER DE FECHAS MADRID ---
export function parseMadridDateTime(dateStr: string, timeStr: string): Date | null {
    try {
        const [day, month, year] = dateStr.split('/').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        if (!day || !month || !year || isNaN(hour) || isNaN(minute)) return null;

        const tempUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
        const madridOffsetMinutes = getMadridOffsetMinutes(tempUtc);
        const finalTimestamp = tempUtc.getTime() - (madridOffsetMinutes * 60 * 1000);

        const targetDate = new Date(finalTimestamp);
        return isNaN(targetDate.getTime()) ? null : targetDate;
    } catch (error) {
        console.error('❌ Error al parsear fecha de Madrid:', error);
        return null;
    }
}

function getMadridOffsetMinutes(date: Date): number {
    const madridDateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);

    const [datePart, timePart] = madridDateStr.split(', ');
    const [m, d, y] = datePart.split('/').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    const asUTC = Date.UTC(y, m - 1, d, h, min, 0);
    const diffMs = asUTC - date.getTime();
    return Math.round(diffMs / (1000 * 60));
}
