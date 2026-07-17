// ============================================
// HISTORIAL DE PRESUPUESTOS
// ============================================

let historialList = [];
let filtroHistorial = {
    mes: '',
    año: ''
};

async function getHistorialAuthUser() {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('No se pudo obtener el usuario actual:', userError);
        showError?.('No hay una sesion activa');
        return null;
    }

    return user;
}

// Cargar historial desde Supabase
async function cargarHistorial() {
    try {
        const supabase = getSupabase();
        const container = document.getElementById('historialList');

        historialList = [];

        if (container) {
            container.innerHTML = '<p class="empty-message">Cargando historial...</p>';
        }

        const user = await getHistorialAuthUser();

        if (!user) return [];

        let query = supabase
            .from('historial_presupuestos')
            .select('*')
            .eq('user_id', user.id);
        
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

    if (!container) {
        return;
    }

    const userCurrency = getUserCurrency();

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    if (historialList.length === 0) {
        container.innerHTML =
            '<p class="empty-message">No hay historial de presupuestos</p>';

        return;
    }

    const grupos = {};

    historialList.forEach((item) => {
        const año = Number(item.año) || '';
        const mes = Number(item.mes) || '';
        const key = `${año}-${mes}`;

        if (!grupos[key]) {
            grupos[key] = {
                año,
                mes,
                items: [],
                cumplimientoGeneral: null
            };
        }

        if (item.categoria === 'GENERAL') {
            grupos[key].cumplimientoGeneral =
                Number(item.porcentaje) || 0;
        } else {
            grupos[key].items.push(item);
        }
    });

    const gruposArray = Object.values(grupos).sort((a, b) => {
        if (a.año !== b.año) {
            return b.año - a.año;
        }

        return b.mes - a.mes;
    });

    const meses = [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre'
    ];

    container.innerHTML = gruposArray.map((grupo) => {
        const mesNombre = escapeHTML(
            meses[grupo.mes - 1] || 'Mes no válido'
        );

        const año = escapeHTML(grupo.año);

        const cumplimiento =
            Number(grupo.cumplimientoGeneral) || 0;

        const cumplimientoSeguro = Math.min(
            Math.max(cumplimiento, 0),
            100
        );

        const cumplimientoTexto = escapeHTML(
            cumplimiento.toFixed(1)
        );

        const colorCumplimiento =
            cumplimiento >= 100
                ? '#4CAF50'
                : cumplimiento >= 75
                    ? '#FF9800'
                    : '#f44336';

        return `
            <div class="historial-mes">
                <div
                    class="mes-header"
                    style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 1rem;
                        padding: 0.5rem;
                        background: var(--primary);
                        border-radius: var(--border-radius-md);
                    "
                >
                    <h3>📅 ${mesNombre} ${año}</h3>

                    <div
                        style="
                            display: flex;
                            align-items: center;
                            gap: 1rem;
                        "
                    >
                        <span>
                            Cumplimiento: ${cumplimientoTexto}%
                        </span>

                        <div
                            class="progress-bar-container"
                            style="
                                background: #e0e0e0;
                                border-radius: 10px;
                                height: 10px;
                                width: 150px;
                            "
                        >
                            <div
                                class="progress-bar-fill"
                                style="
                                    width: ${cumplimientoSeguro}%;
                                    background-color: ${colorCumplimiento};
                                    height: 10px;
                                    border-radius: 10px;
                                "
                            ></div>
                        </div>
                    </div>
                </div>

                <div
                    class="historial-items"
                    style="
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                        margin-bottom: 2rem;
                    "
                >
                    ${grupo.items.map((item) => {
                        const id = Number(item.id);

                        const categoria = escapeHTML(
                            item.categoria || 'Sin categoría'
                        );

                        const limite = escapeHTML(
                            formatCurrency(
                                Number(item.limite) || 0,
                                userCurrency
                            )
                        );

                        const gastado = escapeHTML(
                            formatCurrency(
                                Number(item.gastado) || 0,
                                userCurrency
                            )
                        );

                        const porcentaje =
                            Number(item.porcentaje) || 0;

                        const porcentajeDecimal = escapeHTML(
                            porcentaje.toFixed(1)
                        );

                        const porcentajeEntero = escapeHTML(
                            porcentaje.toFixed(0)
                        );

                        const esVerde =
                            item.color === 'verde';

                        const color = esVerde
                            ? '#4CAF50'
                            : '#f44336';

                        const icono = esVerde
                            ? '✅'
                            : '⚠️';

                        return `
                            <div
                                class="list-item-card"
                                data-id="${id}"
                                style="border-left: 4px solid ${color};"
                            >
                                <div
                                    class="item-info"
                                    style="flex: 2;"
                                >
                                    <div class="item-title">
                                        ${categoria}
                                    </div>

                                    <div class="item-subtitle">
                                        Límite: ${limite}
                                    </div>
                                </div>

                                <div
                                    class="item-info"
                                    style="flex: 2;"
                                >
                                    <div class="item-subtitle">
                                        Gastado: ${gastado}
                                    </div>

                                    <div class="item-subtitle">
                                        ${porcentajeDecimal}%
                                    </div>
                                </div>

                                <div
                                    class="item-amount"
                                    style="color: ${color};"
                                >
                                    ${icono} ${porcentajeEntero}%
                                </div>

                                <div class="item-actions">
                                    <button
                                        class="btn-icon btn-small delete-historial"
                                        data-id="${id}"
                                        title="Eliminar"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    document
        .querySelectorAll('.delete-historial')
        .forEach((btn) => {
            btn.addEventListener('click', () => {
                eliminarHistorialItem(
                    Number(btn.dataset.id)
                );
            });
        });
}

// Eliminar un item del historial
async function eliminarHistorialItem(id) {
    showConfirmModal(
        '¿Eliminar este registro del historial?',
        async () => {
            try {
                const supabase = getSupabase();
                const user = await getHistorialAuthUser();

                if (!user) return;

                const { error } = await supabase
                    .from('historial_presupuestos')
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);
                
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
                const user = await getHistorialAuthUser();

                if (!user) return;

                const { error } = await supabase
                    .from('historial_presupuestos')
                    .delete()
                    .eq('user_id', user.id);
                
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
    if (!window.__historialEventsInitialized) {
        const btnLimpiarTodo = document.getElementById('btnLimpiarHistorial');
        const btnAplicar = document.getElementById('btnAplicarFiltroHistorial');
        const btnLimpiar = document.getElementById('btnLimpiarFiltroHistorial');

        if (btnLimpiarTodo) {
            btnLimpiarTodo.addEventListener('click', limpiarTodoHistorial);
        }

        if (btnAplicar) {
            btnAplicar.addEventListener('click', aplicarFiltroHistorial);
        }

        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', limpiarFiltroHistorial);
        }

        window.__historialEventsInitialized = true;
    }

    // 🔥 IMPORTANTE: asegurar orden correcto
    initHistorialAnoSelect();
    cargarHistorial();
}

console.log('✅ Módulo de historial cargado');
