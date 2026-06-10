<<<<<<< HEAD
// ============================================
// APP PRINCIPAL - Inicialización y eventos globales
// ============================================

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación Gestor de Gastos y Remesas...');
    
    // Inicializar Supabase
    initSupabase();
    
    // Verificar conexión
    const connected = await checkSupabaseConnection();
    if (!connected) {
        console.warn('⚠️ No se pudo conectar a Supabase. Verifica tu conexión.');
        showError('Error de conexión con la base de datos. Verifica tu internet.', 'loginMessage');
    }
    
    // Inicializar módulos
    initAuth();
    initDashboard();
    initModalEvents();
    initGastosEvents();
    initIngresosEvents();
    initOperacionesEvents();
    initCategoriasAdminEvents();

    console.log('El DOM está listo, voy a ejecutar setupAuthEvents');
    setupAuthEvents();
    
    // Eventos de autenticación
    setTimeout(setupAuthEvents, 100);
    
    // Configurar botón de actualización de tasas
    const refreshTasasBtn = document.getElementById('btnRefreshTasas');
    if (refreshTasasBtn) {
        refreshTasasBtn.addEventListener('click', () => {
            updateAllTasas();
        });
    }
    
    console.log('✅ Aplicación inicializada correctamente');
});

// Configurar eventos de autenticación
function setupAuthEvents() {
    console.log('setupAuthEvents ejecutándose');

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            await loginUser(email, password);
        };
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
            await registerUser(email, password, confirmPassword);
        };
    }
    
    // Forgot form
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail')?.value;
            await resetPassword(email);
        };
    }
    
    // Mostrar registro
    const showRegisterLink = document.getElementById('showRegisterLink');
    if (showRegisterLink) {
        showRegisterLink.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('registerScreen').classList.add('active');
        };
    }
    
    // Mostrar recuperación
    const showForgotLink = document.getElementById('showForgotLink');
    if (showForgotLink) {
        showForgotLink.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('forgotScreen').classList.add('active');
        };
    }
    
    // Volver de registro a login
    const showLoginFromRegister = document.getElementById('showLoginFromRegister');
    if (showLoginFromRegister) {
        showLoginFromRegister.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('loginScreen').classList.add('active');
        };
    }
    
    // Volver de recuperación a login
    const showLoginFromForgot = document.getElementById('showLoginFromForgot');
    if (showLoginFromForgot) {
        showLoginFromForgot.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('loginScreen').classList.add('active');
        };
    }
}
// Mostrar pantalla de registro
function showRegisterScreen() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const registerScreen = document.getElementById('registerScreen');
    if (registerScreen) {
        registerScreen.classList.add('active');
    }
}

// Mostrar pantalla de recuperación
function showForgotScreen() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const forgotScreen = document.getElementById('forgotScreen');
    if (forgotScreen) {
        forgotScreen.classList.add('active');
    }
}

// Prevenir cierre accidental
window.addEventListener('beforeunload', (e) => {
    if (isAuthenticated()) {
        // No mostrar mensaje, solo permitir cerrar
        return;
    }
});

// Manejar errores globales
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
});

// Manejar promesas rechazadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('Promesa rechazada:', event.reason);
});

=======
// ============================================
// APP PRINCIPAL - Inicialización y eventos globales
// ============================================

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación Gestor de Gastos y Remesas...');
    
    // Inicializar Supabase
    initSupabase();
    
    // Verificar conexión
    const connected = await checkSupabaseConnection();
    if (!connected) {
        console.warn('⚠️ No se pudo conectar a Supabase. Verifica tu conexión.');
        showError('Error de conexión con la base de datos. Verifica tu internet.', 'loginMessage');
    }
    
    // Inicializar módulos
    initAuth();
    initDashboard();
    initModalEvents();
    initGastosEvents();
    initIngresosEvents();
    initOperacionesEvents();
    initCategoriasAdminEvents();

    console.log('El DOM está listo, voy a ejecutar setupAuthEvents');
    setupAuthEvents();
    
    // Eventos de autenticación
    setTimeout(setupAuthEvents, 100);
    
    // Configurar botón de actualización de tasas
    const refreshTasasBtn = document.getElementById('btnRefreshTasas');
    if (refreshTasasBtn) {
        refreshTasasBtn.addEventListener('click', () => {
            updateAllTasas();
        });
    }
    
    console.log('✅ Aplicación inicializada correctamente');
});

// Configurar eventos de autenticación
function setupAuthEvents() {
    console.log('setupAuthEvents ejecutándose');

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            await loginUser(email, password);
        };
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
            await registerUser(email, password, confirmPassword);
        };
    }
    
    // Forgot form
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail')?.value;
            await resetPassword(email);
        };
    }
    
    // Mostrar registro
    const showRegisterLink = document.getElementById('showRegisterLink');
    if (showRegisterLink) {
        showRegisterLink.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('registerScreen').classList.add('active');
        };
    }
    
    // Mostrar recuperación
    const showForgotLink = document.getElementById('showForgotLink');
    if (showForgotLink) {
        showForgotLink.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('forgotScreen').classList.add('active');
        };
    }
    
    // Volver de registro a login
    const showLoginFromRegister = document.getElementById('showLoginFromRegister');
    if (showLoginFromRegister) {
        showLoginFromRegister.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('loginScreen').classList.add('active');
        };
    }
    
    // Volver de recuperación a login
    const showLoginFromForgot = document.getElementById('showLoginFromForgot');
    if (showLoginFromForgot) {
        showLoginFromForgot.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('loginScreen').classList.add('active');
        };
    }
}
// Mostrar pantalla de registro
function showRegisterScreen() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const registerScreen = document.getElementById('registerScreen');
    if (registerScreen) {
        registerScreen.classList.add('active');
    }
}

// Mostrar pantalla de recuperación
function showForgotScreen() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const forgotScreen = document.getElementById('forgotScreen');
    if (forgotScreen) {
        forgotScreen.classList.add('active');
    }
}

// Prevenir cierre accidental
window.addEventListener('beforeunload', (e) => {
    if (isAuthenticated()) {
        // No mostrar mensaje, solo permitir cerrar
        return;
    }
});

// Manejar errores globales
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
});

// Manejar promesas rechazadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('Promesa rechazada:', event.reason);
});

>>>>>>> f3bae395b482f94449aa12c36abfcec5eb8392c9
console.log('✅ App principal cargada');