// ============================================
// AUTENTICACIÓN - Login, registro y sesión
// ============================================

// Variables globales de autenticación
let currentUser = null;
let authInitialized = false;
let isRecoveringPassword = false;

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

            currentUser = session.user;
            window.currentUser = session.user;

            console.log('✅ Usuario autenticado:', currentUser.email);

            // 🔥 IMPORTANTE: sincronizar antes del dashboard
            showDashboard();

        } else {
            currentUser = null;
            showLoginScreen();
        }

        // =========================
        // AUTH LISTENER
        // =========================
        supabase.auth.onAuthStateChange((event, session) => {

            console.log('🔥 AUTH EVENT:', event);

            if (event === 'SIGNED_IN' && session?.user) {

                currentUser = session.user;
                window.currentUser = session.user;

                console.log('✅ LOGIN EVENT:', currentUser.email);

                showDashboard();
            }

            if (event === 'SIGNED_OUT') {
                currentUser = null;
                window.currentUser = null;
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

        currentUser = data.user;

        // =========================
        // 🔥 FIX CRÍTICO: persistencia usuario
        // =========================
        localStorage.setItem('user_id', currentUser.id);
        localStorage.setItem('user_email', currentUser.email);

        // 🔥 OBTENER ROLE DESDE SUPABASE
        let role = 'usuario';

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (profileError) {
            console.warn('No se pudo obtener role, usando default:', profileError.message);
        }

        if (profile?.role) {
            role = profile.role;
        }

        window.currentUserRole = role;
        localStorage.setItem('user_role', role);

        console.log('👤 Usuario logueado con role:', role);

        showSuccess('¡Inicio de sesión exitoso!', 'loginMessage');

        document.getElementById('loginForm')?.reset();

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
        
        currentUser = null;
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
    if (typeof loadGastosCategorias === 'function') {
        loadGastosCategorias();
    }

    if (typeof loadIngresosCategorias === 'function') {
        loadIngresosCategorias();
    }

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
        // 1. memoria global (login normal)
        if (window.currentUser) return window.currentUser;

        // 2. Supabase auth session
        const supabase = getSupabase();
        const user = supabase?.auth?.getUser?.()?.data?.user;

        if (user) {
            window.currentUser = user;
            return user;
        }

        // 3. fallback localStorage (si existe sesión vieja)
        const storedUser = localStorage.getItem('supabase_user');

        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            window.currentUser = parsed;
            return parsed;
        }

        return null;

    } catch (error) {
        console.error('Error en getCurrentUser:', error);
        return null;
    }
}
