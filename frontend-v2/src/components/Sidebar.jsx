import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Sidebar = ({ setToken }) => {
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'owner'; // default owner if not set
  const isCashier = role === 'cashier';
  const isAccountant = role === 'accountant';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    navigate('/login');
  };

  return (
    <div className="w-64 bg-surface h-screen flex flex-col border-r border-gray-700">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-primary">C.A.L.M</h2>
        <p className="text-xs text-gray-400">Contabilidad a la Mano</p>
        <span className="text-[10px] bg-gray-700 px-2 py-1 rounded text-white mt-2 inline-block uppercase">{role}</span>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {!isCashier && (
          <Link to="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
            Dashboard
          </Link>
        )}
        <Link to="/transactions" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
          Transacciones
        </Link>
        {!isCashier && !isAccountant && (
          <Link to="/inventory" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
            Inventario
          </Link>
        )}
        {!isCashier && !isAccountant && (
          <Link to="/payroll" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
            Planillas
          </Link>
        )}
        {!isCashier && !isAccountant && (
          <Link to="/crm" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
            Contactos (CRM)
          </Link>
        )}
        {!isAccountant && (
          <Link to="/billing" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
            Facturación
          </Link>
        )}
        {!isCashier && (
          <Link to="/reconciliation" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
            Conciliación
          </Link>
        )}
      </nav>
      <div className="p-4">
        <button onClick={handleLogout} className="w-full bg-danger hover:bg-red-700 text-white p-2 rounded">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
