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

async function getIngresosAuthUser() {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('No se pudo obtener el usuario actual:', userError);
        showError?.('No hay una sesion activa');
        return null;
    }

    return user;
}

// Cargar ingresos desde Supabase
async function loadIngresos() {
    try {
        const supabase = getSupabase();
        const container = document.getElementById('ingresosList');
        const totalElement = document.getElementById(
            'totalIngresosFiltrados'
        );
        const userCurrency = getUserCurrency();

        ingresosList = [];

        if (container) {
            container.innerHTML =
                '<p class="empty-message">Cargando ingresos...</p>';
        }

        if (totalElement) {
            totalElement.textContent = formatCurrency(
                0,
                userCurrency
            );
        }

        const user = await getIngresosAuthUser();
        const userId = user?.id;

        if (!userId || userId === 'undefined') {
            console.error('No user ID en ingresos');
            return [];
        }

        let query = supabase
            .from(TABLES.ingresos)
            .select('*')
            .eq('user_id', userId);

        if (filtroIngresos.desde) {
            query = query.gte(
                'fecha',
                filtroIngresos.desde
            );
        }

        if (filtroIngresos.hasta) {
            query = query.lte(
                'fecha',
                filtroIngresos.hasta
            );
        }

        const { data, error } = await query.order(
            'fecha',
            { ascending: false }
        );

        if (error) {
            console.error(
                'Error al cargar ingresos:',
                error
            );

            showError?.('Error al cargar los ingresos');
            return [];
        }

        ingresosList = data || [];

        if (
            Array.isArray(filtroIngresos.categoria) &&
            filtroIngresos.categoria.length > 0
        ) {
            ingresosList = ingresosList.filter(
                (ingreso) =>
                    filtroIngresos.categoria.includes(
                        ingreso.origen
                    )
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

        if (totalElement) {
            if (hayFiltros) {
                const total = ingresosList.reduce(
                    (sum, ingreso) =>
                        sum + Number(
                            ingreso.monto_eur ??
                            ingreso.monto ??
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

        return ingresosList;

    } catch (error) {
        console.error('Error en loadIngresos:', error);
        return [];
    }
}

// Mostrar ingresos en UI
function displayIngresos() {
    const container = document.getElementById('ingresosList');

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

    if (ingresosList.length === 0) {
        container.innerHTML =
            '<p class="empty-message">No hay ingresos registrados</p>';

        return;
    }

    container.innerHTML = ingresosList.map((ingreso) => {
        const id = Number(ingreso.id);
        const origen = escapeHTML(
            ingreso.origen || 'Sin origen'
        );
        const descripcion = escapeHTML(
            ingreso.descripcion || 'Sin descripción'
        );
        const fecha = escapeHTML(formatDate(ingreso.fecha));
        const monto = escapeHTML(
            formatCurrency(
                ingreso.monto,
                userCurrency
            )
        );

        return `
            <div class="list-item-card" data-id="${id}">
                <div class="item-info">
                    <div class="item-title">${origen}</div>

                    <div class="item-subtitle">
                        ${fecha} • ${descripcion}
                    </div>
                </div>

                <div class="item-amount positive">
                    +${monto}
                </div>

                <div class="item-actions">
                    <button
                        class="btn-icon btn-small edit-ingreso"
                        data-id="${id}"
                        title="Editar">
                        ✏️
                    </button>

                    <button
                        class="btn-icon btn-small delete-ingreso"
                        data-id="${id}"
                        title="Eliminar">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.edit-ingreso').forEach(
        (btn) => {
            btn.addEventListener('click', () => {
                editIngreso(Number(btn.dataset.id));
            });
        }
    );

    document.querySelectorAll('.delete-ingreso').forEach(
        (btn) => {
            btn.addEventListener('click', () => {
                deleteIngreso(Number(btn.dataset.id));
            });
        }
    );
}

// Mostrar modal para agregar/editar ingreso
async function showIngresoModal(ingreso = null) {
    editingIngresoId = ingreso ? ingreso.id : null;

    const categorias = await getCategoriasCache('ingresos');

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

    modalTitle.textContent = ingreso
        ? '✏️ Editar Ingreso'
        : '💰 Nuevo Ingreso';

    const fecha = escapeAttr(
        ingreso ? ingreso.fecha : getTodayDate()
    );

    const monto = escapeAttr(
        ingreso ? ingreso.monto : ''
    );

    const descripcion = escapeHTML(
        ingreso ? ingreso.descripcion || '' : ''
    );

    const origenActual = ingreso?.origen || '';

    const userCurrency = getUserCurrency();

    const categoriasOptions = categorias.length > 0
        ? categorias.map((categoria) => {
            const nombre = categoria.nombre || '';
            const selected =
                origenActual === nombre
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
        <form id="ingresoForm">
            <div class="form-group">
                <label for="ingresoFecha">Fecha *</label>

                <input
                    type="date"
                    id="ingresoFecha"
                    name="fecha"
                    value="${fecha}"
                    required>
            </div>

            <div class="form-group">
                <label for="ingresoOrigen">Origen *</label>

                <select
                    id="ingresoOrigen"
                    name="origen"
                    required>
                    <option value="">
                        Seleccionar origen
                    </option>

                    ${categoriasOptions}
                </select>

                <button
                    type="button"
                    id="btnNuevaCategoriaIngreso"
                    class="btn btn-text btn-small"
                    style="margin-top: 5px;">
                    + Crear nueva categoría
                </button>
            </div>

            <div class="form-group">
                <label for="ingresoMonto">
                    Monto (${escapeHTML(userCurrency)}) *
                </label>

                <input
                    type="number"
                    id="ingresoMonto"
                    name="monto"
                    step="0.01"
                    min="0.01"
                    value="${monto}"
                    required>
            </div>

            <div class="form-group">
                <label for="ingresoDescripcion">
                    Descripción
                </label>

                <textarea
                    id="ingresoDescripcion"
                    name="descripcion"
                    rows="2"
                    placeholder="Opcional">${descripcion}</textarea>
            </div>

            <div class="form-actions">
                <button
                    type="button"
                    class="btn btn-secondary"
                    id="cancelIngresoBtn">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="btn btn-primary">
                    ${ingreso ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </form>
    `;

    modal.classList.add('active');

    document
        .getElementById('ingresoForm')
        ?.addEventListener('submit', saveIngreso);

    document
        .getElementById('cancelIngresoBtn')
        ?.addEventListener('click', closeModal);

    const btnNuevaCategoria = document.getElementById(
        'btnNuevaCategoriaIngreso'
    );

    if (btnNuevaCategoria) {
        btnNuevaCategoria.onclick = () => {
            closeModal();

            setTimeout(() => {
                showAddCategoriaModal(
                    'ingreso',
                    'movimiento'
                );
            }, 100);
        };
    }
}

// Guardar ingreso
async function saveIngreso(event) {
    event.preventDefault();

    const fecha = document.getElementById(
        'ingresoFecha'
    )?.value;

    const origen = document.getElementById(
        'ingresoOrigen'
    )?.value;

    const monto = Number(
        document.getElementById('ingresoMonto')?.value
    );

    const moneda = getUserCurrency();

    const descripcion = document.getElementById(
        'ingresoDescripcion'
    )?.value;

    if (!fecha || !origen || !monto || !moneda) {
        showError(
            'Por favor completa todos los campos obligatorios'
        );

        return;
    }

    if (monto <= 0) {
        showError('El monto debe ser mayor a 0');
        return;
    }

    const categoriaExiste = categoriasIngresos.some(
        (categoriaItem) =>
            categoriaItem.nombre === origen
    );

    if (
        !categoriaExiste &&
        categoriasIngresos.length > 0
    ) {
        showError(
            'La categoría seleccionada no existe'
        );

        return;
    }

    const user = await getIngresosAuthUser();

    if (!user) {
        return;
    }

    const ingresoData = {
        fecha,
        origen,
        monto,
        moneda,
        monto_eur: monto,
        descripcion: descripcion || null,
        user_id: user.id
    };

    try {
        const supabase = getSupabase();
        let result;

        if (editingIngresoId) {
            result = await supabase
                .from(TABLES.ingresos)
                .update(ingresoData)
                .eq('id', editingIngresoId)
                .eq('user_id', user.id);
        } else {
            result = await supabase
                .from(TABLES.ingresos)
                .insert([ingresoData]);
        }

        if (result.error) {
            console.error(
                'Error al guardar ingreso:',
                result.error
            );

            showError('Error al guardar el ingreso');
            return;
        }

        showSuccess(
            editingIngresoId
                ? 'Ingreso actualizado'
                : 'Ingreso guardado'
        );

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
        `¿Eliminar ingreso de ${formatCurrency(
            ingreso.monto,
            getUserCurrency()
        )}?`,
        async () => {
            try {
                const supabase = getSupabase();
                const user = await getIngresosAuthUser();

                if (!user) return;
                
                const { error } = await supabase
                    .from(TABLES.ingresos)
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);
                
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
        const user = await getIngresosAuthUser();

        if (!user) return [];

        const { data, error } = await supabase
            .from('ingresos')
            .select('origen')
            .eq('user_id', user.id)
            .not('origen', 'is', null);
        
        if (error) throw error;
        
        const categoriasUnicas = [...new Set(data.map(i => i.origen).filter(c => c))];
        return categoriasUnicas.sort();
    } catch (error) {
        console.error('Error cargando categorías con datos:', error);
        return [];
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
        totalElement.textContent = formatCurrency(0, getUserCurrency());
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
        totalElement.textContent = formatCurrency(0, getUserCurrency());
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

async function getIngresosCategoriasCached(forceReload = false) {
    const categorias = await getCategoriasCache('ingresos', forceReload);
    window.categoriasIngresos = categorias;
    return categorias;
}

console.log('✅ Módulo de ingresos cargado');
