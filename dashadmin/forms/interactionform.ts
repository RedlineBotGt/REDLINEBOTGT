import {
    handleDashCrearFormButton,
    handleFormCreate5Modal,
    handleFormLogoConfigButton,
    handleFormLogoConfigModal,
    handlePromptRenombrarButton,
    handleRenombrarModal,
    handleDashEditarFormButton,
    handleDashEditarFormSelect,
    handleEditDeleteButton,
    handleEditContinueButton,
    handleEditarFormModalSubmit,
    handleEditChangeTitleButton,
    handleEditarNuevoTituloModalSubmit,
    handleEditChangeChannelButton,
    handleEditChangeChannelSelect,
    handleEditFinishButton
} from './formmanager';

import {
    handleDashColocarButton,
    handleDashColocarFormSelect,
    handleDashColocarPubliChannelSelect,
    handleDashColocarRespuestasChannelSelect,
    handleFormButtonClick,
    handleFormSubmitModal,
    handleFormLogoAttachButton,
    handleFormLogoSkipButton,
    handleFormLogoSubmitModal
} from './formactions';

/**
 * Enrutador local del submódulo de Formularios (Form).
 * Filtra la interacción según su tipo y la delega al manejador correspondiente.
 */
export async function handleFormInteractions(interaction: any): Promise<boolean> {
    try {
        if (interaction.isButton()) {
            if (await handleDashColocarButton(interaction)) return true;
            if (await handleFormLogoConfigButton(interaction)) return true;
            if (await handleFormLogoAttachButton(interaction)) return true;
            if (await handleFormLogoSkipButton(interaction)) return true;
            if (await handleFormButtonClick(interaction)) return true;
            if (await handleDashCrearFormButton(interaction)) return true;
            if (await handlePromptRenombrarButton(interaction)) return true;
            if (await handleDashEditarFormButton(interaction)) return true;
            if (await handleEditDeleteButton(interaction)) return true;
            if (await handleEditContinueButton(interaction)) return true;
            if (await handleEditChangeTitleButton(interaction)) return true;
            if (await handleEditChangeChannelButton(interaction)) return true;
            if (await handleEditFinishButton(interaction)) return true;
        }

        if (interaction.isStringSelectMenu()) {
            if (await handleDashColocarFormSelect(interaction)) return true;
            if (await handleDashEditarFormSelect(interaction)) return true;
        }

        if (interaction.isChannelSelectMenu()) {
            if (await handleDashColocarPubliChannelSelect(interaction)) return true;
            if (await handleDashColocarRespuestasChannelSelect(interaction)) return true;
            if (await handleEditChangeChannelSelect(interaction)) return true;
        }

        if (interaction.isModalSubmit()) {
            if (await handleFormCreate5Modal(interaction)) return true;
            if (await handleFormLogoConfigModal(interaction)) return true;
            if (await handleRenombrarModal(interaction)) return true;
            if (await handleEditarFormModalSubmit(interaction)) return true;
            if (await handleEditarNuevoTituloModalSubmit(interaction)) return true;
            if (await handleFormSubmitModal(interaction)) return true;
            if (await handleFormLogoSubmitModal(interaction)) return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Error en el enrutador de formularios (interactionform):', error);
        return false;
    }
}
