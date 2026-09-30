import { Interaction } from 'discord.js';
import * as dash from '../commands/dash';
import * as reporte from '../commands/reporte';
import * as setupdefensa from '../commands/setupdefensa';
import * as veredicto from '../commands/veredicto';
import * as msn from '../commands/msn';
import * as forms from '../commands/forms';
import * as ColocarForm from '../commands/ColocarForm';
import * as borrar from '../commands/borrar'; // 🗑️ ¡Añadido el comando borrar aquí!

import { handleReportButton, handleReportModalSubmit } from './reportModal';
import { handleDefensaButton, handleDefensaModalSubmit } from './defensModal';
import { handleVeredictoModalSubmit } from './veredictoModal';
import { handleMsnModalSubmit } from './msnModal';

// 👋 NUEVO: Importamos los manejadores del sistema de Bienvenidas y Despedidas
import { 
    handleDashWelcomeButton, 
    handleWelcomeMenuButton, 
    handleWelcomeChannelSelect, 
    handleWelcomeModalSubmit, 
    handleGoodbyeChannelSelect, 
    handleGoodbyeModalSubmit 
} from './welcomeSystem';

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

// 🎟️ NUEVO: Importamos los manejadores del sistema de tickets
import { 
    handleDashCrearBotonButton, 
    handleTicketModalSubmit, 
    handleTicketChannelSelect, 
    handleTicketButtonClick, 
    handleCloseTicketButton, 
    activeTicketButtons 
} from './ticketButtonHandler';

// 📅 NUEVO: Importamos los manejadores del sistema de Mensajes Programados
import { 
    handleDashScheduledButton,
    handleSchedContentSubmit,
    handleSchedChannelSelect,
    handleSchedRoleSelection,
    handleSchedDatetimeSubmit,
    handleSchedRepeatYes,
    handleSchedFinalizeNo,
    handleSchedRepeatModalSubmit
} from './scheduledMessage';

// 🎭 NUEVO: Importamos los manejadores del sistema de Roles por Reacción (incluyendo gestión y borrado de BD)
import { 
    handleDashRrButton,
    handleRrContentSubmit,
    handleRrChannelSelect,
    handleRrRoleSelect,
    handleRrExistingSelect,
    handleRrDeleteConfig,
    handleRrStartCreate
} from './reactionRoles';

export async function handleInteraction(interaction: Interaction) {
    try {
        // 1. Manejo de Comandos de Barra (Slash Commands)
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'dash') {
                await dash.execute(interaction);
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
                await handleRrExistingSelect(interaction); // 🎭 Selección de mensaje guardado de RR
            }
            return;
        }

        // 2.1. Manejo de Menús Desplegables de Canales (Channel Select Menus)
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'dash_select_msn_channel') {
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
                await handleGoodbyeChannelSelect(interaction);
            }
            return;
        }

        // 2.2. Manejo de Menús Desplegables de Roles (Role Select Menus)
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'dash_select_verd_role') {
                await handleDashVeredictoRoleSelect(interaction);
            } else if (interaction.customId === 'sched_select_role') {
                await handleSchedRoleSelection(interaction);
            } else if (interaction.customId === 'rr_select_role') {
                await handleRrRoleSelect(interaction);
            }
            return;
        }

        // 3. Manejo de Botones interactivos
        if (interaction.isButton()) {
            if (interaction.customId === 'dash_btn_crear_form') {
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
            } else if (interaction.customId === 'rr_btn_create') {
                await handleDashRrButton(interaction); // 🎭 Abre el panel principal de gestión de RR
            } else if (interaction.customId === 'rr_btn_start_create') {
                await handleRrStartCreate(interaction); // 🎭 Botón "Crear Nuevo" dentro del panel de RR
            } else if (interaction.customId.startsWith('rr_btn_delete_config_')) {
                await handleRrDeleteConfig(interaction); // 🎭 Botón para borrar configuración de la BD
            } else if (interaction.customId === 'dash_btn_welcome_config') {
                await handleDashWelcomeButton(interaction);
            } else if (interaction.customId === 'welcome_menu_bienvenida' || interaction.customId === 'welcome_menu_despedida') {
                await handleWelcomeMenuButton(interaction);
            } else if (interaction.customId === 'sched_skip_role') {
                await handleSchedRoleSelection(interaction);
            } else if (interaction.customId === 'sched_repeat_yes') {
                await handleSchedRepeatYes(interaction);
            } else if (interaction.customId === 'sched_repeat_no') {
                await handleSchedFinalizeNo(interaction);
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
            if (interaction.customId === 'modal_envio_reporte') {
                await handleReportModalSubmit(interaction);
            } else if (interaction.customId === 'modal_envio_defensa') {
                await handleDefensaModalSubmit(interaction);
            } else if (interaction.customId.startsWith('modal_veredicto_')) {
                await handleVeredictoModalSubmit(interaction);
            } else if (interaction.customId.startsWith('modal_msn_')) {
                await handleMsnModalSubmit(interaction);
            } else if (interaction.customId === 'modal_sched_content') {
                await handleSchedContentSubmit(interaction);
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
