window.remesasModule = window.remesasModule || {};

window.remesasModule.remesasList = window.remesasModule.remesasList || [];
window.remesasModule.editingRemesaId = null;

const getState = () => window.remesasModule;

// ============================================
// BINANCE MOCK
// ============================================
async function getBinanceRates() {
    return {
        usdt_bs: 800,
        eur_usdt: 1.08
    };
}

// ============================================
// CALCULO REMESA
// ============================================
async function calculateRemesa() {

    const eur = parseFloat(document.getElementById('remesaMontoEUR')?.value || 0);
    const comision = parseFloat(document.getElementById('remesaComision')?.value || 0);

    const rates = await getBinanceRates();

    const bsWithFee = rates.usdt_bs - (rates.usdt_bs * comision / 100);
    const bsTotal = eur * bsWithFee;
    const usdtNeeded = bsTotal / rates.usdt_bs;
    const eurCost = usdtNeeded / rates.eur_usdt;

    const gananciaCalc = eur - eurCost;

    document.getElementById('resBS').textContent = bsTotal.toFixed(2);
    document.getElementById('resUSDT').textContent = usdtNeeded.toFixed(2);
    document.getElementById('resEURCost').textContent = eurCost.toFixed(2);
    document.getElementById('resGananciaCalc').textContent = gananciaCalc.toFixed(2);

    return { bsTotal, usdtNeeded, eurCost, gananciaCalc };
}

// ============================================
// INIT REMESAS (ENTRY POINT)
// ============================================
window.initRemesas = function () {

    const btn = document.getElementById('btnAddRemesa');
    const modal = document.getElementById('modalRemesas');

    if (!btn || !modal) return;

    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', () => {

        modal.classList.add('active');

        if (!window.remesasModalInit) {
            initRemesasModal();
            window.remesasModalInit = true;
        }

        if (typeof calculateRemesa === 'function') {
            calculateRemesa();
        }
    });

    // cerrar al hacer click fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeRemesasModal();
        }
    });
};

// ============================================
// INIT MODAL EVENTS
// ============================================
function initRemesasModal() {

    const modal = document.getElementById('modalRemesas');
    if (!modal) return;

    const eurInput = document.getElementById('remesaMontoEUR');
    const comInput = document.getElementById('remesaComision');

    if (eurInput && !eurInput.dataset.bound) {
        eurInput.addEventListener('input', () => {
            if (typeof calculateRemesa === 'function') {
                calculateRemesa();
            }
        });
        eurInput.dataset.bound = '1';
    }

    if (comInput && !comInput.dataset.bound) {
        comInput.addEventListener('input', () => {
            if (typeof calculateRemesa === 'function') {
                calculateRemesa();
            }
        });
        comInput.dataset.bound = '1';
    }

    const btnExecute = document.getElementById('btnExecuteRemesa');

    if (btnExecute && !btnExecute.dataset.bound) {
        btnExecute.addEventListener('click', saveRemesa);
        btnExecute.dataset.bound = '1';
    }

    const btnCancelHeader = document.getElementById('btnCancelRemesa');

    if (btnCancelHeader && !btnCancelHeader.dataset.bound) {
        btnCancelHeader.addEventListener('click', closeRemesasModal);
        btnCancelHeader.dataset.bound = '1';
    }

    const btnCancelFooter = document.getElementById('btnCerrarRemesa');

    if (btnCancelFooter && !btnCancelFooter.dataset.bound) {
        btnCancelFooter.addEventListener('click', closeRemesasModal);
        btnCancelFooter.dataset.bound = '1';
    }

    if (typeof calculateRemesa === 'function') {
        calculateRemesa();
    }
}

// ============================================
// SAVE REMESA
// ============================================
async function saveRemesa() {

    try {

        const eur = parseFloat(document.getElementById('remesaMontoEUR')?.value || 0);
        const gananciaManual = parseFloat(document.getElementById('remesaGananciaReal')?.value);

        if (isNaN(eur) || eur <= 0) {
            showError?.('Monto inválido');
            return;
        }

        const calc = await calculateRemesa();

        const supabase = getSupabase();
        const userId = getCurrentUser()?.id;

        if (!userId || userId === 'undefined') {
            showError?.('Usuario no válido');
            return;
        }

        const { error } = await supabase
            .from(TABLES.remesas)
            .insert([{
                fecha: new Date().toISOString(),
                monto_eur: eur,
                bs_total: calc.bsTotal,
                usdt_necesarios: calc.usdtNeeded,
                ganancia_calculada: calc.gananciaCalc,
                ganancia_real: isNaN(gananciaManual) ? null : gananciaManual,
                status: 'pending',
                user_id: userId
            }]);

        if (error) {
            console.error('saveRemesa error:', error);
            showError?.('Error guardando remesa');
            return;
        }

        showSuccess?.('Remesa guardada');

        closeRemesasModal();
        await loadRemesas?.();

    } catch (err) {
        console.error('saveRemesa exception:', err);
        showError?.('Error inesperado');
    }
}

// ============================================
// LOAD REMESAS
// ============================================
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

// ============================================
// RENDER
// ============================================
function renderRemesas() {

    const container = document.getElementById('remesasList');
    if (!container) return;

    const list = getState()?.remesasList || [];

    if (!list.length) {
        container.innerHTML = '<p class="empty-message">No hay remesas registradas</p>';
        return;
    }

    container.innerHTML = list.map(r => `
        <div class="list-item-card">

            <div class="item-info">

                <div class="item-title">
                    EUR: ${r.monto_eur}
                </div>

                <div class="item-subtitle">
                    BS: ${r.bs_total || 0} | USDT: ${r.usdt_necesarios || 0}
                </div>

                <div class="item-subtitle">
                    Ganancia: ${r.ganancia_calculada || 0} EUR
                </div>

                <div class="item-subtitle">
                    Estado: ${r.status || 'pending'}
                </div>

            </div>

        </div>
    `).join('');
}

// ============================================
// CLOSE MODAL (FIX FINAL)
// ============================================
function closeRemesasModal() {
    const modal = document.getElementById('modalRemesas');
    if (!modal) return;

    modal.classList.remove('active');
}

console.log('🚀 REMESAS MODULE READY');