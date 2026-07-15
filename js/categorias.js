// ============================================
// CATEGORÍAS - Gestión de categorías personalizadas
// ============================================

// Cargar categorías del usuario
async function getCategoriasAuthUser() {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('No se pudo obtener el usuario actual:', userError);
        showError?.('No hay una sesion activa');
        return null;
    }

    return user;
}

function invalidateCategoriasCache(tipo) {
    const cacheKey = tipo === 'gasto' ? 'gastos' : 'ingresos';

    resetCategoriasCache?.(cacheKey);
}

async function loadCategorias(tipo = null) {
    try {
        const supabase = getSupabase();
        const user = await getCategoriasAuthUser();

        if (!user) return [];

        let query = supabase
            .from('categorias')
            .select('*')
            .eq('user_id', user.id);
        
        if (tipo) {
            query = query.eq('tipo', tipo);
        }
        
        const { data, error } = await query.order('nombre');
        
        if (error) {
            console.error('Error al cargar categorías:', error);
            return [];
        }
        
        return data || [];
        
    } catch (error) {
        console.error('Error en loadCategorias:', error);
        return [];
    }
}

// Crear nueva categoría
async function createCategoria(nombre, tipo) {

    if (!nombre || !tipo) {
        showError('Nombre y tipo son requeridos');
        return false;
    }

    const nombreFormateado =
        nombre.charAt(0).toUpperCase() +
        nombre.slice(1);

    try {

        const supabase = getSupabase();
        const user = await getCategoriasAuthUser();

        if (!user) return false;

        const { data, error } = await supabase
            .from('categorias')
            .insert([{
                nombre: nombreFormateado,
                tipo,
                user_id: user.id
            }])
            .select();

        if (error) {
            console.error(error);
            showError('Error al crear la categoría');
            return false;
        }

        invalidateCategoriasCache(tipo);

        showSuccess(`Categoría "${nombreFormateado}" creada`);

        return data[0];

    } catch (error) {
        console.error(error);
        return false;
    }

}

// Mostrar modal para agregar categoría
function showAddCategoriaModal(tipo) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('#modal .modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    modalTitle.textContent = tipo === 'gasto' ? '➕ Nueva Categoría de Gasto' : '➕ Nueva Categoría de Ingreso';
    
    modalBody.innerHTML = `
        <form id="categoriaForm">
            <div class="form-group">
                <label for="categoriaNombre">Nombre de la categoría *</label>
                <input type="text" id="categoriaNombre" placeholder="Ej: Alimentación" required>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelCategoriaBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary">Crear Categoría</button>
            </div>
        </form>
    `;
    
    modal.classList.add('active');
    
    const form = document.getElementById('categoriaForm');
    if (form) {
        form.onsubmit = async (e) => {

            e.preventDefault();

            const nombre =
                document.getElementById('categoriaNombre')
                ?.value
                .trim();

            if (!nombre) return;

            const categoria = await createCategoria(nombre, tipo);

            if (!categoria) return;

            closeModal();

            if (tipo === 'gasto') {

                await actualizarSelectCategoriasGastos();

                if (typeof showGastoModal === 'function') {
                    showGastoModal();
                }

            } else {

                await actualizarSelectCategoriasIngresos();

                if (typeof showIngresoModal === 'function') {
                    showIngresoModal();
                }

            }

        };
    }
    
    const cancelBtn = document.getElementById('cancelCategoriaBtn');
    if (cancelBtn) {
        cancelBtn.onclick = () => closeModal();
    }
}

// Cargar y mostrar categorías en el admin
async function loadAdminCategorias() {
    await loadCategoriasAdmin();
}

let filtroActual = '';

async function loadCategoriasAdmin(filtro = '') {
    filtroActual = filtro;

    try {
        const supabase = getSupabase();
        const gastosContainer = document.getElementById('categoriasGastosList');
        const ingresosContainer = document.getElementById('categoriasIngresosList');

        window.categoriasGastos = [];
        window.categoriasIngresos = [];

        if (typeof categoriasGastos !== 'undefined') categoriasGastos = [];
        if (typeof categoriasIngresos !== 'undefined') categoriasIngresos = [];

        if (gastosContainer) {
            gastosContainer.innerHTML = '<p class="empty-message">Cargando categorías...</p>';
        }

        if (ingresosContainer) {
            ingresosContainer.innerHTML = '<p class="empty-message">Cargando categorías...</p>';
        }

        const user = await getCategoriasAuthUser();

        if (!user) return;

        // Cargar gastos
        const { data: gastos, error: errorGastos } = await supabase
            .from('categorias')
            .select('*')
            .eq('user_id', user.id)
            .eq('tipo', 'gasto')
            .order('nombre');

        if (errorGastos) console.error('Error cargando categorías de gastos:', errorGastos);

        // Cargar ingresos
        const { data: ingresos, error: errorIngresos } = await supabase
            .from('categorias')
            .select('*')
            .eq('user_id', user.id)
            .eq('tipo', 'ingreso')
            .order('nombre');

        if (errorIngresos) console.error('Error cargando categorías de ingresos:', errorIngresos);

        // Guardar los datos actuales para exportación
        window.categoriasGastos = gastos || [];
        window.categoriasIngresos = ingresos || [];

        // Mostrar en UI con filtro
        displayCategoriasAdmin(
            window.categoriasGastos,
            window.categoriasIngresos,
            filtro
        );

    } catch (error) {
        console.error('Error en loadCategoriasAdmin:', error);
    }
}

function displayCategoriasAdmin(categoriasGastos, categoriasIngresos, filtro = '') {
    const filtroLower = filtro.toLowerCase();
    
    // Filtrar categorías
    const gastosFiltrados = categoriasGastos.filter(cat => 
        cat.nombre.toLowerCase().includes(filtroLower)
    );
    const ingresosFiltrados = categoriasIngresos.filter(cat => 
        cat.nombre.toLowerCase().includes(filtroLower)
    );

    // Actualizar contadores en los acordeones
    const tituloGastos = document.getElementById('tituloCategoriasGastos');
    const tituloIngresos = document.getElementById('tituloCategoriasIngresos');

    if (tituloGastos) {
        tituloGastos.textContent =
            `Categorías de Gastos (${gastosFiltrados.length})`;
    }

    if (tituloIngresos) {
        tituloIngresos.textContent =
            `Categorías de Ingresos (${ingresosFiltrados.length})`;
    }
    
    // Mostrar categorías de gastos (fondo rojo suave)
    const gastosContainer = document.getElementById('categoriasGastosList');
    if (gastosContainer) {
        if (gastosFiltrados.length === 0) {
            gastosContainer.innerHTML = '<p class="empty-message">No hay categorías de gastos. Crea una.</p>';
        } else {
            gastosContainer.innerHTML = gastosFiltrados.map(cat => `
                <div class="list-item-card" data-id="${cat.id}" style="background-color: rgba(244, 67, 54, 0.05); border-left: 4px solid #f44336;">
                    <div class="item-info">
                        <div class="item-title">📌 ${cat.nombre}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon btn-small edit-categoria" data-id="${cat.id}" data-nombre="${cat.nombre}" data-tipo="gasto" title="Editar">✏️</button>
                        <button class="btn-icon btn-small delete-categoria" data-id="${cat.id}" data-nombre="${cat.nombre}" data-tipo="gasto" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // Mostrar categorías de ingresos (fondo verde suave)
    const ingresosContainer = document.getElementById('categoriasIngresosList');
    if (ingresosContainer) {
        if (ingresosFiltrados.length === 0) {
            ingresosContainer.innerHTML = '<p class="empty-message">No hay categorías de ingresos. Crea una.</p>';
        } else {
            ingresosContainer.innerHTML = ingresosFiltrados.map(cat => `
                <div class="list-item-card" data-id="${cat.id}" style="background-color: rgba(76, 175, 80, 0.05); border-left: 4px solid #4CAF50;">
                    <div class="item-info">
                        <div class="item-title">💰 ${cat.nombre}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon btn-small edit-categoria" data-id="${cat.id}" data-nombre="${cat.nombre}" data-tipo="ingreso" title="Editar">✏️</button>
                        <button class="btn-icon btn-small delete-categoria" data-id="${cat.id}" data-nombre="${cat.nombre}" data-tipo="ingreso" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // Agregar event listeners
    document.querySelectorAll('.edit-categoria').forEach(btn => {
        btn.addEventListener('click', () => showEditCategoriaModal(btn.dataset.id, btn.dataset.nombre, btn.dataset.tipo));
    });
    
    document.querySelectorAll('.delete-categoria').forEach(btn => {
        btn.addEventListener('click', () => deleteCategoria(parseInt(btn.dataset.id), btn.dataset.nombre, btn.dataset.tipo));
    });
}

// Mostrar modal para editar categoría
function showEditCategoriaModal(id, nombreActual, tipo) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('#modal .modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    modalTitle.textContent = `✏️ Editar Categoría de ${tipo === 'gasto' ? 'Gasto' : 'Ingreso'}`;
    
    modalBody.innerHTML = `
        <form id="editCategoriaForm">
            <div class="form-group">
                <label for="editCategoriaNombre">Nombre de la categoría *</label>
                <input type="text" id="editCategoriaNombre" value="${nombreActual}" required>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelEditBtn">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar Cambios</button>
            </div>
        </form>
    `;
    
    modal.classList.add('active');
    
    const form = document.getElementById('editCategoriaForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const nuevoNombre = document.getElementById('editCategoriaNombre')?.value.trim();
            if (nuevoNombre && nuevoNombre !== nombreActual) {
                await updateCategoria(
                    id,
                    nombreActual,
                    nuevoNombre,
                    tipo
                );
            } else if (nuevoNombre === nombreActual) {
                showInfo('El nombre no ha cambiado');
                closeModal();
            }
        };
    }
    
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.onclick = () => closeModal();
    }
}

// Actualizar categoría
async function updateCategoria(id, nombreAnterior, nuevoNombre, tipo) {
    const nombreFormateado = nuevoNombre.charAt(0).toUpperCase() + nuevoNombre.slice(1).toLowerCase();
    
    try {
        const supabase = getSupabase();
        const user = await getCategoriasAuthUser();

        if (!user) return false;
        
        // Actualizar la categoría
        const { error: errorCategoria } = await supabase
            .from('categorias')
            .update({ nombre: nombreFormateado })
            .eq('id', id)
            .eq('user_id', user.id);
        
        if (errorCategoria) {
            console.error('Error al actualizar categoría:', errorCategoria);
            showError('Error al actualizar la categoría');
            return false;
        }
        
        // Actualizar los gastos que usan esta categoría
        if (tipo === 'gasto') {
            const { error: errorGastos } = await supabase
                .from('gastos')
                .update({ categoria: nombreFormateado })
                .eq('categoria', nombreAnterior)
                .eq('user_id', user.id);
            
            if (errorGastos) console.error('Error actualizando gastos:', errorGastos);
        } else {
            const { error: errorIngresos } = await supabase
                .from('ingresos')
                .update({ origen: nombreFormateado })
                .eq('origen', nombreAnterior)
                .eq('user_id', user.id);
            
            if (errorIngresos) console.error('Error actualizando ingresos:', errorIngresos);
        }
        
        showSuccess(`Categoría actualizada a "${nombreFormateado}"`);
        closeModal();
        invalidateCategoriasCache(tipo);
        
        // Recargar todo
        await loadCategoriasAdmin();
        if (tipo === 'gasto') {
            await getCategoriasCache?.('gastos');
            await loadGastos();
        } else {
            await getCategoriasCache?.('ingresos');
            await loadIngresos();
        }
        await loadDashboardData();
        
        return true;
        
    } catch (error) {
        console.error('Error en updateCategoria:', error);
        showError('Error al actualizar la categoría');
        return false;
    }
}

// Eliminar categoría
async function deleteCategoria(id, nombre, tipo) {
    // Verificar si hay gastos/ingresos usando esta categoría
    const supabase = getSupabase();
    const user = await getCategoriasAuthUser();

    if (!user) return;

    let tieneRegistros = false;
    let count = 0;
    
    if (tipo === 'gasto') {
        const { count: c, error } = await supabase
            .from('gastos')
            .select('*', { count: 'exact', head: true })
            .eq('categoria', nombre)
            .eq('user_id', user.id);
        
        if (!error && c > 0) {
            tieneRegistros = true;
            count = c;
        }
    } else {
        const { count: c, error } = await supabase
            .from('ingresos')
            .select('*', { count: 'exact', head: true })
            .eq('origen', nombre)
            .eq('user_id', user.id);
        
        if (!error && c > 0) {
            tieneRegistros = true;
            count = c;
        }
    }
    
    if (tieneRegistros) {
        showError(`No se puede eliminar "${nombre}". Tiene ${count} ${tipo === 'gasto' ? 'gastos' : 'ingresos'} asociados.`);
        return;
    }
    
    showConfirmModal(
        `¿Eliminar categoría "${nombre}"?`,
        async () => {
            try {
                const { error } = await supabase
                    .from('categorias')
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);
                
                if (error) {
                    console.error('Error al eliminar categoría:', error);
                    showError('Error al eliminar la categoría');
                    return;
                }
                
                showSuccess(`Categoría "${nombre}" eliminada`);
                invalidateCategoriasCache(tipo);
                await loadCategoriasAdmin(filtroActual || '');
                
                // ✅ Recargar usando getCategoriasCache
                if (tipo === 'gasto') {
                    await getCategoriasCache('gastos', true);
                    if (typeof loadGastos === 'function') {
                        await loadGastos();
                    }
                } else {
                    await getCategoriasCache('ingresos', true);
                    if (typeof loadIngresos === 'function') {
                        await loadIngresos();
                    }
                }
                
                if (typeof loadDashboardData === 'function') {
                    await loadDashboardData();
                }
                
            } catch (error) {
                console.error('Error en deleteCategoria:', error);
                showError('Error al eliminar la categoría');
            }
        },
        'Eliminar Categoría'
    );
}

// Inicializar eventos del admin de categorías
function initCategoriasAdminEvents() {
    const btnAddGasto = document.getElementById('btnAddCategoriaGasto');
    if (btnAddGasto) {
        btnAddGasto.onclick = () => showAddCategoriaModal('gasto');
    }

    const btnAddIngreso = document.getElementById('btnAddCategoriaIngreso');
    if (btnAddIngreso) {
        btnAddIngreso.onclick = () => showAddCategoriaModal('ingreso');
    }

    // Barra de búsqueda
    const searchInput = document.getElementById('searchCategorias');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            loadCategoriasAdmin(e.target.value);
        });
    }

    initExportMenu('btnExportCategorias', {
        onCSV: exportarCategoriasCSV,
        onPDF: exportarCategoriasPDF
    });
}

console.log('✅ Módulo de categorías cargado');

