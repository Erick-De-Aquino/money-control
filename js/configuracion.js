// ============================================
// CONFIGURACIÓN - Preferencias del usuario
// ============================================

let configuracionInitialized = false;
let savedUserCurrency = 'EUR';

function populateCurrencySettingsSelect() {
    const select = document.getElementById('settingsCurrency');

    if (!select || typeof getSupportedCurrencies !== 'function') {
        return;
    }

    const currencies = getSupportedCurrencies();

    const options = currencies.map((currency) => {
        const option = document.createElement('option');

        option.value = currency.code;
        option.textContent =
            `${currency.code} — ${currency.name} (${currency.symbol})`;

        return option;
    });

    select.replaceChildren(
        new Option('Selecciona una moneda', ''),
        ...options
    );
}

function renderCurrencyPreview(currencyCode) {
    const preview = document.getElementById(
        'settingsCurrencyPreview'
    );

    if (!preview) {
        return;
    }

    preview.textContent = formatCurrency(
        1250,
        currencyCode
    );
}

function setCurrencySettingsLoading(isLoading) {
    const select = document.getElementById('settingsCurrency');
    const saveButton = document.getElementById(
        'btnSaveCurrencySettings'
    );

    if (select) {
        select.disabled = isLoading;
    }

    if (saveButton) {
        saveButton.disabled = isLoading;
        saveButton.textContent = isLoading
            ? 'Guardando...'
            : 'Guardar cambios';
    }
}

async function loadUserSettings() {
    const select = document.getElementById('settingsCurrency');

    if (!select) {
        return;
    }

    const currency = getUserCurrency();

    savedUserCurrency = currency;
    select.value = currency;

    renderCurrencyPreview(currency);
}

async function saveUserSettings() {
    const select =
        document.getElementById('settingsCurrency');

    if (!select) {
        return false;
    }

    const currency = normalizeCurrencyCode(
        select.value,
        ''
    );

    if (!currency) {
        showInfoModal(
            'Selecciona una moneda principal válida.',
            'Configuración'
        );

        return false;
    }

    const user =
        window.currentUser ||
        (
            typeof getCurrentUser === 'function'
                ? getCurrentUser()
                : null
        );

    if (!user?.id) {
        showInfoModal(
            'No se pudo identificar al usuario actual.',
            'Configuración'
        );

        return false;
    }

    if (currency === savedUserCurrency) {
        showInfoModal(
            'No hay cambios pendientes para guardar.',
            'Configuración'
        );

        return true;
    }

    const previousCurrency = savedUserCurrency;

    const previousConfig =
        typeof getCurrencyConfig === 'function'
            ? getCurrencyConfig(previousCurrency)
            : null;

    const newConfig =
        typeof getCurrencyConfig === 'function'
            ? getCurrencyConfig(currency)
            : null;

    const previousName =
        previousConfig?.name || previousCurrency;

    const newName =
        newConfig?.name || currency;

    const confirmationMessage =
        `Vas a cambiar la moneda principal de ` +
        `${previousCurrency} (${previousName}) a ` +
        `${currency} (${newName}). ` +
        `Todos tus gastos e ingresos existentes pasarán a ` +
        `identificarse con la nueva moneda, pero sus importes ` +
        `no serán convertidos. ` +
        `Por ejemplo, ${previousCurrency} 100 pasará a ` +
        `${currency} 100. ¿Deseas continuar?`;

    showConfirmModal(
        confirmationMessage,

        async () => {
            setCurrencySettingsLoading(true);

            try {
                const supabase = getSupabase();

                /*
                 * La función de Supabase actualiza el perfil,
                 * los gastos y los ingresos dentro de una sola
                 * transacción.
                 */
                const { error } = await supabase.rpc(
                    'cambiar_moneda_principal',
                    {
                        p_moneda: currency
                    }
                );

                if (error) {
                    throw error;
                }

                savedUserCurrency = currency;
                window.currentUserCurrency = currency;

                localStorage.setItem(
                    'user_currency',
                    currency
                );

                if (window.currentUser) {
                    window.currentUser.moneda_principal =
                        currency;
                }

                if (
                    typeof currentUser !== 'undefined' &&
                    currentUser
                ) {
                    currentUser.moneda_principal =
                        currency;
                }

                select.value = currency;

                renderCurrencyPreview(currency);

                if (
                    typeof loadDashboardData === 'function'
                ) {
                    await loadDashboardData();
                }

                showInfoModal(
                    `La moneda principal se cambió a ${currency}. ` +
                    `Los gastos e ingresos existentes fueron ` +
                    `actualizados sin convertir sus importes.`,
                    'Configuración actualizada'
                );

                return true;

            } catch (error) {
                console.error(
                    'Error guardando configuración de moneda:',
                    error
                );

                select.value = previousCurrency;
                renderCurrencyPreview(previousCurrency);

                showInfoModal(
                    'No se pudo completar el cambio de moneda. ' +
                    'No se modificó la configuración anterior.',
                    'Error de configuración'
                );

                return false;

            } finally {
                setCurrencySettingsLoading(false);
            }
        },

        'Confirmar cambio de moneda'
    );

    return true;
}

function initConfiguracionEvents() {
    if (configuracionInitialized) {
        loadUserSettings();
        return;
    }

    const form = document.getElementById(
        'currencySettingsForm'
    );

    const select = document.getElementById(
        'settingsCurrency'
    );

    if (!form || !select) {
        return;
    }

    populateCurrencySettingsSelect();

    select.addEventListener('change', () => {
        const currency = normalizeCurrencyCode(
            select.value,
            'EUR'
        );

        renderCurrencyPreview(currency);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveUserSettings();
    });

    configuracionInitialized = true;

    loadUserSettings();
}