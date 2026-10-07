import { 
    ChatInputCommandInteraction, 
    MessageFlags, 
    Client 
} from 'discord.js';
import { MongoClient as MongoDriver } from 'mongodb';
import * as dashCommand from '../commands/dash';
import * as dashstaffCommand from '../commands/dashstaff';
import * as eventHandler from './eventInteractions';
import * as formHandler from './formInteractions'; 
import * as messageHandler from './messageInteractions'; 
import * as encuestaHandler from './encuestaSystem'; 
import * as welcomeHandler from './welcomeInteraction'; 
import * as avisosHandler from './avisosSystem'; 
import * as ticketHandler from './ticketButtonHandler'; 
import * as sorteoHandler from './sorteoHandler'; // 👈 Módulo de Sorteos integrado

// Módulos de Comisarios con las mayúsculas/minúsculas exactas de tus archivos
import * as dashReporteHandler from './dashReporteHandler';
import * as dashDefensaHandler from './dashDefensaHandler';
import * as veredictoHandler from './dashVeredictoHandler';
import * as reportModal from './reportModal';
import * as defensaModal from './defensModal';       
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

        // 2. Delegar interacciones de eventos
        const handledByEvents = await eventHandler.handleEventInteraction(interaction);
        if (handledByEvents) return true;

        // 3. Delegar interacciones de formularios
        const handledByForms = await formHandler.handleFormInteraction(interaction);
        if (handledByForms) return true;

        // 4. Delegar interacciones de mensajes
        const handledByMessages = await messageHandler.handleMsnInteraction(interaction);
        if (handledByMessages) return true;

        // 5. Delegar interacciones de encuestas
        const handledByEncuesta = await encuestaHandler.handleEncuestaInteraction(interaction);
        if (handledByEncuesta) return true;

        // 6. Delegar interacciones de Bienvenidas y Despedidas
        const handledByWelcome = await welcomeHandler.handleWelcomeInteraction(interaction);
        if (handledByWelcome) return true;

        // 7. Delegar interacciones de Comisarios, Avisos, Tickets y Sorteos
        
        // --- BOTONES ---
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
            if (customId === 'dash_btn_avisos_config') {
                return await avisosHandler.handleDashAvisosButton(interaction);
            }
            if (customId === 'dash_btn_crear_boton') {
                return await ticketHandler.handleDashCrearBotonButton(interaction);
            }
            if (customId === 'close_ticket') {
                return await ticketHandler.handleCloseTicketButton(interaction);
            }
            if (customId.startsWith('open_ticket_')) {
                return await ticketHandler.handleTicketButtonClick(interaction);
            }
            if (customId === 'dash_btn_sorteo_create') {
                await sorteoHandler.handleDashSorteoButton(interaction); // 👈 Abre modal del sorteo
                return true;
            }
            if (customId.startsWith('sorteo_launch_')) {
                await sorteoHandler.handleSorteoLaunchButton(interaction); // 👈 Dispara el sorteo de 1 clic
                return true;
            }
        }

        // --- MENÚS DESPLEGABLES ---
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'dash_select_verd_channel') {
                return await veredictoHandler.handleDashVeredictoChannelSelect(interaction);
            }
            if (interaction.customId === 'avisos_select_channel') {
                return await avisosHandler.handleAvisosChannelSelect(interaction);
            }
            if (interaction.customId.startsWith('ticket_deploy_channel_')) {
                return await ticketHandler.handleTicketChannelSelect(interaction);
            }
            if (interaction.customId === 'sorteo_select_channel') {
                await sorteoHandler.handleSorteoChannelSelect(interaction); // 👈 Selecciona canal del sorteo
                return true;
            }
        }

        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'dash_select_verd_role') {
                return await veredictoHandler.handleDashVeredictoRoleSelect(interaction);
            }
            if (interaction.customId === 'sorteo_select_role') {
                await sorteoHandler.handleSorteoRoleSelect(interaction); // 👈 Selecciona rol del sorteo y publica
                return true;
            }
        }

        // --- MODALES ---
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
            if (customId === 'modal_crear_ticket_config') {
                return await ticketHandler.handleTicketModalSubmit(interaction);
            }
            if (customId === 'modal_sorteo_config') {
                await sorteoHandler.handleSorteoModalSubmit(interaction); // 👈 Recoge datos del modal del sorteo
                return true;
            }
        }

        // 8. Botones del Panel Admin y Staff (Resto de módulos restantes)
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // --- COMUNICACIONES Y MENSAJES PROGRAMADOS ---
            if (['dash_btn_scheduled_msg', 'dash_btn_crear_boton', 'rr_btn_create'].includes(customId)) {
                await interaction.reply({ content: '💬 Módulo de Comunicaciones enlazado correctamente.', ephemeral: true });
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
