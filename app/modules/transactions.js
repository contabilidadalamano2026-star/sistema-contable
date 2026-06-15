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
            
            // Solo sumar a los totales si ya estÃ¡n pagadas
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
                        ${tx.hacienda_status.includes('error') ? `<a href="#" onclick="alert('Borrador guardado. Revise configuraciÃƒÂ³n.'); return false;">Reintentar</a>` : ''}
                    </small>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="tx-amount ${tx.type === 'income' ? 'tx-income' : 'tx-expense'}">
                        ${tx.type === 'income' ? '+' : '-'} â‚¡${displayAmount.toFixed(2)} ${currencyTag}
                    </span>
                    ${!tx.is_paid && tx.hacienda_status !== 'anulado' ? '<small style="color:#f44336; font-weight:bold;">[PENDIENTE]</small>' : ''}
                    ${tx.hacienda_status === 'anulado' ? '<small style="color:#f44336; font-weight:bold;">[ANULADO]</small>' : ''}
                    ${canEdit ? `<button class="btn-delete" onclick="openEditModal(${tx.id})" title="Editar" style="background:transparent; color:#ff9800;">âœï¸</button>` : ''}
                    ${tx.hacienda_status === 'aceptado' ? `<button class="btn-delete" onclick="anularFactura(${tx.id})" title="Anular (Nota de CrÃ©dito)" style="background:transparent; color:#f44336;">ðŸš«</button>` : ''}
                    ${!tx.is_paid && tx.hacienda_status !== 'anulado' ? `<button class="btn-delete" onclick="openPaymentModal(${tx.id})" title="Abonar" style="background:transparent; color:#4caf50;">ðŸ’°</button>` : ''}
                    <button class="btn-delete" onclick="deleteTransaction(${tx.id})" title="Eliminar operacion">ðŸ—‘ï¸</button>
                </div>
            `;
            ui.listNegocio.appendChild(li);
        });

        ui.negVentas.innerText = `Ã¢â€šÂ¡${ventas.toLocaleString('es-CR')}`;
        ui.negGastos.innerText = `Ã¢â€šÂ¡${gastos.toLocaleString('es-CR')}`;
        ui.negUtilidad.innerText = `Ã¢â€šÂ¡${(ventas - gastos).toLocaleString('es-CR')}`;
        
        // Renderizar GrÃƒÂ¡ficos AnalÃƒÂ­ticos
        renderCharts(txs, monthFilter, textFilter);
        
        // Cargar estado de hacienda
        await loadHaciendaStatus();
        
        // Cargar bodegas en el dropdown de facturaciÃ³n
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
        
        // Cargar vista de RRHH (NÃ³mina)
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
            alert("OperaciÃƒÂ³n registrada y Factura XML de Hacienda generada exitosamente (Revisa la consola para ver el XML).");
        } else {
            alert('TransacciÃƒÂ³n guardada exitosamente');
        }
        
    } catch(e) {
        alert('Error al guardar la transacciÃƒÂ³n');
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
    if(!confirm("Ã‚Â¿EstÃƒÂ¡s seguro de que deseas eliminar este registro? Esta acciÃƒÂ³n no se puede deshacer.")) return;
    
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
        // Disparar carga dinÃ¡mica si existe
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

    // 1. Datos para GrÃƒÂ¡fico de Tendencia (Agrupados por Mes)
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresosPorMes = new Array(12).fill(0);
    const gastosPorMes = new Array(12).fill(0);
    
    // 2. Datos para GrÃ¡fico de CategorÃ­as (SÃ³lo gastos)
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

    // Destruir grÃƒÂ¡ficos anteriores si existen
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

    // Dibujar CategorÃƒÂ­as
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
// FASE 26: CONCILIADOR SINPE
function openSinpeModal() {
    document.getElementById('modal-sinpe').style.display = 'flex';
    document.getElementById('sinpe-sms').value = '';
}
function closeSinpeModal() {
    document.getElementById('modal-sinpe').style.display = 'none';
}
async function parseSinpe() {
    const text = document.getElementById('sinpe-sms').value;
    if(!text) return alert('Pegue el mensaje SMS');
    
    try {
        const response = await fetch(\/businesses/\/sinpe_parse, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + state.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sms_text: text })
        });
        const data = await response.json();
        
        if(!response.ok) throw new Error(data.detail || 'Error analizando SMS');
        
        if(confirm(Se detectó un Sinpe por ¢\ (Ref: \). ¿Desea registrarlo como Ingreso?)) {
            await saveTransaction(state.currentBusinessId, 'income', data.amount, 'Sinpe Móvil', {
                description: data.description,
                is_paid: true
            });
            closeSinpeModal();
            loadBusinessData();
        }
    } catch(e) {
        alert(e.message);
    }
}

