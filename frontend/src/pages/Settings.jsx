import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, loginUser, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user?.name || '',
    currency: user?.currency || 'INR',
    monthlySalary: user?.monthlySalary || '',
    savingsTargetPct: user?.savingsTargetPct || 50,
    location: user?.location || '',
  });
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await API.put('/users/profile', form);
      loginUser(localStorage.getItem('token'), res.data.data);
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      await API.put('/auth/password', pwForm);
      toast.success('Password updated!');
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update password'); }
    finally { setPwSaving(false); }
  };

  const handleLogout = () => {
    logoutUser();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="fade-up">
      <div className="page-header">
        <div><h1>Settings</h1><p>Manage your account and preferences</p></div>
      </div>

      <div className="grid-2">
        {/* Profile */}
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 14 }}>Profile</div>
          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Monthly Salary</label>
              <input type="number" value={form.monthlySalary} onChange={e => setForm({ ...form, monthlySalary: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Savings Target (%)</label>
              <input type="number" min="0" max="100" value={form.savingsTargetPct} onChange={e => setForm({ ...form, savingsTargetPct: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input type="text" placeholder="Belagavi, Karnataka" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password + Danger zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 14 }}>Change Password</div>
            <form onSubmit={handlePasswordSave}>
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" placeholder="Min 8 characters" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={pwSaving}>
                {pwSaving ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : 'Update Password'}
              </button>
            </form>
          </div>

          <div className="card">
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 14 }}>Account</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                Logged in as <strong>{user?.email}</strong>
              </div>
              <button className="btn btn-ghost" onClick={handleLogout}>Sign Out</button>
              <button className="btn btn-danger" onClick={() => toast.error('Contact support to delete account')}>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}