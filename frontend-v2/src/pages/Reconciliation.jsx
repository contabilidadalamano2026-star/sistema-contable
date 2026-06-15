import { useState, useEffect } from 'react';
import API_URL from '../config';

function Reconciliation({ businessId }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [bankData, setBankData] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/businesses/${businessId}/bank_accounts`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setAccounts(await res.json());
    } catch(e) {
      console.error(e);
    }
  };

  const handleReconcile = async () => {
    if (!selectedAcc || !bankData) return;

    // Alerta de seguridad para salida de datos de la APK
    const confirmSync = window.confirm(
      "⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\n" +
      "Los datos bancarios ingresados serán transmitidos a la nube (Servidor C.A.L.M) para su procesamiento y conciliación.\n\n" +
      "¿Deseas continuar enviando esta información fuera de tu dispositivo?"
    );

    if (!confirmSync) {
      return;
    }

    setLoading(true);

    // Parse simple CSV (date,description,amount)
    const lines = bankData.split('\n').filter(l => l.trim() !== '');
    const movements = lines.map(l => {
      const parts = l.split(',');
      return {
        date: parts[0]?.trim() || '',
        description: parts[1]?.trim() || '',
        amount: parseFloat(parts[2]) || 0
      };
    });

    try {
      const res = await fetch(`${API_URL}/businesses/${businessId}/bank_accounts/${selectedAcc}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ movements })
      });
      if (res.ok) {
        setResults(await res.json());
      }
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="container p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Conciliación Bancaria</h2>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        <label className="block mb-2 font-semibold dark:text-gray-300">Seleccionar Cuenta a Conciliar:</label>
        <select 
          className="border p-2 rounded w-full md:w-1/3 dark:bg-gray-700 dark:text-white"
          value={selectedAcc} 
          onChange={e => setSelectedAcc(e.target.value)}
        >
          <option value="">-- Seleccione --</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>{acc.name} (Saldo: {acc.currency} {acc.current_balance})</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        <label className="block mb-2 font-semibold dark:text-gray-300">Pegar Datos del Banco (Formato CSV: fecha, descripcion, monto):</label>
        <p className="text-xs text-gray-500 mb-2">Ejemplo: 2026-06-15, Pago de Luz, -15000</p>
        <textarea 
          className="w-full h-32 border p-2 rounded dark:bg-gray-700 dark:text-white font-mono text-sm"
          value={bankData}
          onChange={e => setBankData(e.target.value)}
          placeholder="2026-06-15,Venta Mostrador,50000&#10;2026-06-16,Recibo Internet,-30000"
        ></textarea>
        <button 
          onClick={handleReconcile}
          disabled={loading || !selectedAcc || !bankData}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold disabled:opacity-50"
        >
          {loading ? 'Conciliando...' : 'Hacer Match Automático'}
        </button>
      </div>

      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200">
            <h3 className="font-bold text-green-800 dark:text-green-400 mb-3">Movimientos Conciliados ({results.matches.length})</h3>
            {results.matches.map((m, i) => (
              <div key={i} className="text-sm mb-2 border-b pb-1 dark:text-gray-300">
                <span className="font-semibold text-green-600">✓ </span>
                {m.bank.date} - {m.bank.description} (Banco: {m.bank.amount} | Sistema: {m.local.amount})
              </div>
            ))}
            {results.matches.length === 0 && <p className="text-sm text-gray-500">Ningún movimiento coincidió.</p>}
          </div>

          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg border border-red-200">
            <h3 className="font-bold text-red-800 dark:text-red-400 mb-3">Diferencias / No Conciliados</h3>
            
            <h4 className="font-semibold text-sm mt-2 text-gray-700 dark:text-gray-300">En el Banco (Falta en Sistema):</h4>
            {results.unmatched_bank.map((m, i) => (
              <div key={i} className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {m.date} - {m.description} ({m.amount})
              </div>
            ))}
            {results.unmatched_bank.length === 0 && <p className="text-xs text-gray-500">Todo en orden.</p>}

            <h4 className="font-semibold text-sm mt-4 text-gray-700 dark:text-gray-300">En el Sistema (Falta en Banco):</h4>
            {results.unmatched_local.map((m, i) => (
              <div key={i} className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {m.date.substring(0,10)} - {m.description} ({m.amount})
              </div>
            ))}
            {results.unmatched_local.length === 0 && <p className="text-xs text-gray-500">Todo en orden.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default Reconciliation;
