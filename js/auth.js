// ============================================
// AUTENTICACIÓN - Login, registro y sesión
// ============================================

// Variables globales de autenticación
let currentUser = null;
let authInitialized = false;

// Inicializar autenticación
async function initAuth() {
    try {
        const supabase = getSupabase();
        
        // Verificar sesión actual
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Error al obtener sesión:', error);
            return false;
        }
        
        if (session) {
            currentUser = session.user;

            console.log('✅ Usuario autenticado:', currentUser.email);

        } else {
            showLoginScreen();
        }
        
        // Escuchar cambios en la autenticación
        supabase.auth.onAuthStateChange((event, session) => {

            console.log('🔥 EVENTO AUTH:', event);
            console.log('🔥 SESSION:', session);

            if (event === 'PASSWORD_RECOVERY') {

                alert('RECUPERACIÓN DETECTADA');

                return;
            }

            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user;
                showDashboard();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                showLoginScreen();
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
            email: email,
            password: password
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
        
        if (data.user) {
            currentUser = data.user;
            showSuccess('¡Inicio de sesión exitoso!', 'loginMessage');
            
            // Limpiar formulario
            document.getElementById('loginForm').reset();
            
            // Mostrar dashboard
            showDashboard();
            
            // Cargar datos iniciales
            loadDashboardData();
            
            return true;
        }
        
        return false;
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
    
    // Cargar tasas al entrar
    if (typeof loadTasas === 'function') {
        loadTasas();
    }
    
    // Iniciar actualización periódica de tasas
    startTasaInterval();
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
    
    // Detener actualización de tasas
    stopTasaInterval();
}

// Verificar si usuario está autenticado
function isAuthenticated() {
    return currentUser !== null;
}

// Obtener usuario actual
function getCurrentUser() {
    return currentUser;
}
