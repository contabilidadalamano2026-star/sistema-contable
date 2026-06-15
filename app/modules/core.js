const API_URL = 'http://localhost:8000/api';

// Estado Global
let state = {
    token: localStorage.getItem('token') || null,
    view: 'auth', // 'auth', 'casa', 'negocio'
    businesses: [],
    currentBusinessId: null,
    transactionsCasa: [],
    transactionsNegocio: []
};

// Referencias UI
const ui = {
    nav: document.getElementById('main-nav'),
    viewAuth: document.getElementById('view-auth'),
    viewCasa: document.getElementById('view-casa'),
    viewNegocio: document.getElementById('view-negocio'),
    themeCheckbox: document.getElementById('checkbox'),
    
    // Auth
    authForm: document.getElementById('auth-form'),
    authError: document.getElementById('auth-error'),
    toggleAuthMode: document.getElementById('toggle-auth-mode'),
    groupEmail: document.getElementById('group-email'),
    authUsername: document.getElementById('auth-username'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    
    // Casa
    casaIngresos: document.getElementById('casa-ingresos'),
    casaGastos: document.getElementById('casa-gastos'),
    casaDisponible: document.getElementById('casa-disponible'),
    formCasa: document.getElementById('form-transaccion-casa'),
    listCasa: document.getElementById('list-transacciones-casa'),
    
    // Health Analysis
    btnAnalyzeHealth: document.getElementById('btn-analyze-health'),
    healthResults: document.getElementById('health-results'),
    healthStatusTitle: document.getElementById('health-status-title'),
    healthAdvice: document.getElementById('health-advice'),
    healthMargin: document.getElementById('health-margin'),
    healthAvailable: document.getElementById('health-available'),
    
    // Negocio
    businessSelector: document.getElementById('business-selector'),
    btnNuevoNegocio: document.getElementById('btn-nuevo-negocio'),
    formCrearNegocio: document.getElementById('form-crear-negocio-container'),
    businessContent: document.getElementById('business-dashboard-content'),
    negVentas: document.getElementById('neg-ventas'),
    negGastos: document.getElementById('neg-gastos'),
    negUtilidad: document.getElementById('neg-utilidad'),
    formNegocio: document.getElementById('form-transaccion-negocio'),
    listNegocio: document.getElementById('list-negocio')
};

let isLoginMode = true;

// --- InicializaciÃ³n ---
function init() {
    setupEventListeners();
    if (state.token) {
        checkAuthAndLoad();
    } else {
        renderView('auth');
    }
}

// --- Renderizado y Rutas ---
function renderView(viewName) {
    state.view = viewName;
    ui.viewAuth.classList.remove('active');
    ui.viewCasa.classList.remove('active');
    ui.viewNegocio.classList.remove('active');
    
    if (viewName === 'auth') {
        ui.viewAuth.classList.add('active');
        ui.nav.style.display = 'none';
        document.body.removeAttribute('data-theme');
    } else {
        ui.nav.style.display = 'flex';
        if (viewName === 'casa') {
            ui.viewCasa.classList.add('active');
            ui.themeCheckbox.checked = false;
            document.body.removeAttribute('data-theme');
            loadCasaData();
        } else if (viewName === 'negocio') {
            ui.viewNegocio.classList.add('active');
            ui.themeCheckbox.checked = true;
            document.body.setAttribute('data-theme', 'negocio');
            loadBusinessData();
        }
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Theme Switch (Toggle Rutas)
    ui.themeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            renderView('negocio');
        } else {
            renderView('casa');
        }
    });

    // Auth Toggle
    ui.toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        ui.groupEmail.style.display = isLoginMode ? 'none' : 'flex';
        ui.toggleAuthMode.innerText = isLoginMode ? 'Â¿No tienes cuenta? RegÃ­strate' : 'Â¿Ya tienes cuenta? Entra';
        ui.authForm.querySelector('button').innerText = isLoginMode ? 'Entrar' : 'Registrarse';
    });

    // Auth Submit
    ui.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.authError.style.display = 'none';
        
        const username = ui.authUsername.value;
        const password = ui.authPassword.value;
        const email = ui.authEmail.value;

        const endpoint = isLoginMode ? '/login' : '/register';
        const body = isLoginMode ? { username, password } : { username, email, password };

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.detail || 'Error en autenticaciÃ³n');

            if (isLoginMode) {
                state.token = data.access_token;
                localStorage.setItem('token', state.token);
                localStorage.setItem('userRole', data.role);
                checkAuthAndLoad();
            } else {
                alert('Registro exitoso. Ahora puedes iniciar sesiÃ³n.');
                ui.toggleAuthMode.click(); // Cambiar a login
            }
        } catch (error) {
            ui.authError.innerText = error.message;
            ui.authError.style.display = 'block';
        }
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        state.token = null;
        renderView('auth');
    });

    // Form Casa
    ui.formCasa.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTransaction(
            null, 
            document.getElementById('tc-type').value,
            parseFloat(document.getElementById('tc-amount').value),
            document.getElementById('tc-category').value
        );
        ui.formCasa.reset();
        loadCasaData();
    });

    // Analizar Finanzas
    ui.btnAnalyzeHealth.addEventListener('click', async () => {
        try {
            ui.btnAnalyzeHealth.innerText = 'Analizando...';
            const data = await authFetch('/financial-health');
            ui.btnAnalyzeHealth.innerText = 'Actualizar AnÃ¡lisis';
            ui.healthResults.style.display = 'block';
            
            ui.healthStatusTitle.innerText = `Estado: ${data.health_status}`;
            ui.healthStatusTitle.style.color = 
                data.health_status === 'Excelente' ? 'var(--success-color)' : 
                (data.health_status === 'Peligro CrÃ­tico' ? 'var(--danger-color)' : '#f57c00');
                
            ui.healthAdvice.innerText = data.advice;
            ui.healthMargin.innerText = data.debt_margin_percentage;
            ui.healthAvailable.innerText = data.available_money.toLocaleString();
            
        } catch(e) {
            alert('Error analizando finanzas: ' + e.message);
            ui.btnAnalyzeHealth.innerText = 'Analizar Capacidad Crediticia';
        }
    });

    // Formulario Negocio
    ui.formNegocio.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!state.currentBusinessId) return alert('Selecciona un negocio primero');
        
        const type = document.getElementById('tn-type').value;
        const amount = document.getElementById('tn-amount').value;
        const category = document.getElementById('tn-category').value;
        
        // Datos extra de Hacienda
        const emitirCheckbox = document.getElementById('tn-emitir-hacienda');
        const wasHacienda = emitirCheckbox ? emitirCheckbox.checked : false; // Guardar estado ANTES del reset
        let extraData = null;
        
        if (wasHacienda) {
            extraData = {
                emitir_hacienda: true,
                receptor_cedula: document.getElementById('hc-cliente-cedula').value,
                receptor_nombre: document.getElementById('hc-cliente-nombre').value,
                tarifa_iva: parseInt(document.getElementById('hc-iva').value || '0')
            };
        }
        
        const isCreditCheckbox = document.getElementById('tn-is-credit');
        const isPaid = isCreditCheckbox ? !isCreditCheckbox.checked : true;
        const dueDateInput = document.getElementById('tn-due-date');
        const dueDate = (isCreditCheckbox && isCreditCheckbox.checked && dueDateInput) ? dueDateInput.value : null;
        
        const currency = document.getElementById('tn-currency') ? document.getElementById('tn-currency').value : 'CRC';
        const exchangeRate = document.getElementById('tn-exchange-rate') ? parseFloat(document.getElementById('tn-exchange-rate').value) : 1.0;
        const accountId = document.getElementById('tn-account-id') ? document.getElementById('tn-account-id').value : '';
        const contactId = document.getElementById('tn-contact-id') ? document.getElementById('tn-contact-id').value : '';
        const warehouseId = document.getElementById('tn-warehouse-id') ? document.getElementById('tn-warehouse-id').value : '';
        
        if (!extraData) extraData = {};
        extraData.is_paid = isPaid;
        extraData.due_date = dueDate;
        extraData.currency = currency;
        extraData.exchange_rate = exchangeRate;
        if (accountId) extraData.account_id = parseInt(accountId);
        if (contactId) extraData.contact_id = parseInt(contactId);
        
        // FASE 22: Inventario
        if (warehouseId && state.productosNegocio) {
            const prodName = category.split(' - ')[0] || category; // en caso de usar algun sufijo
            const prod = state.productosNegocio.find(p => p.name.toLowerCase() === prodName.toLowerCase());
            if (prod) {
                extraData.items = [{
                    product_id: prod.id,
                    warehouse_id: parseInt(warehouseId),
                    quantity: 1, // Por simplicidad en Puntos de Venta asume 1, se podria agregar input de qty
                    price: parseFloat(amount)
                }];
            }
        }

        await saveTransaction(state.currentBusinessId, type, amount, category, extraData);
        ui.formNegocio.reset();
        // Ocultar campos de Hacienda si estaban visibles (el reset desmarca el checkbox pero no oculta el div)
        if (wasHacienda) {
            document.getElementById('hacienda-fields').style.display = 'none';
        }
        loadBusinessData();
    });

    // Cambiar Negocio
    ui.businessSelector.addEventListener('change', (e) => {
        state.currentBusinessId = e.target.value ? parseInt(e.target.value) : null;
        if(state.currentBusinessId) {
            ui.businessContent.style.display = 'block';
            loadBusinessData();
        } else {
            ui.businessContent.style.display = 'none';
        }
    });

    // BotÃ³n crear negocio
    ui.btnNuevoNegocio.addEventListener('click', () => {
        ui.formCrearNegocio.style.display = 'block';
    });

    // Formulario crear negocio
    document.getElementById('form-crear-negocio').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-biz-name').value;
        const legalId = document.getElementById('new-biz-cedula').value;
        
        try {
            const res = await authFetch('/businesses', {
                method: 'POST',
                body: JSON.stringify({ name, legal_id: legalId })
            });
            if(res.id) {
                ui.formCrearNegocio.style.display = 'none';
                document.getElementById('form-crear-negocio').reset();
                await fetchBusinesses();
                ui.businessSelector.value = res.id;
                ui.businessSelector.dispatchEvent(new Event('change'));
            }
        } catch(e) {
            alert('Error creando negocio');
        }
    });

    // Formulario ConfiguraciÃ³n Hacienda
    document.getElementById('form-hacienda-config').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!state.currentBusinessId) return alert("Selecciona un negocio");
        
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Encriptando y guardando...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('business_id', state.currentBusinessId);
        formData.append('atv_username', document.getElementById('hc-user').value);
        formData.append('atv_password', document.getElementById('hc-pass').value);
        formData.append('pin', document.getElementById('hc-pin').value);
        
        const fileInput = document.getElementById('hc-p12');
        if (fileInput.files.length > 0) {
            formData.append('p12_file', fileInput.files[0]);
        }

        try {
            const response = await fetch(`${API_URL}/hacienda-config`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${state.token}` },
                body: formData
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Error al guardar configuraciÃ³n");
            
            alert(data.message);
            fileInput.value = ''; // Limpiar input de archivo
            document.getElementById('hc-pass').value = '';
            document.getElementById('hc-pin').value = '';
            
            // Recargar estado
            await loadHaciendaStatus();
        } catch(err) {
            alert(err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// --- LÃ³gica API y Datos ---
async function authFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
        ...options.headers
    };
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('token');
        state.token = null;
        renderView('auth');
        throw new Error('SesiÃ³n expirada');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Error en el servidor');
    return data;
}

async function checkAuthAndLoad() {
    try {
        await authFetch('/me');
        
        const role = localStorage.getItem('userRole') || 'owner';
        if (role !== 'owner') {
            document.getElementById('btn-nuevo-negocio').style.display = 'none';
            document.getElementById('btn-subusers').style.display = 'none';
        } else {
            document.getElementById('btn-nuevo-negocio').style.display = 'inline-block';
            document.getElementById('btn-subusers').style.display = 'inline-block';
        }

        renderView('casa');
    } catch (e) {
        renderView('auth');
    }
}

async function loadCasaData() {
    try {
        const txs = await authFetch('/transactions'); // Sin business_id = casa
        state.transactionsCasa = txs;
        
        let ingresos = 0;
        let gastos = 0;
        ui.listCasa.innerHTML = '';
        
        txs.forEach(tx => {
            if(tx.type === 'income') ingresos += tx.amount;
            if(tx.type === 'expense') gastos += tx.amount;
            
            const li = document.createElement('li');
            li.className = 'tx-item';
            li.innerHTML = `
                <div>
                    <span class="tx-date">${new Date(tx.date).toLocaleDateString()}</span>
                    <span class="tx-category">${tx.category}</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <span class="tx-amount ${tx.type === 'income' ? 'tx-income' : 'tx-expense'}">
                        ${tx.type === 'income' ? '+' : '-'} ₡${tx.amount.toFixed(2)}
                    </span>
                    <button class="btn-delete" onclick="deleteTransaction(${tx.id})" title="Eliminar movimiento">🗑️</button>
                </div>
            `;
            ui.listCasa.appendChild(li);
        });

        ui.casaIngresos.innerText = `â‚¡${ingresos.toLocaleString()}`;
        ui.casaGastos.innerText = `â‚¡${gastos.toLocaleString()}`;
        ui.casaDisponible.innerText = `â‚¡${(ingresos - gastos).toLocaleString()}`;
        
    } catch(e) { console.error(e); }
}

async function fetchBusinesses() {
    const biz = await authFetch('/businesses');
    state.businesses = biz;
    ui.businessSelector.innerHTML = '<option value="">-- Selecciona un Negocio --</option>';
    biz.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.innerText = b.name;
        ui.businessSelector.appendChild(opt);
    });
}

async function loadBusinessData() {
