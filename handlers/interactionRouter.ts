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
    handleEventRepeatNoButton,
    handleEventRepeatModalSubmit,
    handleEventSingleDatetimeSubmit 
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
    handleEncuestaStep1Submit,
    handleEncuestaStep2Submit,
    handleEncuestaAddMoreButton,
    handleEncuestaAddSingleSubmit,
    handleEncuestaOptionsDoneButton,
    handleEncuestaChannelSelect,
    handleEncuestaRoleSelection,
    handleEncuestaLogChannelSelect
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
import { 
    handleDashCrearBotonButton, 
    handleTicketModalSubmit, 
    handleTicketChannelSelect, 
    handleTicketButtonClick, 
    handleCloseTicketButton, 
    activeTicketButtons 
} from './ticketButtonHandler';
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

import { 
    handleDashRrButton,
    handleRrContentSubmit,
    handleRrChannelSelect,
    handleRrRoleSelect,
    handleRrExistingSelect,
    handleRrDeleteConfig,
    handleRrStartCreate
} from './reactionRoles';

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
            } else if (interaction.commandName === 'dado') {
                await dado.execute(interaction);
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
                await handleSchedExistingSelect(interaction); 
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
                await handleSchedChannelSelect(interaction); 
            } else if (interaction.customId === 'rr_select_channel') {
                await handleRrChannelSelect(interaction);
            } else if (interaction.customId === 'welcome_select_welcome_channel') {
                await handleWelcomeChannelSelect(interaction);
            } else if (interaction.customId === 'welcome_select_goodbye_channel') {
                await handleWelcomeChannelSelect(interaction); 
            } else if (interaction.customId === 'sorteo_select_channel') {
                await handleSorteoChannelSelect(interaction); 
            } else if (interaction.customId === 'encuesta_select_channel') {
                await handleEncuestaChannelSelect(interaction); // 📊 Canal de publicación encuesta
            } else if (interaction.customId === 'encuesta_select_log_channel') {
                await handleEncuestaLogChannelSelect(interaction); // 📊 Canal de logs encuesta
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
            } else if (interaction.customId === 'sorteo_select_role') {
                await handleSorteoRoleSelect(interaction);
            } else if (interaction.customId === 'dash_select_verd_role') {
                await handleDashVeredictoRoleSelect(interaction);
            } else if (interaction.customId === 'sched_select_role') {
                await handleSchedRoleSelection(interaction);
            } else if (interaction.customId === 'rr_select_role') {
                await handleRrRoleSelect(interaction);
            } else if (interaction.customId === 'encuesta_select_role') {
                await handleEncuestaRoleSelection(interaction); // 📊 Rol de mención encuesta
            }
            return;
        }

        // 3. Manejo de Botones (Buttons)
        if (interaction.isButton()) {
            const customId = interaction.customId;
            
            if (customId === 'dash_welcome_btn') {
                await handleDashWelcomeButton(interaction);
            } else if (customId === 'welcome_menu_btn') {
                await handleWelcomeMenuButton(interaction);
            } else if (customId === 'dash_avisos_btn') {
                await handleDashAvisosButton(interaction);
            } else if (customId === 'dash_event_btn') {
                await handleDashEventButton(interaction);
            } else if (customId === 'event_rsvp_btn') {
                await handleEventRsvpButton(interaction);
            }
            return;
        }
                    else if (customId === 'dash_btn_encuesta_create') {
                        await handleEncuestaStart(interaction); // 📊 Iniciar encuesta (Muestra selectores)
                    } else if (customId === 'encuesta_btn_open_modal') {
                        await handleEncuestaOpenModalButton(interaction); // 📊 Botón "Siguiente" para abrir modal
                    } else if (['event_rsvp_yes', 'event_rsvp_maybe', 'event_rsvp_no'].includes(customId)) {
                        await handleEventRsvpButton(interaction); 
                    } else if (customId === 'event_repeat_yes') {
                        await handleEventRepeatYesButton(interaction); 
                    } else if (customId === 'event_repeat_no') {
                        await handleEventRepeatNoButton(interaction); 
                    } else if (customId === 'dash_btn_crear_form') {
                        await handleDashCreateFormButton(interaction); 
                    } else if (customId === 'dash_btn_abrir_preguntas') {
                        await handleDashOpenPreguntasButton(interaction); 
                    } else if (customId === 'dash_btn_editar_form') {
                        await handleDashEditButton(interaction); 
                    } else if (customId === 'dash_btn_borrar_form') {
                        await handleDashDeleteButton(interaction); 
                    } else if (customId === 'dash_btn_colocar_form') {
                        await handleDashColocarButton(interaction); 
                    } else if (customId === 'dash_btn_crear_boton') {
                        await handleDashCrearBotonButton(interaction);
                    } else if (customId === 'dash_btn_scheduled_msg') {
                        await handleDashScheduledButton(interaction); 
                    } else if (customId === 'sched_btn_new') {
                        await handleSchedNewButton(interaction); 
                    } else if (customId === 'sched_btn_existing') {
                        await handleSchedExistingButton(interaction); 
                    } else if (customId.startsWith('sched_action_')) {
                        await handleSchedActionButtons(interaction); 
                    } else if (customId === 'sched_skip_role') {
                        await handleSchedRoleSelection(interaction); 
                    } else if (customId === 'sched_repeat_yes') {
                        await handleSchedRepeatYes(interaction); 
                    } else if (customId === 'sched_repeat_no') {
                        await handleSchedFinalizeNo(interaction); 
                    } else if (customId === 'rr_btn_create') {
                        await handleDashRrButton(interaction); 
                    } else if (customId === 'rr_btn_start_create') {
                        await handleRrStartCreate(interaction); 
                    } else if (customId.startsWith('rr_btn_delete_config_')) {
                        await handleRrDeleteConfig(interaction); 
                    } else if (customId === 'dash_btn_welcome_config') {
                        await handleDashWelcomeButton(interaction);
                    } else if (customId === 'welcome_menu_bienvenida' || customId === 'welcome_menu_
