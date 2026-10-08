import { Interaction } from 'discord.js';
import { handleReporteInteractions } from './reporte/interactionreporte';
import { handleDefensaInteractions } from './defensa/interactiondefensa';
import { handleVeredictoInteractions } from './veredicto/interactionveredicto';
import { handleScheduledInteractions } from './scheduled/interactionscheduled';

/**
 * Enrutador principal del Panel de Administración (DashAdmin).
 * Se encarga de filtrar las interacciones del panel (botones, menús, modales)
 * y delegarlas al submódulo correspondiente (reportes, defensas, avisos, etc.).
 */
export async function handleDashAdminInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Delegar interacciones al submódulo de Reportes
        const handledReporte = await handleReporteInteractions(interaction);
        if (handledReporte) return true;

        // 2. Delegar interacciones al submódulo de Defensas
        const handledDefensa = await handleDefensaInteractions(interaction);
        if (handledDefensa) return true;

        // 3. Delegar interacciones al submódulo de Veredictos
        const handledVeredicto = await handleVeredictoInteractions(interaction);
        if (handledVeredicto) return true;

        // 4. Delegar interacciones al submódulo de Mensajes Programados
        const handledScheduled = await handleScheduledInteractions(interaction);
        if (handledScheduled) return true;

        // 5. Aquí iremos añadiendo los delegados de los demás botones del dash conforme los crees:
        // const handledWelcome = await handleWelcomeInteractions(interaction);
        // if (handledWelcome) return true;

        return false; // La interacción no pertenece a ningún submódulo administrado por el dash
    } catch (error) {
        console.error('❌ Error en el enrutador general de DashAdmin:', error);
        return false;
    }
}
