import { Interaction } from 'discord.js';
import { handleMsnModalSubmit } from './msnmodal';

/**
 * Enrutador de interacciones específico para el módulo de mensajes (msn).
 * Se encarga de evaluar si la interacción entrante pertenece a este módulo
 * (como el modal de envío de mensajes) y derivarla a su lógica correspondiente.
 */
export async function handleMensajeInteractions(interaction: Interaction): Promise<boolean> {
    try {
        // Manejo de envíos de modales del módulo msn
        if (interaction.isModalSubmit()) {
            const handled = await handleMsnModalSubmit(interaction);
            if (handled) return true;
        }

        // Si en el futuro añades botones, menús desplegables (select menus) 
        // u otros componentes para este módulo, los gestionaremos aquí.

        return false; // La interacción no pertenece a este módulo
    } catch (error) {
        console.error('❌ Error en el enrutador de interacciones de mensaje:', error);
        return false;
    }
}
