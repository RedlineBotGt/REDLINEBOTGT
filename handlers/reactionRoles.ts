import { Client, MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);

let reactionCollection: any = null;

async function getReactionCollection() {
    if (!reactionCollection) {
        await clientMongo.connect();
        reactionCollection = clientMongo.db('redline_bot').collection('reaction_roles');
        console.log('🎭 [MongoDB] Conectado a la colección de roles por reacción.');
    }
    return reactionCollection;
}

// 1. SENCRO Y CACHÉ: Se ejecuta al encender el bot para que reviva tras los deploys
export async function initReactionRoles(client: Client) {
    try {
        const col = await getReactionCollection();
        const configs = await col.find({}).toArray();

        if (configs.length === 0) {
            console.log('🎭 [ReactionRoles] No hay roles por reacción configurados todavía.');
            return;
        }

        for (const conf of configs) {
            try {
                const guild = await client.guilds.fetch(conf.guildId).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(conf.channelId).catch(() => null);
                if (!channel || !channel.isTextBased()) continue;

                // Forzamos el fetch del mensaje para que Discord lo guarde en memoria y detecte eventos
                await channel.messages.fetch(conf.messageId);
            } catch (err) {
                console.error(`❌ [ReactionRoles] Error al hacer fetch del mensaje ID ${conf.messageId}:`, err);
            }
        }

        console.log(`🎭 [ReactionRoles] Sincronizados ${configs.length} mensajes de roles por reacción con éxito.`);
    } catch (error) {
        console.error('❌ [ReactionRoles] Error al inicializar el sistema:', error);
    }
}

// 2. EVENTO: Añadir rol al poner la reacción
export async function handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    const col = await getReactionCollection();
    const emojiIdentifier = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    // Si el emoji es personalizado usa el ID, si es nativo usa el unicode/nombre

    const config = await col.findOne({
        messageId: reaction.message.id,
        $or: [
            { emoji: reaction.emoji.name },
            { emoji: reaction.emoji.id },
            { emoji: emojiIdentifier }
        ]
    });

    if (!config) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    try {
        const member = await guild.members.fetch(user.id);
        if (!member.roles.cache.has(config.roleId)) {
            await member.roles.add(config.roleId);
            console.log(`✅ [ReactionRoles] Rol ${config.roleId} asignado a ${member.user.tag}`);
        }
    } catch (error) {
        console.error('❌ [ReactionRoles] Error al asignar el rol:', error);
    }
}

// 3. EVENTO: Quitar rol al retirar la reacción
export async function handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    const col = await getReactionCollection();
    const emojiIdentifier = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

    const config = await col.findOne({
        messageId: reaction.message.id,
        $or: [
            { emoji: reaction.emoji.name },
            { emoji: reaction.emoji.id },
            { emoji: emojiIdentifier }
        ]
    });

    if (!config) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    try {
        const member = await guild.members.fetch(user.id);
        if (member.roles.cache.has(config.roleId)) {
            await member.roles.remove(config.roleId);
            console.log(`❌ [ReactionRoles] Rol ${config.roleId} retirado a ${member.user.tag}`);
        }
    } catch (error) {
        console.error('❌ [ReactionRoles] Error al retirar el rol:', error);
    }
}
