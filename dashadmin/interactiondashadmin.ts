import { Interaction } from 'discord.js';
import { handleReporteInteractions } from './reporte/interactionreporte';
import { handleDefensaInteractions } from './defensa/interactiondefensa';
import { handleVeredictoInteractions } from './veredicto/interactionveredicto';
import { handleScheduledInteractions } from './scheduled/interactionscheduled';
import { handleFormInteractions } from './forms/interactionform'; 
import { handleReactionRoleInteractions } from './reactionrol/interactionreactionrole';
import { handleSorteoInteractions } from './sorteo/interactionsorteo';
import { handleBotonesInteractions } from './botones/interactionbotones';
import { handleAvisosInteractions } from './avisos/interactionavisos';
import { handleWelcomeInteractions } from './welcome/interactionwelcome';
import { handleEventInteractions } from './eventos/interactioneventos';
import { handleEncuestaInteractions } from './encuestas/interactionencuesta';
import { handleMsnInteractions } from './msn/msnmanager';
import { handleDraftInteractions } from './draft/draftinteractions'; // ➔ Submódulo de Draft
import { handleClubInteractions } from './club/clubactions'; // 👈 1. Importación de GT Club

/**
 * Enrutador principal del Panel de Administración (DashAdmin).
 * Se encarga de filtrar las interacciones del panel (botones, menús, modales)
 * y delegarlas al submódulo correspondiente del sistema nuevo.
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

        // 5. Delegar interacciones al submódulo de Formularios
        const handledForm = await handleFormInteractions(interaction);
        if (handledForm) return true;

        // 6. Delegar interacciones al submódulo de Reaction Roles
        const handledReactionRole = await handleReactionRoleInteractions(interaction);
        if (handledReactionRole) return true;

        // 7. Delegar interacciones al submódulo de Sorteos
        const handledSorteo = await handleSorteoInteractions(interaction);
        if (handledSorteo) return true;

        // 8. Delegar interacciones al submódulo de Botones Personalizados y Tickets
        const handledBotones = await handleBotonesInteractions(interaction);
        if (handledBotones) return true;

        // 9. Delegar interacciones al submódulo de Avisos y Logs
        const handledAvisos = await handleAvisosInteractions(interaction);
        if (handledAvisos) return true;

        // 10. Delegar interacciones al submódulo de Bienvenidas y Despedidas
        const handled
