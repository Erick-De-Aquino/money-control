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

        gastosList = [];

        if (container) {
            container.innerHTML = '<p class="empty-message">Cargando gastos...</p>';
        }

        if (totalElement) {
            totalElement.textContent = formatCurrency(0, 'EUR');
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

        const { data, error } = await query.order('fecha', { ascending: false });

        if (error) {
            console.error('Error al cargar gastos:', error);
            showError?.('Error al cargar los gastos');
            return [];
        }

        gastosList = data || [];

        // FILTRO MULTICATEGORÍA
        if (
            Array.isArray(filtroGastos.categoria) &&
            filtroGastos.categoria.length > 0
        ) {
            gastosList = gastosList.filter(g =>
                filtroGastos.categoria.includes(g.categoria)
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
                    (sum, g) => sum + (g.monto_eur || g.monto),
                    0
                );

                totalElement.textContent =
                    formatCurrency(total, 'EUR');

            } else {

                totalElement.textContent =
                    formatCurrency(0, 'EUR');
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
    if (!container) return;

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    if (gastosList.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay gastos registrados</p>';
        return;
    }

    container.innerHTML = gastosList.map(gasto => {
        const id = Number(gasto.id);
        const categoria = escapeHTML(gasto.categoria || 'Sin categoría');
        const descripcion = escapeHTML(gasto.descripcion || 'Sin descripción');
        const fecha = escapeHTML(formatDate(gasto.fecha));
        const monto = escapeHTML(formatCurrency(gasto.monto, gasto.moneda));

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
                    <button class="btn-icon btn-small edit-gasto" data-id="${id}" title="Editar">✏️</button>
                    <button class="btn-icon btn-small delete-gasto" data-id="${id}" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.edit-gasto').forEach(btn => {
        btn.addEventListener('click', () => editGasto(Number(btn.dataset.id)));
    });

    document.querySelectorAll('.delete-gasto').forEach(btn => {
        btn.addEventListener('click', () => deleteGasto(Number(btn.dataset.id)));
    });
}

// Mostrar modal para agregar/editar gasto
async function showGastoModal(gasto = null) {
    editingGastoId = gasto ? gasto.id : null;

    const categorias = await getCategoriasCache('gastos');

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

    modalTitle.textContent = gasto ? '✏️ Editar Gasto' : '➕ Nuevo Gasto';

    const fecha = escapeAttr(gasto ? gasto.fecha : getTodayDate());
    const monto = escapeAttr(gasto ? gasto.monto : '');
    const descripcion = escapeHTML(gasto ? gasto.descripcion || '' : '');
    const moneda = gasto?.moneda || 'EUR';
    const categoriaActual = gasto?.categoria || '';

    const categoriasOptions = categorias.length > 0
        ? categorias.map(cat => {
            const nombre = cat.nombre || '';
            const selected = categoriaActual === nombre ? 'selected' : '';

            return `
                <option value="${escapeAttr(nombre)}" ${selected}>
                    ${escapeHTML(nombre)}
                </option>
            `;
        }).join('')
        : '<option value="">No hay categorías. Crea una primero.</option>';

    modalBody.innerHTML = `
        <form id="gastoForm">
            <div class="form-group">
                <label for="gastoFecha">Fecha *</label>
                <input type="date" id="gastoFecha" name="fecha" value="${fecha}" required>
            </div>

            <div class="form-group">
                <label for="gastoCategoria">Categoría *</label>
                <select id="gastoCategoria" name="categoria" required>
                    <option value="">Seleccionar categoría</option>
                    ${categoriasOptions}
                </select>

                <button type="button" id="btnNuevaCategoriaGasto" class="btn btn-text btn-small" style="margin-top: 5px;">
                    + Crear nueva categoría
                </button>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="gastoMonto">Monto *</label>
                    <input type="number" id="gastoMonto" name="monto" step="0.01" value="${monto}" required>
                </div>

                <div class="form-group">
                    <label for="gastoMoneda">Moneda *</label>
                    <select id="gastoMoneda" name="moneda" required>
                        <option value="EUR" ${moneda === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        <option value="USDT" ${moneda === 'USDT' ? 'selected' : ''}>USDT (₿)</option>
                        <option value="BS" ${moneda === 'BS' ? 'selected' : ''}>BS (Bs.)</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="gastoDescripcion">Descripción</label>
                <textarea id="gastoDescripcion" name="descripcion" rows="2" placeholder="Opcional">${descripcion}</textarea>
            </div>

            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelGastoBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary">${gasto ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;

    modal.classList.add('active');

    document.getElementById('gastoForm')?.addEventListener('submit', saveGasto);
    document.getElementById('cancelGastoBtn')?.addEventListener('click', closeModal);

    const btnNuevaCategoria = document.getElementById('btnNuevaCategoriaGasto');

    if (btnNuevaCategoria) {
        btnNuevaCategoria.onclick = () => {
            closeModal();
            setTimeout(() => showAddCategoriaModal('gasto', 'movimiento'), 100);
        };
    }

    document.getElementById('gastoMoneda')?.addEventListener('change', () => showGastoConversion());
    document.getElementById('gastoMonto')?.addEventListener('input', () => showGastoConversion());
}

// Mostrar conversión en tiempo real
async function showGastoConversion() {
    const monto = parseFloat(document.getElementById('gastoMonto')?.value || 0);
    const moneda = document.getElementById('gastoMoneda')?.value;
    
    if (!monto || !moneda || moneda === 'EUR') return;
    
    const montoEUR = await convertToEUR(monto, moneda);
    
    let conversionMsg = document.getElementById('conversionMsg');
    if (!conversionMsg) {
        const form = document.getElementById('gastoForm');
        const lastGroup = form?.querySelector('.form-group:last-child');
        if (lastGroup) {
            conversionMsg = document.createElement('div');
            conversionMsg.id = 'conversionMsg';
            conversionMsg.className = 'form-message info';
            lastGroup.insertAdjacentElement('afterend', conversionMsg);
        }
    }
    
    if (conversionMsg) {
        conversionMsg.textContent = `≈ ${formatCurrency(montoEUR, 'EUR')} (convertido)`;
        conversionMsg.style.display = 'block';
    }
}

// Guardar gasto
async function saveGasto(event) {
    event.preventDefault();
    
    const fecha = document.getElementById('gastoFecha')?.value;
    const categoria = document.getElementById('gastoCategoria')?.value;
    const monto = parseFloat(document.getElementById('gastoMonto')?.value);
    const moneda = document.getElementById('gastoMoneda')?.value;
    const descripcion = document.getElementById('gastoDescripcion')?.value;
    
    if (!fecha || !categoria || !monto || !moneda) {
        showError('Por favor completa todos los campos obligatorios');
        return;
    }
    
    if (monto <= 0) {
        showError('El monto debe ser mayor a 0');
        return;
    }
    
    const categoriaExiste = categoriasGastos.some(cat => cat.nombre === categoria);
    if (!categoriaExiste && categoriasGastos.length > 0) {
        showError('La categoría seleccionada no existe');
        return;
    }
    
    const user = await getGastosAuthUser();

    if (!user) return;

    const montoEUR = await convertToEUR(monto, moneda);
    
    const gastoData = {
        fecha,
        categoria,
        monto,
        moneda,
        monto_eur: montoEUR,
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
            console.error('Error al guardar gasto:', result.error);
            showError('Error al guardar el gasto');
            return;
        }
        
        showSuccess(editingGastoId ? 'Gasto actualizado' : 'Gasto guardado');
        closeModal();
        await loadGastos();
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error en saveGasto:', error);
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
    const gasto = gastosList.find(g => g.id === id);
    
    showConfirmModal(
        `¿Eliminar gasto de ${formatCurrency(gasto.monto, gasto.moneda)}?`,
        async () => {
            try {
                const supabase = getSupabase();
                const user = await getGastosAuthUser();

                if (!user) return;
                
                const { error } = await supabase
                    .from(TABLES.gastos)
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);
                
                if (error) {
                    console.error('Error al eliminar gasto:', error);
                    showError('Error al eliminar el gasto');
                    return;
                }
                
                showSuccess('Gasto eliminado');
                await loadGastos();
                await loadDashboardData();
                
            } catch (error) {
                console.error('Error en deleteGasto:', error);
                showError('Error al eliminar el gasto');
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
    const total = gastosList.reduce((sum, g) => sum + (g.monto_eur || g.monto), 0);
    const totalElement = document.getElementById('totalGastosFiltrados');
    if (totalElement) {
        totalElement.textContent = formatCurrency(total, 'EUR');
    }
}

console.log('✅ Módulo de gastos cargado');
