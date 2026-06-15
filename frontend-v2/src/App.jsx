import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Transactions from './pages/Transactions';
import Inventory from './pages/Inventory';
import Payroll from './pages/Payroll';
import CRM from './pages/CRM';
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
  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-surface p-6 rounded shadow border-t-4 border-primary">
          <h3 className="text-gray-400 text-sm">Ingresos del Mes</h3>
          <p className="text-2xl font-bold mt-2">₡0.00</p>
        </div>
        <div className="bg-surface p-6 rounded shadow border-t-4 border-danger">
          <h3 className="text-gray-400 text-sm">Gastos del Mes</h3>
          <p className="text-2xl font-bold mt-2">₡0.00</p>
        </div>
        <div className="bg-surface p-6 rounded shadow border-t-4 border-secondary">
          <h3 className="text-gray-400 text-sm">Flujo de Caja Libre</h3>
          <p className="text-2xl font-bold mt-2">₡0.00</p>
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
      </Routes>
    </Router>
  );
}

export default App;
