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
    const periodText = month === 'all' ? `AÃ±o Fiscal ${year}` : `${monthNames[parseInt(month)-1]} ${year}`;
    document.getElementById('rep-period').innerText = `PerÃ­odo: ${periodText}`;
    
    document.getElementById('rep-ingresos').innerText = `â‚¡${ingresosTotales.toFixed(2)}`;
    document.getElementById('rep-utilidad-bruta').innerText = `â‚¡${ingresosTotales.toFixed(2)}`;
    
    const listaGastosDiv = document.getElementById('rep-gastos-lista');
    listaGastosDiv.innerHTML = '';
    
    if (Object.keys(gastosMap).length === 0) {
        listaGastosDiv.innerHTML = `<div style="color:#777; font-style:italic;">No se registraron gastos en este perÃ­odo.</div>`;
    } else {
        for (const [cat, amt] of Object.entries(gastosMap)) {
            listaGastosDiv.innerHTML += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>${cat}</span>
                    <span>â‚¡${amt.toFixed(2)}</span>
                </div>
            `;
        }
    }
    
    document.getElementById('rep-total-gastos').innerText = `â‚¡${gastosTotales.toFixed(2)}`;
    document.getElementById('rep-utilidad-neta').innerText = `â‚¡${utilidadNeta.toFixed(2)}`;
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
            <td style="padding:10px; font-weight:bold;">â‚¡${displayAmountCRC.toFixed(2)} ${currencyTag}</td>
            <td style="padding:10px; text-align:right;">
                <button class="btn btn-primary" style="padding:5px 10px; font-size:0.8rem;" onclick="markAsPaid(${tx.id})">
                    ${isIncome ? 'ðŸ’µ RecibÃ­ el Dinero' : 'ðŸ’µ Ya lo PaguÃ©'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function markAsPaid(txId) {
    if(!confirm("Â¿Confirmas que esta transacciÃ³n ya fue liquidada/pagada? Esto inyectarÃ¡ el monto en tu flujo de caja neto.")) return;
    
    try {
        const response = await fetch(`${API_URL}/transactions/${txId}/pay`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (response.ok) {
            alert("âœ… TransacciÃ³n marcada como pagada. El flujo de caja ha sido actualizado.");
            loadBusinessData(); // Recargar todo para actualizar graficos
        } else {
            alert("Error al actualizar la transacciÃ³n.");
        }
    } catch (error) {
        console.error("Error pagando transacciÃ³n:", error);
    }
}

// --- FASE 15: ANULAR FACTURA (NOTA DE CREDITO) ---
async function anularFactura(txId) {
    if(!confirm("Â¿Deseas emitir una Nota de CrÃ©dito para anular esta factura electrÃ³nica de forma permanente?")) return;
    try {
        await authFetch(`/transactions/${txId}/anular`, { method: 'POST' });
        alert("Nota de CrÃ©dito generada exitosamente. Factura anulada.");
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
                <h4 style="color:#a0aabf; margin:0;">DÃ©bito Fiscal (IVA Cobrado)</h4>
                <h2 style="color:#4caf50; margin:10px 0;">â‚¡${debitoFiscal.toLocaleString('es-CR', {minimumFractionDigits:2})}</h2>
            </div>
            <div style="font-size: 2rem; padding: 20px;">-</div>
            <div class="glass-card" style="flex:1; border: 2px solid #f44336;">
                <h4 style="color:#a0aabf; margin:0;">CrÃ©dito Fiscal (IVA Pagado)</h4>
                <h2 style="color:#f44336; margin:10px 0;">â‚¡${creditoFiscal.toLocaleString('es-CR', {minimumFractionDigits:2})}</h2>
            </div>
        </div>
        <div class="glass-card" style="margin-top:20px; text-align:center; background: ${ivaPagar > 0 ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)'}; border: 2px solid ${ivaPagar > 0 ? '#ff9800' : '#4caf50'};">
            <h3 style="color:#a0aabf; margin:0;">Total a Declarar y Pagar (Hacienda)</h3>
            <h1 style="color:${ivaPagar > 0 ? '#ff9800' : '#4caf50'}; font-size:3rem; margin:10px 0;">
                â‚¡${ivaPagar > 0 ? ivaPagar.toLocaleString('es-CR', {minimumFractionDigits:2}) : '0.00'}
            </h1>
            <p style="color:#78909c;">${ivaPagar < 0 ? `Tienes un saldo a favor de â‚¡${Math.abs(ivaPagar).toLocaleString('es-CR', {minimumFractionDigits:2})}` : 'Monto neto a transferir al Ministerio de Hacienda.'}</p>
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
                        ${b.currency === 'CRC' ? 'â‚¡' : '$'}${b.current_balance.toLocaleString('es-CR', {minimumFractionDigits:2})}
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
        
        select.innerHTML = '<option value="">Ninguno (PÃºblico General)</option>';
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
                    <br><small>CÃ©dula: ${c.tax_id || 'N/A'} | Tel: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'}</small><br><small style="color:#e91e63; font-weight:bold;">Puntos Fidelidad: ${c.points ? c.points.toFixed(1) : '0.0'}</small>
                </div>
                <div style="text-align: right;">
                    <button class="btn btn-secondary" onclick="deleteContact(${c.id})" style="padding: 4px 8px;">ðŸ—‘ï¸</button>
                </div>
            `;
            list.appendChild(li);
        });
    } catch (e) {
        console.error(e);
    }
}

async function deleteContact(id) {
    if(!confirm("Â¿Eliminar contacto?")) return;
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
                    <span class="tx-amount" style="color:#a0aabf; font-weight:bold;">â‚¡${q.total.toLocaleString('es-CR', {minimumFractionDigits:2})}</span>
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
    if(!confirm("Â¿Convertir esta cotizaciÃ³n en una factura real?")) return;
    try {
        await authFetch(`/quotes/${id}/convert`, { method: 'POST' });
        alert("CotizaciÃ³n convertida en factura exitosamente (Borrador). Ve a 'Movimientos de Negocio' para revisarla o enviarla a Hacienda.");
        renderCotizacionesModule();
        loadBusinessData();
    } catch (e) {
        console.error(e);
        alert("Error convirtiendo cotizaciÃ³n.");
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
            alert("Error al crear cotizaciÃ³n");
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
                <span class="tx-amount tx-income">â‚¡${p.amount.toFixed(2)}</span>
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
                    <button type="button" onclick="currentJournalLines.splice(${idx},1); updateJournalLinesUI();" style="border:none; background:transparent; color:red; cursor:pointer;">âœ–</button>
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
    
    if (!date || !desc) return alert("Completa la fecha y descripciÃ³n");
    if (currentJournalLines.length < 2) return alert("El asiento debe tener al menos 2 lÃ­neas");
    
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
        alert("Error al crear sub-cuenta. QuizÃ¡s el usuario ya existe.");
    }
}
// FASE 25: ACTIVOS FIJOS
function openFixedAssetsModal() {
    document.getElementById('modal-fixed-assets').style.display = 'flex';
    document.getElementById('fa-date').valueAsDate = new Date();
    loadFixedAssets();
}
function closeFixedAssetsModal() {
    document.getElementById('modal-fixed-assets').style.display = 'none';
}
async function loadFixedAssets() {
    try {
        const assets = await authFetch(/businesses/${state.currentBusinessId}/fixed_assets);
        const ul = document.getElementById('list-fixed-assets');
        ul.innerHTML = '';
        assets.forEach(a => {
            const li = document.createElement('li');
            li.className = 'tx-item';
            li.innerHTML = 
                <div>
                    <strong>${a.name}</strong><br>
                    <small>Costo: ¢${a.value.toLocaleString()} - Comprado: ${a.purchase_date}</small><br>
                    <small>Depreciación anual: ${(a.depreciation_rate * 100).toFixed(1)}%</small>
                </div>
            ;
            ul.appendChild(li);
        });
    } catch(e) { console.error(e); }
}
async function createFixedAsset() {
    const name = document.getElementById('fa-name').value;
    const val = parseFloat(document.getElementById('fa-value').value);
    const date = document.getElementById('fa-date').value;
    const life = parseInt(document.getElementById('fa-lifespan').value);
    
    if(!name || !val || !date || !life) return alert('Llene todos los campos');
    
    // Cálculo simplificado de depreciación anual (Línea recta)
    const rate = 1.0 / life;
    
    const asset = {
        name: name,
        value: val,
        purchase_date: date,
        lifespan_years: life,
        depreciation_rate: rate
    };
    
    try {
        await authFetch(/businesses/${state.currentBusinessId}/fixed_assets, {
            method: 'POST',
            body: JSON.stringify(asset)
        });
        document.getElementById('fa-name').value = '';
        document.getElementById('fa-value').value = '';
        loadFixedAssets();
    } catch(e) {
        alert(e.message);
    }
}

// FASE 34: PRESUPUESTOS Y SOBRES
async function loadBudgets() {
    try {
        const budgets = await authFetch(/businesses/${state.currentBusinessId}/budget_envelopes);
        const list = document.getElementById('list-budgets');
        if (!list) return;
        
        list.innerHTML = '';
        budgets.forEach(b => {
            const perc = (b.spent / b.budget_amount) * 100;
            const barColor = perc > 90 ? '#f44336' : (perc > 70 ? '#ff9800' : '#4caf50');
            
            const div = document.createElement('div');
            div.className = 'card';
            div.style.padding = '10px';
            div.innerHTML = 
                <div style="display:flex; justify-content:space-between;">
                    <strong>${b.category}</strong>
                    <button class="btn btn-secondary" onclick="deleteBudget(${b.id})" style="padding:2px 5px; font-size:0.7rem;">Eliminar</button>
                </div>
                <div style="margin-top:5px; font-size:0.8rem; color:#a0aabf; display:flex; justify-content:space-between;">
                    <span>Gastado: ₡${b.spent.toLocaleString()}</span>
                    <span>Límite: ₡${b.budget_amount.toLocaleString()}</span>
                </div>
                <div style="width:100%; background:#2c3140; height:8px; border-radius:4px; margin-top:5px; overflow:hidden;">
                    <div style="width:${Math.min(perc, 100)}%; background:${barColor}; height:100%;"></div>
                </div>
                <div style="margin-top:5px; font-size:0.8rem; text-align:right;">
                    <span style="color:${b.remaining < 0 ? '#f44336' : '#4caf50'};">Quedan: ₡${b.remaining.toLocaleString()}</span>
                </div>
            ;
            list.appendChild(div);
        });
    } catch(e) { console.error(e); }
}

async function deleteBudget(id) {
    if(!confirm('¿Eliminar sobre de presupuesto?')) return;
    try {
        await authFetch(/budget_envelopes/${id}, { method: 'DELETE' });
        loadBudgets();
    } catch(e) { alert(e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    const formB = document.getElementById('form-budget');
    if(formB) {
        formB.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cat = document.getElementById('budget-category').value;
            const amt = parseFloat(document.getElementById('budget-amount').value);
            try {
                await authFetch(/businesses/${state.currentBusinessId}/budget_envelopes, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ category: cat, budget_amount: amt })
                });
                formB.reset();
                loadBudgets();
            } catch(e) { alert(e.message); }
        });
    }
});

// FASE 27: TRANSFERENCIAS BANCARIAS
async function openTransferModal() {
    document.getElementById('modal-transfer').style.display = 'flex';
    document.getElementById('transfer-amount').value = '';
    document.getElementById('transfer-desc').value = '';
    
    // Cargar cuentas en los selects
    try {
        const banks = await authFetch(/businesses/${state.currentBusinessId}/bank_accounts);
        const src = document.getElementById('transfer-source');
        const tgt = document.getElementById('transfer-target');
        src.innerHTML = '';
        tgt.innerHTML = '';
        banks.forEach(b => {
            const opt = <option value="${b.id}">${b.name} (${b.currency})</option>;
            src.innerHTML += opt;
            tgt.innerHTML += opt;
        });
    } catch(e) { console.error(e); }
}
function closeTransferModal() {
    document.getElementById('modal-transfer').style.display = 'none';
}
async function executeBankTransfer() {
    const src = document.getElementById('transfer-source').value;
    const tgt = document.getElementById('transfer-target').value;
    const amt = parseFloat(document.getElementById('transfer-amount').value);
    const desc = document.getElementById('transfer-desc').value;
    
    if(!src || !tgt || !amt) return alert('Llene todos los campos');
    if(src === tgt) return alert('No puede transferir a la misma cuenta');
    
    try {
        await authFetch(/businesses/${state.currentBusinessId}/bank_transfers, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                source_account_id: parseInt(src),
                target_account_id: parseInt(tgt),
                amount: amt,
                description: desc
            })
        });
        closeTransferModal();
        renderBancosModule();
    } catch(e) {
        alert(e.message);
    }
}
