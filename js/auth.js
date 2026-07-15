// ============================================
// AUTENTICACIÓN - Login, registro y sesión
// ============================================

// Variables globales de autenticación
let currentUser = null;
let authInitialized = false;
let isRecoveringPassword = false;

function persistSessionProfile(user, profile = {}) {
    const role = profile?.role || 'usuario';
    const monedaPrincipal = profile?.moneda_principal || 'EUR';
    const previousUserId =
        window.currentUser?.id ||
        localStorage.getItem('user_id');

    if (user?.id && previousUserId && previousUserId !== user.id) {
        clearUserDataState();
    }

    currentUser = user;
    window.currentUser = user;

    if (currentUser) {
        currentUser.moneda_principal = monedaPrincipal;
        localStorage.setItem('user_id', currentUser.id);
        localStorage.setItem('user_email', currentUser.email || '');
    }

    window.currentUserRole = role;
    window.currentUserCurrency = monedaPrincipal;

    localStorage.setItem('user_role', role);
    localStorage.setItem('user_currency', monedaPrincipal);

    return {
        role,
        moneda_principal: monedaPrincipal
    };
}

function setElementHTML(id, html) {
    const element = document.getElementById(id);

    if (element) {
        element.innerHTML = html;
    }
}

function setElementText(id, text) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = text;
    }
}

function clearUserDataState() {
    if (typeof resetUserCache === 'function') {
        resetUserCache();
    } else {
        window.appCache = {
            userId: null,
            categorias: {
                gastos: { loaded: false, promise: null, data: [] },
                ingresos: { loaded: false, promise: null, data: [] }
            }
        };
    }

    if (typeof gastosList !== 'undefined') gastosList = [];
    if (typeof ingresosList !== 'undefined') ingresosList = [];
    if (typeof presupuestosList !== 'undefined') presupuestosList = [];
    if (typeof historialList !== 'undefined') historialList = [];
    if (typeof categoriasGastos !== 'undefined') categoriasGastos = [];
    if (typeof categoriasIngresos !== 'undefined') categoriasIngresos = [];

    window.categoriasGastos = [];
    window.categoriasIngresos = [];
    window.dashboardGastosFiltrados = [];
    window.dashboardIngresosFiltrados = [];
    window.dashboardCategoriasDisponibles = [];

    if (typeof filtroDashboard !== 'undefined') {
        filtroDashboard = {
            desde: '',
            hasta: '',
            categoriasGastos: [],
            categoriasIngresos: []
        };
    }

    if (typeof filtroGastos !== 'undefined') {
        filtroGastos = {
            desde: '',
            hasta: '',
            categoria: []
        };
    }

    if (typeof filtroIngresos !== 'undefined') {
        filtroIngresos = {
            desde: '',
            hasta: '',
            categoria: []
        };
    }

    if (typeof filtroPresupuesto !== 'undefined') {
        filtroPresupuesto = {
            mes: new Date().getMonth() + 1,
            año: new Date().getFullYear()
        };
    }

    if (typeof filtroHistorial !== 'undefined') {
        filtroHistorial = {
            mes: '',
            año: ''
        };
    }

    if (typeof monthlyChart !== 'undefined' && monthlyChart) {
        monthlyChart.destroy();
        monthlyChart = null;
    }

    if (typeof categoryChart !== 'undefined' && categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }

    if (
        window.incomeCategoryChart &&
        typeof window.incomeCategoryChart.destroy === 'function'
    ) {
        window.incomeCategoryChart.destroy();
        window.incomeCategoryChart = null;
    }

    clearSensitiveUserUI();
}

function clearSensitiveUserUI() {
    setElementText('totalGastos', '0.00 €');
    setElementText('totalIngresos', '0.00 €');
    setElementText('balance', '0.00 €');
    setElementText('gananciaOperaciones', '0.00 €');
    setElementText('totalGastosFiltrados', '0.00 €');
    setElementText('totalIngresosFiltrados', '0.00 €');

    setElementHTML('gastosList', '<p class="empty-message">No hay gastos registrados</p>');
    setElementHTML('ingresosList', '<p class="empty-message">No hay ingresos registrados</p>');
    setElementHTML('presupuestosList', '<p class="empty-message">No hay presupuestos para este período</p>');
    setElementHTML('historialList', '<p class="empty-message">No hay historial de presupuestos</p>');
    setElementHTML('categoriasGastosList', '<p class="empty-message">No hay categorías de gastos. Crea una.</p>');
    setElementHTML('categoriasIngresosList', '<p class="empty-message">No hay categorías de ingresos. Crea una.</p>');
    setElementHTML('leyendaCategoriasGastos', '');
    setElementHTML('leyendaCategoriasIngresos', '');
    setElementHTML('adminUsersList', '<p class="empty-message">Cargando usuarios...</p>');

    [
        'filtroReseña',
        'filtroReseñaGastos',
        'filtroReseñaIngresos',
        'btnLimpiarFiltroDashboardReseña',
        'btnLimpiarFiltroGastosReseña',
        'btnLimpiarFiltroIngresosReseña'
    ].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.style.display = 'none';
        }
    });
}

async function loadCurrentUserProfile(user) {
    if (!user?.id) {
        return persistSessionProfile(user, {
            role: 'usuario',
            moneda_principal: 'EUR'
        });
    }

    try {
        const supabase = getSupabase();

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, moneda_principal')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            console.warn('No se pudo cargar el perfil, usando valores por defecto:', error.message);
        }

        return persistSessionProfile(user, profile || {});

    } catch (error) {
        console.error('Error en loadCurrentUserProfile:', error);
        return persistSessionProfile(user, {
            role: 'usuario',
            moneda_principal: 'EUR'
        });
    }
}

function clearSessionState() {
    clearUserDataState();

    currentUser = null;
    window.currentUser = null;
    window.currentUserRole = null;
    window.currentUserCurrency = null;

    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_currency');
    localStorage.removeItem('supabase_user');
}

// Inicializar autenticación
async function initAuth() {
    try {
        const supabase = getSupabase();

        // =========================
        // SESSION ACTUAL
        // =========================
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Error al obtener sesión:', error);
            showLoginScreen();
            return false;
        }

        if (session?.user) {

            await loadCurrentUserProfile(session.user);

            console.log('✅ Usuario autenticado:', currentUser.email);

            // 🔥 IMPORTANTE: sincronizar antes del dashboard
            updateSidebarVisibility?.();
            showDashboard();

        } else {
            clearSessionState();
            showLoginScreen();
        }

        // =========================
        // AUTH LISTENER
        // =========================
        supabase.auth.onAuthStateChange(async (event, session) => {

            console.log('🔥 AUTH EVENT:', event);

            if (event === 'SIGNED_IN' && session?.user) {

                await loadCurrentUserProfile(session.user);

                console.log('✅ LOGIN EVENT:', currentUser.email);

                updateSidebarVisibility?.();
                showDashboard();
            }

            if (event === 'SIGNED_OUT') {
                clearSessionState();
                updateSidebarVisibility?.();
                showLoginScreen();
            }

            if (event === 'PASSWORD_RECOVERY') {
                isRecoveringPassword = true;
                showResetPasswordScreen();
            }
        });

        authInitialized = true;
        return true;

    } catch (error) {
        console.error('Error en initAuth:', error);
        showLoginScreen();
        return false;
    }
}

// Registrar nuevo usuario
async function registerUser(email, password, confirmPassword) {
    // Validaciones
    if (!email || !password || !confirmPassword) {
        showError('Todos los campos son obligatorios', 'registerMessage');
        return false;
    }
    
    if (!isValidEmail(email)) {
        showError('Correo electrónico inválido', 'registerMessage');
        return false;
    }
    
    if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres', 'registerMessage');
        return false;
    }
    
    if (password !== confirmPassword) {
        showError('Las contraseñas no coinciden', 'registerMessage');
        return false;
    }
    
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: 'https://erick-de-aquino.github.io/money-control/',
                data: {
                    created_at: new Date().toISOString()
                }
            }
        });
        
        if (error) {
            console.error('Error de registro:', error);
            
            if (error.message.includes('already registered')) {
                showError('Este correo ya está registrado', 'registerMessage');
            } else {
                showError(error.message, 'registerMessage');
            }
            return false;
        }
        
        if (data.user) {
            // Guardar email en tabla usuario_config
            await saveUserConfig(email);
            
            showSuccess('¡Registro exitoso! Revisa tu correo para confirmar tu cuenta. Luego inicia sesión.', 'registerMessage');
            
            // Limpiar formulario
            document.getElementById('registerForm').reset();
            
            // Volver al login después de 3 segundos
            setTimeout(() => {
                showLoginScreen();
            }, 3000);
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error en registerUser:', error);
        showError(ERROR_MESSAGES.serverError, 'registerMessage');
        return false;
    }
}

// Iniciar sesión
async function loginUser(email, password) {
    if (!email || !password) {
        showError('Correo y contraseña son obligatorios', 'loginMessage');
        return false;
    }

    if (!isValidEmail(email)) {
        showError('Correo electrónico inválido', 'loginMessage');
        return false;
    }

    try {
        const supabase = getSupabase();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Error de login:', error);

            if (error.message.includes('Invalid login credentials')) {
                showError('Correo o contraseña incorrectos', 'loginMessage');
            } else if (error.message.includes('Email not confirmed')) {
                showError('Por favor confirma tu correo antes de iniciar sesión', 'loginMessage');
            } else {
                showError(error.message, 'loginMessage');
            }
            return false;
        }

        if (!data?.user) return false;
        const sessionProfile = await loadCurrentUserProfile(data.user);

        console.log('👤 Usuario logueado con role:', sessionProfile.role);
        showSuccess('¡Inicio de sesión exitoso!', 'loginMessage');

        document.getElementById('loginForm')?.reset();

        updateSidebarVisibility?.();
        showDashboard();
        loadDashboardData();

        return true;

    } catch (error) {
        console.error('Error en loginUser:', error);
        showError(ERROR_MESSAGES.serverError, 'loginMessage');
        return false;
    }
}

// Cerrar sesión
async function logoutUser() {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('Error al cerrar sesión:', error);
            showError('Error al cerrar sesión', 'loginMessage');
            return false;
        }
        
        clearSessionState();
        updateSidebarVisibility?.();
        showLoginScreen();
        console.log('✅ Sesión cerrada correctamente');
        return true;
    } catch (error) {
        console.error('Error en logoutUser:', error);
        return false;
    }
}

// Recuperar contraseña
async function resetPassword(email) {
    if (!email) {
        showError('Ingresa tu correo electrónico', 'forgotMessage');
        return false;
    }
    
    if (!isValidEmail(email)) {
        showError('Correo electrónico inválido', 'forgotMessage');
        return false;
    }
    
    try {
        const supabase = getSupabase();
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://erick-de-aquino.github.io/money-control/'
        });
        
        if (error) {
            console.error('Error al recuperar contraseña:', error);
            showError(error.message, 'forgotMessage');
            return false;
        }
        
        showSuccess('Se ha enviado un enlace de recuperación a tu correo', 'forgotMessage');
        
        // Limpiar formulario
        document.getElementById('forgotForm').reset();
        
        // Volver al login después de 3 segundos
        setTimeout(() => {
            showLoginScreen();
        }, 3000);
        
        return true;
    } catch (error) {
        console.error('Error en resetPassword:', error);
        showError(ERROR_MESSAGES.serverError, 'forgotMessage');
        return false;
    }
}

// Actualizar contraseña después de recuperación
async function updateUserPassword(newPassword) {

    try {

        const supabase = getSupabase();

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {

            console.error('Error actualizando contraseña:', error);

            showError(
                error.message,
                'resetPasswordMessage'
            );

            return false;
        }

        showSuccess(
            'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
            'resetPasswordMessage'
        );

        const resetForm =
            document.getElementById('resetPasswordForm');

        if (resetForm) {
            resetForm.reset();
        }

        isRecoveringPassword = false;

        setTimeout(() => {
            showLoginScreen();
        }, 2000);

        return true;

    } catch (error) {

        console.error('Error en updateUserPassword:', error);

        showError(
            'Error al actualizar la contraseña',
            'resetPasswordMessage'
        );

        return false;
    }
}

// Guardar configuración de usuario
async function saveUserConfig(email) {
    try {
        const supabase = getSupabase();
        
        const { error } = await supabase
            .from(TABLES.usuario_config)
            .insert([{ email: email }]);
        
        if (error && error.code !== '23505') { // Ignorar error de duplicado
            console.error('Error al guardar config:', error);
        }
    } catch (error) {
        console.error('Error en saveUserConfig:', error);
    }
}

// Mostrar dashboard (autenticado)
function showDashboard() {
    updateSidebarVisibility?.();
    activatePage?.('dashboard');
    setActiveMenuItem?.('dashboard');

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const dashboardScreen = document.getElementById('dashboardScreen');
    if (dashboardScreen) {
        dashboardScreen.classList.add('active');
    }
    
        // Mostrar email del usuario
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement && currentUser) {
        userEmailElement.textContent = currentUser.email;
    }

    // Cargar categorías para filtros y formularios
    getCategoriasCache?.('gastos');
    getCategoriasCache?.('ingresos');

    /*
    // Cargar tasas al entrar
    if (typeof loadTasas === 'function') {
        loadTasas?.();
    }
    */

    // Iniciar actualización periódica de tasas
    
}

// Mostrar pantalla de login
function showLoginScreen() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.classList.add('active');
    }
    
    // Detener actua?.lización de tasas
    
}

function showResetPasswordScreen() {

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const resetScreen =
        document.getElementById('resetPasswordScreen');

    if (resetScreen) {
        resetScreen.classList.add('active');
    }
}

// Verificar si usuario está autenticado
function isAuthenticated() {
    return currentUser !== null;
}

// Obtener usuario actual (ROBUSTO + FALLBACK)
function getCurrentUser() {
    try {
        return window.currentUser || currentUser || null;

    } catch (error) {
        console.error('Error en getCurrentUser:', error);
        return null;
    }
}

async function getCurrentUserAsync() {
    try {
        const cachedUser = getCurrentUser();

        if (cachedUser) return cachedUser;

        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getUser();

        if (error) {
            console.warn('No se pudo obtener usuario actual:', error.message);
            return null;
        }

        if (data?.user) {
            await loadCurrentUserProfile(data.user);
            return window.currentUser;
        }

        return null;

    } catch (error) {
        console.error('Error en getCurrentUserAsync:', error);
        return null;
    }
}

async function loadAdminUsers() {
    const container = document.getElementById('adminUsersList');

    if (!container) return;

    try {
        const supabase = getSupabase();

        container.innerHTML = '<p class="empty-message">Cargando usuarios...</p>';

        const currentRole =
            window.currentUserRole ||
            localStorage.getItem('user_role') ||
            'usuario';

        if (currentRole !== 'admin') {
            container.innerHTML =
                '<p class="empty-message">No tienes permisos para ver usuarios.</p>';

            if (typeof showError === 'function') {
                showError('No tienes permisos para ver usuarios.');
            }

            return;
        }

        const { data, error } = await supabase.rpc('get_users_with_roles_admin');

        if (error) {
            const message =
                error.message ||
                'No se pudieron cargar los usuarios.';

            if (
                error.code === '42501' ||
                message.toLowerCase().includes('not authorized')
            ) {
                container.innerHTML =
                    '<p class="empty-message">No tienes permisos para ver usuarios.</p>';

                if (typeof showError === 'function') {
                    showError('No tienes permisos para ver usuarios.');
                }

                return;
            }

            throw error;
        }

        if (!data || data.length === 0) {
            container.innerHTML =
                '<p class="empty-message">No hay usuarios</p>';

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

        const formatDate = (value) => {
            if (!value) return 'Sin fecha';

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return 'Sin fecha';
            }

            return date.toLocaleDateString();
        };

        container.innerHTML = data.map(user => {
            const userId = escapeHTML(user.id);
            const email = escapeHTML(user.email || 'Sin email');
            const role = escapeHTML(user.role || 'usuario');
            const createdAt = escapeHTML(formatDate(user.created_at));

            return `
                <div class="list-item-card">
                    <div class="item-info">
                        <div class="item-title">
                            ${email}
                        </div>

                        <div class="admin-user-row">
                            <span>
                                Rol:
                                <span class="role-badge role-${role}">
                                    ${role}
                                </span>
                            </span>

                            <span>
                                Alta:
                                ${createdAt}
                            </span>

                            <select
                                id="role-${userId}"
                                class="form-control admin-role-select"
                            >
                                <option value="usuario"
                                    ${user.role === 'usuario' ? 'selected' : ''}>
                                    Usuario
                                </option>

                                <option value="operador"
                                    ${user.role === 'operador' ? 'selected' : ''}>
                                    Operador
                                </option>

                                <option value="admin"
                                    ${user.role === 'admin' ? 'selected' : ''}>
                                    Admin
                                </option>
                            </select>

                            <button
                                class="btn btn-primary btn-small"
                                onclick="actualizarRolUsuario('${userId}')"
                            >
                                Actualizar
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando usuarios:', error);

        container.innerHTML =
            '<p class="empty-message">Error cargando usuarios.</p>';

        if (typeof showError === 'function') {
            showError('Error cargando usuarios.');
        }
    }
}

async function actualizarRolUsuario(userId) {
    try {
        const currentRole =
            window.currentUserRole ||
            localStorage.getItem('user_role') ||
            'usuario';

        if (currentRole !== 'admin') {
            showError('No tienes permisos para actualizar roles.');
            return;
        }

        const roleSelect = document.getElementById(`role-${userId}`);

        if (!roleSelect) {
            showError('No se encontró el selector de rol.');
            return;
        }

        const nuevoRol = roleSelect.value;

        const rolesPermitidos = ['usuario', 'operador', 'admin'];

        if (!rolesPermitidos.includes(nuevoRol)) {
            showError('Rol no válido.');
            return;
        }

        const supabase = getSupabase();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            showError('No se pudo validar la sesión.');
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                role: nuevoRol
            })
            .eq('id', userId);

        if (error) throw error;

        showSuccess('Rol actualizado correctamente');

        await loadAdminUsers();

    } catch (error) {
        console.error('Error actualizando rol:', error);

        showError('No se pudo actualizar el rol');
    }
}