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

// Cargar presupuestos desde Supabase
async function loadPresupuestos() {
    try {
        const supabase = getSupabase();
        let query = supabase.from('presupuestos').select('*');
        
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
    
    if (presupuestosList.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay presupuestos para este período</p>';
        return;
    }
    
    const gastos = await getGastosDelMes(filtroPresupuesto.año, filtroPresupuesto.mes);
    
    container.innerHTML = presupuestosList.map(p => {
        const gastado = gastos.filter(g => g.categoria === p.categoria).reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
        const porcentaje = (gastado / p.limite) * 100;
        
        return `
            <div class="list-item-card" data-id="${p.id}">
                <div class="item-info" style="flex: 2;">
                    <div class="item-title">${p.categoria}</div>
                    <div class="item-subtitle">${p.mes}/${p.año}</div>
                </div>
                <div class="item-info" style="flex: 3;">
                    <div class="progress-bar-container" style="background: #e0e0e0; border-radius: 10px; height: 20px; width: 100%;">
                        <div class="progress-bar-fill" style="width: ${Math.min(porcentaje, 100)}%; background-color: ${porcentaje >= 90 ? '#f44336' : (porcentaje >= 75 ? '#FF9800' : '#4CAF50')}; height: 20px; border-radius: 10px; transition: width 0.3s;"></div>
                    </div>
                    <div class="item-subtitle" style="margin-top: 5px;">
                        Gastado: ${formatCurrency(gastado, 'EUR')} / ${formatCurrency(p.limite, 'EUR')} (${porcentaje.toFixed(1)}%)
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon btn-small edit-presupuesto" data-id="${p.id}" title="Editar">✏️</button>
                    <button class="btn-icon btn-small delete-presupuesto" data-id="${p.id}" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.edit-presupuesto').forEach(btn => {
        btn.addEventListener('click', () => editPresupuesto(parseInt(btn.dataset.id)));
    });
    
    document.querySelectorAll('.delete-presupuesto').forEach(btn => {
        btn.addEventListener('click', () => deletePresupuesto(parseInt(btn.dataset.id)));
    });
}

// Obtener gastos del mes específico
async function getGastosDelMes(año, mes) {
    try {
        const supabase = getSupabase();
        const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`;
        const fechaFin = `${año}-${String(mes).padStart(2, '0')}-${new Date(año, mes, 0).getDate()}`;
        
        const { data, error } = await supabase
            .from(TABLES.gastos)
            .select('*')
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin);
        
        if (error) {
            console.error('Error al cargar gastos del mes:', error);
            return [];
        }
        
        return data || [];
    } catch (error) {
        console.error('Error en getGastosDelMes:', error);
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
    
    modalTitle.textContent = presupuesto ? '✏️ Editar Presupuesto' : '➕ Nuevo Presupuesto';
    
    const categorias = await loadGastosCategorias();
    const categoriasOptions = categorias.map(cat => 
        `<option value="${cat.nombre}" ${presupuesto && presupuesto.categoria === cat.nombre ? 'selected' : ''}>${cat.nombre}</option>`
    ).join('');
    
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
                        <option value="1" ${presupuesto && presupuesto.mes === 1 ? 'selected' : ''}>Enero</option>
                        <option value="2" ${presupuesto && presupuesto.mes === 2 ? 'selected' : ''}>Febrero</option>
                        <option value="3" ${presupuesto && presupuesto.mes === 3 ? 'selected' : ''}>Marzo</option>
                        <option value="4" ${presupuesto && presupuesto.mes === 4 ? 'selected' : ''}>Abril</option>
                        <option value="5" ${presupuesto && presupuesto.mes === 5 ? 'selected' : ''}>Mayo</option>
                        <option value="6" ${presupuesto && presupuesto.mes === 6 ? 'selected' : ''}>Junio</option>
                        <option value="7" ${presupuesto && presupuesto.mes === 7 ? 'selected' : ''}>Julio</option>
                        <option value="8" ${presupuesto && presupuesto.mes === 8 ? 'selected' : ''}>Agosto</option>
                        <option value="9" ${presupuesto && presupuesto.mes === 9 ? 'selected' : ''}>Septiembre</option>
                        <option value="10" ${presupuesto && presupuesto.mes === 10 ? 'selected' : ''}>Octubre</option>
                        <option value="11" ${presupuesto && presupuesto.mes === 11 ? 'selected' : ''}>Noviembre</option>
                        <option value="12" ${presupuesto && presupuesto.mes === 12 ? 'selected' : ''}>Diciembre</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="presupuestoAño">Año *</label>
                    <input type="number" id="presupuestoAño" value="${presupuesto ? presupuesto.año : new Date().getFullYear()}" required>
                </div>
            </div>
            
            <div class="form-group">
                <label for="presupuestoLimite">Límite (EUR) *</label>
                <input type="number" id="presupuestoLimite" step="0.01" value="${presupuesto ? presupuesto.limite : ''}" required>
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
    
    const categoria = document.getElementById('presupuestoCategoria')?.value;
    const mes = parseInt(document.getElementById('presupuestoMes')?.value);
    const año = parseInt(document.getElementById('presupuestoAño')?.value);
    const limite = parseFloat(document.getElementById('presupuestoLimite')?.value);
    
    if (!categoria || !mes || !año || !limite) {
        showError('Por favor completa todos los campos');
        return;
    }
    
    if (limite <= 0) {
        showError('El límite debe ser mayor a 0');
        return;
    }
    
    const presupuestoData = {
        categoria,
        mes,
        año,
        limite,
        user_id: getCurrentUser()?.id
    };
    
    try {
        const supabase = getSupabase();
        let result;
        
        if (editingPresupuestoId) {
            result = await supabase
                .from('presupuestos')
                .update(presupuestoData)
                .eq('id', editingPresupuestoId);
        } else {
            result = await supabase
                .from('presupuestos')
                .insert([presupuestoData]);
        }
        
        if (result.error) {
            console.error('Error al guardar presupuesto:', result.error);
            showError('Error al guardar el presupuesto');
            return;
        }
        
        showSuccess(editingPresupuestoId ? 'Presupuesto actualizado' : 'Presupuesto guardado');
        closeModal();
        await loadPresupuestos();
        
    } catch (error) {
        console.error('Error en savePresupuesto:', error);
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
    
    showConfirmModal(
        `¿Eliminar presupuesto de ${presupuesto.categoria} para ${presupuesto.mes}/${presupuesto.año}?`,
        async () => {
            try {
                const supabase = getSupabase();
                
                const { error } = await supabase
                    .from('presupuestos')
                    .delete()
                    .eq('id', id);
                
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
    
    const btnAdd = document.getElementById('btnAddPresupuesto');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => showPresupuestoModal());
    }
    
    const btnAplicar = document.getElementById('btnAplicarFiltroPresupuesto');
    const btnLimpiar = document.getElementById('btnLimpiarFiltroPresupuesto');
    
    if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltroPresupuestos);
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFiltroPresupuestos);
    
    initAnoSelect();
    loadPresupuestos();
}

// ============================================
// ALERTAS DE PRESUPUESTO (75%, 90%, 100%)
// ============================================

// Verificar si ya se mostró una alerta
async function alertaYaMostrada(presupuestoId, tipo, mes, año) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('alertas_mostradas')
        .select('id')
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
    await supabase
        .from('alertas_mostradas')
        .insert([{
            presupuesto_id: presupuestoId,
            tipo: tipo,
            mes: mes,
            año: año,
            user_id: getCurrentUser()?.id
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
    const { data: presupuestos, error } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('mes', mesActual)
        .eq('año', añoActual);
    
    if (error || !presupuestos || presupuestos.length === 0) return;
    
    // Obtener gastos del mes actual
    const gastos = await getGastosDelMes(añoActual, mesActual);
    
    const todasAlertas = [];
    
    for (const p of presupuestos) {
        const gastado = (gastos || []).filter(g => g.categoria === p.categoria).reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
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
    const { data, error } = await supabase
        .from('historial_presupuestos')
        .select('año, mes')
        .eq('user_id', getCurrentUser()?.id)
        .order('año', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1);
    
    if (error || !data || data.length === 0) return null;
    return { año: data[0].año, mes: data[0].mes };
}

// Guardar presupuestos del mes en el historial
async function guardarMesEnHistorial(año, mes) {
    const supabase = getSupabase();
    
    // Obtener presupuestos del mes
    const { data: presupuestos, error: errorPres } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('mes', mes)
        .eq('año', año);
    
    if (errorPres || !presupuestos || presupuestos.length === 0) return;
    
    // Obtener gastos del mes
    const gastos = await getGastosDelMes(año, mes);
    
    let presupuestosCumplidos = 0;
    
    for (const p of presupuestos) {
        const gastado = (gastos || []).filter(g => g.categoria === p.categoria).reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
        const porcentaje = (gastado / p.limite) * 100;
        const color = porcentaje >= 100 ? 'rojo' : 'verde';
        
        if (porcentaje < 100) presupuestosCumplidos++;
        
        // Guardar en historial
        await supabase
            .from('historial_presupuestos')
            .insert([{
                categoria: p.categoria,
                mes: mes,
                año: año,
                limite: p.limite,
                gastado: gastado,
                porcentaje: porcentaje,
                color: color,
                user_id: getCurrentUser()?.id
            }]);
    }
    
    // Calcular y guardar cumplimiento general
    const cumplimientoGeneral = (presupuestosCumplidos / presupuestos.length) * 100;
    
    await supabase
        .from('historial_presupuestos')
        .insert([{
            categoria: 'GENERAL',
            mes: mes,
            año: año,
            limite: 0,
            gastado: 0,
            porcentaje: cumplimientoGeneral,
            color: cumplimientoGeneral >= 100 ? 'verde' : 'rojo',
            cumplimiento_general: cumplimientoGeneral,
            user_id: getCurrentUser()?.id
        }]);
    
    // Eliminar presupuestos del mes anterior
    await supabase
        .from('presupuestos')
        .delete()
        .eq('mes', mes)
        .eq('año', año);
    
    // Eliminar alertas del mes anterior
    await supabase
        .from('alertas_mostradas')
        .delete()
        .eq('mes', mes)
        .eq('año', año);
    
    console.log(`✅ Historial guardado para ${mes}/${año}`);
}

// Verificar si es un nuevo mes y pasar al historial
async function verificarNuevoMes() {
    const supabase = getSupabase();
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const añoActual = hoy.getFullYear();
    
    // Verificar si ya hay presupuestos para el mes actual
    const { data: presupuestosActuales, error } = await supabase
        .from('presupuestos')
        .select('id')
        .eq('mes', mesActual)
        .eq('año', añoActual)
        .limit(1);
    
    // Si ya hay presupuestos para el mes actual, no hacer nada
    if (presupuestosActuales && presupuestosActuales.length > 0) return;
    
    // Buscar presupuestos del mes anterior
    let mesAnterior = mesActual - 1;
    let añoAnterior = añoActual;
    if (mesAnterior === 0) {
        mesAnterior = 12;
        añoAnterior--;
    }
    
    const { data: presupuestosAnteriores } = await supabase
        .from('presupuestos')
        .select('id')
        .eq('mes', mesAnterior)
        .eq('año', añoAnterior)
        .limit(1);
    
    if (presupuestosAnteriores && presupuestosAnteriores.length > 0) {
        await guardarMesEnHistorial(añoAnterior, mesAnterior);
    }
}

// Inicializar verificación de nuevo mes al cargar
async function initHistorialCheck() {
    await verificarNuevoMes();
}

console.log('✅ Módulo de presupuestos cargado');