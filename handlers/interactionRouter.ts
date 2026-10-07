import { 
    ChatInputCommandInteraction, 
    MessageFlags, 
    Client 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';
import * as dashCommand from '../commands/dash';
import * as dashstaffCommand from '../commands/dashstaff';
import * as eventHandler from './eventInteractions';
import * as formHandler from './formInteractions'; // 👈 Módulo de formularios integrado

// Configuración de MongoDB para los eventos
const uri = process.env.MONGODB_URI || "mongodb+srv://REDLINEBOTGT:347Hh9743%23@cluster0.xo8znuv.mongodb.net/?appName=Cluster0&tls=true";
const clientMongo = new MongoDriver(uri);
let eventsCollection: any = null;

export async function getEventsCollection() {
    if (!eventsCollection) {
        await clientMongo.connect();
        eventsCollection = clientMongo.db('redline_bot').collection('event_jobs');
        console.log('📅 [MongoDB] Conectado al sistema de eventos de simracing.');
    }
    return eventsCollection;
}

// 🛡️ ENRUTADOR CENTRAL
export async function handleInteraction(interaction: any): Promise<boolean> {
    try {
        // 1. Comandos de Barra Principales (/dash y /dashstaff)
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dash') {
                await dashCommand.execute(interaction);
                return true;
            }
            if (interaction.commandName === 'dashstaff') {
                await dashstaffCommand.execute(interaction);
                return true;
            }
            return false;
        }

        // 2. Delegar interacciones de eventos (Botones, Modales, Menús de Canales y Roles de eventos)
        const handledByEvents = await eventHandler.handleEventInteraction(interaction);
        if (handledByEvents) return true;

        // 3. Delegar interacciones de formularios (Botones, Selectores y Modales de formularios)
        const handledByForms = await formHandler.handleFormInteraction(interaction);
        if (handledByForms) return true;

        // 4. Botones del Panel Admin y Staff (Resto de módulos pendientes)
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // --- BIENVENIDAS ---
            if (customId === 'dash_btn_welcome_config') {
                await interaction.reply({ content: '👋 Módulo de Bienvenidas enlazado correctamente.', flags: [MessageFlags.Ephemeral] });
                return true;
            }

            // --- COMUNICACIONES, SORTEOS Y AUTOROL ---
            if (['dash_btn_sorteo_create', 'dash_btn_scheduled_msg', 'dash_btn_crear_boton', 'rr_btn_create', 'dash_btn_msn_mensaje'].includes(customId)) {
                await interaction.reply({ content: '💬 Módulo de Comunicaciones/Sorteos enlazado correctamente.', flags: [MessageFlags.Ephemeral] });
                return true;
            }

            // --- COMISARIOS Y VEREDICTOS ---
            if (['dash_btn_setup_reporte', 'dash_btn_setup_defensa', 'dash_btn_veredicto'].includes(customId)) {
                await interaction.reply({ content: '⚖️ Módulo de Comisarios enlazado correctamente.', flags: [MessageFlags.Ephemeral] });
                return true;
            }

            // --- ENCUESTAS ---
            if (customId === 'dash_btn_encuesta_create') {
                await interaction.reply({ content: '📊 Módulo de Encuestas enlazado correctamente.', flags: [MessageFlags.Ephemeral] });
                return true;
            }

            // --- AVISOS ---
            if (customId === 'dash_btn_avisos_config') {
                await interaction.reply({ content: '📋 Módulo de Avisos enlazado correctamente.', flags: [MessageFlags.Ephemeral] });
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de interacciones:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocurrió un error al procesar esta acción.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        }
        return false;
    }
}
