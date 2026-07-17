// ============================================
// PRESUPUESTOS - Gestión de presupuestos mensuales
// ============================================

// Variables globales
let presupuestosList = [];
let editingPresupuestoId = null;
let filtroPresupuesto = {
    mes: new Date().getMonth() + 1,
    año: new Date().getFullYear()
};

async function getPresupuestoAuthUser() {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('No se pudo obtener el usuario actual:', userError);
        showError?.('No hay una sesion activa');
        return null;
    }

    return user;
}

// Cargar presupuestos desde Supabase
async function loadPresupuestos() {
    try {
        const supabase = getSupabase();
        const container = document.getElementById('presupuestosList');

        presupuestosList = [];

        if (container) {
            container.innerHTML = '<p class="empty-message">Cargando presupuestos...</p>';
        }

        const user = await getPresupuestoAuthUser();

        if (!user) return [];

        let query = supabase
            .from('presupuestos')
            .select('*')
            .eq('user_id', user.id);
        
        if (filtroPresupuesto.mes) {
            query = query.eq('mes', filtroPresupuesto.mes);
        }
        if (filtroPresupuesto.año) {
            query = query.eq('año', filtroPresupuesto.año);
        }
        
        const { data, error } = await query.order('categoria');
        
        if (error) {
            console.error('Error al cargar presupuestos:', error);
            showError('Error al cargar los presupuestos');
            return [];
        }
        
        presupuestosList = data || [];
        displayPresupuestos();
        return presupuestosList;
        
    } catch (error) {
        console.error('Error en loadPresupuestos:', error);
        return [];
    }
}

// Mostrar presupuestos en UI
async function displayPresupuestos() {
    const container = document.getElementById('presupuestosList');
    if (!container) return;

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    if (presupuestosList.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay presupuestos para este período</p>';
        return;
    }

    const gastos = await getGastosDelMes(filtroPresupuesto.año, filtroPresupuesto.mes);

    const userCurrency = getUserCurrency();

    container.innerHTML = presupuestosList.map(p => {
        const id = Number(p.id);
        const categoria = escapeHTML(p.categoria || 'Sin categoría');
        const mes = Number(p.mes) || '';
        const año = Number(p.año) || '';
        const limite = Number(p.limite) || 0;

        const gastado = gastos
            .filter(g => g.categoria === p.categoria)
            .reduce(
                (sum, g) =>
                    sum + Number(
                        g.monto_eur ??
                        g.monto ??
                        0
                    ),
                0
            );

        const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0;
        const porcentajeSeguro = Math.min(Math.max(porcentaje, 0), 100);
        const colorBarra =
            porcentaje >= 90
                ? '#f44336'
                : porcentaje >= 75
                    ? '#FF9800'
                    : '#4CAF50';

        const gastadoTexto = escapeHTML(
            formatCurrency(gastado, userCurrency)
        );

        const limiteTexto = escapeHTML(
            formatCurrency(limite, userCurrency)
        );
        const porcentajeTexto = escapeHTML(porcentaje.toFixed(1));

        return `
            <div class="list-item-card" data-id="${id}">
                <div class="item-info" style="flex: 2;">
                    <div class="item-title">${categoria}</div>
                    <div class="item-subtitle">${mes}/${año}</div>
                </div>

                <div class="item-info" style="flex: 3;">
                    <div class="progress-bar-container" style="background: #e0e0e0; border-radius: 10px; height: 20px; width: 100%;">
                        <div class="progress-bar-fill" style="width: ${porcentajeSeguro}%; background-color: ${colorBarra}; height: 20px; border-radius: 10px; transition: width 0.3s;"></div>
                    </div>

                    <div class="item-subtitle" style="margin-top: 5px;">
                        Gastado: ${gastadoTexto} / ${limiteTexto} (${porcentajeTexto}%)
                    </div>
                </div>

                <div class="item-actions">
                    <button class="btn-icon btn-small edit-presupuesto" data-id="${id}" title="Editar">✏️</button>
                    <button class="btn-icon btn-small delete-presupuesto" data-id="${id}" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.edit-presupuesto').forEach(btn => {
        btn.addEventListener('click', () => editPresupuesto(Number(btn.dataset.id)));
    });

    document.querySelectorAll('.delete-presupuesto').forEach(btn => {
        btn.addEventListener('click', () => deletePresupuesto(Number(btn.dataset.id)));
    });
}

// Obtener gastos de un mes específico
async function getGastosDelMes(año, mes) {
    try {
        const supabase = getSupabase();
        const user = await getPresupuestoAuthUser();

        if (!user) {
            return [];
        }

        const añoNumerico = Number(año);
        const mesNumerico = Number(mes);

        if (
            !Number.isInteger(añoNumerico) ||
            !Number.isInteger(mesNumerico) ||
            mesNumerico < 1 ||
            mesNumerico > 12
        ) {
            console.error(
                'Periodo inválido al consultar gastos:',
                { año, mes }
            );

            return [];
        }

        const fechaInicio =
            `${añoNumerico}-${String(mesNumerico).padStart(2, '0')}-01`;

        /*
         * Se utiliza el primer día del mes siguiente como límite
         * exclusivo. Es más seguro que calcular manualmente el
         * último día del mes.
         */
        const siguienteMes =
            mesNumerico === 12
                ? 1
                : mesNumerico + 1;

        const siguienteAño =
            mesNumerico === 12
                ? añoNumerico + 1
                : añoNumerico;

        const fechaSiguienteMes =
            `${siguienteAño}-${String(siguienteMes).padStart(2, '0')}-01`;

        const { data, error } = await supabase
            .from('gastos')
            .select(
                'id, fecha, categoria, monto, monto_eur, moneda, user_id'
            )
            .eq('user_id', user.id)
            .gte('fecha', fechaInicio)
            .lt('fecha', fechaSiguienteMes)
            .order('fecha', { ascending: true });

        if (error) {
            console.error(
                'Error al cargar gastos del mes:',
                error
            );

            return [];
        }

        return Array.isArray(data)
            ? data
            : [];
    } catch (error) {
        console.error(
            'Error en getGastosDelMes:',
            error
        );

        return [];
    }
}

// Mostrar modal para agregar/editar presupuesto
async function showPresupuestoModal(presupuesto = null) {
    editingPresupuestoId = presupuesto ? presupuesto.id : null;

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('#modal .modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const escapeAttr = escapeHTML;

    modalTitle.textContent = presupuesto ? '✏️ Editar Presupuesto' : '➕ Nuevo Presupuesto';

    const categorias = await getCategoriasCache('gastos');
    const categoriaActual = presupuesto?.categoria || '';

    const categoriasOptions = categorias.map(cat => {
        const nombre = cat.nombre || '';
        const selected = categoriaActual === nombre ? 'selected' : '';

        return `
            <option value="${escapeAttr(nombre)}" ${selected}>
                ${escapeHTML(nombre)}
            </option>
        `;
    }).join('');

    const año = escapeAttr(presupuesto ? presupuesto.año : new Date().getFullYear());
    const limite = escapeAttr(presupuesto ? presupuesto.limite : '');
    const mesActual = Number(presupuesto?.mes);

    const userCurrency = getUserCurrency();

    modalBody.innerHTML = `
        <form id="presupuestoForm">
            <div class="form-group">
                <label for="presupuestoCategoria">Categoría *</label>
                <select id="presupuestoCategoria" required>
                    <option value="">Seleccionar categoría</option>
                    ${categoriasOptions}
                </select>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="presupuestoMes">Mes *</label>
                    <select id="presupuestoMes" required>
                        <option value="1" ${mesActual === 1 ? 'selected' : ''}>Enero</option>
                        <option value="2" ${mesActual === 2 ? 'selected' : ''}>Febrero</option>
                        <option value="3" ${mesActual === 3 ? 'selected' : ''}>Marzo</option>
                        <option value="4" ${mesActual === 4 ? 'selected' : ''}>Abril</option>
                        <option value="5" ${mesActual === 5 ? 'selected' : ''}>Mayo</option>
                        <option value="6" ${mesActual === 6 ? 'selected' : ''}>Junio</option>
                        <option value="7" ${mesActual === 7 ? 'selected' : ''}>Julio</option>
                        <option value="8" ${mesActual === 8 ? 'selected' : ''}>Agosto</option>
                        <option value="9" ${mesActual === 9 ? 'selected' : ''}>Septiembre</option>
                        <option value="10" ${mesActual === 10 ? 'selected' : ''}>Octubre</option>
                        <option value="11" ${mesActual === 11 ? 'selected' : ''}>Noviembre</option>
                        <option value="12" ${mesActual === 12 ? 'selected' : ''}>Diciembre</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="presupuestoAño">Año *</label>
                    <input type="number" id="presupuestoAño" value="${año}" required>
                </div>
            </div>

            <div class="form-group">
                <label for="presupuestoLimite">Límite (${escapeHTML(userCurrency)}) *</label>
                <input type="number" id="presupuestoLimite" step="0.01" min="0.01" value="${limite}" required>
            </div>

            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelPresupuestoBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary">${presupuesto ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;

    modal.classList.add('active');

    const form = document.getElementById('presupuestoForm');

    if (form) {
        form.addEventListener('submit', savePresupuesto);
    }

    const cancelBtn = document.getElementById('cancelPresupuestoBtn');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
}

// Guardar presupuesto
async function savePresupuesto(event) {
    event.preventDefault();

    const categoria =
        document.getElementById('presupuestoCategoria')?.value;

    const mes = Number.parseInt(
        document.getElementById('presupuestoMes')?.value,
        10
    );

    const año = Number.parseInt(
        document.getElementById('presupuestoAño')?.value,
        10
    );

    const limite = Number.parseFloat(
        document.getElementById('presupuestoLimite')?.value
    );

    if (
        !categoria ||
        !Number.isInteger(mes) ||
        !Number.isInteger(año) ||
        !Number.isFinite(limite)
    ) {
        showError('Por favor completa todos los campos');
        return;
    }

    if (mes < 1 || mes > 12) {
        showError('El mes seleccionado no es válido');
        return;
    }

    if (limite <= 0) {
        showError('El límite debe ser mayor a 0');
        return;
    }

    const user = await getPresupuestoAuthUser();

    if (!user) {
        return;
    }

    const presupuestoData = {
        categoria,
        mes,
        año,
        limite,
        user_id: user.id
    };

    try {
        const supabase = getSupabase();
        const estabaEditando = Boolean(editingPresupuestoId);

        let result;

        if (estabaEditando) {
            result = await supabase
                .from('presupuestos')
                .update(presupuestoData)
                .eq('id', editingPresupuestoId)
                .eq('user_id', user.id);
        } else {
            result = await supabase
                .from('presupuestos')
                .insert([presupuestoData]);
        }

        if (result.error) {
            console.error(
                'Error al guardar presupuesto:',
                result.error
            );

            showError('Error al guardar el presupuesto');
            return;
        }

        /*
         * Determinar si el presupuesto pertenece a un mes
         * que ya ha finalizado.
         */
        const hoy = new Date();
        const mesActual = hoy.getMonth() + 1;
        const añoActual = hoy.getFullYear();

        const periodoSeleccionado = (año * 100) + mes;
        const periodoActual = (añoActual * 100) + mesActual;

        const esPeriodoCerrado =
            periodoSeleccionado < periodoActual;

        /*
         * Si el presupuesto pertenece a un mes anterior,
         * pasarlo inmediatamente al historial.
         */
        if (esPeriodoCerrado) {
            const guardadoEnHistorial =
                await guardarMesEnHistorial(año, mes);

            if (!guardadoEnHistorial) {
                console.error(
                    `El presupuesto se guardó, pero no pudo sincronizarse con el historial de ${mes}/${año}.`
                );

                showError(
                    'El presupuesto se guardó, pero no pudo actualizarse el historial'
                );

                await loadPresupuestos();
                return;
            }
        }

        closeModal();

        if (esPeriodoCerrado) {
            showSuccess(
                estabaEditando
                    ? 'Presupuesto actualizado en el historial'
                    : 'Presupuesto guardado en el historial'
            );
        } else {
            showSuccess(
                estabaEditando
                    ? 'Presupuesto actualizado'
                    : 'Presupuesto guardado'
            );
        }

        await loadPresupuestos();
    } catch (error) {
        console.error(
            'Error en savePresupuesto:',
            error
        );

        showError('Error al guardar el presupuesto');
    }
}

// Editar presupuesto
async function editPresupuesto(id) {
    const presupuesto = presupuestosList.find(p => p.id === id);
    if (presupuesto) {
        await showPresupuestoModal(presupuesto);
    }
}

// Eliminar presupuesto
async function deletePresupuesto(id) {
    const presupuesto = presupuestosList.find(p => p.id === id);

    if (!presupuesto) {
        showError('No se encontró el presupuesto');
        return;
    }
    
    showConfirmModal(
        `¿Eliminar presupuesto de ${presupuesto.categoria} para ${presupuesto.mes}/${presupuesto.año}?`,
        async () => {
            try {
                const supabase = getSupabase();
                const user = await getPresupuestoAuthUser();

                if (!user) return;
                
                const { error } = await supabase
                    .from('presupuestos')
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);
                
                if (error) {
                    console.error('Error al eliminar presupuesto:', error);
                    showError('Error al eliminar el presupuesto');
                    return;
                }
                
                showSuccess('Presupuesto eliminado');
                await loadPresupuestos();
                
            } catch (error) {
                console.error('Error en deletePresupuesto:', error);
                showError('Error al eliminar el presupuesto');
            }
        },
        'Eliminar Presupuesto'
    );
}

// Aplicar filtros
async function aplicarFiltroPresupuestos() {
    filtroPresupuesto.mes = parseInt(document.getElementById('filtroMesPresupuesto')?.value);
    filtroPresupuesto.año = parseInt(document.getElementById('filtroAnoPresupuesto')?.value);
    
    await loadPresupuestos();
    showSuccess('Filtro aplicado');
}

function limpiarFiltroPresupuestos() {
    const hoy = new Date();
    filtroPresupuesto = {
        mes: hoy.getMonth() + 1,
        año: hoy.getFullYear()
    };
    
    const mesSelect = document.getElementById('filtroMesPresupuesto');
    const añoSelect = document.getElementById('filtroAnoPresupuesto');
    
    if (mesSelect) mesSelect.value = filtroPresupuesto.mes;
    if (añoSelect) añoSelect.value = filtroPresupuesto.año;
    
    loadPresupuestos();
    showSuccess('Filtros limpiados');
}

// Inicializar select de años
function initAnoSelect() {
    const añoSelect = document.getElementById('filtroAnoPresupuesto');
    if (!añoSelect) return;
    
    const añoActual = new Date().getFullYear();
    añoSelect.innerHTML = '';
    for (let i = añoActual - 2; i <= añoActual + 2; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === añoActual) option.selected = true;
        añoSelect.appendChild(option);
    }
}

// Inicializar eventos
function initPresupuestosEvents() {
    // Verificar cambio de mes al entrar
    initHistorialCheck();

    if (!window.__presupuestosEventsInitialized) {
        const btnAdd = document.getElementById('btnAddPresupuesto');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => showPresupuestoModal());
        }

        const btnAplicar = document.getElementById('btnAplicarFiltroPresupuesto');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroPresupuesto');

        if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltroPresupuestos);
        if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFiltroPresupuestos);

        window.__presupuestosEventsInitialized = true;
    }
    
    initAnoSelect();
    loadPresupuestos();
}

// ============================================
// ALERTAS DE PRESUPUESTO (75%, 90%, 100%)
// ============================================

// Verificar si ya se mostró una alerta
async function alertaYaMostrada(presupuestoId, tipo, mes, año) {
    const supabase = getSupabase();
    const user = await getPresupuestoAuthUser();

    if (!user) return false;
    const { data, error } = await supabase
        .from('alertas_mostradas')
        .select('id')
        .eq('user_id', user.id)
        .eq('presupuesto_id', presupuestoId)
        .eq('tipo', tipo)
        .eq('mes', mes)
        .eq('año', año);
    
    if (error) return false;
    return data && data.length > 0;
}

// Guardar que se mostró una alerta
async function guardarAlertaMostrada(presupuestoId, tipo, mes, año) {
    const supabase = getSupabase();
    const user = await getPresupuestoAuthUser();

    if (!user) return false;
    await supabase
        .from('alertas_mostradas')
        .insert([{
            presupuesto_id: presupuestoId,
            tipo: tipo,
            mes: mes,
            año: año,
            user_id: user.id
        }]);
}

// Verificar alertas para un presupuesto específico
async function verificarAlertasPresupuestoUnico(presupuesto, gastado, mes, año) {
    const porcentaje = (gastado / presupuesto.limite) * 100;
    const alertasPendientes = [];
    
    if (porcentaje >= 75 && !(await alertaYaMostrada(presupuesto.id, '75', mes, año))) {
        alertasPendientes.push({ tipo: '75', mensaje: `📢 Atención: Has alcanzado el 75% del presupuesto de "${presupuesto.categoria}". (${porcentaje.toFixed(1)}%)` });
    }
    
    if (porcentaje >= 90 && !(await alertaYaMostrada(presupuesto.id, '90', mes, año))) {
        alertasPendientes.push({ tipo: '90', mensaje: `⚠️ Atención: Has alcanzado el 90% del presupuesto de "${presupuesto.categoria}". (${porcentaje.toFixed(1)}%)` });
    }
    
    if (porcentaje >= 100 && !(await alertaYaMostrada(presupuesto.id, '100', mes, año))) {
        alertasPendientes.push({ tipo: '100', mensaje: `🔴 ¡ALERTA! Has superado el presupuesto de "${presupuesto.categoria}". (${porcentaje.toFixed(1)}%)` });
    }
    
    return alertasPendientes;
}

// Mostrar alertas una por una
async function mostrarAlertasSecuencial(alertas) {
    for (const alerta of alertas) {
        await new Promise((resolve) => {
            showConfirmModal(
                alerta.mensaje,
                () => resolve(),
                '📊 Alerta de Presupuesto'
            );
        });
    }
}

// Verificar todas las alertas del mes actual
async function verificarTodasAlertas() {
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const añoActual = hoy.getFullYear();
    
    // Obtener presupuestos del mes actual
    const supabase = getSupabase();
    const user = await getPresupuestoAuthUser();

    if (!user) return;
    const { data: presupuestos, error } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mesActual)
        .eq('año', añoActual);
    
    if (error || !presupuestos || presupuestos.length === 0) return;
    
    // Obtener gastos del mes actual
    const gastos = await getGastosDelMes(añoActual, mesActual);
    
    const todasAlertas = [];
    
    for (const p of presupuestos) {
        const gastado = (gastos || [])
            .filter(g => g.categoria === p.categoria)
            .reduce(
                (sum, g) =>
                    sum + Number(
                        g.monto_eur ??
                        g.monto ??
                        0
                    ),
                0
            );
        const alertas = await verificarAlertasPresupuestoUnico(p, gastado, mesActual, añoActual);
        todasAlertas.push(...alertas);
        
        // Guardar alertas que se mostrarán
        for (const alerta of alertas) {
            await guardarAlertaMostrada(p.id, alerta.tipo, mesActual, añoActual);
        }
    }
    
    if (todasAlertas.length > 0) {
        await mostrarAlertasSecuencial(todasAlertas);
    }
}

// ============================================
// HISTORIAL DE PRESUPUESTOS
// ============================================

// Obtener el último mes con historial guardado
async function getUltimoMesHistorial() {
    const supabase = getSupabase();
    const user = await getPresupuestoAuthUser();

    if (!user) return null;
    const { data, error } = await supabase
        .from('historial_presupuestos')
        .select('año, mes')
        .eq('user_id', user.id)
        .order('año', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1);
    
    if (error || !data || data.length === 0) return null;
    return { año: data[0].año, mes: data[0].mes };
}

// Guardar o actualizar presupuestos de un mes cerrado en el historial
async function guardarMesEnHistorial(año, mes) {
    const supabase = getSupabase();
    const user = await getPresupuestoAuthUser();

    if (!user) {
        return false;
    }

    const añoNumerico = Number(año);
    const mesNumerico = Number(mes);

    if (
        !Number.isInteger(añoNumerico) ||
        !Number.isInteger(mesNumerico) ||
        mesNumerico < 1 ||
        mesNumerico > 12
    ) {
        console.error(
            'Periodo inválido para guardar en historial:',
            { año, mes }
        );

        return false;
    }

    // Obtener presupuestos pendientes del mes cerrado
    const {
        data: presupuestos,
        error: errorPresupuestos
    } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mesNumerico)
        .eq('año', añoNumerico);

    if (errorPresupuestos) {
        console.error(
            'Error al obtener los presupuestos del mes:',
            errorPresupuestos
        );

        return false;
    }

    if (!presupuestos || presupuestos.length === 0) {
        return false;
    }

    // Obtener los registros históricos ya existentes para ese mes
    const {
        data: historialExistente,
        error: errorHistorial
    } = await supabase
        .from('historial_presupuestos')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes', mesNumerico)
        .eq('año', añoNumerico);

    if (errorHistorial) {
        console.error(
            'Error al consultar el historial existente:',
            errorHistorial
        );

        return false;
    }

    const historialPorCategoria = new Map();

    (historialExistente || [])
        .filter((item) => item.categoria !== 'GENERAL')
        .forEach((item) => {
            historialPorCategoria.set(
                item.categoria,
                item
            );
        });

    const registroGeneralExistente =
        (historialExistente || []).find(
            (item) => item.categoria === 'GENERAL'
        ) || null;

    // Obtener los gastos del mes completo
    const gastos = await getGastosDelMes(
        añoNumerico,
        mesNumerico
    );

    let huboError = false;

    for (const presupuesto of presupuestos) {
        const limite =
            Number(presupuesto.limite) || 0;

        const gastado = (gastos || [])
            .filter(
                (gasto) =>
                    gasto.categoria ===
                    presupuesto.categoria
            )
            .reduce(
                (total, gasto) =>
                    total + Number(
                        gasto.monto_eur ??
                        gasto.monto ??
                        0
                    ),
                0
            );

        const porcentaje =
            limite > 0
                ? (gastado / limite) * 100
                : 0;

        const cumplido = porcentaje < 100;

        const datosHistorial = {
            categoria: presupuesto.categoria,
            mes: mesNumerico,
            año: añoNumerico,
            limite,
            gastado,
            porcentaje,
            color: cumplido ? 'verde' : 'rojo',
            user_id: user.id
        };

        const registroExistente =
            historialPorCategoria.get(
                presupuesto.categoria
            );

        let errorGuardar;

        if (registroExistente) {
            const { error } = await supabase
                .from('historial_presupuestos')
                .update(datosHistorial)
                .eq('id', registroExistente.id)
                .eq('user_id', user.id);

            errorGuardar = error;
        } else {
            const { error } = await supabase
                .from('historial_presupuestos')
                .insert([datosHistorial]);

            errorGuardar = error;
        }

        if (errorGuardar) {
            console.error(
                `Error al guardar la categoría "${presupuesto.categoria}" en el historial:`,
                errorGuardar
            );

            huboError = true;
            break;
        }
    }

    if (huboError) {
        return false;
    }

    /*
     * Volver a consultar todas las categorías históricas del mes,
     * incluyendo las que ya existían y las recién añadidas.
     */
    const {
        data: categoriasHistorial,
        error: errorCategoriasHistorial
    } = await supabase
        .from('historial_presupuestos')
        .select('id, categoria, porcentaje')
        .eq('user_id', user.id)
        .eq('mes', mesNumerico)
        .eq('año', añoNumerico)
        .neq('categoria', 'GENERAL');

    if (errorCategoriasHistorial) {
        console.error(
            'Error al recalcular el cumplimiento general:',
            errorCategoriasHistorial
        );

        return false;
    }

    const totalCategorias =
        categoriasHistorial?.length || 0;

    const categoriasCumplidas =
        (categoriasHistorial || []).filter(
            (item) =>
                Number(item.porcentaje) < 100
        ).length;

    const cumplimientoGeneral =
        totalCategorias > 0
            ? (
                categoriasCumplidas /
                totalCategorias
            ) * 100
            : 0;

    const datosGenerales = {
        categoria: 'GENERAL',
        mes: mesNumerico,
        año: añoNumerico,
        limite: 0,
        gastado: 0,
        porcentaje: cumplimientoGeneral,
        color:
            cumplimientoGeneral >= 100
                ? 'verde'
                : 'rojo',
        cumplimiento_general:
            cumplimientoGeneral,
        user_id: user.id
    };

    let errorGuardarGeneral;

    if (registroGeneralExistente) {
        const { error } = await supabase
            .from('historial_presupuestos')
            .update(datosGenerales)
            .eq('id', registroGeneralExistente.id)
            .eq('user_id', user.id);

        errorGuardarGeneral = error;
    } else {
        const { error } = await supabase
            .from('historial_presupuestos')
            .insert([datosGenerales]);

        errorGuardarGeneral = error;
    }

    if (errorGuardarGeneral) {
        console.error(
            'Error al guardar el cumplimiento general:',
            errorGuardarGeneral
        );

        return false;
    }

    /*
     * Eliminar los presupuestos pendientes únicamente después
     * de que todos hayan sido guardados correctamente.
     */
    const { error: errorEliminarPresupuestos } =
        await supabase
            .from('presupuestos')
            .delete()
            .eq('user_id', user.id)
            .eq('mes', mesNumerico)
            .eq('año', añoNumerico);

    if (errorEliminarPresupuestos) {
        console.error(
            'El historial se guardó, pero no se pudieron eliminar los presupuestos procesados:',
            errorEliminarPresupuestos
        );

        return false;
    }

    const { error: errorEliminarAlertas } =
        await supabase
            .from('alertas_mostradas')
            .delete()
            .eq('user_id', user.id)
            .eq('mes', mesNumerico)
            .eq('año', añoNumerico);

    if (errorEliminarAlertas) {
        console.warn(
            'No se pudieron eliminar algunas alertas antiguas:',
            errorEliminarAlertas
        );
    }

    return true;
}

// Verificar presupuestos de meses cerrados y pasarlos al historial
async function verificarNuevoMes() {
    const supabase = getSupabase();
    const user = await getPresupuestoAuthUser();

    if (!user) {
        return;
    }

    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const añoActual = hoy.getFullYear();

    const periodoActual = (añoActual * 100) + mesActual;

    const { data: presupuestos, error } = await supabase
        .from('presupuestos')
        .select('mes, año')
        .eq('user_id', user.id);

    if (error) {
        console.error(
            'Error al buscar presupuestos de meses anteriores:',
            error
        );

        return;
    }

    if (!presupuestos || presupuestos.length === 0) {
        return;
    }

    /*
     * Obtener los periodos anteriores al mes actual.
     * Se usa Set para evitar procesar varias veces un mismo mes.
     */
    const periodosCerrados = [
        ...new Map(
            presupuestos
                .filter((presupuesto) => {
                    const mes = Number(presupuesto.mes);
                    const año = Number(presupuesto.año);
                    const periodo = (año * 100) + mes;

                    return periodo < periodoActual;
                })
                .map((presupuesto) => {
                    const mes = Number(presupuesto.mes);
                    const año = Number(presupuesto.año);

                    return [
                        `${año}-${mes}`,
                        { año, mes }
                    ];
                })
        ).values()
    ];

    /*
     * Procesar primero los meses más antiguos.
     */
    periodosCerrados.sort((a, b) => {
        const periodoA = (a.año * 100) + a.mes;
        const periodoB = (b.año * 100) + b.mes;

        return periodoA - periodoB;
    });

    for (const periodo of periodosCerrados) {
        await guardarMesEnHistorial(
            periodo.año,
            periodo.mes
        );
    }
}

// Inicializar verificación de nuevo mes al cargar
async function initHistorialCheck() {
    await verificarNuevoMes();
}

console.log('✅ Módulo de presupuestos cargado');



