import { Interaction } from 'discord.js';
import { handleReporteInteractions } from './reporte/interactionreporte';

/**
 * Enrutador principal del Panel de Administración (DashAdmin).
 * Se encarga de filtrar las interacciones del panel (botones, menús, modales)
 * y delegarlas al submódulo correspondiente (reportes, defensas, avisos, etc.).
 */
export async function handleDashAdminInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // 1. Delegar interacciones al submódulo de Reportes
        // (El enrutador local de reportes gestionará botones, menús de canales/roles y modales)
        const handledReporte = await handleReporteInteractions(interaction);
        if (handledReporte) return true;

        // 2. Aquí iremos añadiendo los delegados de los demás botones del dash conforme los crees:
        // const handledDefensa = await handleDefensaInteractions(interaction);
        // if (handledDefensa) return true;

        // const handledWelcome = await handleWelcomeInteractions(interaction);
        // if (handledWelcome) return true;

        return false; // La interacción no pertenece a ningún submódulo administrado por el dash
    } catch (error) {
        console.error('❌ Error en el enrutador general de DashAdmin:', error);
        return false;
    }
}
