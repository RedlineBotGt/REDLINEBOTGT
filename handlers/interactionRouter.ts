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
import * as dado from '../commands/dado';

import { handleReportButton, handleReportModalSubmit } from './reportModal';
import { handleDefensaButton, handleDefensaModalSubmit } from './defensModal';
import { handleVeredictoModalSubmit } from './veredictoModal';
import { handleMsnModalSubmit } from './msnModal';

import { 
    handleDashWelcomeButton, 
    handleWelcomeMenuButton, 
    handleWelcomeChannelSelect, 
    handleWelcomeModalSubmit, 
    handleGoodbyeChannelSelect, 
    handleGoodbyeModalSubmit 
} from './welcomeSystem';

import { 
    handleDashAvisosButton, 
    handleAvisosChannelSelect 
} from './avisosSystem';

import {
    handleDashEventButton,
    handleEventChannelSelect,
    handleEventRoleSelect,
    handleEventModalSubmit,
    handleEventRsvpButton,
    handleEventRepeatYesButton,
    handleEventPublishNowButton,
    handleEventRepeatModalSubmit
} from './eventSystem';

import { 
    handleDashSorteoButton, 
    handleSorteoModalSubmit, 
    handleSorteoChannelSelect, 
    handleSorteoRoleSelect, 
    handleSorteoLaunchButton 
} from './sorteoHandler';
// 📊 Sistema de Encuestas (DashStaff)
import {
    handleEncuestaStart,
    handleEncuestaOpenModalButton,
    handleEncuestaPreSelections,
    handleEncuestaFinalSubmit
} from './encuestaSystem';

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
        // 4. Manejo de Envíos de Formularios (Modals)
        if (interaction.isModalSubmit()) {
            const modalId = interaction.customId;

            if (modalId === 'modal_encuesta_final') {
                await handleEncuestaFinalSubmit(interaction);
            } else if (modalId === 'modal_event_create') {
                await handleEventModalSubmit(interaction); 
            } else if (modalId === 'modal_event_repeat') {
                await handleEventRepeatModalSubmit(interaction); 
            } else if (modalId === 'modal_envio_reporte') {
                await handleReportModalSubmit(interaction);
            } else if (modalId === 'modal_envio_defensa') {
                await handleDefensaModalSubmit(interaction);
            } else if (modalId.startsWith('modal_veredicto_')) {
                await handleVeredictoModalSubmit(interaction);
            } else if (modalId.startsWith('modal_msn_')) {
                await handleMsnModalSubmit(interaction);
            } else if (modalId === 'modal_sched_new' || modalId === 'modal_sched_edit') {
                await handleSchedModalSubmit(interaction); 
            } else if (modalId === 'modal_sched_datetime') {
                await handleSchedDatetimeSubmit(interaction); 
            } else if (modalId === 'modal_sched_repeat') {
                await handleSchedRepeatModalSubmit(interaction); 
            } else if (modalId === 'modal_rr_content') { 
                await handleRrContentSubmit(interaction);
            } else if (modalId === 'modal_welcome_text') {
                await handleWelcomeModalSubmit(interaction);
            } else if (modalId === 'modal_goodbye_text') {
                await handleGoodbyeModalSubmit(interaction);
            } else if (modalId === 'modal_crear_ticket_config') {
                await handleTicketModalSubmit(interaction);
            } else if (modalId === 'modal_sorteo_config') {
                await handleSorteoModalSubmit(interaction); 
            } else if (modalId === 'modal_dash_form_titulo') {
                await handleDashFormTituloModal(interaction); 
            } else if (modalId === 'modal_crear_formulario_preguntas') {
                await handleFormCreateModal(interaction);
            } else if (modalId.startsWith('submit_form_')) {
                await handleFormSubmitModal(interaction);
            } else if (modalId.startsWith('modal_editar_form_')) {
                await handleModalEditFormSubmit(interaction); 
            } else if (modalId === 'modal_dado_lanza') {
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
