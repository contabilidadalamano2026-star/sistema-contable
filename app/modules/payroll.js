    try {
        await fetch(`${API_URL}/recurring_expenses/process?business_id=${businessId}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
    } catch(e) {
        console.error("Error procesando gastos recurrentes automÃ¡ticos", e);
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
            <td style="padding:10px; color: #f44336;">â‚¡${r.amount.toFixed(2)}</td>
            <td style="padding:10px;">DÃ­a ${r.day_of_month}</td>
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
    if(!confirm("Â¿Seguro que deseas eliminar este gasto recurrente? No se procesarÃ¡ mÃ¡s en el futuro.")) return;
    
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
            <td style="padding:10px;">â‚¡${emp.base_salary.toFixed(2)}</td>
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
    if(!confirm("Â¿Seguro que deseas eliminar a este empleado?")) return;
    
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
    
    const applyCcss = confirm(`Â¿Aplicar deducciÃ³n de Ley (CCSS 10.5%) al salario base de â‚¡${emp.base_salary.toLocaleString()}?`);
    
    let netAmount = emp.base_salary;
    let desc = `Salario Base (AutomÃ¡tico)`;
    let ccssAmount = 0;
    
    if(applyCcss) {
        ccssAmount = emp.base_salary * 0.105;
        netAmount = emp.base_salary - ccssAmount;
        desc = `Salario Neto (Base: â‚¡${emp.base_salary} - CCSS: â‚¡${ccssAmount})`;
    }
    
    if(!confirm(`Registrar pago a ${emp.name} por un Neto de â‚¡${netAmount.toLocaleString()}?`)) return;
    
    const payload = { 
        amount: netAmount, 
        description: desc 
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
            // Cambiar a pestaÃ±a de movimientos para que el usuario vea el cambio
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
// FASE 29-30: AGUINALDOS Y LIQUIDACIONES
async function payAguinaldo(id) {
    const emp = state.employeesNegocio.find(e => e.id === id);
    if(!emp) return;
    
    // Simplificación: Aguinaldo = 1 mes de salario (asumiendo año completo)
    const amount = emp.base_salary;
    
    if(!confirm(¿Registrar pago de AGUINALDO a  por ¢?)) return;
    
    try {
        await fetch(${API_URL}/employees//pay, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token},
            body: JSON.stringify({ amount: amount, description: Pago de Aguinaldo })
        });
        alert('Aguinaldo registrado exitosamente');
        loadBusinessData();
    } catch(e) { alert(e.message); }
}

async function liquidateEmployee(id) {
    const emp = state.employeesNegocio.find(e => e.id === id);
    if(!emp) return;
    
    // Simplificación: Liquidación = 1.5 meses de salario (Preaviso + Cesantía + Vacaciones)
    const amount = emp.base_salary * 1.5;
    
    if(!confirm(¿Registrar LIQUIDACIÓN de  por ¢?)) return;
    
    try {
        await fetch(${API_URL}/employees//pay, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token},
            body: JSON.stringify({ amount: amount, description: Liquidación Laboral })
        });
        alert('Liquidación registrada exitosamente');
        loadBusinessData();
    } catch(e) { alert(e.message); }
}



