// ============================================
// GASTOS - CRUD de gastos
// ============================================

// Variables globales
let categoriasGastos = [];
let gastosList = [];
let intervaloParpadeoGastos = null;
let editingGastoId = null;
let filtroGastos = {
    desde: '',
    hasta: '',
    categoria: []
};

async function getGastosAuthUser() {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('No se pudo obtener el usuario actual:', userError);
        showError?.('No hay una sesion activa');
        return null;
    }

    return user;
}

// Cargar gastos desde Supabase
async function loadGastos() {
    try {
        const supabase = getSupabase();
        const container = document.getElementById('gastosList');
        const totalElement = document.getElementById('totalGastosFiltrados');
        const userCurrency = getUserCurrency();

        gastosList = [];

        if (container) {
            container.innerHTML =
                '<p class="empty-message">Cargando gastos...</p>';
        }

        if (totalElement) {
            totalElement.textContent = formatCurrency(0, userCurrency);
        }

        const user = await getGastosAuthUser();
        const userId = user?.id;

        if (!userId || userId === 'undefined') {
            console.error('No user ID en gastos');
            return [];
        }

        let query = supabase
            .from(TABLES.gastos)
            .select('*')
            .eq('user_id', userId);

        if (filtroGastos.desde) {
            query = query.gte('fecha', filtroGastos.desde);
        }

        if (filtroGastos.hasta) {
            query = query.lte('fecha', filtroGastos.hasta);
        }

        const { data, error } = await query.order(
            'fecha',
            { ascending: false }
        );

        if (error) {
            console.error('Error al cargar gastos:', error);
            showError?.('Error al cargar los gastos');
            return [];
        }

        gastosList = data || [];

        if (
            Array.isArray(filtroGastos.categoria) &&
            filtroGastos.categoria.length > 0
        ) {
            gastosList = gastosList.filter((gasto) =>
                filtroGastos.categoria.includes(gasto.categoria)
            );
        }

        displayGastos?.();

        const hayFiltros =
            filtroGastos.desde ||
            filtroGastos.hasta ||
            (
                Array.isArray(filtroGastos.categoria) &&
                filtroGastos.categoria.length > 0
            );

        if (totalElement) {
            if (hayFiltros) {
                const total = gastosList.reduce(
                    (sum, gasto) =>
                        sum + Number(
                            gasto.monto_eur ??
                            gasto.monto ??
                            0
                        ),
                    0
                );

                totalElement.textContent = formatCurrency(
                    total,
                    userCurrency
                );
            } else {
                totalElement.textContent = formatCurrency(
                    0,
                    userCurrency
                );
            }
        }

        return gastosList;

    } catch (error) {
        console.error('Error en loadGastos:', error);
        return [];
    }
}

// Cargar categorías de gastos desde caché central
async function getGastosCategoriasCached(forceReload = false) {
    const categorias = await getCategoriasCache('gastos', forceReload);
    window.categoriasGastos = categorias;
    return categorias;
}

// Mostrar gastos en UI
function displayGastos() {
    const container = document.getElementById('gastosList');

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

    if (gastosList.length === 0) {
        container.innerHTML =
            '<p class="empty-message">No hay gastos registrados</p>';

        return;
    }

    container.innerHTML = gastosList.map((gasto) => {
        const id = Number(gasto.id);
        const categoria = escapeHTML(
            gasto.categoria || 'Sin categoría'
        );
        const descripcion = escapeHTML(
            gasto.descripcion || 'Sin descripción'
        );
        const fecha = escapeHTML(formatDate(gasto.fecha));
        const monto = escapeHTML(
            formatCurrency(gasto.monto, userCurrency)
        );

        return `
            <div class="list-item-card" data-id="${id}">
                <div class="item-info">
                    <div class="item-title">${categoria}</div>

                    <div class="item-subtitle">
                        ${fecha} • ${descripcion}
                    </div>
                </div>

                <div class="item-amount negative">
                    ${monto}
                </div>

                <div class="item-actions">
                    <button
                        class="btn-icon btn-small edit-gasto"
                        data-id="${id}"
                        title="Editar">
                        ✏️
                    </button>

                    <button
                        class="btn-icon btn-small delete-gasto"
                        data-id="${id}"
                        title="Eliminar">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.edit-gasto').forEach((btn) => {
        btn.addEventListener('click', () => {
            editGasto(Number(btn.dataset.id));
        });
    });

    document.querySelectorAll('.delete-gasto').forEach((btn) => {
        btn.addEventListener('click', () => {
            deleteGasto(Number(btn.dataset.id));
        });
    });
}

// Mostrar modal para agregar/editar gasto
async function showGastoModal(gasto = null) {
    editingGastoId = gasto ? gasto.id : null;

    const categorias = await getCategoriasCache('gastos');

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('#modal .modal-body');

    if (!modal || !modalTitle || !modalBody) {
        return;
    }

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const escapeAttr = escapeHTML;

    modalTitle.textContent = gasto
        ? '✏️ Editar Gasto'
        : '➕ Nuevo Gasto';

    const fecha = escapeAttr(
        gasto ? gasto.fecha : getTodayDate()
    );

    const monto = escapeAttr(
        gasto ? gasto.monto : ''
    );

    const descripcion = escapeHTML(
        gasto ? gasto.descripcion || '' : ''
    );

    const categoriaActual = gasto?.categoria || '';

    const userCurrency = getUserCurrency();

    const categoriasOptions = categorias.length > 0
        ? categorias.map((categoria) => {
            const nombre = categoria.nombre || '';
            const selected =
                categoriaActual === nombre
                    ? 'selected'
                    : '';

            return `
                <option
                    value="${escapeAttr(nombre)}"
                    ${selected}>
                    ${escapeHTML(nombre)}
                </option>
            `;
        }).join('')
        : `
            <option value="">
                No hay categorías. Crea una primero.
            </option>
        `;

    modalBody.innerHTML = `
        <form id="gastoForm">
            <div class="form-group">
                <label for="gastoFecha">Fecha *</label>

                <input
                    type="date"
                    id="gastoFecha"
                    name="fecha"
                    value="${fecha}"
                    required>
            </div>

            <div class="form-group">
                <label for="gastoCategoria">Categoría *</label>

                <select
                    id="gastoCategoria"
                    name="categoria"
                    required>
                    <option value="">
                        Seleccionar categoría
                    </option>

                    ${categoriasOptions}
                </select>

                <button
                    type="button"
                    id="btnNuevaCategoriaGasto"
                    class="btn btn-text btn-small"
                    style="margin-top: 5px;">
                    + Crear nueva categoría
                </button>
            </div>

            <div class="form-group">
                <label for="gastoMonto">
                    Monto (${escapeHTML(userCurrency)}) *
                </label>

                <input
                    type="number"
                    id="gastoMonto"
                    name="monto"
                    step="0.01"
                    min="0.01"
                    value="${monto}"
                    required>
            </div>

            <div class="form-group">
                <label for="gastoDescripcion">
                    Descripción
                </label>

                <textarea
                    id="gastoDescripcion"
                    name="descripcion"
                    rows="2"
                    placeholder="Opcional">${descripcion}</textarea>
            </div>

            <div class="form-actions">
                <button
                    type="button"
                    class="btn btn-secondary"
                    id="cancelGastoBtn">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="btn btn-primary">
                    ${gasto ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </form>
    `;

    modal.classList.add('active');

    document
        .getElementById('gastoForm')
        ?.addEventListener('submit', saveGasto);

    document
        .getElementById('cancelGastoBtn')
        ?.addEventListener('click', closeModal);

    const btnNuevaCategoria = document.getElementById(
        'btnNuevaCategoriaGasto'
    );

    if (btnNuevaCategoria) {
        btnNuevaCategoria.onclick = () => {
            closeModal();

            setTimeout(() => {
                showAddCategoriaModal(
                    'gasto',
                    'movimiento'
                );
            }, 100);
        };
    }
}

// Comprobar si una fecha pertenece a un mes ya cerrado
function isGastoPeriodoCerrado(fecha) {
    if (!fecha) {
        return false;
    }

    const [año, mes] = String(fecha)
        .split('-')
        .map(Number);

    if (
        !Number.isInteger(año) ||
        !Number.isInteger(mes)
    ) {
        return false;
    }

    const hoy = new Date();

    const periodoFecha = (año * 100) + mes;
    const periodoActual =
        (hoy.getFullYear() * 100) +
        (hoy.getMonth() + 1);

    return periodoFecha < periodoActual;
}

// Recalcular el historial de presupuestos de un mes cerrado
async function sincronizarHistorialGastosPeriodo(
    fecha,
    userId
) {
    if (
        !fecha ||
        !userId ||
        !isGastoPeriodoCerrado(fecha)
    ) {
        return true;
    }

    const [año, mes] = String(fecha)
        .split('-')
        .map(Number);

    const supabase = getSupabase();

    const {
        data: historialMes,
        error: historialError
    } = await supabase
        .from('historial_presupuestos')
        .select(
            'id, categoria, limite, porcentaje'
        )
        .eq('user_id', userId)
        .eq('año', año)
        .eq('mes', mes);

    if (historialError) {
        console.error(
            'Error consultando el historial del mes:',
            historialError
        );

        return false;
    }

    /*
     * Si el mes todavía no tiene historial, no hay nada
     * que actualizar.
     */
    if (
        !historialMes ||
        historialMes.length === 0
    ) {
        return true;
    }

    const fechaInicio =
        `${año}-${String(mes).padStart(2, '0')}-01`;

    const mesSiguiente =
        mes === 12
            ? 1
            : mes + 1;

    const añoSiguiente =
        mes === 12
            ? año + 1
            : año;

    const fechaMesSiguiente =
        `${añoSiguiente}-${String(mesSiguiente)
            .padStart(2, '0')}-01`;

    const {
        data: gastosMes,
        error: gastosError
    } = await supabase
        .from(TABLES.gastos)
        .select(
            'categoria, monto, monto_eur'
        )
        .eq('user_id', userId)
        .gte('fecha', fechaInicio)
        .lt('fecha', fechaMesSiguiente);

    if (gastosError) {
        console.error(
            'Error consultando gastos retroactivos:',
            gastosError
        );

        return false;
    }

    const categoriasHistorial =
        historialMes.filter(
            (item) =>
                item.categoria !== 'GENERAL'
        );

    for (const item of categoriasHistorial) {
        const limite =
            Number(item.limite) || 0;

        const gastado = (gastosMes || [])
            .filter(
                (gasto) =>
                    gasto.categoria ===
                    item.categoria
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

        const color =
            porcentaje >= 100
                ? 'rojo'
                : 'verde';

        const { error: updateError } =
            await supabase
                .from('historial_presupuestos')
                .update({
                    gastado,
                    porcentaje,
                    color
                })
                .eq('id', item.id)
                .eq('user_id', userId);

        if (updateError) {
            console.error(
                `Error actualizando historial de "${item.categoria}":`,
                updateError
            );

            return false;
        }
    }

    const categoriasCumplidas =
        categoriasHistorial.filter(
            (item) => {
                const limite =
                    Number(item.limite) || 0;

                const gastado = (gastosMes || [])
                    .filter(
                        (gasto) =>
                            gasto.categoria ===
                            item.categoria
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

                return porcentaje < 100;
            }
        ).length;

    const cumplimientoGeneral =
        categoriasHistorial.length > 0
            ? (
                categoriasCumplidas /
                categoriasHistorial.length
            ) * 100
            : 0;

    const registroGeneral =
        historialMes.find(
            (item) =>
                item.categoria === 'GENERAL'
        );

    if (registroGeneral) {
        const { error: generalError } =
            await supabase
                .from('historial_presupuestos')
                .update({
                    porcentaje:
                        cumplimientoGeneral,
                    cumplimiento_general:
                        cumplimientoGeneral,
                    color:
                        cumplimientoGeneral >= 100
                            ? 'verde'
                            : 'rojo'
                })
                .eq('id', registroGeneral.id)
                .eq('user_id', userId);

        if (generalError) {
            console.error(
                'Error actualizando el cumplimiento general:',
                generalError
            );

            return false;
        }
    }

    return true;
}

// Guardar gasto
async function saveGasto(event) {
    event.preventDefault();

    const fecha = document.getElementById(
        'gastoFecha'
    )?.value;

    const categoria = document.getElementById(
        'gastoCategoria'
    )?.value;

    const monto = Number(
        document.getElementById('gastoMonto')?.value
    );

    const moneda = getUserCurrency();

    const descripcion = document.getElementById(
        'gastoDescripcion'
    )?.value;

    if (!fecha || !categoria || !monto || !moneda) {
        showError(
            'Por favor completa todos los campos obligatorios'
        );

        return;
    }

    if (monto <= 0) {
        showError('El monto debe ser mayor a 0');
        return;
    }

    const categoriaExiste = categoriasGastos.some(
        (categoriaItem) =>
            categoriaItem.nombre === categoria
    );

    if (
        !categoriaExiste &&
        categoriasGastos.length > 0
    ) {
        showError(
            'La categoría seleccionada no existe'
        );

        return;
    }

    const user = await getGastosAuthUser();

    if (!user) {
        return;
    }

    /*
     * Guardar el periodo anterior antes de editar,
     * porque la fecha o la categoría podrían cambiar.
     */
    const gastoAnterior = editingGastoId
        ? gastosList.find(
            (gasto) =>
                Number(gasto.id) ===
                Number(editingGastoId)
        )
        : null;

    const gastoData = {
        fecha,
        categoria,
        monto,
        moneda,
        monto_eur: monto,
        descripcion: descripcion || null,
        user_id: user.id
    };

    try {
        const supabase = getSupabase();
        let result;

        if (editingGastoId) {
            result = await supabase
                .from(TABLES.gastos)
                .update(gastoData)
                .eq('id', editingGastoId)
                .eq('user_id', user.id);
        } else {
            result = await supabase
                .from(TABLES.gastos)
                .insert([gastoData]);
        }

        if (result.error) {
            console.error(
                'Error al guardar gasto:',
                result.error
            );

            showError('Error al guardar el gasto');
            return;
        }

        /*
         * Recalcular los meses afectados.
         * Set evita recalcular dos veces el mismo periodo.
         */
        const fechasAfectadas = new Set();

        if (gastoAnterior?.fecha) {
            fechasAfectadas.add(
                gastoAnterior.fecha
            );
        }

        fechasAfectadas.add(fecha);

        let historialSincronizado = true;

        for (
            const fechaAfectada
            of fechasAfectadas
        ) {
            const sincronizado =
                await sincronizarHistorialGastosPeriodo(
                    fechaAfectada,
                    user.id
                );

            if (!sincronizado) {
                historialSincronizado = false;
            }
        }

        closeModal();

        showSuccess(
            editingGastoId
                ? 'Gasto actualizado'
                : 'Gasto guardado'
        );

        if (!historialSincronizado) {
            showError(
                'El gasto se guardó, pero no se pudo actualizar completamente el historial'
            );
        }

        await loadGastos();
        await loadDashboardData();

    } catch (error) {
        console.error(
            'Error en saveGasto:',
            error
        );

        showError('Error al guardar el gasto');
    }
}

// Editar gasto
async function editGasto(id) {
    const gasto = gastosList.find(g => g.id === id);
    if (gasto) {
        await showGastoModal(gasto);
    }
}

// Eliminar gasto
async function deleteGasto(id) {
    const gasto = gastosList.find(
        (item) =>
            Number(item.id) === Number(id)
    );

    if (!gasto) {
        showError(
            'No se pudo identificar el gasto'
        );

        return;
    }

    showConfirmModal(
        `¿Eliminar gasto de ${formatCurrency(
            gasto.monto,
            getUserCurrency()
        )}?`,

        async () => {
            try {
                const supabase = getSupabase();
                const user =
                    await getGastosAuthUser();

                if (!user) {
                    return;
                }

                const { error } = await supabase
                    .from(TABLES.gastos)
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);

                if (error) {
                    console.error(
                        'Error al eliminar gasto:',
                        error
                    );

                    showError(
                        'Error al eliminar el gasto'
                    );

                    return;
                }

                const historialSincronizado =
                    await sincronizarHistorialGastosPeriodo(
                        gasto.fecha,
                        user.id
                    );

                showSuccess('Gasto eliminado');

                if (!historialSincronizado) {
                    showError(
                        'El gasto se eliminó, pero no se pudo actualizar completamente el historial'
                    );
                }

                await loadGastos();
                await loadDashboardData();

            } catch (error) {
                console.error(
                    'Error en deleteGasto:',
                    error
                );

                showError(
                    'Error al eliminar el gasto'
                );
            }
        },

        'Eliminar Gasto'
    );
}

// Cargar categorías que tienen gastos
async function loadCategoriasGastosConDatos() {
    try {
        const supabase = getSupabase();
        const user = await getGastosAuthUser();

        if (!user) return [];

        const { data, error } = await supabase
            .from('gastos')
            .select('categoria')
            .eq('user_id', user.id)
            .not('categoria', 'is', null);
        
        if (error) throw error;
        
        const categoriasUnicas = [...new Set(data.map(g => g.categoria).filter(c => c))];
        return categoriasUnicas.sort();
    } catch (error) {
        console.error('Error cargando categorías con datos:', error);
        return [];
    }
}

async function actualizarSelectCategoriasGastos() {
    const categorias = await loadCategoriasGastosConDatos();
    const select = document.getElementById('filtroGastosCategoria');

    if (!select) return;

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    select.innerHTML =
        '<option value="">Todas las categorías</option>' +
        categorias.map(cat => {
            const nombre = escapeHTML(cat);

            return `<option value="${nombre}">${nombre}</option>`;
        }).join('');
}

// Inicializar eventos de gastos
async function initGastosEvents() {
    const btnAddGasto = document.getElementById('btnAddGasto');
    if (btnAddGasto) {
        btnAddGasto.addEventListener('click', async () => {
            showGastoModal();
        });
    }

    //const btnAplicar = document.getElementById('btnAplicarFiltroGastos');
    //const btnLimpiar = document.getElementById('btnLimpiarFiltroGastos');

    //if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltroGastos);
    //if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFiltroGastos);

    const btnAbrirFiltros = document.getElementById('btnAbrirModalFiltrosGastos');

    if (btnAbrirFiltros) {
        btnAbrirFiltros.addEventListener('click', async () => {
            window.filtroActivoPara = 'gastos';
            await abrirModalFiltros();
        });
    }
    /*
    const btnLimpiarReseña = document.getElementById('btnLimpiarFiltroGastosReseña');
    if (btnLimpiarReseña) {
        btnLimpiarReseña.addEventListener('click', limpiarFiltroGastos);
    }
    */

    const btnLimpiarReseña = document.getElementById('btnLimpiarFiltroGastosReseña');

    if (btnLimpiarReseña) {

        btnLimpiarReseña.addEventListener('click', async () => {

            filtroGastos = {
                desde: '',
                hasta: '',
                categoria: []
            };

            const reseña = document.getElementById('filtroReseñaGastos');

            if (reseña) {
                reseña.style.display = 'none';
            }

            btnLimpiarReseña.style.display = 'none';

            await loadGastos();

            showSuccess('Filtros limpiados');

        });

    }

    initExportMenu('btnExportGastos', {
        onCSV: () => exportarGastosCSV(),
        onPDF: () => exportarGastosPDF()
    });

    //resetearFiltrosGastos?.();
}

// Actualizar total de gastos filtrados
function actualizarTotalGastosFiltrados() {
    const total = gastosList.reduce(
        (sum, gasto) =>
            sum + Number(
                gasto.monto_eur ??
                gasto.monto ??
                0
            ),
        0
    );

    const totalElement = document.getElementById(
        'totalGastosFiltrados'
    );

    if (totalElement) {
        totalElement.textContent = formatCurrency(
            total,
            getUserCurrency()
        );
    }
}

console.log('✅ Módulo de gastos cargado');
