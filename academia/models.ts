
// academia/models.ts

import { Collection } from 'mongodb';
import { getEventsCollection } from '../Index';

/**
 * Devuelve la colección de progreso de Academia Campos.
 *
 * Reutiliza la conexión MongoDB del bot principal.
 * Los datos de Academia se guardan independientemente
 * de los eventos y campeonatos de REDLINE BOT GT.
 */
export async function getUserProgressCollection(): Promise<Collection> {
    const eventsCollection = await getEventsCollection();

    return eventsCollection.db.collection('user_progress');
}
