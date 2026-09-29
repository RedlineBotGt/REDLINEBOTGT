import { Interaction } from 'discord.js';
import * as dash from '../commands/dash';
import * as reporte from '../commands/reporte';
import * as setupdefensa from '../commands/setupdefensa';
import * as veredicto from '../commands/veredicto';
import * as msn from '../commands/msn';
import * as forms from '../commands/forms';
import * as ColocarForm from '../commands/ColocarForm';

import { handleReportButton, handleReportModalSubmit } from './reportModal';
import { handleDefensaButton, handleDefensaModalSubmit } from './defensModal';
import { handleVeredictoModalSubmit } from './veredictoModal';
import { handleMsnModalSubmit } from './msnModal';

// Manejadores de formularios y Dash
import { handleFormCreateModal } from './formCreateModal';
import { handleFormDeploySelect } from './formDeployHandler';
import { handleFormButtonClick } from './formButtonHandler';
import { handleFormSubmitModal } from './formSubmitHandler';
import { handleDashDeleteFormSelect } from './dashDeleteHandler'; 
import { handleDashMsnChannelSelect, handleDashMsnButton } from './dashMsnHandler';     
import { handleDashEditButton, handleDashEditFormSelect } from './dashEditHandler';           
import { handleDashEditSubmitModal } from './dashEditSubmitHandler';   
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
    handleDashOpenPreguntasButton // <-- ¡Añadida la función del botón intermedio!
} from './dashCreateFormHandler'; 

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
            }
            return;
        }

        // 2. Manejo de Menús Desplegables de Texto (String Select Menus)
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('select_form_deploy_')) {
                await handleFormDeploySelect(interaction);
            } else if (interaction.customId === 'dash_select_eliminar_form') {
                await handleDashDeleteFormSelect(interaction);
            } else if (interaction.customId === 'dash_select_editar_form') {
                await handleDashEditFormSelect(interaction);
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
            }
            return;
        }

        // 2.2. Manejo de Menús Desplegables de Roles (Role Select Menus)
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'dash_select_verd_role') {
                await handleDashVeredictoRoleSelect(interaction);
            }
            return;
        }

        // 3. Manejo de Botones interactivos
        if (interaction.isButton()) {
            if (interaction.customId === 'dash_btn_crear_form') {
                await handleDashCreateFormButton(interaction); 
            } else if (interaction.customId === 'dash_btn_abrir_preguntas') {
                await handleDashOpenPreguntasButton(interaction); // <-- ¡Captura el clic y abre el modal de preguntas!
            } else if (interaction.customId === 'dash_btn_editar_form') {
                await handleDashEditButton(interaction); 
            } else if (interaction.customId === 'dash_btn_msn_mensaje') {
                await handleDashMsnButton(interaction); 
            } else if (interaction.customId === 'dash_btn_veredicto') {
                await handleDashVeredictoButton(interaction); 
            } else if (interaction.customId === 'dash_btn_setup_reporte') {
                await handleDashReporteButton(interaction);
            } else if (interaction.customId === 'dash_btn_setup_defensa') {
                await handleDashDefensaButton(interaction);
            } else if (interaction.customId === 'btn_abrir_reporte') {
                const handled = await handleReportButton(interaction);
                if (handled) return;
            } else if (interaction.customId === 'btn_abrir_defensa') {
                const handledDef = await handleDefensaButton(interaction);
                if (handledDef) return;
            } else if (interaction.customId.startsWith('open_form_')) {
                await handleFormButtonClick(interaction);
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
            } else if (interaction.customId === 'modal_dash_form_titulo') {
                await handleDashFormTituloModal(interaction); 
            } else if (interaction.customId === 'modal_crear_formulario_preguntas') {
                await handleFormCreateModal(interaction);
            } else if (interaction.customId.startsWith('submit_form_')) {
                await handleFormSubmitModal(interaction);
            } else if (interaction.customId.startsWith('modal_editar_form_')) {
                await handleDashEditSubmitModal(interaction); 
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
