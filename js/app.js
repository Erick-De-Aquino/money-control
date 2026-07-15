
// ============================================
// APP PRINCIPAL - Inicialización y eventos globales
// ============================================

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación Gestor de Gastos y Remesas...');

    initSupabase();

    const connected = await checkSupabaseConnection();

    if (!connected) {
        console.warn('⚠️ No se pudo conectar a Supabase. Verifica tu conexión.');
        showError(
            'Error de conexión con la base de datos. Verifica tu internet.',
            'loginMessage'
        );
    }

    window.appCache = window.appCache || {};

    if (typeof loadCache === 'function') {
        loadCache();
    } else {
        console.warn('⚠️ Cache aún no disponible, se inicializará vacío');

        window.appCache = {
            userId: null,
            categorias: {
                gastos: {
                    loaded: false,
                    promise: null,
                    data: []
                },
                ingresos: {
                    loaded: false,
                    promise: null,
                    data: []
                }
            }
        };
    }

    // Esperar autenticación
    const authOk = await initAuth();

    if (!authOk) {
        console.error('No se pudo inicializar la autenticación');
        return;
    }

    console.log('El DOM está listo, voy a ejecutar setupAuthEvents');

    setupAuthEvents();

    initDashboard();
    initModalEvents();
    initGastosEvents();
    initIngresosEvents();
    initOperacionesEvents?.();
    initCategoriasAdminEvents();

    const refreshTasasBtn = document.getElementById('btnRefreshTasas');

    if (refreshTasasBtn) {
        refreshTasasBtn.addEventListener('click', () => {
            updateAllTasas?.();
        });
    }

    initPasswordToggles();

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

    // Reset password form
    const resetPasswordForm = document.getElementById('resetPasswordForm');

    if (resetPasswordForm) {

        resetPasswordForm.onsubmit = async (e) => {

            e.preventDefault();

            const password =
                document.getElementById('newPassword')?.value;

            const confirmPassword =
                document.getElementById('confirmNewPassword')?.value;

            if (!password || !confirmPassword) {

                showError(
                    'Todos los campos son obligatorios',
                    'resetPasswordMessage'
                );

                return;
            }

            if (password.length < 6) {

                showError(
                    'La contraseña debe tener al menos 6 caracteres',
                    'resetPasswordMessage'
                );

                return;
            }

            if (password !== confirmPassword) {

                showError(
                    'Las contraseñas no coinciden',
                    'resetPasswordMessage'
                );

                return;
            }

            await updateUserPassword(password);
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

function initBalanceVisibility() {
    const balance = document.getElementById('balance');
    const totalGastos = document.getElementById('totalGastos');
    const totalIngresos = document.getElementById('totalIngresos');
    const toggle = document.getElementById('toggleBalance');

    if (!balance || !totalGastos || !totalIngresos || !toggle) return;

    const ojoAbierto = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>`;

    const ojoCerrado = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>`;

    const saved = localStorage.getItem('balanceHidden') === 'true';

    if (saved) {
        balance.classList.add('blurred');
        totalGastos.classList.add('blurred');
        totalIngresos.classList.add('blurred');
        toggle.innerHTML = ojoCerrado;
    }

    toggle.addEventListener('click', () => {
        const hidden = !balance.classList.contains('blurred');
        
        if (hidden) {
            balance.classList.add('blurred');
            totalGastos.classList.add('blurred');
            totalIngresos.classList.add('blurred');
            toggle.innerHTML = ojoCerrado;
        } else {
            balance.classList.remove('blurred');
            totalGastos.classList.remove('blurred');
            totalIngresos.classList.remove('blurred');
            toggle.innerHTML = ojoAbierto;
        }
        
        localStorage.setItem('balanceHidden', hidden);
    });
}

initBalanceVisibility();
