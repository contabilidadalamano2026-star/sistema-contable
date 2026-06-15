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
    if(!state.businesses.length) {
        await fetchBusinesses();
    }
    
    if(!state.currentBusinessId) return;

    try {
        const monthFilter = document.getElementById('filter-month') ? document.getElementById('filter-month').value : '';
        const textFilter = document.getElementById('filter-text') ? document.getElementById('filter-text').value.toLowerCase() : '';
        
        // 1. Inyectar primero los gastos recurrentes si corresponde
        await processRecurringExpenses(state.currentBusinessId);
        
        // 2. Traer transacciones frescas (ahora incluyen los recurrentes generados)
        const txs = await authFetch(`/transactions?business_id=${state.currentBusinessId}`);
        state.transactionsNegocio = txs;
        
        const tbody = document.getElementById('list-negocio');
        tbody.innerHTML = '';
        
        let ventas = 0;
        let gastos = 0;
        
        txs.forEach(tx => {
            // Aplicar filtros
            const txDate = new Date(tx.date);
            if (monthFilter !== '' && txDate.getMonth().toString() !== monthFilter) return;
            if (textFilter !== '' && (!tx.category.toLowerCase().includes(textFilter) && (!tx.description || !tx.description.toLowerCase().includes(textFilter)))) return;
            
            // Solo sumar a los totales si ya están pagadas
            if (tx.is_paid) {
                const amountCRC = tx.amount * (tx.exchange_rate || 1.0);
                if(tx.type === 'income') ventas += amountCRC;
                if(tx.type === 'expense') gastos += amountCRC;
            }
            
            const li = document.createElement('li');
            li.className = 'tx-item';
            
            // Determinar si se puede editar (no enviado a Hacienda o es borrador)
            const canEdit = !tx.hacienda_status || tx.hacienda_status.includes('error') || tx.hacienda_status === 'borrador';
            
            const currencyTag = (tx.currency && tx.currency !== 'CRC') ? ` <span style="color:#2196f3; font-weight:bold;">($${tx.amount.toFixed(2)} USD)</span>` : '';
            const displayAmount = tx.amount * (tx.exchange_rate || 1.0);
            
            li.innerHTML = `
                <div>
                    <span class="tx-date">${txDate.toLocaleDateString()}</span>
                    <span class="tx-category">${tx.category}</span>
                    ${tx.hacienda_status ? `<br><small style="color: ${tx.hacienda_status.includes('error') ? '#f44336' : (tx.hacienda_status === 'procesando' ? '#ff9800' : '#4caf50')}">
                        Hacienda: ${tx.hacienda_status} 
                        ${tx.hacienda_status === 'procesando' ? `<a href="#" onclick="checkHaciendaStatus(${tx.id}); return false;">Verificar</a>` : ''}
                        ${tx.hacienda_status.includes('error') ? `<a href="#" onclick="alert('Borrador guardado. Revise configuraciÃ³n.'); return false;">Reintentar</a>` : ''}
                    </small>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="tx-amount ${tx.type === 'income' ? 'tx-income' : 'tx-expense'}">
                        ${tx.type === 'income' ? '+' : '-'} ₡${displayAmount.toFixed(2)} ${currencyTag}
                    </span>
                    ${!tx.is_paid && tx.hacienda_status !== 'anulado' ? '<small style="color:#f44336; font-weight:bold;">[PENDIENTE]</small>' : ''}
                    ${tx.hacienda_status === 'anulado' ? '<small style="color:#f44336; font-weight:bold;">[ANULADO]</small>' : ''}
                    ${canEdit ? `<button class="btn-delete" onclick="openEditModal(${tx.id})" title="Editar" style="background:transparent; color:#ff9800;">✏️</button>` : ''}
                    ${tx.hacienda_status === 'aceptado' ? `<button class="btn-delete" onclick="anularFactura(${tx.id})" title="Anular (Nota de Crédito)" style="background:transparent; color:#f44336;">🚫</button>` : ''}
                    ${!tx.is_paid && tx.hacienda_status !== 'anulado' ? `<button class="btn-delete" onclick="openPaymentModal(${tx.id})" title="Abonar" style="background:transparent; color:#4caf50;">💰</button>` : ''}
                    <button class="btn-delete" onclick="deleteTransaction(${tx.id})" title="Eliminar operacion">🗑️</button>
                </div>
            `;
            ui.listNegocio.appendChild(li);
        });

        ui.negVentas.innerText = `â‚¡${ventas.toLocaleString('es-CR')}`;
        ui.negGastos.innerText = `â‚¡${gastos.toLocaleString('es-CR')}`;
        ui.negUtilidad.innerText = `â‚¡${(ventas - gastos).toLocaleString('es-CR')}`;
        
        // Renderizar GrÃ¡ficos AnalÃ­ticos
        renderCharts(txs, monthFilter, textFilter);
        
        // Cargar estado de hacienda
        await loadHaciendaStatus();
        
        // Cargar bodegas en el dropdown de facturación
        const warehouses = await authFetch(`/businesses/${state.currentBusinessId}/warehouses`);
        const whSelect = document.getElementById('tn-warehouse-id');
        if(whSelect) {
            whSelect.innerHTML = '<option value="">Sin deducir inventario</option>';
            warehouses.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w.id;
                opt.textContent = w.name;
                whSelect.appendChild(opt);
            });
        }
        
        // FASE 12: Cargar Cuentas Bancarias en el Dropdown
        await loadBankAccountsDropdown();
        
        // FASES 13-14: Cargar Contactos en Dropdown
        await loadContactsDropdown();
        
        // Cargar productos del inventario
        loadProducts(state.currentBusinessId);
        
        // Cargar vista administrativa de gastos recurrentes
        loadRecurring(state.currentBusinessId);
        
        // Cargar vista de RRHH (Nómina)
        loadEmployees(state.currentBusinessId);
        
        // Renderizar Cuentas por Cobrar/Pagar
        renderCxC();
        
    } catch(e) { console.error(e); }
}

async function loadHaciendaStatus() {
    if(!state.currentBusinessId) return;
    try {
        const data = await authFetch(`/hacienda-config?business_id=${state.currentBusinessId}`);
        const statusText = document.getElementById('hacienda-status-text');
        
        if (data.has_config) {
            document.getElementById('hc-user').value = data.atv_username || '';
            if (data.is_active) {
                statusText.innerHTML = `Estado: <span style="color:var(--success-color)">Activo y Vinculado</span>`;
            } else {
                statusText.innerHTML = `Estado: <span style="color:#f57c00">Incompleto (Falta Llave o Claves)</span>`;
            }
        } else {
            statusText.innerHTML = `Estado: <span style="color:var(--danger-color)">Inactivo</span>`;
            document.getElementById('hc-user').value = '';
        }
    } catch(e) { console.error('Error cargando estado de hacienda', e); }
}

async function saveTransaction(businessId, type, amount, category, extraData = null) {
    const payload = {
        business_id: businessId,
        type: type,
        amount: parseFloat(amount),
        category: category
    };
    
    if (extraData) {
        Object.assign(payload, extraData);
    }

    try {
        const response = await authFetch('/transactions', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        if (response.hacienda_xml) {
            console.log("=== XML DE HACIENDA GENERADO ===\n", response.hacienda_xml);
            alert("OperaciÃ³n registrada y Factura XML de Hacienda generada exitosamente (Revisa la consola para ver el XML).");
        } else {
            alert('TransacciÃ³n guardada exitosamente');
        }
        
    } catch(e) {
        alert('Error al guardar la transacciÃ³n');
    }
}

async function checkHaciendaStatus(txId) {
    try {
        const response = await authFetch(`/hacienda-status/${txId}`);
        alert(`Estado actualizado: ${response.status}`);
        loadBusinessData();
    } catch(e) {
        alert('Error al consultar estado a Hacienda');
    }
}

async function deleteTransaction(txId) {
    if(!confirm("Â¿EstÃ¡s seguro de que deseas eliminar este registro? Esta acciÃ³n no se puede deshacer.")) return;
    
    try {
        await authFetch(`/transactions/${txId}`, { method: 'DELETE' });
        if(state.currentBusinessId) loadBusinessData();
        else loadCasaData();
    } catch(e) {
        alert('Error al eliminar');
    }
}

let editingTxId = null;

function openEditModal(txId) {
    const tx = state.transactionsNegocio.find(t => t.id === txId) || state.transactionsCasa.find(t => t.id === txId);
    if(!tx) return;
    
    editingTxId = txId;
    document.getElementById('edit-category').value = tx.category;
    document.getElementById('edit-amount').value = tx.amount;
    document.getElementById('edit-date').value = tx.date.split(' ')[0]; // yyyy-mm-dd
    
    document.getElementById('modal-edit-tx').style.display = 'flex';
}

document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
    if(!editingTxId) return;
    const cat = document.getElementById('edit-category').value;
    const amount = document.getElementById('edit-amount').value;
    const d = document.getElementById('edit-date').value;
    
    try {
        await authFetch(`/transactions/${editingTxId}`, {
            method: 'PUT',
            body: JSON.stringify({
                category: cat,
                amount: parseFloat(amount),
                date: d + " 00:00:00"
            })
        });
        document.getElementById('modal-edit-tx').style.display = 'none';
        if(state.currentBusinessId) loadBusinessData();
        else loadCasaData();
    } catch(e) {
        alert('Error al editar');
    }
});

document.getElementById('filter-month')?.addEventListener('change', loadBusinessData);
document.getElementById('filter-text')?.addEventListener('input', loadBusinessData);

// Sub-Tab Switch para Negocios
window.switchNegocioTab = function(tabName) {
    // Esconder todas las vistas y quitar active a todos los botones
    document.querySelectorAll('.tab-menu .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('[id^="subview-"]').forEach(view => view.style.display = 'none');
    
    // Mostrar la solicitada
    const targetBtn = document.getElementById('tab-' + tabName);
    const targetView = document.getElementById('subview-' + tabName);
    
    if (targetBtn) targetBtn.classList.add('active');
    if (targetView) {
        targetView.style.display = 'block';
        // Disparar carga dinámica si existe
        if (tabName === 'iva') renderIvaModule();
        if (tabName === 'bancos') renderBancosModule();
        if (tabName === 'contactos') renderContactosModule();
        if (tabName === 'cotizaciones') renderCotizacionesModule();
        if (tabName === 'catalogo-contable') renderCatalogoContableModule();
        if (tabName === 'libro-diario') renderLibroDiarioModule();
    }
};

window.toggleHaciendaFields = function() {
    const check = document.getElementById('tn-emitir-hacienda');
    const fields = document.getElementById('hacienda-fields');
    fields.style.display = check.checked ? 'flex' : 'none';
};

// Iniciar app
init();

let chartTendencia = null;
let chartCategorias = null;

function renderCharts(allTxs, monthFilter, textFilter) {
    // Filtrar los datos (igual que en la lista)
    const txs = allTxs.filter(tx => {
        const txDate = new Date(tx.date);
        if (monthFilter !== '' && txDate.getMonth().toString() !== monthFilter) return false;
        if (textFilter !== '' && (!tx.category.toLowerCase().includes(textFilter) && (!tx.description || !tx.description.toLowerCase().includes(textFilter)))) return false;
        return true;
    });

    // 1. Datos para GrÃ¡fico de Tendencia (Agrupados por Mes)
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresosPorMes = new Array(12).fill(0);
    const gastosPorMes = new Array(12).fill(0);
    
    // 2. Datos para Gráfico de Categorías (Sólo gastos)
    const gastosPorCat = {};

    txs.forEach(tx => {
        // IGNORAR CUENTAS NO PAGADAS EN EL FLUJO DE CAJA
        if (!tx.is_paid) return;
        
        const amountCRC = tx.amount * (tx.exchange_rate || 1.0);
        const mes = new Date(tx.date).getMonth();
        if (tx.type === 'income') {
            ingresosPorMes[mes] += amountCRC;
        } else {
            gastosPorMes[mes] += amountCRC;
            gastosPorCat[tx.category] = (gastosPorCat[tx.category] || 0) + amountCRC;
        }
    });

    // Destruir grÃ¡ficos anteriores si existen
    if (chartTendencia) chartTendencia.destroy();
    if (chartCategorias) chartCategorias.destroy();

    // Dibujar Tendencia
    const ctxTendencia = document.getElementById('chart-tendencia').getContext('2d');
    chartTendencia = new Chart(ctxTendencia, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [
                {
                    label: 'Ventas Netas',
                    data: ingresosPorMes,
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: '#4caf50',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Gastos',
                    data: gastosPorMes,
                    backgroundColor: 'rgba(244, 67, 54, 0.6)',
                    borderColor: '#f44336',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { color: '#ffffff' } }
            },
            scales: {
                y: { ticks: { color: '#a0aabf' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#a0aabf' }, grid: { display: false } }
            }
        }
    });

    // Dibujar CategorÃ­as
    const ctxCategorias = document.getElementById('chart-categorias').getContext('2d');
    const catLabels = Object.keys(gastosPorCat);
    const catData = Object.values(gastosPorCat);
    
    chartCategorias = new Chart(ctxCategorias, {
        type: 'doughnut',
        data: {
            labels: catLabels.length ? catLabels : ['Sin Datos'],
            datasets: [{
                data: catData.length ? catData : [1],
                backgroundColor: [
                    '#ff9800', '#f44336', '#9c27b0', '#3f51b5', '#00bcd4', '#8bc34a', '#ffc107', '#795548', '#607d8b'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            cutout: '60%',
            plugins: {
                legend: { position: 'right', labels: { color: '#ffffff', boxWidth: 12 } }
            }
        }
    });
}
function exportToCSV() {
    if (!state.transactionsNegocio || state.transactionsNegocio.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    
    // Obtener filtros actuales
    const monthFilter = document.getElementById('filter-month') ? document.getElementById('filter-month').value : '';
    const textFilter = document.getElementById('filter-text') ? document.getElementById('filter-text').value.toLowerCase() : '';
    
    const filteredTxs = state.transactionsNegocio.filter(tx => {
        const txDate = new Date(tx.date);
        if (monthFilter !== '' && txDate.getMonth().toString() !== monthFilter) return false;
        if (textFilter !== '' && (!tx.category.toLowerCase().includes(textFilter) && (!tx.description || !tx.description.toLowerCase().includes(textFilter)))) return false;
        return true;
    });

    if (filteredTxs.length === 0) {
        alert("Los filtros actuales no devuelven resultados para exportar.");
        return;
    }

    let csvContent = "Fecha,Tipo,Categoría,Detalle,Monto (CRC),Estado Hacienda
";
    
    filteredTxs.forEach(tx => {
        const fecha = new Date(tx.date).toLocaleDateString();
        const tipo = tx.type === 'income' ? 'Ingreso' : 'Gasto';
        const categoria = "${tx.category || ''}";
        const detalle = "${tx.description || ''}";
        const monto = tx.amount.toFixed(2);
        const estado = "${tx.hacienda_status || 'Local'}";
        
        csvContent += "","","","","","
";
    });

    // Añadir BOM para que Excel lea los acentos correctamente
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Reporte_Contable_" + new Date().getTime() + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- MODULO DE INVENTARIO / CATALOGO ---

async function loadProducts(businessId) {
    try {
        const response = await fetch(`${API_URL}/products?business_id=${businessId}`, {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        if (response.ok) {
            state.productosNegocio = await response.json();
            renderProducts();
            populateProductDatalist();
        }
    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

function renderProducts() {
    const tbody = document.getElementById('list-productos');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!state.productosNegocio || state.productosNegocio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay productos en el inventario.</td></tr>';
        return;
    }
    
    state.productosNegocio.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #ddd';
        const qtyText = p.warehouse_name ? `${p.quantity} (${p.warehouse_name})` : p.quantity;
        tr.innerHTML = `
            <td style="padding:10px;">${p.product_name}</td>
            <td style="padding:10px;">₡${p.price.toFixed(2)}</td>
            <td style="padding:10px;">Stock: ${qtyText}</td>
            <td style="padding:10px; text-align:right;">
                <button class="btn btn-outline" style="padding:3px 8px; font-size:0.8rem;" onclick="openProductModal(${p.product_id})">Editar</button>
                <button class="btn btn-danger" style="padding:3px 8px; font-size:0.8rem;" onclick="deleteProduct(${p.product_id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Funciones FASE 22: Bodegas
async function loadWarehouses() {
    if (!state.currentBusinessId) return;
    const warehouses = await authFetch(`/businesses/${state.currentBusinessId}/warehouses`);
    const ul = document.getElementById('list-warehouses');
    if(ul) {
        ul.innerHTML = '';
        warehouses.forEach(w => {
            const li = document.createElement('li');
            li.className = 'tx-item';
            li.innerHTML = `<span>${w.name}</span>`;
            ul.appendChild(li);
        });
    }
}

function openWarehouseModal() {
    document.getElementById('modal-warehouse').style.display = 'flex';
    loadWarehouses();
}

function closeWarehouseModal() {
    document.getElementById('modal-warehouse').style.display = 'none';
}

async function createWarehouse() {
    const name = document.getElementById('warehouse-name').value;
    if(!name) return alert("Ingrese el nombre de la bodega");
    
    await authFetch(`/businesses/${state.currentBusinessId}/warehouses`, {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    document.getElementById('warehouse-name').value = '';
    loadWarehouses();
}

function populateProductDatalist() {
    const datalist = document.getElementById('products-list');
    if(!datalist) return;
    datalist.innerHTML = '';
    
    if(state.productosNegocio) {
        const added = new Set();
        state.productosNegocio.forEach(p => {
            if(!added.has(p.product_name)) {
                added.add(p.product_name);
                const option = document.createElement('option');
                option.value = p.product_name;
                datalist.appendChild(option);
            }
        });
    }
}

function onProductSelect(productName) {
    if(!state.productosNegocio) return;
    const prod = state.productosNegocio.find(p => p.product_name.toLowerCase() === productName.toLowerCase());
    if(prod) {
        document.getElementById('tn-amount').value = prod.price;
        const ivaSelect = document.getElementById('tn-iva');
        if(ivaSelect) {
            ivaSelect.value = prod.iva_rate ? prod.iva_rate.toString() : "0";
        }
    }
}

function openProductModal(id = null) {
    document.getElementById('modal-product').style.display = 'flex';
    document.getElementById('prod-id').value = id || '';
    if(id) {
        const prod = state.productosNegocio.find(p => p.id === id);
        if(prod) {
            document.getElementById('modal-product-title').innerText = 'Editar Producto';
            document.getElementById('prod-name').value = prod.name;
            document.getElementById('prod-price').value = prod.price;
            document.getElementById('prod-iva').value = prod.iva_rate;
            document.getElementById('prod-stock').value = prod.stock;
        }
    } else {
        document.getElementById('modal-product-title').innerText = 'Nuevo Producto';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-iva').value = '13';
        document.getElementById('prod-stock').value = '0';
    }
}

function closeProductModal() {
    document.getElementById('modal-product').style.display = 'none';
}

async function saveProduct() {
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const iva_rate = parseInt(document.getElementById('prod-iva').value);
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    
    if(!name || isNaN(price)) {
        alert("Completa el nombre y el precio válidamente.");
        return;
    }
    
    const payload = id ? { name, price, iva_rate, stock } : { business_id: state.currentBusinessId, name, price, iva_rate, stock };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/products/${id}` : `${API_URL}/products`;
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + state.token
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            closeProductModal();
            loadProducts(state.currentBusinessId);
        } else {
            alert("Error al guardar producto");
        }
    } catch (error) {
        console.error("Error guardando producto:", error);
    }
}

async function deleteProduct(id) {
    if(!confirm("¿Seguro que deseas borrar este producto del catálogo?")) return;
    
    try {
        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (response.ok) {
            loadProducts(state.currentBusinessId);
        } else {
            alert("Error al borrar producto");
        }
    } catch (error) {
        console.error("Error borrando producto:", error);
    }
}

// --- MODULO DE GASTOS RECURRENTES / SUSCRIPCIONES ---

async function processRecurringExpenses(businessId) {
    try {
        await fetch(`${API_URL}/recurring_expenses/process?business_id=${businessId}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
    } catch(e) {
        console.error("Error procesando gastos recurrentes automáticos", e);
    }
}

async function loadRecurring(businessId) {
    try {
        const response = await fetch(`${API_URL}/recurring_expenses?business_id=${businessId}`, {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        if (response.ok) {
            state.recurringNegocio = await response.json();
            renderRecurring();
        }
    } catch (error) {
        console.error("Error cargando gastos recurrentes:", error);
    }
}

function renderRecurring() {
    const tbody = document.getElementById('list-recurrentes');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!state.recurringNegocio || state.recurringNegocio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No hay gastos recurrentes configurados.</td></tr>';
        return;
    }
    
    state.recurringNegocio.forEach(r => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #ddd';
        tr.innerHTML = `
            <td style="padding:10px;">${r.category}</td>
            <td style="padding:10px;">${r.description}</td>
            <td style="padding:10px; color: #f44336;">₡${r.amount.toFixed(2)}</td>
            <td style="padding:10px;">Día ${r.day_of_month}</td>
            <td style="padding:10px; color: #888;">${r.last_processed || 'Nunca'}</td>
            <td style="padding:10px; text-align:right;">
                <button class="btn btn-danger" style="padding:3px 8px; font-size:0.8rem;" onclick="deleteRecurring(${r.id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openRecurringModal() {
    document.getElementById('modal-recurring').style.display = 'flex';
    document.getElementById('rec-category').value = '';
    document.getElementById('rec-description').value = '';
    document.getElementById('rec-amount').value = '';
    document.getElementById('rec-day').value = '1';
}

function closeRecurringModal() {
    document.getElementById('modal-recurring').style.display = 'none';
}

async function saveRecurring() {
    const category = document.getElementById('rec-category').value;
    const description = document.getElementById('rec-description').value;
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const day_of_month = parseInt(document.getElementById('rec-day').value);
    
    if(!category || !description || isNaN(amount) || isNaN(day_of_month)) {
        alert("Completa todos los campos correctamente.");
        return;
    }
    
    const payload = { business_id: state.currentBusinessId, category, description, amount, day_of_month };
    
    try {
        const response = await fetch(`${API_URL}/recurring_expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + state.token
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            closeRecurringModal();
            loadRecurring(state.currentBusinessId);
        } else {
            alert("Error al crear gasto fijo");
        }
    } catch (error) {
        console.error("Error guardando:", error);
    }
}

async function deleteRecurring(id) {
    if(!confirm("¿Seguro que deseas eliminar este gasto recurrente? No se procesará más en el futuro.")) return;
    
    try {
        const response = await fetch(`${API_URL}/recurring_expenses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (response.ok) {
            loadRecurring(state.currentBusinessId);
        } else {
            alert("Error al borrar");
        }
    } catch (error) {
        console.error("Error borrando:", error);
    }
}

// --- MODULO DE PLANILLAS / RRHH (NOMINA) ---

async function loadEmployees(businessId) {
    try {
        const response = await fetch(`${API_URL}/employees?business_id=${businessId}`, {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        if (response.ok) {
            state.employeesNegocio = await response.json();
            renderEmployees();
        }
    } catch (error) {
        console.error("Error cargando empleados:", error);
    }
}

function renderEmployees() {
    const tbody = document.getElementById('list-employees');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!state.employeesNegocio || state.employeesNegocio.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay empleados registrados.</td></tr>';
        return;
    }
    
    state.employeesNegocio.forEach(emp => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #ddd';
        tr.innerHTML = `
            <td style="padding:10px;">${emp.name}</td>
            <td style="padding:10px;">${emp.identification || 'N/A'}</td>
            <td style="padding:10px;">₡${emp.base_salary.toFixed(2)}</td>
            <td style="padding:10px;">
                <span style="color: ${emp.is_active ? '#4CAF50' : '#f44336'}">
                    ${emp.is_active ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td style="padding:10px; text-align:right;">
                ${emp.is_active ? `<button class="btn btn-outline" style="padding:3px 8px; font-size:0.8rem; margin-right: 5px;" onclick="payEmployee(${emp.id})">Pagar Salario</button>` : ''}
                <button class="btn btn-danger" style="padding:3px 8px; font-size:0.8rem;" onclick="deleteEmployee(${emp.id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openEmployeeModal() {
    document.getElementById('modal-employee').style.display = 'flex';
    document.getElementById('emp-name').value = '';
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-salary').value = '';
}

function closeEmployeeModal() {
    document.getElementById('modal-employee').style.display = 'none';
}

async function saveEmployee() {
    const name = document.getElementById('emp-name').value;
    const identification = document.getElementById('emp-id').value;
    const base_salary = parseFloat(document.getElementById('emp-salary').value);
    
    if(!name || isNaN(base_salary)) {
        alert("El nombre y salario base son obligatorios.");
        return;
    }
    
    const payload = { business_id: state.currentBusinessId, name, identification, base_salary };
    
    try {
        const response = await fetch(`${API_URL}/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + state.token
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            closeEmployeeModal();
            loadEmployees(state.currentBusinessId);
        } else {
            alert("Error al registrar empleado");
        }
    } catch (error) {
        console.error("Error guardando empleado:", error);
    }
}

async function deleteEmployee(id) {
    if(!confirm("¿Seguro que deseas eliminar a este empleado?")) return;
    
    try {
        const response = await fetch(`${API_URL}/employees/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (response.ok) {
            loadEmployees(state.currentBusinessId);
        } else {
            alert("Error al borrar");
        }
    } catch (error) {
        console.error("Error borrando:", error);
    }
}

async function payEmployee(id) {
    const emp = state.employeesNegocio.find(e => e.id === id);
    if(!emp) return;
    
    if(!confirm(`¿Registrar pago de salario mensual por ₡${emp.base_salary.toFixed(2)} a ${emp.name}?`)) return;
    
    const payload = { 
        amount: emp.base_salary, 
        description: `Salario Base (Automático)` 
    };
    
    try {
        const response = await fetch(`${API_URL}/employees/${id}/pay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + state.token
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert("Pago registrado en el flujo de caja exitosamente.");
            // Recargar movimientos para reflejar el pago
            loadBusinessData();
            // Cambiar a pestaña de movimientos para que el usuario vea el cambio
            switchNegocioTab('movimientos');
        } else {
            alert("Error registrando pago");
        }
    } catch (error) {
        console.error("Error pagando:", error);
    }
}

// --- MODULO DE REPORTES Y ESTADOS FINANCIEROS (FASE 8) ---

function generateFinancialReport() {
    if(!state.currentBusiness || !state.transactionsNegocio) return;
    
    const month = document.getElementById('report-month').value;
    const year = document.getElementById('report-year').value;
    
    // Filtrar transacciones (SOLO PAGADAS para el Estado de Resultados)
    const filteredTxs = state.transactionsNegocio.filter(tx => {
        if (!tx.is_paid) return false;
        const d = new Date(tx.date);
        const yMatch = d.getFullYear().toString() === year;
        const mMatch = month === 'all' ? true : (d.getMonth() + 1).toString().padStart(2, '0') === month;
        return yMatch && mMatch;
    });
    
    let totalVentas = 0;
    let totalGastos = 0;
    let gastosMap = {};
    
    filteredTxs.forEach(tx => {
        const amountCRC = tx.amount * (tx.exchange_rate || 1.0);
        if (tx.type === 'income') {
            totalVentas += amountCRC;
        } else if (tx.type === 'expense') {
            totalGastos += amountCRC;
            const cat = tx.category || 'Otros Gastos';
            gastosMap[cat] = (gastosMap[cat] || 0) + amountCRC;
        }
    });
    
    const utilidadNeta = totalVentas - totalGastos;
    
    // Llenar HTML del Reporte
    document.getElementById('rep-business-name').innerText = state.currentBusiness.name.toUpperCase();
    document.getElementById('rep-business-id').innerText = state.currentBusiness.legal_id;
    
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const periodText = month === 'all' ? `Año Fiscal ${year}` : `${monthNames[parseInt(month)-1]} ${year}`;
    document.getElementById('rep-period').innerText = `Período: ${periodText}`;
    
    document.getElementById('rep-ingresos').innerText = `₡${ingresosTotales.toFixed(2)}`;
    document.getElementById('rep-utilidad-bruta').innerText = `₡${ingresosTotales.toFixed(2)}`;
    
    const listaGastosDiv = document.getElementById('rep-gastos-lista');
    listaGastosDiv.innerHTML = '';
    
    if (Object.keys(gastosMap).length === 0) {
        listaGastosDiv.innerHTML = `<div style="color:#777; font-style:italic;">No se registraron gastos en este período.</div>`;
    } else {
        for (const [cat, amt] of Object.entries(gastosMap)) {
            listaGastosDiv.innerHTML += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>${cat}</span>
                    <span>₡${amt.toFixed(2)}</span>
                </div>
            `;
        }
    }
    
    document.getElementById('rep-total-gastos').innerText = `₡${gastosTotales.toFixed(2)}`;
    document.getElementById('rep-utilidad-neta').innerText = `₡${utilidadNeta.toFixed(2)}`;
    document.getElementById('rep-utilidad-neta').style.color = utilidadNeta >= 0 ? '#000' : '#d32f2f';
    
    // Mostrar reporte
    document.getElementById('report-preview').style.display = 'block';
}

// --- MODULO CXC / CXP (CUENTAS PENDIENTES) ---

function renderCxC() {
    const tbody = document.getElementById('list-cxc');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const pendingTxs = state.transactionsNegocio.filter(tx => !tx.is_paid);
    
    if(pendingTxs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No hay cuentas pendientes de cobro o pago.</td></tr>';
        return;
    }
    
    pendingTxs.forEach(tx => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #ddd';
        const isIncome = tx.type === 'income';
        const concept = isIncome ? 'Cobro Pendiente (Venta)' : 'Pago Pendiente (Compra)';
        const dateStr = new Date(tx.date).toLocaleDateString();
        
        const displayAmountCRC = tx.amount * (tx.exchange_rate || 1.0);
        const currencyTag = (tx.currency && tx.currency !== 'CRC') ? `<br><small style="color:#2196f3;">$${tx.amount.toFixed(2)} USD</small>` : '';
        
        tr.innerHTML = `
            <td style="padding:10px;">${dateStr}</td>
            <td style="padding:10px;"><strong style="color:${isIncome ? '#4caf50' : '#f44336'}">${concept}</strong></td>
            <td style="padding:10px;">${tx.category} <br><small>${tx.description || ''}</small></td>
            <td style="padding:10px;">${tx.due_date ? tx.due_date : '<span style="color:#777">No definida</span>'}</td>
            <td style="padding:10px; font-weight:bold;">₡${displayAmountCRC.toFixed(2)} ${currencyTag}</td>
            <td style="padding:10px; text-align:right;">
                <button class="btn btn-primary" style="padding:5px 10px; font-size:0.8rem;" onclick="markAsPaid(${tx.id})">
                    ${isIncome ? '💵 Recibí el Dinero' : '💵 Ya lo Pagué'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function markAsPaid(txId) {
    if(!confirm("¿Confirmas que esta transacción ya fue liquidada/pagada? Esto inyectará el monto en tu flujo de caja neto.")) return;
    
    try {
        const response = await fetch(`${API_URL}/transactions/${txId}/pay`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (response.ok) {
            alert("✅ Transacción marcada como pagada. El flujo de caja ha sido actualizado.");
            loadBusinessData(); // Recargar todo para actualizar graficos
        } else {
            alert("Error al actualizar la transacción.");
        }
    } catch (error) {
        console.error("Error pagando transacción:", error);
    }
}

// --- FASE 15: ANULAR FACTURA (NOTA DE CREDITO) ---
async function anularFactura(txId) {
    if(!confirm("¿Deseas emitir una Nota de Crédito para anular esta factura electrónica de forma permanente?")) return;
    try {
        await authFetch(`/transactions/${txId}/anular`, { method: 'POST' });
        alert("Nota de Crédito generada exitosamente. Factura anulada.");
        loadBusinessData();
    } catch (e) {
        console.error(e);
        alert("Error al anular la factura.");
    }
}

// --- FASE 11: MODULO IVA (D-104) ---

function renderIvaModule() {
    const month = document.getElementById('iva-month') ? document.getElementById('iva-month').value : new Date().getMonth().toString();
    const year = document.getElementById('iva-year') ? document.getElementById('iva-year').value : new Date().getFullYear().toString();
    
    let debitoFiscal = 0; // IVA cobrado en ventas
    let creditoFiscal = 0; // IVA pagado en compras
    
    state.transactionsNegocio.forEach(tx => {
        const d = new Date(tx.date);
        if (d.getFullYear().toString() !== year || d.getMonth().toString() !== month) return;
        
        // El IVA debe estar consolidado en CRC
        const ivaCRC = (tx.iva_amount || 0) * (tx.exchange_rate || 1.0);
        
        if (tx.type === 'income') {
            debitoFiscal += ivaCRC;
        } else {
            creditoFiscal += ivaCRC;
        }
    });
    
    const ivaPagar = debitoFiscal - creditoFiscal;
    
    const container = document.getElementById('iva-results');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-top:20px; text-align:center;">
            <div class="glass-card" style="flex:1; border: 2px solid #4caf50;">
                <h4 style="color:#a0aabf; margin:0;">Débito Fiscal (IVA Cobrado)</h4>
                <h2 style="color:#4caf50; margin:10px 0;">₡${debitoFiscal.toLocaleString('es-CR', {minimumFractionDigits:2})}</h2>
            </div>
            <div style="font-size: 2rem; padding: 20px;">-</div>
            <div class="glass-card" style="flex:1; border: 2px solid #f44336;">
                <h4 style="color:#a0aabf; margin:0;">Crédito Fiscal (IVA Pagado)</h4>
                <h2 style="color:#f44336; margin:10px 0;">₡${creditoFiscal.toLocaleString('es-CR', {minimumFractionDigits:2})}</h2>
            </div>
        </div>
        <div class="glass-card" style="margin-top:20px; text-align:center; background: ${ivaPagar > 0 ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)'}; border: 2px solid ${ivaPagar > 0 ? '#ff9800' : '#4caf50'};">
            <h3 style="color:#a0aabf; margin:0;">Total a Declarar y Pagar (Hacienda)</h3>
            <h1 style="color:${ivaPagar > 0 ? '#ff9800' : '#4caf50'}; font-size:3rem; margin:10px 0;">
                ₡${ivaPagar > 0 ? ivaPagar.toLocaleString('es-CR', {minimumFractionDigits:2}) : '0.00'}
            </h1>
            <p style="color:#78909c;">${ivaPagar < 0 ? `Tienes un saldo a favor de ₡${Math.abs(ivaPagar).toLocaleString('es-CR', {minimumFractionDigits:2})}` : 'Monto neto a transferir al Ministerio de Hacienda.'}</p>
        </div>
    `;
}

// --- FASE 12: BANCOS Y CONCILIACION ---

async function loadBankAccountsDropdown() {
    try {
        const banks = await authFetch(`/businesses/${state.currentBusinessId}/bank_accounts`);
        const select = document.getElementById('tn-account-id');
        if (!select) return;
        
        select.innerHTML = '<option value="">Efectivo / General</option>';
        banks.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.innerText = `${b.name} (${b.currency})`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
    }
}

async function renderBancosModule() {
    try {
        const banks = await authFetch(`/businesses/${state.currentBusinessId}/bank_accounts`);
        const list = document.getElementById('list-bancos');
        if (!list) return;
        
        list.innerHTML = '';
        banks.forEach(b => {
            const li = document.createElement('li');
            li.className = 'tx-item';
            li.innerHTML = `
                <div>
                    <span class="tx-category">${b.name}</span>
                    <br><small>${b.currency}</small>
                </div>
                <div style="text-align: right;">
                    <span class="tx-amount ${b.current_balance >= 0 ? 'tx-income' : 'tx-expense'}">
                        ${b.currency === 'CRC' ? '₡' : '$'}${b.current_balance.toLocaleString('es-CR', {minimumFractionDigits:2})}
                    </span>
                </div>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        console.error(e);
    }
}

const formBank = document.getElementById('form-bank');
if(formBank) {
    formBank.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await authFetch(`/businesses/${state.currentBusinessId}/bank_accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('bank-name').value,
                    currency: document.getElementById('bank-currency').value,
                    initial_balance: parseFloat(document.getElementById('bank-initial-balance').value)
                })
            });
            formBank.reset();
            renderBancosModule();
            loadBankAccountsDropdown();
        } catch (error) {
            console.error(error);
            alert("Error al crear cuenta bancaria");
        }
    });
}

// --- FASES 13 Y 14: CRM CLIENTES Y PROVEEDORES ---

async function loadContactsDropdown() {
    try {
        const contacts = await authFetch(`/businesses/${state.currentBusinessId}/contacts`);
        const select = document.getElementById('tn-contact-id');
        if (!select) return;
        
        select.innerHTML = '<option value="">Ninguno (Público General)</option>';
        const quoteSelect = document.getElementById('quote-contact');
        if (quoteSelect) quoteSelect.innerHTML = '<option value="">Selecciona un cliente</option>';
        
        contacts.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = `${c.name} - ${c.role === 'client' ? 'Cliente' : (c.role === 'provider' ? 'Proveedor' : 'Ambos')}`;
            select.appendChild(opt);
            
            if (quoteSelect && (c.role === 'client' || c.role === 'both')) {
                const qopt = document.createElement('option');
                qopt.value = c.id;
                qopt.innerText = c.name;
                quoteSelect.appendChild(qopt);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

async function renderContactosModule() {
    try {
        const roleFilter = document.getElementById('filter-contact-role') ? document.getElementById('filter-contact-role').value : '';
        const contacts = await authFetch(`/businesses/${state.currentBusinessId}/contacts`);
        const list = document.getElementById('list-contactos');
        if (!list) return;
        
        list.innerHTML = '';
        contacts.forEach(c => {
            // Filtrar
            if (roleFilter && c.role !== roleFilter && c.role !== 'both') return;
            
            const li = document.createElement('li');
            li.className = 'tx-item';
            li.innerHTML = `
                <div>
                    <span class="tx-category">${c.name} <small style="color:#2196f3;">[${c.role.toUpperCase()}]</small></span>
                    <br><small>Cédula: ${c.tax_id || 'N/A'} | Tel: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'}</small>
                </div>
                <div style="text-align: right;">
                    <button class="btn btn-secondary" onclick="deleteContact(${c.id})" style="padding: 4px 8px;">🗑️</button>
                </div>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        console.error(e);
    }
}

async function deleteContact(id) {
    if(!confirm("¿Eliminar contacto?")) return;
    try {
        await authFetch(`/contacts/${id}`, { method: 'DELETE' });
        renderContactosModule();
        loadContactsDropdown();
    } catch (e) {
        console.error(e);
        alert("Error al eliminar contacto. Puede que tenga transacciones asociadas.");
    }
}

const formContact = document.getElementById('form-contact');
if (formContact) {
    formContact.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await authFetch(`/businesses/${state.currentBusinessId}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('contact-name').value,
                    tax_id: document.getElementById('contact-taxid').value,
                    email: document.getElementById('contact-email').value,
                    phone: document.getElementById('contact-phone').value,
                    role: document.getElementById('contact-role').value
                })
            });
            formContact.reset();
            renderContactosModule();
            loadContactsDropdown();
        } catch (error) {
            console.error(error);
            alert("Error al guardar contacto");
        }
    });
}

// --- FASE 16: COTIZACIONES / PROFORMAS ---

async function renderCotizacionesModule() {
    try {
        const quotes = await authFetch(`/businesses/${state.currentBusinessId}/quotes`);
        const list = document.getElementById('list-cotizaciones');
        if (!list) return;
        
        list.innerHTML = '';
        quotes.forEach(q => {
            const li = document.createElement('li');
            li.className = 'tx-item';
            
            let badge = '';
            if (q.status === 'pending') badge = '<span style="background:#ff9800; color:#000; padding:2px 5px; border-radius:3px; font-size:10px; font-weight:bold;">PENDIENTE</span>';
            if (q.status === 'invoiced') badge = '<span style="background:#4caf50; color:#fff; padding:2px 5px; border-radius:3px; font-size:10px; font-weight:bold;">FACTURADA</span>';
            
            li.innerHTML = `
                <div>
                    <span class="tx-category">Proforma a ${q.contact_name || 'Desconocido'} ${badge}</span>
                    <br><small>${new Date(q.date).toLocaleDateString()} | ${q.details}</small>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 10px;">
                    <span class="tx-amount" style="color:#a0aabf; font-weight:bold;">₡${q.total.toLocaleString('es-CR', {minimumFractionDigits:2})}</span>
                    ${q.status === 'pending' ? `<button class="btn btn-primary" onclick="convertQuoteToInvoice(${q.id})" style="padding: 4px 8px; font-size: 0.8rem;">Facturar</button>` : ''}
                </div>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        console.error(e);
    }
}

async function convertQuoteToInvoice(id) {
    if(!confirm("¿Convertir esta cotización en una factura real?")) return;
    try {
        await authFetch(`/quotes/${id}/convert`, { method: 'POST' });
        alert("Cotización convertida en factura exitosamente (Borrador). Ve a 'Movimientos de Negocio' para revisarla o enviarla a Hacienda.");
        renderCotizacionesModule();
        loadBusinessData();
    } catch (e) {
        console.error(e);
        alert("Error convirtiendo cotización.");
    }
}

const formQuote = document.getElementById('form-quote');
if (formQuote) {
    formQuote.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await authFetch(`/businesses/${state.currentBusinessId}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contact_id: parseInt(document.getElementById('quote-contact').value),
                    total: parseFloat(document.getElementById('quote-total').value),
                    details: document.getElementById('quote-details').value,
                    date: new Date().toISOString()
                })
            });
            formQuote.reset();
            renderCotizacionesModule();
        } catch (error) {
            console.error(error);
            alert("Error al crear cotización");
        }
    });
}

// --- FASE 17: ABONOS Y PAGOS PARCIALES ---
async function openPaymentModal(txId) {
    const tx = state.transactionsNegocio.find(t => t.id === txId);
    if (!tx) return;
    
    document.getElementById('payment-tx-id').value = tx.id;
    document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('payment-amount').value = (tx.amount - tx.amount_paid).toFixed(2);
    
    // Rellenar select de bancos
    try {
        const banks = await authFetch(`/businesses/${state.currentBusinessId}/bank_accounts`);
        const select = document.getElementById('payment-account');
        select.innerHTML = '<option value="">Efectivo / General</option>';
        banks.forEach(b => {
            select.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    } catch(e) {}
    
    // Cargar historial de abonos
    try {
        const payments = await authFetch(`/transactions/${txId}/payments`);
        const list = document.getElementById('list-payments');
        list.innerHTML = '';
        payments.forEach(p => {
            list.innerHTML += `<li class="tx-item">
                <span class="tx-category">${new Date(p.date).toLocaleDateString()}</span>
                <span class="tx-amount tx-income">₡${p.amount.toFixed(2)}</span>
            </li>`;
        });
    } catch(e) {}
    
    document.getElementById('modal-payment').style.display = 'block';
}

function closePaymentModal() {
    document.getElementById('modal-payment').style.display = 'none';
}

async function savePayment() {
    const txId = document.getElementById('payment-tx-id').value;
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const date = document.getElementById('payment-date').value;
    let accountId = document.getElementById('payment-account').value;
    accountId = accountId ? parseInt(accountId) : null;
    
    if(!amount || !date) return alert("Completa los datos");
    
    try {
        await authFetch(`/transactions/${txId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, date, account_id: accountId })
        });
        closePaymentModal();
        loadBusinessData();
        alert("Abono registrado");
    } catch (e) {
        console.error(e);
        alert("Error al guardar abono");
    }
}

// --- FASE 18: CATALOGO CONTABLE ---

async function renderCatalogoContableModule() {
    try {
        const accounts = await authFetch(`/businesses/${state.currentBusinessId}/accounts_catalog`);
        const list = document.getElementById('list-cuentas-contables');
        if (!list) return;
        
        list.innerHTML = '';
        const typesMap = {
            'asset': { name: 'Activos', color: '#4caf50' },
            'liability': { name: 'Pasivos', color: '#f44336' },
            'equity': { name: 'Patrimonio', color: '#2196f3' },
            'revenue': { name: 'Ingresos', color: '#00bcd4' },
            'expense': { name: 'Gastos', color: '#ff9800' }
        };
        
        accounts.forEach(acc => {
            const li = document.createElement('li');
            li.className = 'tx-item';
            const typeInfo = typesMap[acc.type] || {name: 'Otro', color:'#fff'};
            
            li.innerHTML = `
                <div>
                    <span class="tx-category" style="font-family: monospace;">[${acc.code}]</span> ${acc.name}
                </div>
                <div style="text-align: right;">
                    <span style="background:${typeInfo.color}; color:#000; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold;">${typeInfo.name}</span>
                </div>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        console.error(e);
    }
}

const formAccountCatalog = document.getElementById('form-account-catalog');
if (formAccountCatalog) {
    formAccountCatalog.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await authFetch(`/businesses/${state.currentBusinessId}/accounts_catalog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: document.getElementById('account-code').value,
                    name: document.getElementById('account-name').value,
                    type: document.getElementById('account-type').value
                })
            });
            formAccountCatalog.reset();
            renderCatalogoContableModule();
        } catch (error) {
            console.error(error);
            alert("Error al crear cuenta contable");
        }
    });
}

// --- FASE 19: LIBRO DIARIO (ASIENTOS) ---

let currentJournalLines = [];

async function renderLibroDiarioModule() {
    try {
        const entries = await authFetch(`/businesses/${state.currentBusinessId}/journal_entries`);
        const list = document.getElementById('list-journal-entries');
        if (!list) return;
        
        list.innerHTML = '';
        entries.forEach(e => {
            let linesHtml = e.lines.map(l => `
                <div style="display:flex; justify-content:space-between; font-size:0.9em; padding:2px 0;">
                    <span>[${l.code}] ${l.name}</span>
                    <span style="font-family:monospace; width:150px; text-align:right;">
                        ${l.debit > 0 ? `<span style="color:#f44336; display:inline-block; width:70px;">${l.debit.toFixed(2)}</span>` : '<span style="display:inline-block; width:70px;"></span>'}
                        ${l.credit > 0 ? `<span style="color:#4caf50; display:inline-block; width:70px;">${l.credit.toFixed(2)}</span>` : '<span style="display:inline-block; width:70px;"></span>'}
                    </span>
                </div>
            `).join('');
            
            list.innerHTML += `
                <div class="card" style="border-left: 4px solid #3f51b5; padding: 15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong>${new Date(e.date).toLocaleDateString()} - ${e.description}</strong>
                        <small style="color:#888;">Ref: ${e.reference_type}</small>
                    </div>
                    <div style="background:#fafafa; padding:10px; border-radius:5px;">
                        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:0.8em; border-bottom:1px solid #ccc; margin-bottom:5px;">
                            <span>Cuenta</span>
                            <span style="width:150px; text-align:right;">
                                <span style="display:inline-block; width:70px;">Debe</span>
                                <span style="display:inline-block; width:70px;">Haber</span>
                            </span>
                        </div>
                        ${linesHtml}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function openJournalModal() {
    document.getElementById('journal-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('journal-description').value = '';
    currentJournalLines = [];
    updateJournalLinesUI();
    
    try {
        const accounts = await authFetch(`/businesses/${state.currentBusinessId}/accounts_catalog`);
        const select = document.getElementById('journal-account-select');
        select.innerHTML = '<option value="">Seleccione Cuenta...</option>';
        accounts.forEach(a => {
            select.innerHTML += `<option value="${a.id}">[${a.code}] ${a.name}</option>`;
        });
    } catch (e) {}
    
    document.getElementById('modal-journal').style.display = 'block';
}

function closeJournalModal() {
    document.getElementById('modal-journal').style.display = 'none';
}

function addJournalLine() {
    const select = document.getElementById('journal-account-select');
    const accId = parseInt(select.value);
    const accName = select.options[select.selectedIndex].text;
    let debit = parseFloat(document.getElementById('journal-debit-input').value) || 0;
    let credit = parseFloat(document.getElementById('journal-credit-input').value) || 0;
    
    if(!accId) return alert("Selecciona una cuenta");
    if(debit === 0 && credit === 0) return alert("Debes ingresar un valor en el Debe o en el Haber");
    
    currentJournalLines.push({ account_id: accId, name: accName, debit, credit });
    
    document.getElementById('journal-debit-input').value = '';
    document.getElementById('journal-credit-input').value = '';
    updateJournalLinesUI();
}

function updateJournalLinesUI() {
    const container = document.getElementById('journal-lines-container');
    container.innerHTML = '';
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    currentJournalLines.forEach((l, idx) => {
        totalDebit += l.debit;
        totalCredit += l.credit;
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; background:#fff; padding:8px; border:1px solid #eee; border-radius:4px;">
                <span>${l.name}</span>
                <span>
                    ${l.debit > 0 ? `<span style="color:#f44336; margin-right:10px;">D: ${l.debit.toFixed(2)}</span>` : ''}
                    ${l.credit > 0 ? `<span style="color:#4caf50; margin-right:10px;">H: ${l.credit.toFixed(2)}</span>` : ''}
                    <button type="button" onclick="currentJournalLines.splice(${idx},1); updateJournalLinesUI();" style="border:none; background:transparent; color:red; cursor:pointer;">✖</button>
                </span>
            </div>
        `;
    });
    
    document.getElementById('journal-total-debit').innerText = totalDebit.toFixed(2);
    document.getElementById('journal-total-credit').innerText = totalCredit.toFixed(2);
}

async function saveJournalEntry() {
    const date = document.getElementById('journal-date').value;
    const desc = document.getElementById('journal-description').value;
    
    if (!date || !desc) return alert("Completa la fecha y descripción");
    if (currentJournalLines.length < 2) return alert("El asiento debe tener al menos 2 líneas");
    
    let totalDebit = currentJournalLines.reduce((acc, l) => acc + l.debit, 0);
    let totalCredit = currentJournalLines.reduce((acc, l) => acc + l.credit, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return alert(`El asiento no cuadra. Debe: ${totalDebit.toFixed(2)} | Haber: ${totalCredit.toFixed(2)}`);
    }
    
    const lines = currentJournalLines.map(l => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit
    }));
    
    try {
        await authFetch(`/businesses/${state.currentBusinessId}/journal_entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                description: desc,
                lines,
                reference_type: 'manual'
            })
        });
        
        closeJournalModal();
        renderLibroDiarioModule();
        alert("Asiento guardado exitosamente");
    } catch (e) {
        console.error(e);
        alert("Error al guardar asiento");
    }
}

// --- FASE 20: ESTADOS FINANCIEROS ---

async function loadFinancialStatements() {
    try {
        const accounts = await authFetch(`/businesses/${state.currentBusinessId}/financial_statements`);
        const tbody = document.getElementById('financial-statements-body');
        tbody.innerHTML = '';
        
        let sumDebe = 0;
        let sumHaber = 0;
        
        accounts.forEach(acc => {
            if (acc.total_debit === 0 && acc.total_credit === 0) return; // Skip zero balance
            
            sumDebe += acc.total_debit;
            sumHaber += acc.total_credit;
            
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 5px;">${acc.code}</td>
                    <td style="padding: 5px;">${acc.name}</td>
                    <td style="padding: 5px; text-align: right;">${acc.total_debit.toFixed(2)}</td>
                    <td style="padding: 5px; text-align: right;">${acc.total_credit.toFixed(2)}</td>
                    <td style="padding: 5px; text-align: right; font-weight: bold;">${acc.balance.toFixed(2)}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML += `
            <tr style="border-top: 2px solid #ccc; font-weight: bold;">
                <td colspan="2" style="padding: 5px; text-align: right;">TOTALES</td>
                <td style="padding: 5px; text-align: right;">${sumDebe.toFixed(2)}</td>
                <td style="padding: 5px; text-align: right;">${sumHaber.toFixed(2)}</td>
                <td style="padding: 5px; text-align: right;">-</td>
            </tr>
        `;
        
        document.getElementById('financial-statements-container').style.display = 'block';
    } catch (e) {
        console.error(e);
        alert("Error al cargar estados financieros");
    }
}

// --- FASE 21: SUB-USUARIOS ---

async function openSubusersModal() {
    document.getElementById('modal-subusers').style.display = 'block';
    loadSubusers();
}

function closeSubusersModal() {
    document.getElementById('modal-subusers').style.display = 'none';
}

async function loadSubusers() {
    try {
        const users = await authFetch('/subusers');
        const list = document.getElementById('list-subusers');
        list.innerHTML = '';
        users.forEach(u => {
            list.innerHTML += `
                <li class="tx-item" style="border-left: 3px solid #ff9800;">
                    <div>
                        <strong>${u.username}</strong>
                    </div>
                    <div>
                        <span style="background:#ff9800; color:#fff; padding:2px 8px; border-radius:10px; font-size:11px;">${u.role.toUpperCase()}</span>
                    </div>
                </li>
            `;
        });
    } catch(e) {
        console.error(e);
    }
}

async function createSubuser() {
    const username = document.getElementById('subuser-username').value;
    const password = document.getElementById('subuser-password').value;
    const role = document.getElementById('subuser-role').value;
    
    if(!username || !password) return alert("Completa los datos");
    
    try {
        await authFetch('/subusers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        document.getElementById('subuser-username').value = '';
        document.getElementById('subuser-password').value = '';
        loadSubusers();
        alert("Sub-cuenta creada exitosamente");
    } catch(e) {
        console.error(e);
        alert("Error al crear sub-cuenta. Quizás el usuario ya existe.");
    }
}
