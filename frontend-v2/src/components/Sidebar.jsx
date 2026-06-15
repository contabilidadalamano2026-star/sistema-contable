import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Sidebar = ({ setToken }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    navigate('/login');
  };

  return (
    <div className="w-64 bg-surface h-screen flex flex-col border-r border-gray-700">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-primary">C.A.L.M</h2>
        <p className="text-xs text-gray-400">Contabilidad a la Mano</p>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        <Link to="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
          Dashboard
        </Link>
        <Link to="/transactions" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
          Transacciones
        </Link>
        <Link to="/inventory" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
          Inventario
        </Link>
        <Link to="/payroll" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
          Planillas
        </Link>
        <Link to="/crm" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
          Contactos (CRM)
        </Link>
        <Link to="/billing" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 text-white">
          Facturación
        </Link>
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
