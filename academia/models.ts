// academia/models.ts
import { Collection } from 'mongodb';
import { getEventsCollection } from '../Index';

export async function getUserProgressCollection(): Promise<Collection> {
    // Reutilizamos la conexión activa de MongoDB del bot principal
    const eventsCollection = await getEventsCollection();
    return eventsCollection.db.collection('user_progress');
}
