window.remesasModule = window.remesasModule || {};

window.remesasModule.remesasList = window.remesasModule.remesasList || [];
window.remesasModule.editingRemesaId = null;

let currentRemesa = null;
const getState = () => window.remesasModule;

window.initRemesas = function () {

    const btn = document.getElementById('btnAddRemesa');
    const modal = document.getElementById('modalRemesa');
    const confirmModal = document.getElementById('modalConfirmRemesa');

    if (!btn || !modal) return;

    if (!window.remesasModalInit) {
        initRemesasModal();
        window.remesasModalInit = true;
    }

    if (!window.confirmRemesaModalInit) {
        initConfirmRemesaModal();
        window.confirmRemesaModalInit = true;
    }

    if (!btn.dataset.bound) {

        btn.addEventListener('click', () => {

            modal.classList.add('active');

            if (typeof calculateRemesa === 'function') {
                calculateRemesa();
            }

        });

        btn.dataset.bound = '1';
    }

    if (!modal.dataset.bound) {

        modal.addEventListener('click', (e) => {

            if (e.target === modal) {
                closeRemesasModal();
            }

        });

        modal.dataset.bound = '1';

    }

    if (confirmModal && !confirmModal.dataset.bound) {

        confirmModal.addEventListener('click', (e) => {

            if (e.target === confirmModal) {
                closeConfirmRemesaModal();
            }

        });

        confirmModal.dataset.bound = '1';

    }

};

function initRemesasModal() {

    const modal = document.getElementById('modalRemesa');
    if (!modal) return;

    bindRemesaEvents();

    [
        ['btnCancelRemesa', closeRemesasModal],
        ['btnCloseRemesa', closeRemesasModal],
        ['btnSaveRemesa', saveRemesa]
    ].forEach(([id, handler]) => {

        const btn = document.getElementById(id);

        if (!btn || btn.dataset.bound) return;

        btn.addEventListener('click', handler);
        btn.dataset.bound = '1';

    });

}

async function loadRemesas() {
    
    try {

        const supabase = getSupabase();

        if (!supabase) return [];

        const userId = getCurrentUser()?.id;

        if (!userId || userId === 'undefined') {
            console.error('No user ID válido en loadRemesas');
            return [];
        }

        const { data, error } = await supabase
            .from(TABLES.remesas)
            .select('*')
            .eq('user_id', userId)
            .order('fecha', { ascending: false });

        if (error) {
            console.error('loadRemesas error:', error);
            return [];
        }

        const state = getState();
        state.remesasList = Array.isArray(data) ? data : [];

        renderRemesas();

        return state.remesasList;

    } catch (err) {
        console.error('loadRemesas exception:', err);
        return [];
    }
}

function renderRemesas() {
    const container = document.getElementById('remesasList');
    if (!container) return;

    const list = getState()?.remesasList || [];

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    if (!list.length) {
        container.innerHTML = '<p class="empty-message">No hay remesas registradas</p>';
        return;
    }

    container.innerHTML = list.map(r => {
        const id = escapeHTML(r.id);
        const status = r.status || 'pending';

        return `
            <div class="list-item-card" data-id="${id}">
                <div class="item-info">
                    <div class="item-title">
                        EUR: ${escapeHTML(formatNumber(r.monto_eur || 0))}
                    </div>

                    <div class="item-subtitle">
                        EUR utilizados: ${escapeHTML(formatNumber(r.euros_utilizados || 0))}
                    </div>

                    <div class="item-subtitle">
                        USDT comprados: ${escapeHTML(formatNumber(r.usdt_comprar || 0))}
                    </div>

                    <div class="item-subtitle">
                        BS: ${escapeHTML(formatNumber(r.bs_total || 0))}
                    </div>

                    <div class="item-subtitle">
                        Ganancia: ${escapeHTML(formatNumber(r.ganancia_calculada || 0))} EUR
                    </div>

                    <div class="item-subtitle">
                        Ganancia real: ${escapeHTML(formatNumber(r.ganancia_real || 0))} EUR
                    </div>

                    <div class="item-subtitle">
                        Estado: ${escapeHTML(status)}
                    </div>
                </div>

                <div class="item-actions">
                    ${status === 'pending' ? `
                        <button
                            type="button"
                            class="btn btn-primary btn-small confirmar-remesa-btn"
                            data-id="${id}">
                            Confirmar
                        </button>

                        <button
                            type="button"
                            class="btn btn-danger btn-small eliminar-remesa-btn"
                            data-id="${id}">
                            Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.confirmar-remesa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (!id) return;

            openConfirmRemesaModalById(id);
        });
    });

    container.querySelectorAll('.eliminar-remesa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (!id) return;

            eliminarRemesa(id);
        });
    });
}

async function eliminarRemesa(remesaId) {

    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOkBtn = document.getElementById('confirmOkBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');

    if (
        !confirmModal ||
        !confirmTitle ||
        !confirmMessage ||
        !confirmOkBtn ||
        !confirmCancelBtn
    ) {
        console.error('Modal de confirmación no encontrado');
        return;
    }

    confirmTitle.textContent = 'Eliminar remesa';
    confirmMessage.textContent =
        '¿Eliminar esta remesa pendiente? Esta acción no se puede deshacer.';

    confirmModal.style.display = 'flex';

    const cerrarModal = () => {
        confirmModal.style.display = 'none';
        confirmOkBtn.onclick = null;
        confirmCancelBtn.onclick = null;
    };

    confirmCancelBtn.onclick = () => {
        cerrarModal();
    };

    confirmOkBtn.onclick = async () => {

        cerrarModal();

        try {

            const supabase = getSupabase();

            const { error } = await supabase
                .from(TABLES.remesas)
                .delete()
                .eq('id', remesaId);

            if (error) throw error;

            await loadRemesas();

            showSuccess(
                'Remesa eliminada correctamente'
            );

        } catch (error) {

            console.error(
                'Error eliminando remesa:',
                error
            );

            showError(
                'No se pudo eliminar la remesa'
            );

        }

    };

}

function closeRemesasModal() {
    const modal = document.getElementById('modalRemesa');
    if (!modal) return;

    modal.classList.remove('active');
}

function bindRemesaEvents() {

    [
        'remesaEuros',
        'remesaTasaEuroUsdt',
        'remesaTasaUsdtBs',
        'remesaComision'
    ].forEach(id => {

        const input = document.getElementById(id);

        if (!input || input.dataset.bound) return;

        input.addEventListener('input', calculateRemesa);
        input.dataset.bound = '1';

    });

}

function calculateRemesa() {

    const eurosCliente = parseFloat(document.getElementById('remesaEuros')?.value) || 0;
    const tasaEUR = parseFloat(document.getElementById('remesaTasaEuroUsdt')?.value) || 0;
    const tasaBS = parseFloat(document.getElementById('remesaTasaUsdtBs')?.value) || 0;

    const comisionPorcentaje = parseFloat(document.getElementById('remesaComision')?.value) || 0;
    const comision = comisionPorcentaje / 100;

    const modo = document.querySelector('input[name="remesaModo"]:checked')?.value || 'euros';

    // Si faltan datos, limpiar resultados
    if (eurosCliente <= 0 || tasaEUR <= 0 || tasaBS <= 0) {

        currentRemesa = {
            modo,
            eurosCliente: 0,
            eurosUtilizados: 0,
            usdtComprar: 0,
            usdtVender: 0,
            bsBrutos: 0,
            bsComision: 0,
            bsNetos: 0,
            ganancia: 0,
            tasaEUR,
            tasaBS,
            comisionPorcentaje,
            comision
        };

        updateRemesaSummary();
        return;
    }

    // Cálculos
    const bsBrutos = eurosCliente * tasaBS;

    const bsComision = bsBrutos * comision;

    const bsNetos = bsBrutos - bsComision;

    const usdtVender = bsNetos / tasaBS;

    const usdtComprar = usdtVender;

    const eurosUtilizados = usdtComprar * tasaEUR;

    const ganancia = eurosCliente - eurosUtilizados;

    currentRemesa = {

        modo,

        eurosCliente,

        eurosUtilizados,

        usdtComprar,

        usdtVender,

        bsBrutos,

        bsComision,

        bsNetos,

        ganancia,

        tasaEUR,

        tasaBS,

        comisionPorcentaje,

        comision

    };

    updateRemesaSummary();

}

function updateRemesaSummary() {

    if (!currentRemesa) {
        document.getElementById('resEurosUtilizados').textContent = `${formatNumber(0)} €`;
        document.getElementById('resUsdtComprar').textContent = formatNumber(0);
        document.getElementById('resUsdtVender').textContent = formatNumber(0);
        document.getElementById('resBsNetos').textContent = `${formatNumber(0)} Bs`;
        document.getElementById('resGananciaEuros').textContent = `${formatNumber(0)} €`;
        return;
    }

    document.getElementById('resEurosUtilizados').textContent =
        `${formatNumber(currentRemesa.eurosUtilizados)} €`;

    document.getElementById('resUsdtComprar').textContent =
        formatNumber(currentRemesa.usdtComprar);

    document.getElementById('resUsdtVender').textContent =
        formatNumber(currentRemesa.usdtVender);

    document.getElementById('resBsNetos').textContent =
        `${formatNumber(currentRemesa.bsNetos)} Bs`;

    document.getElementById('resGananciaEuros').textContent =
        `${formatNumber(currentRemesa.ganancia)} €`;
}

async function saveRemesa() {

    try {

        if (
            !currentRemesa ||
            currentRemesa.eurosCliente <= 0
        ) {
            showInfoModal?.(
                'No hay una remesa válida para guardar.',
                'Remesa no válida'
            );
            return;
        }

        const supabase = getSupabase();

        if (!supabase) {
            throw new Error('Supabase no está inicializado.');
        }

        const userId = getCurrentUser()?.id;

        if (!userId) {
            throw new Error('No hay un usuario autenticado.');
        }

        const registro = {

            user_id: userId,

            fecha: new Date(),

            modo: currentRemesa.modo,

            monto_eur: currentRemesa.eurosCliente,

            euros_utilizados: currentRemesa.eurosUtilizados,

            usdt_necesarios: currentRemesa.usdtComprar,

            usdt_comprar: currentRemesa.usdtComprar,

            usdt_vender: currentRemesa.usdtVender,

            bs_brutos: currentRemesa.bsBrutos,

            bs_comision: currentRemesa.bsComision,

            bs_total: currentRemesa.bsNetos,

            ganancia_calculada: currentRemesa.ganancia,

            ganancia_real: null,

            tasa_euro_usdt: currentRemesa.tasaEUR,

            tasa_usdt_bs: currentRemesa.tasaBS,

            comision_pct: currentRemesa.comisionPorcentaje,

            status: 'pending'

        };

        const { data, error } = await supabase
            .from(TABLES.remesas)
            .insert(registro)
            .select()
            .single();

        if (error) {
            throw error;
        }

        console.log('Remesa guardada:', data);

        currentRemesa = null;

        if (typeof resetRemesaForm === 'function') {
            resetRemesaForm();
        }

        await loadRemesas();

        closeRemesasModal();

    } catch (err) {

        console.error('saveRemesa:', err);

        showInfoModal?.(
            'No se pudo guardar la remesa. Revisa los datos e inténtalo de nuevo.',
            'Error al guardar remesa'
        );

    }

}

async function saveConfirmRemesa() {
    if (window.isSavingConfirmRemesa) {
        return;
    }

    window.isSavingConfirmRemesa = true;

    try {
        const remesa = window.currentConfirmRemesa;

        if (!remesa?.id || !remesa?.user_id) {
            showInfoModal?.(
                'No se pudo identificar la remesa.',
                'Error al confirmar remesa'
            );

            return;
        }

        const gananciaInput = document.getElementById(
            'confirmGananciaReal'
        );

        const gananciaReal = Number.parseFloat(
            gananciaInput?.value
        );

        if (
            !Number.isFinite(gananciaReal) ||
            gananciaReal < 0
        ) {
            showInfoModal?.(
                'Ingrese una ganancia válida.',
                'Ganancia no válida'
            );

            return;
        }

        const supabase = getSupabase();

        /*
         * Consultar el estado real en Supabase.
         * Evita confirmar dos veces por clics repetidos.
         */
        const {
            data: remesaActual,
            error: remesaError
        } = await supabase
            .from(TABLES.remesas)
            .select(
                'id, user_id, status, ganancia_real'
            )
            .eq('id', remesa.id)
            .eq('user_id', remesa.user_id)
            .single();

        if (remesaError) {
            throw remesaError;
        }

        /*
         * Comprobar si ya existe un ingreso para esta remesa.
         */
        const {
            data: ingresosExistentes,
            error: consultaIngresoError
        } = await supabase
            .from(TABLES.ingresos)
            .select('id')
            .eq('remesa_id', remesa.id)
            .eq('user_id', remesa.user_id)
            .limit(1);

        if (consultaIngresoError) {
            throw consultaIngresoError;
        }

        const ingresoExistente =
            Array.isArray(ingresosExistentes) &&
            ingresosExistentes.length > 0;

        let ingresoCreadoId = null;

        /*
         * Crear el ingreso solo si todavía no existe.
         * Ya no se envía monto_eur.
         */
        if (!ingresoExistente) {
            const {
                data: ingresoCreado,
                error: ingresoError
            } = await supabase
                .from(TABLES.ingresos)
                .insert({
                    user_id: remesa.user_id,
                    fecha: remesa.fecha
                    ? remesa.fecha.slice(0, 10)
                    : getTodayDate(),
                    origen: 'Remesas',
                    monto: gananciaReal,
                    moneda: 'EUR',
                    descripcion: `Remesa #${remesa.id}`,
                    remesa_id: remesa.id
                })
                .select('id')
                .single();

            if (ingresoError) {
                throw ingresoError;
            }

            ingresoCreadoId = ingresoCreado?.id || null;
        }

        /*
         * Marcar como completada después de asegurar
         * que el ingreso existe.
         */
        if (remesaActual.status !== 'completed') {
            const { error: updateError } = await supabase
                .from(TABLES.remesas)
                .update({
                    status: 'completed',
                    ganancia_real: gananciaReal
                })
                .eq('id', remesa.id)
                .eq('user_id', remesa.user_id)
                .eq('status', 'pending');

            if (updateError) {
                /*
                 * Reversión: si acabamos de crear el ingreso
                 * pero no pudimos confirmar la remesa,
                 * eliminamos ese ingreso.
                 */
                if (ingresoCreadoId) {
                    const { error: rollbackError } =
                        await supabase
                            .from(TABLES.ingresos)
                            .delete()
                            .eq('id', ingresoCreadoId)
                            .eq('user_id', remesa.user_id);

                    if (rollbackError) {
                        console.error(
                            'Error revirtiendo el ingreso de la remesa:',
                            rollbackError
                        );
                    }
                }

                throw updateError;
            }
        }

        closeConfirmRemesaModal();

        window.currentConfirmRemesa = null;

        await loadRemesas();

        if (typeof loadIngresos === 'function') {
            await loadIngresos();
        }

        if (typeof loadDashboardData === 'function') {
            await loadDashboardData();
        }

        showInfoModal?.(
            ingresoExistente
                ? 'La remesa ya estaba confirmada. No se duplicó el ingreso.'
                : 'Remesa confirmada correctamente y ganancia registrada en Ingresos.',
            'Remesa confirmada'
        );

    } catch (error) {
        console.error(
            'Error en saveConfirmRemesa:',
            error
        );

        showInfoModal?.(
            'No se pudo confirmar la remesa. Revisa los datos e inténtalo de nuevo.',
            'Error al confirmar remesa'
        );

    } finally {
        window.isSavingConfirmRemesa = false;
    }
}

function initConfirmRemesaModal() {

    [
        ['btnCancelConfirmRemesa', closeConfirmRemesaModal],
        ['btnCloseConfirmRemesa', closeConfirmRemesaModal],
        ['btnSaveConfirmRemesa', saveConfirmRemesa]
    ].forEach(([id, handler]) => {

        const btn = document.getElementById(id);

        if (!btn || btn.dataset.bound) return;

        btn.addEventListener('click', handler);

        btn.dataset.bound = '1';

    });

}

function openConfirmRemesaModal(remesa) {
    console.log('openConfirmRemesaModal', remesa);
    window.currentConfirmRemesa = remesa;

    document.getElementById('confMontoEur').textContent =
        formatNumber(remesa.monto_eur) + ' €';

    document.getElementById('confUsdtComprar').textContent =
        formatNumber(remesa.usdt_necesarios);

    document.getElementById('confBsTotal').textContent =
        formatNumber(remesa.bs_total) + ' Bs';

    document.getElementById('confGananciaCalculada').textContent =
        formatNumber(remesa.ganancia_calculada) + ' €';

    document.getElementById('confirmGananciaReal').value =
        Number(remesa.ganancia_calculada).toFixed(2);

    initConfirmRemesaModal();

    document
        .getElementById('modalConfirmRemesa')
        .classList.add('active');

}

function closeConfirmRemesaModal() {

    window.currentConfirmRemesa = null;

    document
        .getElementById('modalConfirmRemesa')
        .classList.remove('active');

}

function resetRemesaForm() {

    [
        'remesaEuros',
        'remesaTasaEuroUsdt',
        'remesaTasaUsdtBs',
        'remesaComision'
    ].forEach(id => {

        const input = document.getElementById(id);

        if (input) {
            input.value = '';
        }

    });

    const radio = document.querySelector(
        'input[name="remesaModo"][value="euros"]'
    );

    if (radio) {
        radio.checked = true;
    }

    currentRemesa = null;

    updateRemesaSummary();

}

function openConfirmRemesaModalById(id) {
    console.log('openConfirmRemesaModalById', id);
    const remesa = getState().remesasList.find(r => r.id == id);

    if (!remesa) return;

    openConfirmRemesaModal(remesa);

}

window.openConfirmRemesaModalById = openConfirmRemesaModalById;

window.openConfirmRemesaModal = openConfirmRemesaModal;

