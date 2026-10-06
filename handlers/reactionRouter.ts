import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { handleReactionAdd as handleRrAdd, handleReactionRemove as handleRrRemove } from './reactionRoles';
import { handleEncuestaReactionAdd } from './encuestaSystem';
import { handleEventReactionAdd, handleEventReactionRemove } from './eventSystem'; // 👈 1. Importamos el sistema de eventos

// Enrutador global para cuando se añade una reacción
export async function handleReactionAddRouter(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
        if (user.bot) return;

        // 1. Intentar procesar Reaction Roles (siempre con protección por si cambia el export)
        try {
            if (typeof handleRrAdd === 'function') {
                await handleRrAdd(reaction as any, user as any);
            }
        } catch (rrError) {
            console.error('⚠️ Error menor en reactionRoles add:', rrError);
        }

        // 2. Procesar votos de las Encuestas
        try {
            await handleEncuestaReactionAdd(reaction, user);
        } catch (encuestaError) {
            console.error('❌ Error en encuesta reaction add:', encuestaError);
        }

        // 3. Procesar respuestas a Eventos (✅, ❓, ❌) 👈 ¡Añadido aquí!
        try {
            await handleEventReactionAdd(reaction, user);
        } catch (eventError) {
            console.error('❌ Error en event reaction add:', eventError);
        }

    } catch (error) {
        console.error('❌ Error crítico en el router de reacciones (Add):', error);
    }
}

// Enrutador global para cuando se retira una reacción
export async function handleReactionRemoveRouter(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
        if (user.bot) return;

        // 1. Procesar retirada en Reaction Roles
        try {
            if (typeof handleRrRemove === 'function') {
                await handleRrRemove(reaction as any, user as any);
            }
        } catch (rrError) {
            console.error('⚠️ Error menor en reactionRoles remove:', rrError);
        }

        // 2. Procesar retirada de reacciones en Eventos 👈 ¡Añadido aquí!
        try {
            await handleEventReactionRemove(reaction, user);
        } catch (eventError) {
            console.error('❌ Error en event reaction remove:', eventError);
        }

    } catch (error) {
        console.error('❌ Error crítico en el router de reacciones (Remove):', error);
    }
}
