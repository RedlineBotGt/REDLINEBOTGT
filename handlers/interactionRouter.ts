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
import * as messageHandler from './messageInteractions'; // 👈 Módulo de mensajes (/msn y dash) integrado
import * as encuestaHandler from './encuestaSystem'; // 👈 Módulo de encuestas integrado corregido

// Módulos de Comisarios (Reportes, Defensas y Veredictos)
import * as dashReporteHandler from './dashReporteHandler';
import * as dashDefensaHandler from './dashDefensaHandler';
import * as veredictoHandler from './dashVeredictoHandler'; // 👈 Nombre de archivo corregido
import * as reportModal from './reportModal';
import * as defensaModal from './defensaModal';
import * as veredictoModal from './veredictoModal';

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

        // 4. Delegar interacciones de mensajes (Botones, Selectores de canal y Modales de /msn y dash)
        const handledByMessages = await messageHandler.handleMsnInteraction(interaction);
        if (handledByMessages) return true;

        // 5. Delegar interacciones de encuestas (Botones, Menús desplegables y Modales del sistema de encuestas)
        const handledByEncuesta = await encuestaHandler.handleEncuestaInteraction(interaction);
        if (handledByEncuesta) return true;

        // 6. Delegar interacciones de Comisarios (Configuraciones de /dash, botones públicos y modales)
        
        // --- BOTONES (Configuraciones y Aperturas de Formularios) ---
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId === 'dash_btn_setup_reporte') {
                return await dashReporteHandler.handleDashReporteButton(interaction);
            }
            if (customId === 'dash_btn_setup_defensa') {
                return await dashDefensaHandler.handleDashDefensaButton(interaction);
            }
            if (customId === 'dash_btn_veredicto') {
                return await veredictoHandler.handleDashVeredictoButton(interaction);
            }
            if (customId === 'btn_abrir_reporte') {
                return await reportModal.handleReportButton(interaction);
            }
            if (customId === 'btn_abrir_defensa') {
                return await defensaModal.handleDefensaButton(interaction);
            }
        }

        // --- MENÚS DESPLEGABLES (Veredictos) ---
        if (interaction.isChannelSelectMenu() && interaction.customId === 'dash_select_verd_channel') {
            return await veredictoHandler.handleDashVeredictoChannelSelect(interaction);
        }
        if (interaction.isRoleSelectMenu() && interaction.customId === 'dash_select_verd_role') {
            return await veredictoHandler.handleDashVeredictoRoleSelect(interaction);
        }

        // --- MODALES (Envíos de Reportes, Defensas y Veredictos) ---
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            if (customId === 'modal_envio_reporte') {
                return await reportModal.handleReportModalSubmit(interaction);
            }
            if (customId === 'modal_envio_defensa') {
                return await defensaModal.handleDefensaModalSubmit(interaction);
            }
            if (customId.startsWith('modal_veredicto_')) {
                return await veredictoModal.handleVeredictoModalSubmit(interaction);
            }
        }

        // 7. Botones del Panel Admin y Staff (Resto de módulos)
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // --- BIENVENIDAS ---
            if (customId === 'dash_btn_welcome_config') {
                await interaction.reply({ content: '👋 Módulo de Bienvenidas enlazado correctamente.', ephemeral: true });
                return true;
            }

            // --- COMUNICACIONES, SORTEOS Y AUTOROL ---
            if (['dash_btn_sorteo_create', 'dash_btn_scheduled_msg', 'dash_btn_crear_boton', 'rr_btn_create'].includes(customId)) {
                await interaction.reply({ content: '💬 Módulo de Comunicaciones/Sorteos enlazado correctamente.', ephemeral: true });
                return true;
            }

            // --- AVISOS ---
            if (customId === 'dash_btn_avisos_config') {
                await interaction.reply({ content: '📋 Módulo de Avisos enlazado correctamente.', ephemeral: true });
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de interacciones:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocurrió un error al procesar esta acción.', ephemeral: true }).catch(() => {});
        }
        return false;
    }
}
