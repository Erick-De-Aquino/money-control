// ============================================
// INGRESOS - CRUD de ingresos
// ============================================

// Variables globales
let categoriasIngresos = [];
let ingresosList = [];
let intervaloParpadeoIngresos = null;
let editingIngresoId = null;
let filtroIngresos = {
    desde: '',
    hasta: '',
    categoria: []
};
let limpiandoFiltros = false;
let ultimaCarga = 0;

// Cargar ingresos desde Supabase
async function loadIngresos() {
    try {
        const supabase = getSupabase();

        const userId = getCurrentUser()?.id;

        if (!userId || userId === 'undefined') {
            console.error('No user ID en ingresos');
            return [];
        }

        let query = supabase
            .from(TABLES.ingresos)
            .select('*')
            .eq('user_id', userId);

        if (filtroIngresos.desde) {
            query = query.gte('fecha', filtroIngresos.desde);
        }

        if (filtroIngresos.hasta) {
            query = query.lte('fecha', filtroIngresos.hasta);
        }

        const { data, error } = await query.order('fecha', { ascending: false });

        if (error) {
            console.error('Error al cargar ingresos:', error);
            showError?.('Error al cargar los ingresos');
            return [];
        }

        ingresosList = data || [];

        // FILTRO MULTICATEGORÍA
        if (
            Array.isArray(filtroIngresos.categoria) &&
            filtroIngresos.categoria.length > 0
        ) {
            ingresosList = ingresosList.filter(i =>
                filtroIngresos.categoria.includes(i.origen)
            );
        }

        displayIngresos?.();

        const hayFiltros =
            filtroIngresos.desde ||
            filtroIngresos.hasta ||
            (
                Array.isArray(filtroIngresos.categoria) &&
                filtroIngresos.categoria.length > 0
            );

        const totalElement = document.getElementById('totalIngresosFiltrados');

        if (totalElement) {
            if (hayFiltros) {
                const total = ingresosList.reduce(
                    (sum, i) => sum + (i.monto_eur || i.monto),
                    0
                );

                totalElement.textContent =
                    formatCurrency(total, 'EUR');
            } else {
                totalElement.textContent =
                    formatCurrency(0, 'EUR');
            }
        }

        return ingresosList;

    } catch (error) {
        console.error('Error en loadIngresos:', error);
        return [];
    }
}

// Cargar categorías de ingresos desde Supabase
async function getIngresosCategoriasCached() {

    // 1. devolver cache si ya está listo
    if (window.appCache.ingresos.loaded) {
        return window.appCache.ingresos.categorias;
    }

    // 2. esperar request en curso
    if (window.appCache.ingresos.promise) {
        return await window.appCache.ingresos.promise;
    }

    // 3. crear request único
    window.appCache.ingresos.promise = (async () => {

        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .eq('tipo', 'ingreso')
            .order('nombre');

        if (error) {
            console.error('❌ Error cargando ingresos:', error);
            window.appCache.ingresos.promise = null;
            return [];
        }

        const categorias = data || [];

        // 🔥 SOLO CACHE CENTRAL (evita duplicación global)
        window.appCache.ingresos.categorias = categorias;
        window.appCache.ingresos.loaded = true;

        // ⚠️ mantener compatibilidad (pero ya NO es fuente principal)
        window.categoriasIngresos = categorias;

        return categorias;
    })();

    return await window.appCache.ingresos.promise;
}

// Mostrar ingresos en UI
function displayIngresos() {
    const container = document.getElementById('ingresosList');
    if (!container) return;
    
    if (ingresosList.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay ingresos registrados</p>';
        return;
    }
    
    container.innerHTML = ingresosList.map(ingreso => `
        <div class="list-item-card" data-id="${ingreso.id}">
            <div class="item-info">
                <div class="item-title">${ingreso.origen || 'Sin origen'}</div>
                <div class="item-subtitle">
                    ${formatDate(ingreso.fecha)} • ${ingreso.descripcion || 'Sin descripción'}
                </div>
            </div>
            <div class="item-amount positive">
                +${formatCurrency(ingreso.monto, ingreso.moneda)}
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-small edit-ingreso" data-id="${ingreso.id}" title="Editar">✏️</button>
                <button class="btn-icon btn-small delete-ingreso" data-id="${ingreso.id}" title="Eliminar">🗑️</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.edit-ingreso').forEach(btn => {
        btn.addEventListener('click', () => editIngreso(parseInt(btn.dataset.id)));
    });
    
    document.querySelectorAll('.delete-ingreso').forEach(btn => {
        btn.addEventListener('click', () => deleteIngreso(parseInt(btn.dataset.id)));
    });
}

// Mostrar modal para agregar/editar ingreso
async function showIngresoModal(ingreso = null) {
    editingIngresoId = ingreso ? ingreso.id : null;

    const categorias = await getCategoriasCache('ingresos');

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('#modal .modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = ingreso ? '✏️ Editar Ingreso' : '💰 Nuevo Ingreso';

    const categoriasOptions = categorias.length > 0 
        ? categorias.map(cat =>
            `<option value="${cat.nombre}" ${ingreso && ingreso.origen === cat.nombre ? 'selected' : ''}>${cat.nombre}</option>`
          ).join('')
        : '<option value="">No hay categorías. Crea una primero.</option>';

    modalBody.innerHTML = `
        <form id="ingresoForm">
            <div class="form-group">
                <label for="ingresoFecha">Fecha *</label>
                <input type="date" id="ingresoFecha" name="fecha" value="${ingreso ? ingreso.fecha : getTodayDate()}" required>
            </div>

            <div class="form-group">
                <label for="ingresoOrigen">Origen *</label>
                <select id="ingresoOrigen" name="origen" required>
                    <option value="">Seleccionar origen</option>
                    ${categoriasOptions}
                </select>
                <button type="button" id="btnNuevaCategoriaIngreso" class="btn btn-text btn-small" style="margin-top: 5px;">+ Crear nueva categoría</button>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="ingresoMonto">Monto *</label>
                    <input type="number" id="ingresoMonto" name="monto" step="0.01" value="${ingreso ? ingreso.monto : ''}" required>
                </div>

                <div class="form-group">
                    <label for="ingresoMoneda">Moneda *</label>
                    <select id="ingresoMoneda" name="moneda" required>
                        <option value="EUR" ${ingreso && ingreso.moneda === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                        <option value="USDT" ${ingreso && ingreso.moneda === 'USDT' ? 'selected' : ''}>USDT (₿)</option>
                        <option value="BS" ${ingreso && ingreso.moneda === 'BS' ? 'selected' : ''}>BS (Bs.)</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label for="ingresoDescripcion">Descripción</label>
                <textarea id="ingresoDescripcion" name="descripcion" rows="2" placeholder="Opcional">${ingreso ? ingreso.descripcion || '' : ''}</textarea>
            </div>

            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelIngresoBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary">${ingreso ? 'Actualizar' : 'Guardar'}</button>
            </div>
        </form>
    `;

    modal.classList.add('active');

    document.getElementById('ingresoForm')?.addEventListener('submit', saveIngreso);
    document.getElementById('cancelIngresoBtn')?.addEventListener('click', closeModal);

    const btnNuevaCategoria = document.getElementById('btnNuevaCategoriaIngreso');
    if (btnNuevaCategoria) {
        btnNuevaCategoria.onclick = () => {
            closeModal();
            setTimeout(() => showAddCategoriaModal('ingreso'), 100);
        };
    }

    document.getElementById('ingresoMoneda')?.addEventListener('change', () => showIngresoConversion());
    document.getElementById('ingresoMonto')?.addEventListener('input', () => showIngresoConversion());
}

// Mostrar conversión en tiempo real para ingresos
async function showIngresoConversion() {
    const monto = parseFloat(document.getElementById('ingresoMonto')?.value || 0);
    const moneda = document.getElementById('ingresoMoneda')?.value;
    
    if (!monto || !moneda || moneda === 'EUR') return;
    
    const montoEUR = await convertToEUR(monto, moneda);
    
    let conversionMsg = document.getElementById('conversionMsgIngreso');
    if (!conversionMsg) {
        const form = document.getElementById('ingresoForm');
        const lastGroup = form?.querySelector('.form-group:last-child');
        if (lastGroup) {
            conversionMsg = document.createElement('div');
            conversionMsg.id = 'conversionMsgIngreso';
            conversionMsg.className = 'form-message info';
            lastGroup.insertAdjacentElement('afterend', conversionMsg);
        }
    }
    
    if (conversionMsg) {
        conversionMsg.textContent = `≈ ${formatCurrency(montoEUR, 'EUR')} (convertido)`;
        conversionMsg.style.display = 'block';
    }
}

// Guardar ingreso
async function saveIngreso(event) {
    event.preventDefault();
    
    const fecha = document.getElementById('ingresoFecha')?.value;
    const origen = document.getElementById('ingresoOrigen')?.value;
    const monto = parseFloat(document.getElementById('ingresoMonto')?.value);
    const moneda = document.getElementById('ingresoMoneda')?.value;
    const descripcion = document.getElementById('ingresoDescripcion')?.value;
    
    if (!fecha || !origen || !monto || !moneda) {
        showError('Por favor completa todos los campos obligatorios');
        return;
    }
    
    if (monto <= 0) {
        showError('El monto debe ser mayor a 0');
        return;
    }
    
    const categoriaExiste = categoriasIngresos.some(cat => cat.nombre === origen);
    if (!categoriaExiste && categoriasIngresos.length > 0) {
        showError('La categoría seleccionada no existe');
        return;
    }
    
    const montoEUR = await convertToEUR(monto, moneda);
    
    const ingresoData = {
        fecha,
        origen,
        monto,
        moneda,
        monto_eur: montoEUR,
        descripcion: descripcion || null,
        user_id: getCurrentUser()?.id
    };
    
    try {
        const supabase = getSupabase();
        let result;
        
        if (editingIngresoId) {
            result = await supabase
                .from(TABLES.ingresos)
                .update(ingresoData)
                .eq('id', editingIngresoId);
        } else {
            result = await supabase
                .from(TABLES.ingresos)
                .insert([ingresoData]);
        }
        
        if (result.error) {
            console.error('Error al guardar ingreso:', result.error);
            showError('Error al guardar el ingreso');
            return;
        }
        
        showSuccess(editingIngresoId ? 'Ingreso actualizado' : 'Ingreso guardado');
        closeModal();
        await loadIngresos();
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error en saveIngreso:', error);
        showError('Error al guardar el ingreso');
    }
}

// Editar ingreso
async function editIngreso(id) {
    const ingreso = ingresosList.find(i => i.id === id);
    if (ingreso) {
        await showIngresoModal(ingreso);
    }
}

// Eliminar ingreso
async function deleteIngreso(id) {
    const ingreso = ingresosList.find(i => i.id === id);
    
    showConfirmModal(
        `¿Eliminar ingreso de ${formatCurrency(ingreso.monto, ingreso.moneda)}?`,
        async () => {
            try {
                const supabase = getSupabase();
                
                const { error } = await supabase
                    .from(TABLES.ingresos)
                    .delete()
                    .eq('id', id);
                
                if (error) {
                    console.error('Error al eliminar ingreso:', error);
                    showError('Error al eliminar el ingreso');
                    return;
                }
                
                showSuccess('Ingreso eliminado');
                await loadIngresos();
                await loadDashboardData();
                
            } catch (error) {
                console.error('Error en deleteIngreso:', error);
                showError('Error al eliminar el ingreso');
            }
        },
        'Eliminar Ingreso'
    );
}

// Cargar categorías que tienen ingresos
async function loadCategoriasIngresosConDatos() {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('ingresos')
            .select('origen')
            .not('origen', 'is', null);
        
        if (error) throw error;
        
        const categoriasUnicas = [...new Set(data.map(i => i.origen).filter(c => c))];
        return categoriasUnicas.sort();
    } catch (error) {
        console.error('Error cargando categorías con datos:', error);
        return [];
    }
}

// Abrir modal de filtros (cargando valores según página activa)
async function abrirModalFiltros() {

    if (!window.filtroActivoPara) {
        window.filtroActivoPara = 'dashboard';
    }

    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');

    const catSelect = document.getElementById('filtroDashboardCategoria');

    let categorias = [];
    let seleccionadas = [];

    // DASHBOARD
    if (window.filtroActivoPara === 'dashboard') {

        if (desdeInput) desdeInput.value = filtroDashboard.desde || '';
        if (hastaInput) hastaInput.value = filtroDashboard.hasta || '';

        categorias = await getCategoriasCache('gastos');
        seleccionadas = filtroDashboard.categoria || [];
    }

    // GASTOS
    else if (window.filtroActivoPara === 'gastos') {

        if (desdeInput) desdeInput.value = filtroGastos.desde || '';
        if (hastaInput) hastaInput.value = filtroGastos.hasta || '';

        categorias = await getCategoriasCache('gastos');
        seleccionadas = filtroGastos.categoria || [];
    }

    // INGRESOS
    else if (window.filtroActivoPara === 'ingresos') {

        if (desdeInput) desdeInput.value = filtroIngresos.desde || '';
        if (hastaInput) hastaInput.value = filtroIngresos.hasta || '';

        categorias = await getCategoriasCache('ingresos');
        seleccionadas = filtroIngresos.categoria || [];
    }

    // Crear contenedor de checkboxes
    if (catSelect) {

        let container = document.getElementById('contenedorCategoriasCheckbox');

        if (!container) {

            container = document.createElement('div');
            container.id = 'contenedorCategoriasCheckbox';

            container.style.maxHeight = '220px';
            container.style.overflowY = 'auto';
            container.style.border = '1px solid #ccc';
            container.style.borderRadius = '8px';
            container.style.padding = '10px';
            container.style.marginTop = '8px';

            catSelect.parentNode.appendChild(container);
        }

        container.innerHTML = categorias.map(cat => `
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <input
                    type="checkbox"
                    class="checkboxCategoriaFiltro"
                    value="${cat.nombre}"
                    ${seleccionadas.includes(cat.nombre) ? 'checked' : ''}
                >
                ${cat.nombre}
            </label>
        `).join('');

        catSelect.style.display = 'none';
    }

    const modal = document.getElementById('modalFiltros');

    if (modal) {
        modal.classList.add('active');
    }
}

// Limpiar filtros de ingresos
async function limpiarFiltroIngresos() {
    filtroIngresos = { desde: '', hasta: '', categoria: '' };
    
    // Limpiar inputs del modal
    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');
    const catSelect = document.getElementById('filtroDashboardCategoria');
    
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
    if (catSelect) catSelect.value = '';
    
    // Forzar total a 0 visualmente
    const totalElement = document.getElementById('totalIngresosFiltrados');
    if (totalElement) {
        totalElement.textContent = formatCurrency(0, 'EUR');
    }
    
    // Limpiar la lista visual
    const container = document.getElementById('ingresosList');
    if (container) {
        container.innerHTML = '<p class="empty-message">Cargando...</p>';
    }
    
    // Ocultar reseña y botón de limpiar
    const reseña = document.getElementById('filtroReseñaIngresos');
    const btnLimpiar = document.getElementById('btnLimpiarFiltroIngresosReseña');
    if (reseña) {
        reseña.style.display = 'none';
        if (intervaloParpadeoIngresos) {
            clearInterval(intervaloParpadeoIngresos);
            intervaloParpadeoIngresos = null;
        }
    }
    if (btnLimpiar) btnLimpiar.style.display = 'none';
    
    // Cerrar modal si está abierto
    cerrarModalFiltros();
    
    // Recargar datos
    await loadIngresos();
    showSuccess('Filtros limpiados');
}

async function actualizarSelectCategoriasIngresos() {
    const categorias = await loadCategoriasIngresosConDatos();
    const select = document.getElementById('filtroIngresosCategoria');
    if (select) {
        select.innerHTML = '<option value="">Todas las categorías</option>' +
            categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
}

// Limpiar filtros y UI de ingresos al entrar a la página
async function resetearFiltrosIngresos() {
    filtroIngresos = { desde: '', hasta: '', categoria: '' };
    
    // Limpiar inputs del modal
    const desdeInput = document.getElementById('filtroDashboardDesde');
    const hastaInput = document.getElementById('filtroDashboardHasta');
    const catSelect = document.getElementById('filtroDashboardCategoria');
    
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
    if (catSelect) catSelect.value = '';
    
    // Mostrar 0 porque no hay filtros
    const totalElement = document.getElementById('totalIngresosFiltrados');
    if (totalElement) {
        totalElement.textContent = formatCurrency(0, 'EUR');
    }
    
    // Limpiar reseña y detener parpadeo
    const reseña = document.getElementById('filtroReseñaIngresos');
    const btnLimpiar = document.getElementById('btnLimpiarFiltroIngresosReseña');
    if (reseña) {
        reseña.style.display = 'none';
        if (intervaloParpadeoIngresos) {
            clearInterval(intervaloParpadeoIngresos);
            intervaloParpadeoIngresos = null;
        }
    }
    if (btnLimpiar) btnLimpiar.style.display = 'none';
    
    await loadIngresos();
}

// Inicializar eventos de ingresos
async function initIngresosEvents() {
    const btnAddIngreso = document.getElementById('btnAddIngreso');
    if (btnAddIngreso) {
        btnAddIngreso.addEventListener('click', async () => {
            showIngresoModal();
        });
    }

    const btnAbrirFiltros = document.getElementById('btnAbrirModalFiltrosIngresos');
    if (btnAbrirFiltros) {
        btnAbrirFiltros.addEventListener('click', async () => {
            window.filtroActivoPara = 'ingresos';
            await abrirModalFiltros();
        });
    }

    const btnLimpiarReseña = document.getElementById('btnLimpiarFiltroIngresosReseña');
    if (btnLimpiarReseña) {
        btnLimpiarReseña.addEventListener('click', limpiarFiltroIngresos);
    }

    initExportMenu('btnExportIngresos', {
        onCSV: () => exportarIngresosCSV(),
        onPDF: () => exportarIngresosPDF()
    });

    resetearFiltrosIngresos?.();
}

async function getIngresosCategoriasCached() {
    return await getCategoriasCache('ingresos');
}

console.log('✅ Módulo de ingresos cargado');