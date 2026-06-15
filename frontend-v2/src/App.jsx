import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Transactions from './pages/Transactions';
import Inventory from './pages/Inventory';
import Payroll from './pages/Payroll';
import CRM from './pages/CRM';
import Billing from './pages/Billing';
import Reconciliation from './pages/Reconciliation';
import { API_URL } from './config';

const Login = ({ setToken }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            // hardcode business 2 for testing
            localStorage.setItem('businessId', 2);
            localStorage.setItem('role', data.role);
            setToken(data.access_token);
        } else {
            alert("Credenciales inválidas");
        }
    } catch(err) {
        console.error(err);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background text-white">
      <div className="bg-surface p-8 rounded shadow-lg w-full max-w-sm">
        <h1 className="text-2xl text-primary font-bold mb-6 text-center">C.A.L.M V2</h1>
        <p className="text-center text-sm text-gray-400 mb-4">Contabilidad a la Mano</p>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block mb-2 text-sm text-gray-400">Usuario</label>
            <input type="text" value={id} onChange={(e) => setId(e.target.value)} className="w-full p-2 rounded bg-background border border-gray-600 focus:border-primary outline-none" required />
          </div>
          <div className="mb-6">
            <label className="block mb-2 text-sm text-gray-400">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 rounded bg-background border border-gray-600 focus:border-primary outline-none" required />
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-green-600 text-white p-2 rounded transition font-bold">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [data, setData] = useState({ revenue: 0, expenses: 0, net_income: 0 });
  const [taxData, setTaxData] = useState({ total_iva_pagar: 0 });

  useEffect(() => {
    const fetchReports = async () => {
      const bId = localStorage.getItem('businessId');
      if(bId) {
        try {
          const res = await fetch(`${API_URL}/businesses/${bId}/reports/income-statement`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if(res.ok) {
            setData(await res.json());
          }

          const taxRes = await fetch(`${API_URL}/businesses/${bId}/reports/tax-d104`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if(taxRes.ok) {
            setTaxData(await taxRes.json());
          }
        } catch(e) {
          console.error(e);
        }
      }
    };
    fetchReports();
  }, []);

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">Dashboard Financiero</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-t-4 border-green-500">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm uppercase font-semibold">Ingresos Totales</h3>
          <p className="text-3xl font-bold mt-2 text-gray-800 dark:text-white">₡{data.revenue.toLocaleString('es-CR')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-t-4 border-red-500">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm uppercase font-semibold">Gastos Totales</h3>
          <p className="text-3xl font-bold mt-2 text-gray-800 dark:text-white">₡{data.expenses.toLocaleString('es-CR')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-t-4 border-blue-500">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm uppercase font-semibold">Rendimiento Neto</h3>
          <p className={`text-3xl font-bold mt-2 ${data.net_income >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ₡{data.net_income.toLocaleString('es-CR')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-t-4 border-purple-500">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm uppercase font-semibold">IVA a Pagar (D-104)</h3>
          <p className="text-3xl font-bold mt-2 text-purple-600 dark:text-purple-400">₡{taxData.total_iva_pagar.toLocaleString('es-CR')}</p>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!token ? <Login setToken={setToken} /> : <Navigate to="/" />} />
        
        <Route path="/" element={token ? <Layout setToken={setToken}><Dashboard /></Layout> : <Navigate to="/login" />} />
        <Route path="/transactions" element={token ? <Layout setToken={setToken}><Transactions /></Layout> : <Navigate to="/login" />} />
        <Route path="/inventory" element={token ? <Layout setToken={setToken}><Inventory /></Layout> : <Navigate to="/login" />} />
        <Route path="/payroll" element={token ? <Layout setToken={setToken}><Payroll /></Layout> : <Navigate to="/login" />} />
        <Route path="/crm" element={token ? <Layout setToken={setToken}><CRM /></Layout> : <Navigate to="/login" />} />
        <Route path="/billing" element={token ? <Layout setToken={setToken}><Billing businessId={localStorage.getItem('businessId')} /></Layout> : <Navigate to="/login" />} />
        <Route path="/reconciliation" element={token ? <Layout setToken={setToken}><Reconciliation businessId={localStorage.getItem('businessId')} /></Layout> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
