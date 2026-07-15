const CACHE_KEY = 'app_cache_v1';

function saveCache() {
    const cacheToPersist = createEmptyAppCache(window.appCache?.userId || null);

    ['gastos', 'ingresos'].forEach(tipo => {
        const cache = window.appCache?.categorias?.[tipo];

        cacheToPersist.categorias[tipo] = {
            loaded: Boolean(cache?.loaded),
            promise: null,
            data: Array.isArray(cache?.data) ? cache.data : []
        };
    });

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheToPersist));
}

function createEmptyAppCache(userId = null) {
    return {
        userId,
        categorias: {
            gastos: { loaded: false, promise: null, data: [] },
            ingresos: { loaded: false, promise: null, data: [] }
        }
    };
}

function resetUserCache(userId = null) {
    window.appCache = createEmptyAppCache(userId);
    localStorage.removeItem(CACHE_KEY);
}

function normalizeCategoriaCacheTipo(tipo) {
    if (tipo === 'gasto') return 'gastos';
    if (tipo === 'ingreso') return 'ingresos';
    return tipo;
}

function resetCategoriasCache(tipo = null) {
    if (!window.appCache?.categorias) {
        window.appCache = createEmptyAppCache(window.appCache?.userId || null);
    }

    const cacheKey = normalizeCategoriaCacheTipo(tipo);

    if (cacheKey) {
        if (window.appCache.categorias[cacheKey]) {
            window.appCache.categorias[cacheKey] = {
                loaded: false,
                promise: null,
                data: []
            };
        }
        return;
    }

    window.appCache.categorias.gastos = { loaded: false, promise: null, data: [] };
    window.appCache.categorias.ingresos = { loaded: false, promise: null, data: [] };
}

function loadCache() {
    const data = localStorage.getItem(CACHE_KEY);

    window.appCache = createEmptyAppCache();

    if (data) {
        const parsed = JSON.parse(data);
        window.appCache.userId = parsed?.userId || null;

        // merge seguro (evita romper estructura)
        if (parsed?.categorias) {
            window.appCache.categorias.gastos = {
                loaded: Boolean(parsed.categorias.gastos?.loaded),
                promise: null,
                data: Array.isArray(parsed.categorias.gastos?.data)
                    ? parsed.categorias.gastos.data
                    : []
            };

            window.appCache.categorias.ingresos = {
                loaded: Boolean(parsed.categorias.ingresos?.loaded),
                promise: null,
                data: Array.isArray(parsed.categorias.ingresos?.data)
                    ? parsed.categorias.ingresos.data
                    : []
            };
        }
    }
}

async function getCacheAuthUser() {
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('No se pudo obtener el usuario actual:', userError);
        showError?.('No hay una sesion activa');
        return null;
    }

    return user;
}

async function getCategoriasCache(tipo, forceReload = false) {
    const cacheKey = normalizeCategoriaCacheTipo(tipo);

    if (!cacheKey) return [];

    const user = await getCacheAuthUser();

    if (!user) return [];

    if (window.appCache?.userId !== user.id) {
        resetUserCache(user.id);
    }

    if (forceReload) {
        resetCategoriasCache(cacheKey);
    }

    const cache = window.appCache.categorias?.[cacheKey];

    if (!cache) {
        console.warn('Tipo de categoría no soportado:', tipo);
        return [];
    }

    if (cache.loaded) return cache.data;

    if (cache.promise) return await cache.promise;

    cache.promise = (async () => {
        try {
            const supabase = getSupabase();

            const { data, error } = await supabase
                .from('categorias')
                .select('*')
                .eq('user_id', user.id)
                .eq('tipo', cacheKey === 'gastos' ? 'gasto' : 'ingreso')
                .order('nombre');

            if (error) {
                console.error('Error cargando categorías:', error);
                cache.promise = null;
                return [];
            }

            const categorias = data || [];

            cache.data = categorias;
            cache.loaded = true;
            cache.promise = null;
            window.appCache.userId = user.id;
            saveCache();

            return categorias;

        } catch (err) {
            console.error('Error en cache global:', err);
            cache.promise = null;
            return [];
        }
    })();

    return await cache.promise;
}

window.getCategoriasCache = getCategoriasCache;
window.loadCache = loadCache;
window.resetCategoriasCache = resetCategoriasCache;
window.resetUserCache = resetUserCache;
window.saveCache = saveCache;
window.categoriasGastos = [];
window.categoriasIngresos = [];
