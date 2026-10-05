import { Interaction } from 'discord.js';
import * as dash from '../commands/dash';
import * as dashstaff from '../commands/dashstaff'; 
import * as reporte from '../commands/reporte';
import * as setupdefensa from '../commands/setupdefensa';
import * as veredicto from '../commands/veredicto';
import * as msn from '../commands/msn';
import * as forms from '../commands/forms';
import * as ColocarForm from '../commands/ColocarForm';
import * as borrar from '../commands/borrar'; 
import * as dashsheets from '../commands/dashSheets'; 
import * as dado from '../commands/dado'; // 🎲 

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
    handleEventRepeatModalSubmit,
    handleEventSingleDatetimeSubmit 
} from './eventSystem';

// 🎁 Sistema de Sorteos
import { 
    handleDashSorteoButton, 
    handleSorteoModalSubmit, 
    handleSorteoChannelSelect, 
    handleSorteoRoleSelect, 
    handleSorteoLaunchButton 
} from './sorteoHandler
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
                await handleDashScheduledButton(interaction); 
            } else if (interaction.customId === 'sched_btn_new') {
                await handleSchedNewButton(interaction); 
            } else if (interaction.customId === 'sched_btn_existing') {
                await handleSchedExistingButton(interaction); 
            } else if (interaction.customId.startsWith('sched_action_')) {
                await handleSchedActionButtons(interaction); 
            } else if (interaction.customId === 'sched_skip_role') {
                await handleSchedRoleSelection(interaction); 
            } else if (interaction.customId === 'sched_repeat_yes') {
                await handleSchedRepeatYes(interaction); 
            } else if (interaction.customId === 'sched_repeat_no') {
                await handleSchedFinalizeNo(interaction); 
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
            } else if (interaction.customId === 'modal_event_single_datetime') {
                await handleEventSingleDatetimeSubmit(interaction); 
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
                await handleSchedModalSubmit(interaction); 
            } else if (interaction.customId === 'modal_sched_datetime') {
                await handleSchedDatetimeSubmit(interaction); 
            } else if (interaction.customId === 'modal_sched_repeat') {
                await handleSchedRepeatModalSubmit(interaction); 
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
            } else if (interaction.customId === 'modal_dado_lanza') {
                await dado.handleDadoModalSubmit(interaction);
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
