import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const navItems = [
  { path: '/dashboard', icon: '⊟', label: 'Dashboard' },
  { path: '/transactions', icon: '≡', label: 'Transactions' },
  { path: '/budgets', icon: '◎', label: 'Budgets' },
  { path: '/analytics', icon: '◈', label: 'Analytics' },
  { path: '/settings', icon: '⊕', label: 'Settings' },
];

export default function Layout() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    toast.success('Logged out');
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'AB';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--green)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#000' }}>₹</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>FinTrack</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Personal Finance Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{user?.name}</span>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff' }}>{initials}</div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 52, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4, flexShrink: 0 }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} title={item.label}
              style={({ isActive }) => ({
                width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 16, textDecoration: 'none', border: '1px solid transparent',
                color: isActive ? 'var(--green)' : 'var(--text3)',
                background: isActive ? 'var(--green-bg)' : 'transparent',
                borderColor: isActive ? 'rgba(34,197,94,0.2)' : 'transparent',
              })}>
              {item.icon}
            </NavLink>
          ))}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg)' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}