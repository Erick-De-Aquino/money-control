// ============================================
// HISTORIAL DE PRESUPUESTOS
// ============================================

let historialList = [];
let filtroHistorial = {
    mes: '',
    año: ''
};

// Cargar historial desde Supabase
async function cargarHistorial() {
    try {
        const supabase = getSupabase();
        let query = supabase.from('historial_presupuestos').select('*');
        
        if (filtroHistorial.mes) {
            query = query.eq('mes', parseInt(filtroHistorial.mes));
        }
        if (filtroHistorial.año) {
            query = query.eq('año', parseInt(filtroHistorial.año));
        }
        
        const { data, error } = await query.order('año', { ascending: false }).order('mes', { ascending: false });
        
        if (error) {
            console.error('Error al cargar historial:', error);
            showError('Error al cargar el historial');
            return [];
        }
        
        historialList = data || [];
        displayHistorial();
        return historialList;
        
    } catch (error) {
        console.error('Error en cargarHistorial:', error);
        return [];
    }
}

// Mostrar historial agrupado por mes
function displayHistorial() {
    const container = document.getElementById('historialList');
    if (!container) return;
    
    if (historialList.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay historial de presupuestos</p>';
        return;
    }
    
    // Agrupar por mes/año
    const grupos = {};
    historialList.forEach(item => {
        const key = `${item.año}-${item.mes}`;
        if (!grupos[key]) {
            grupos[key] = {
                año: item.año,
                mes: item.mes,
                items: [],
                cumplimientoGeneral: null
            };
        }
        if (item.categoria === 'GENERAL') {
            grupos[key].cumplimientoGeneral = item.porcentaje;
        } else {
            grupos[key].items.push(item);
        }
    });
    
    // Convertir a array ordenado
    const gruposArray = Object.values(grupos).sort((a, b) => {
        if (a.año !== b.año) return b.año - a.año;
        return b.mes - a.mes;
    });
    
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    container.innerHTML = gruposArray.map(grupo => `
        <div class="historial-mes">
            <div class="mes-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.5rem; background: var(--primary); border-radius: var(--border-radius-md);">
                <h3>📅 ${meses[grupo.mes - 1]} ${grupo.año}</h3>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span>Cumplimiento: ${grupo.cumplimientoGeneral ? grupo.cumplimientoGeneral.toFixed(1) : 0}%</span>
                    <div class="progress-bar-container" style="background: #e0e0e0; border-radius: 10px; height: 10px; width: 150px;">
                        <div class="progress-bar-fill" style="width: ${grupo.cumplimientoGeneral || 0}%; background-color: ${(grupo.cumplimientoGeneral || 0) >= 100 ? '#4CAF50' : (grupo.cumplimientoGeneral || 0) >= 75 ? '#FF9800' : '#f44336'}; height: 10px; border-radius: 10px;"></div>
                    </div>
                </div>
            </div>
            <div class="historial-items" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 2rem;">
                ${grupo.items.map(item => `
                    <div class="list-item-card" data-id="${item.id}" style="border-left: 4px solid ${item.color === 'verde' ? '#4CAF50' : '#f44336'};">
                        <div class="item-info" style="flex: 2;">
                            <div class="item-title">${item.categoria}</div>
                            <div class="item-subtitle">Límite: ${formatCurrency(item.limite, 'EUR')}</div>
                        </div>
                        <div class="item-info" style="flex: 2;">
                            <div class="item-subtitle">Gastado: ${formatCurrency(item.gastado, 'EUR')}</div>
                            <div class="item-subtitle">${item.porcentaje.toFixed(1)}%</div>
                        </div>
                        <div class="item-amount" style="color: ${item.color === 'verde' ? '#4CAF50' : '#f44336'}">
                            ${item.color === 'verde' ? '✅' : '⚠️'} ${item.porcentaje.toFixed(0)}%
                        </div>
                        <div class="item-actions">
                            <button class="btn-icon btn-small delete-historial" data-id="${item.id}" title="Eliminar">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    // Agregar event listeners para eliminar
    document.querySelectorAll('.delete-historial').forEach(btn => {
        btn.addEventListener('click', () => eliminarHistorialItem(parseInt(btn.dataset.id)));
    });
}

// Eliminar un item del historial
async function eliminarHistorialItem(id) {
    showConfirmModal(
        '¿Eliminar este registro del historial?',
        async () => {
            try {
                const supabase = getSupabase();
                const { error } = await supabase
                    .from('historial_presupuestos')
                    .delete()
                    .eq('id', id);
                
                if (error) {
                    console.error('Error al eliminar:', error);
                    showError('Error al eliminar el registro');
                    return;
                }
                
                showSuccess('Registro eliminado');
                await cargarHistorial();
            } catch (error) {
                console.error('Error:', error);
                showError('Error al eliminar');
            }
        },
        'Eliminar Registro'
    );
}

// Limpiar todo el historial
async function limpiarTodoHistorial() {
    showConfirmModal(
        '¿Eliminar TODO el historial de presupuestos? Esta acción no se puede deshacer.',
        async () => {
            try {
                const supabase = getSupabase();
                const { error } = await supabase
                    .from('historial_presupuestos')
                    .delete()
                    .neq('id', 0);
                
                if (error) {
                    console.error('Error al limpiar historial:', error);
                    showError('Error al limpiar el historial');
                    return;
                }
                
                showSuccess('Historial limpiado');
                await cargarHistorial();
            } catch (error) {
                console.error('Error:', error);
                showError('Error al limpiar el historial');
            }
        },
        'Limpiar Historial'
    );
}

// Inicializar select de años
function initHistorialAnoSelect() {
    const añoSelect = document.getElementById('filtroHistorialAno');
    if (!añoSelect) return;
    
    const añoActual = new Date().getFullYear();
    añoSelect.innerHTML = '<option value="">Todos</option>';
    for (let i = añoActual; i >= añoActual - 5; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        añoSelect.appendChild(option);
    }
}

// Aplicar filtros
async function aplicarFiltroHistorial() {
    filtroHistorial.mes = document.getElementById('filtroHistorialMes')?.value || '';
    filtroHistorial.año = document.getElementById('filtroHistorialAno')?.value || '';
    
    await cargarHistorial();
    showSuccess('Filtro aplicado');
}

function limpiarFiltroHistorial() {
    filtroHistorial = { mes: '', año: '' };
    const mesSelect = document.getElementById('filtroHistorialMes');
    const añoSelect = document.getElementById('filtroHistorialAno');
    
    if (mesSelect) mesSelect.value = '';
    if (añoSelect) añoSelect.value = '';
    
    cargarHistorial();
    showSuccess('Filtros limpiados');
}

// Inicializar eventos
function initHistorialEvents() {
    const btnLimpiarTodo = document.getElementById('btnLimpiarHistorial');
    if (btnLimpiarTodo) {
        btnLimpiarTodo.addEventListener('click', limpiarTodoHistorial);
    }
    
    const btnAplicar = document.getElementById('btnAplicarFiltroHistorial');
    const btnLimpiar = document.getElementById('btnLimpiarFiltroHistorial');
    
    if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltroHistorial);
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFiltroHistorial);
    
    initHistorialAnoSelect();
    cargarHistorial();
}

console.log('✅ Módulo de historial cargado');