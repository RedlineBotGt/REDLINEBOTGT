
import { MongoClient, Collection } from "mongodb";

const CHANNEL_ID = "1563193909381693580";
const DATABASE_NAME = "redline_bot";
const COLLECTION_NAME = "event_jobs";

export const ROLE_TITULAR = "1561843376842608750";
export const ROLE_RESERVA = "1561843486129528913";

let mongoClient: MongoClient | null = null;
let eventsCollection: Collection | null = null;

async function getEventsCollection(): Promise<Collection> {
  if (eventsCollection) {
    return eventsCollection;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Falta la variable MONGODB_URI en WEBLINEGT."
    );
  }

  mongoClient = new MongoClient(uri);

  await mongoClient.connect();

  eventsCollection = mongoClient
    .db(DATABASE_NAME)
    .collection(COLLECTION_NAME);

  console.log(
    "WEBLINEGT conectado a la colección de eventos."
  );

  return eventsCollection;
}

export async function getCurrentEvent() {
  const collection = await getEventsCollection();

  const event = await collection.findOne(
    {
      channelId: CHANNEL_ID,
      status: "sent"
    },
    {
      sort: {
        scheduledAt: 1
      }
    }
  );

  if (!event) {
    return null;
  }

  const rsvps = event.rsvps || {};

  const scheduledDate = event.scheduledAt
    ? new Date(event.scheduledAt)
    : null;

  return {
    id: event._id.toString(),

    guildId: event.guildId
      ? String(event.guildId)
      : "",

    title: event.title || "Evento REDLINE GT",

    description: event.description || "",

    scheduledAt:
      scheduledDate && !Number.isNaN(scheduledDate.getTime())
        ? scheduledDate.toISOString()
        : null,

    publishAt: event.publishAt
      ? new Date(event.publishAt).toISOString()
      : null,

    channelId: event.channelId,

    channelName: event.channelName || "",

    image: event.image || event.imageUrl || "",

    status: event.status,

    reminderSent: Boolean(event.reminderSent),

    rsvps: {
      yes: Array.isArray(rsvps.yes) ? rsvps.yes : [],
      reserve: Array.isArray(rsvps.reserve) ? rsvps.reserve : [],
      maybe: Array.isArray(rsvps.maybe) ? rsvps.maybe : [],
      no: Array.isArray(rsvps.no) ? rsvps.no : []
    },

    limits: {
      titular: 15
    }
  };
}
