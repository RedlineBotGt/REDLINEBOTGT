import { Interaction } from 'discord.js';
import * as dash from '../commands/dash';
import * as dashstaff from '../commands/dashstaff'; // ⚡ Panel operativo de staff
import * as reporte from '../commands/reporte';
import * as setupdefensa from '../commands/setupdefensa';
import * as veredicto from '../commands/veredicto';
import * as msn from '../commands/msn';
import * as forms from '../commands/forms';
import * as ColocarForm from '../commands/ColocarForm';
import * as borrar from '../commands/borrar'; 
import * as dashsheets from '../commands/dashSheets'; 

import { handleReportButton, handleReportModalSubmit } from './reportModal';
import { handleDefensaButton, handleDefensaModalSubmit } from './defensModal';
import { handleVeredictoModalSubmit } from './veredictoModal';
import { handleMsnModalSubmit } from './msnModal';

// 👋 Sistema de Bienvenidas y Despedidas
import { 
    handleDashWelcomeButton, 
    handleWelcomeMenuButton, 
    handleWelcomeChannelSelect, 
    handleWelcomeModalSubmit, 
    handleGoodbyeChannelSelect, 
    handleGoodbyeModalSubmit 
} from './welcomeSystem';

// 📋 Sistema de Avisos (Entradas, Salidas y Roles)
import { 
    handleDashAvisosButton, 
    handleAvisosChannelSelect 
} from './avisosSystem';

// 📅 Sistema de Eventos de Simracing
import {
    handleDashEventButton,
    handleEventChannelSelect,
    handleEventRoleSelect,
    handleEventModalSubmit,
    handleEventRsvpButton,
    handleEventRepeatYesButton,
    handleEventRepeatNoButton,
    handleEventRepeatModalSubmit
} from './eventSystem';

// 🎁 Sistema de Sorteos
import { 
    handleDashSorteoButton, 
    handleSorteoModalSubmit, 
    handleSorteoChannelSelect, 
    handleSorteoRoleSelect, 
    handleSorteoLaunchButton 
} from './sorteoHandler';

// Manejadores de formularios y Dash
import { handleFormCreateModal } from './formCreateModal';
import { 
    handleDashColocarButton, 
    handleDashColocarFormSelect, 
    handleDashColocarChannelSelect 
} from './formDeployHandler';
import { handleFormButtonClick } from './formButtonHandler';
import { handleFormSubmitModal } from './formSubmitHandler';
import { 
    handleDashDeleteButton, 
    handleDashDeleteFormSelect, 
    handleDashDeleteConfirmButton 
} from './dashDeleteHandler'; 
import { handleDashMsnChannelSelect, handleDashMsnButton } from './dashMsnHandler';     
import { handleDashEditButton, handleDashEditFormSelect, handleModalEditFormSubmit } from './dashEditHandler';           
import { 
    handleDashVeredictoButton, 
    handleDashVeredictoChannelSelect, 
    handleDashVeredictoRoleSelect 
} from './dashVeredictoHandler'; 
import { handleDashReporteButton } from './dashReporteHandler';
import { handleDashDefensaButton, handleDashDefensaChannelSelect } from './dashDefensaHandler'; 
import { 
    handleDashCreateFormButton, 
    handleDashCreateFormChannelSelect, 
    handleDashFormTituloModal,
    handleDashOpenPreguntasButton 
} from './dashCreateFormHandler'; 

// 🎟️ Sistema de tickets
import { 
    handleDashCrearBotonButton, 
    handleTicketModalSubmit, 
    handleTicketChannelSelect, 
    handleTicketButtonClick, 
    handleCloseTicketButton, 
    activeTicketButtons 
} from './ticketButtonHandler';

// 📅 NUEVO SISTEMA: Mensajes Programados con Plantillas y BD
import { 
    handleDashScheduledButton,
    handleSchedNewButton,
    handleSchedExistingButton,
    handleSchedExistingSelect,
    handleSchedActionButtons,
    handleSchedModalSubmit,
    handleSchedChannelSelect,
    handleSchedRoleSelection,
    handleSchedDatetimeSubmit,
    handleSchedRepeatYes,
    handleSchedFinalizeNo,
    handleSchedRepeatModalSubmit
} from './scheduledMessage';

// 🎭 Roles por Reacción
import { 
    handleDashRrButton,
    handleRrContentSubmit,
    handleRrChannelSelect,
    handleRrRoleSelect,
    handleRrExistingSelect,
    handleRrDeleteConfig,
    handleRrStartCreate
} from './reactionRoles';

// 📊 Panel de Google Sheets
import { 
    handleDashSheetsButton, 
    handleSheetsChannelSelect, 
    handleSheetsRoleSelect 
} from './dashSheetsHandler';

export async function handleInteraction(interaction: Interaction) {
    try {
        // 1. Manejo de Comandos de Barra (Slash Commands)
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dash') {
                await dash.execute(interaction);
            } else if (interaction.commandName === 'dashstaff') {
                await dashstaff.execute(interaction); 
            } else if (interaction.commandName === 'setup-reporte') {
                await reporte.execute(interaction);
            } else if (interaction.commandName === 'setupdefensa') {
                await setupdefensa.execute(interaction);
            } else if (interaction.commandName === 'veredicto') {
                await veredicto.execute(interaction);
            } else if (interaction.commandName === 'msn') {
                await msn.execute(interaction);
            } else if (interaction.commandName === 'forms') {
                await forms.execute(interaction);
            } else if (interaction.commandName === 'colocarform') {
                await ColocarForm.execute(interaction);
            } else if (interaction.commandName === 'borrar') {
                await borrar.execute(interaction);
            } else if (interaction.commandName === 'dashsheets') {
                await dashsheets.execute(interaction); 
            }
            return;
        }

        // 2. Manejo de Menús Desplegables de Texto (String Select Menus)
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'dash_select_colocar_form') {
                await handleDashColocarFormSelect(interaction);
            } else if (interaction.customId === 'dash_select_eliminar_form') {
                await handleDashDeleteFormSelect(interaction);
            } else if (interaction.customId === 'dash_select_editar_form') {
                await handleDashEditFormSelect(interaction);
            } else if (interaction.customId === 'rr_select_existing_message') {
                await handleRrExistingSelect(interaction); 
            } else if (interaction.customId === 'sched_select_existing') {
                await handleSchedExistingSelect(interaction); // 📅 Selección de plantilla programada existente
            }
            return;
        }

        // 2.1. Manejo de Menús Desplegables de Canales (Channel Select Menus)
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'sheets_select_channel') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate().catch(() => {});
                }
                await handleSheetsChannelSelect(interaction); 
            } else if (interaction.customId === 'avisos_select_channel') {
                await handleAvisosChannelSelect(interaction); 
            } else if (interaction.customId === 'event_select_channel') {
                await handleEventChannelSelect(interaction); 
            } else if (interaction.customId === 'dash_select_msn_channel') {
                await handleDashMsnChannelSelect(interaction);
            } else if (interaction.customId === 'dash_select_verd_channel') {
                await handleDashVeredictoChannelSelect(interaction);
            } else if (interaction.customId === 'dash_select_defensa_channel') {
                await handleDashDefensaChannelSelect(interaction);
            } else if (interaction.customId === 'dash_select_form_create_channel') {
                await handleDashCreateFormChannelSelect(interaction);
            } else if (interaction.customId.startsWith('dash_channel_colocar_')) {
                await handleDashColocarChannelSelect(interaction);
            } else if (interaction.customId.startsWith('ticket_deploy_channel_')) {
                await handleTicketChannelSelect(interaction);
            } else if (interaction.customId === 'sched_select_channel') {
                await handleSchedChannelSelect(interaction); // 📅 Canal seleccionado para programar
            } else if (interaction.customId === 'rr_select_channel') {
                await handleRrChannelSelect(interaction);
            } else if (interaction.customId === 'welcome_select_welcome_channel') {
                await handleWelcomeChannelSelect(interaction);
            } else if (interaction.customId === 'welcome_select_goodbye_channel') {
                await handleWelcomeChannelSelect(interaction); 
            } else if (interaction.customId === 'sorteo_select_channel') {
                await handleSorteoChannelSelect(interaction); 
            }
            return;
        }

        // 2.2. Manejo de Menús Desplegables de Roles (Role Select Menus)
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'sheets_select_role') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate().catch(() => {});
                }
                await handleSheetsRoleSelect(interaction); 
            } else if (interaction.customId === 'event_select_role') {
                await handleEventRoleSelect(interaction); 
            } else if (interaction.customId === 'dash_select_verd_role') {
                await handleDashVeredictoRoleSelect(interaction);
            } else if (interaction.customId === 'sched_select_role') {
                await handleSchedRoleSelection(interaction); // 📅 Rol seleccionado para mención programada
            } else if (interaction.customId === 'rr_select_role') {
                await handleRrRoleSelect(interaction);
            } else if (interaction.customId === 'sorteo_select_role') {
                await handleSorteoRoleSelect(interaction); 
            }
            return;
        }

        // 3. Manejo de Botones interactivos
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('sheets_') || interaction.customId.startsWith('pub_')) {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate().catch(() => {});
                }
                await handleDashSheetsButton(interaction); 
            } else if (interaction.customId === 'dash_btn_avisos_config') {
                await handleDashAvisosButton(interaction); 
            } else if (interaction.customId === 'dash_btn_event_create') {
                await handleDashEventButton(interaction); 
            } else if (['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(interaction.customId)) {
                await handleEventRsvpButton(interaction); 
            } else if (interaction.customId === 'event_repeat_yes') {
                await handleEventRepeatYesButton(interaction); 
            } else if (interaction.customId === 'event_repeat_no') {
                await handleEventRepeatNoButton(interaction); 
            } else if (interaction.customId === 'dash_btn_crear_form') {
                await handleDashCreateFormButton(interaction); 
            } else if (interaction.customId === 'dash_btn_abrir_preguntas') {
                await handleDashOpenPreguntasButton(interaction); 
            } else if (interaction.customId === 'dash_btn_editar_form') {
                await handleDashEditButton(interaction); 
            } else if (interaction.customId === 'dash_btn_borrar_form') {
                await handleDashDeleteButton(interaction); 
            } else if (interaction.customId === 'dash_btn_colocar_form') {
                await handleDashColocarButton(interaction); 
            } else if (interaction.customId === 'dash_btn_crear_boton') {
                await handleDashCrearBotonButton(interaction);
            } else if (interaction.customId === 'dash_btn_scheduled_msg') {
                await handleDashScheduledButton(interaction); // 📅 Abre menú Crear Nuevo / Existente
            } else if (interaction.customId === 'sched_btn_new') {
                await handleSchedNewButton(interaction); // 📅 Abre modal para crear plantilla nueva
            } else if (interaction.customId === 'sched_btn_existing') {
                await handleSchedExistingButton(interaction); // 📅 Abre selector de plantillas existentes
            } else if (interaction.customId.startsWith('sched_action_')) {
                await handleSchedActionButtons(interaction); // 📅 Acciones sobre plantilla (programar, editar, borrar)
            } else if (interaction.customId === 'sched_skip_role') {
                await handleSchedRoleSelection(interaction); // 📅 Saltar mención de rol
            } else if (interaction.customId === 'sched_repeat_yes') {
                await handleSchedRepeatYes(interaction); // 📅 Configurar repetición
            } else if (interaction.customId === 'sched_repeat_no') {
                await handleSchedFinalizeNo(interaction); // 📅 Finalizar sin repetición
            } else if (interaction.customId === 'rr_btn_create') {
                await handleDashRrButton(interaction); 
            } else if (interaction.customId === 'rr_btn_start_create') {
                await handleRrStartCreate(interaction); 
            } else if (interaction.customId.startsWith('rr_btn_delete_config_')) {
                await handleRrDeleteConfig(interaction); 
            } else if (interaction.customId === 'dash_btn_welcome_config') {
                await handleDashWelcomeButton(interaction);
            } else if (interaction.customId === 'welcome_menu_bienvenida' || interaction.customId === 'welcome_menu_despedida') {
                await handleWelcomeMenuButton(interaction);
            } else if (interaction.customId === 'dash_btn_sorteo_create') {
                await handleDashSorteoButton(interaction); 
            } else if (interaction.customId.startsWith('sorteo_launch_')) {
                await handleSorteoLaunchButton(interaction); 
            } else if (interaction.customId.startsWith('dash_confirm_borrar_')) {
                await handleDashDeleteConfirmButton(interaction); 
            } else if (interaction.customId === 'dash_btn_msn_mensaje') {
                await handleDashMsnButton(interaction); 
            } else if (interaction.customId === 'dash_btn_veredicto') {
                await handleDashVeredictoButton(interaction); 
            } else if (interaction.customId === 'dash_btn_setup_reporte') {
                await handleDashReporteButton(interaction);
            } else if (interaction.customId === 'dash_btn_setup_defensa') {
                await handleDashDefensaButton(interaction);
            } else if (interaction.customId === 'close_ticket') {
                await handleCloseTicketButton(interaction);
            } else if (interaction.customId === 'btn_abrir_reporte') {
                const handled = await handleReportButton(interaction);
                if (handled) return;
            } else if (interaction.customId === 'btn_abrir_defensa') {
                const handledDef = await handleDefensaButton(interaction);
                if (handledDef) return;
            } else if (interaction.customId.startsWith('open_form_')) {
                await handleFormButtonClick(interaction);
            } else if (activeTicketButtons.has(interaction.customId)) {
                await handleTicketButtonClick(interaction);
            }
            return;
        }

        // 4. Manejo de Envíos de Formularios (Modals)
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_event_create') {
                await handleEventModalSubmit(interaction); 
            } else if (interaction.customId === 'modal_event_repeat') {
                await handleEventRepeatModalSubmit(interaction); 
            } else if (interaction.customId === 'modal_envio_reporte') {
                await handleReportModalSubmit(interaction);
            } else if (interaction.customId === 'modal_envio_defensa') {
                await handleDefensaModalSubmit(interaction);
            } else if (interaction.customId.startsWith('modal_veredicto_')) {
                await handleVeredictoModalSubmit(interaction);
            } else if (interaction.customId.startsWith('modal_msn_')) {
                await handleMsnModalSubmit(interaction);
            } else if (interaction.customId === 'modal_sched_new' || interaction.customId === 'modal_sched_edit') {
                await handleSchedModalSubmit(interaction); // 📅 Guardar o editar plantilla en BD
            } else if (interaction.customId === 'modal_sched_datetime') {
                await handleSchedDatetimeSubmit(interaction); // 📅 Guardar fecha/hora programada
            } else if (interaction.customId === 'modal_sched_repeat') {
                await handleSchedRepeatModalSubmit(interaction); // 📅 Guardar frecuencia de repetición
            } else if (interaction.customId === 'modal_rr_content') { 
                await handleRrContentSubmit(interaction);
            } else if (interaction.customId === 'modal_welcome_text') {
                await handleWelcomeModalSubmit(interaction);
            } else if (interaction.customId === 'modal_goodbye_text') {
                await handleGoodbyeModalSubmit(interaction);
            } else if (interaction.customId === 'modal_crear_ticket_config') {
                await handleTicketModalSubmit(interaction);
            } else if (interaction.customId === 'modal_sorteo_config') {
                await handleSorteoModalSubmit(interaction); 
            } else if (interaction.customId === 'modal_dash_form_titulo') {
                await handleDashFormTituloModal(interaction); 
            } else if (interaction.customId === 'modal_crear_formulario_preguntas') {
                await handleFormCreateModal(interaction);
            } else if (interaction.customId.startsWith('submit_form_')) {
                await handleFormSubmitModal(interaction);
            } else if (interaction.customId.startsWith('modal_editar_form_')) {
                await handleModalEditFormSubmit(interaction); 
            }
            return;
        }

    } catch (error) {
        console.error('❌ Error al procesar la interacción:', error);
        if (interaction.isRepliable()) {
            const errorMessage = {
                content: 'Hubo un error al procesar esta acción.',
                ephemeral: true
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
}
