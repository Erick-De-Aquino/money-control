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
function showAddCategoriaModal(tipo, contexto = 'auto') {
    tipo = tipo === 'gastos' ? 'gasto' : tipo;
    tipo = tipo === 'ingresos' ? 'ingreso' : tipo;

    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('#modal .modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    const isAdminCategoriasVisible = () => {
        const gastosList = document.getElementById('categoriasGastosList');
        const ingresosList = document.getElementById('categoriasIngresosList');

        return [gastosList, ingresosList].some(el => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
    };

    const contextoFinal =
        contexto !== 'auto'
            ? contexto
            : isAdminCategoriasVisible()
                ? 'admin'
                : 'movimiento';

    modalTitle.textContent =
        tipo === 'gasto'
            ? '➕ Nueva Categoría de Gasto'
            : '➕ Nueva Categoría de Ingreso';

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

            const nombre = document.getElementById('categoriaNombre')?.value.trim();

            if (!nombre) return;

            const categoria = await createCategoria(nombre, tipo);

            if (!categoria) return;

            closeModal();

            invalidateCategoriasCache?.(tipo);

            if (contextoFinal === 'admin') {
                await loadCategoriasAdmin(filtroActual || '');
                return;
            }

            if (tipo === 'gasto') {
                await actualizarSelectCategoriasGastos?.();

                if (typeof showGastoModal === 'function') {
                    showGastoModal();
                }
            } else {
                await actualizarSelectCategoriasIngresos?.();

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
    const filtroLower = String(filtro || '').toLowerCase();

    const escapeHTML = (value) => {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const gastosFiltrados = (categoriasGastos || []).filter(cat =>
        String(cat.nombre || '').toLowerCase().includes(filtroLower)
    );

    const ingresosFiltrados = (categoriasIngresos || []).filter(cat =>
        String(cat.nombre || '').toLowerCase().includes(filtroLower)
    );

    const tituloGastos = document.getElementById('tituloCategoriasGastos');
    const tituloIngresos = document.getElementById('tituloCategoriasIngresos');

    if (tituloGastos) {
        tituloGastos.textContent = `Categorías de Gastos (${gastosFiltrados.length})`;
    }

    if (tituloIngresos) {
        tituloIngresos.textContent = `Categorías de Ingresos (${ingresosFiltrados.length})`;
    }

    const gastosContainer = document.getElementById('categoriasGastosList');

    if (gastosContainer) {
        if (gastosFiltrados.length === 0) {
            gastosContainer.innerHTML =
                '<p class="empty-message">No hay categorías de gastos. Crea una.</p>';
        } else {
            gastosContainer.innerHTML = gastosFiltrados.map(cat => `
                <div class="list-item-card" data-id="${escapeHTML(cat.id)}" style="background-color: rgba(244, 67, 54, 0.05); border-left: 4px solid #f44336;">
                    <div class="item-info">
                        <div class="item-title">📌 ${escapeHTML(cat.nombre)}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon btn-small edit-categoria" data-id="${escapeHTML(cat.id)}" data-tipo="gasto" title="Editar">✏️</button>
                        <button class="btn-icon btn-small delete-categoria" data-id="${escapeHTML(cat.id)}" data-tipo="gasto" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `).join('');
        }

        gastosContainer.onclick = (e) => {
            const editBtn = e.target.closest('.edit-categoria');
            const deleteBtn = e.target.closest('.delete-categoria');

            if (editBtn) {
                const id = Number(editBtn.dataset.id);
                const categoria = window.categoriasGastos?.find(cat => Number(cat.id) === id);

                if (!categoria) return;

                showEditCategoriaModal(categoria.id, categoria.nombre, 'gasto');
                return;
            }

            if (deleteBtn) {
                const id = Number(deleteBtn.dataset.id);
                const categoria = window.categoriasGastos?.find(cat => Number(cat.id) === id);

                if (!categoria) return;

                deleteCategoria(categoria.id, categoria.nombre, 'gasto');
            }
        };
    }

    const ingresosContainer = document.getElementById('categoriasIngresosList');

    if (ingresosContainer) {
        if (ingresosFiltrados.length === 0) {
            ingresosContainer.innerHTML =
                '<p class="empty-message">No hay categorías de ingresos. Crea una.</p>';
        } else {
            ingresosContainer.innerHTML = ingresosFiltrados.map(cat => `
                <div class="list-item-card" data-id="${escapeHTML(cat.id)}" style="background-color: rgba(76, 175, 80, 0.05); border-left: 4px solid #4CAF50;">
                    <div class="item-info">
                        <div class="item-title">💰 ${escapeHTML(cat.nombre)}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon btn-small edit-categoria" data-id="${escapeHTML(cat.id)}" data-tipo="ingreso" title="Editar">✏️</button>
                        <button class="btn-icon btn-small delete-categoria" data-id="${escapeHTML(cat.id)}" data-tipo="ingreso" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `).join('');
        }

        ingresosContainer.onclick = (e) => {
            const editBtn = e.target.closest('.edit-categoria');
            const deleteBtn = e.target.closest('.delete-categoria');

            if (editBtn) {
                const id = Number(editBtn.dataset.id);
                const categoria = window.categoriasIngresos?.find(cat => Number(cat.id) === id);

                if (!categoria) return;

                showEditCategoriaModal(categoria.id, categoria.nombre, 'ingreso');
                return;
            }

            if (deleteBtn) {
                const id = Number(deleteBtn.dataset.id);
                const categoria = window.categoriasIngresos?.find(cat => Number(cat.id) === id);

                if (!categoria) return;

                deleteCategoria(categoria.id, categoria.nombre, 'ingreso');
            }
        };
    }
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
    try {
        const supabase = getSupabase();
        const user = await getCategoriasAuthUser();

        if (!user) return;

        const mostrarMensaje = (mensaje, tipoMensaje = 'error') => {
            if (window.ElaraNotifications?.showToast) {
                window.ElaraNotifications.showToast(mensaje, tipoMensaje);
                return;
            }

            if (typeof showToast === 'function') {
                showToast(mensaje, tipoMensaje);
                return;
            }

            if (tipoMensaje === 'error' && typeof showError === 'function') {
                showError(mensaje);
                return;
            }

            console.warn(mensaje);
        };

        let count = 0;

        if (tipo === 'gasto') {
            const { count: total, error } = await supabase
                .from('gastos')
                .select('*', { count: 'exact', head: true })
                .eq('categoria', nombre)
                .eq('user_id', user.id);

            if (error) {
                console.error('Error verificando gastos asociados:', error);
                mostrarMensaje('No se pudo verificar si la categoría tiene gastos asociados.');
                return;
            }

            count = total || 0;
        } else {
            const { count: total, error } = await supabase
                .from('ingresos')
                .select('*', { count: 'exact', head: true })
                .eq('origen', nombre)
                .eq('user_id', user.id);

            if (error) {
                console.error('Error verificando ingresos asociados:', error);
                mostrarMensaje('No se pudo verificar si la categoría tiene ingresos asociados.');
                return;
            }

            count = total || 0;
        }

        if (count > 0) {
            const tipoRegistro = tipo === 'gasto' ? 'gasto' : 'ingreso';
            const tipoRegistroPlural = tipo === 'gasto' ? 'gastos' : 'ingresos';

            const mensaje =
                `No se puede eliminar "${nombre}" porque tiene ${count} ` +
                `${count === 1 ? tipoRegistro : tipoRegistroPlural} ` +
                `asociado${count === 1 ? '' : 's'}. ` +
                `Primero cambia o elimina esos movimientos.`;

            if (typeof showInfoModal === 'function') {
                showInfoModal(mensaje, 'Categoría en uso');
            } else {
                console.warn(mensaje);
            }

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
                        mostrarMensaje('Error al eliminar la categoría.');
                        return;
                    }

                    mostrarMensaje(`Categoría "${nombre}" eliminada correctamente.`, 'success');

                    invalidateCategoriasCache?.(tipo);

                    await loadCategoriasAdmin(filtroActual || '');

                    if (tipo === 'gasto') {
                        await getCategoriasCache?.('gastos', true);

                        if (typeof loadGastos === 'function') {
                            await loadGastos();
                        }
                    } else {
                        await getCategoriasCache?.('ingresos', true);

                        if (typeof loadIngresos === 'function') {
                            await loadIngresos();
                        }
                    }

                    if (typeof loadDashboardData === 'function') {
                        await loadDashboardData();
                    }

                } catch (error) {
                    console.error('Error en confirmación de deleteCategoria:', error);
                    mostrarMensaje('Error al eliminar la categoría.');
                }
            },
            'Eliminar Categoría'
        );

    } catch (error) {
        console.error('Error en deleteCategoria:', error);

        if (window.ElaraNotifications?.showToast) {
            window.ElaraNotifications.showToast('Error al eliminar la categoría.', 'error');
        } else if (typeof showError === 'function') {
            showError('Error al eliminar la categoría.');
        }
    }
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

