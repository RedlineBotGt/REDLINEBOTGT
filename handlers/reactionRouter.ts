import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { handleReactionAdd as handleRrAdd, handleReactionRemove as handleRrRemove } from './reactionRoles';
import { handleEncuestaReactionAdd } from './encuestaSystem';

// Enrutador global para cuando se añade una reacción
export async function handleReactionAddRouter(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
        if (user.bot) return;

        // 1. Intentar procesar Reaction Roles antiguos (si aplica)
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

    } catch (error) {
        console.error('❌ Error crítico en el router de reacciones (Add):', error);
    }
}

// Enrutador global para cuando se retira una reacción
export async function handleReactionRemoveRouter(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
        if (user.bot) return;

        // 1. Procesar retirada en Reaction Roles antiguos
        try {
            if (typeof handleRrRemove === 'function') {
                await handleRrRemove(reaction as any, user as any);
            }
        } catch (rrError) {
            console.error('⚠️ Error menor en reactionRoles remove:', rrError);
        }

    } catch (error) {
        console.error('❌ Error crítico en el router de reacciones (Remove):', error);
    }
}
