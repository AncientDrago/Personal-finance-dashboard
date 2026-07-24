import { useState, useEffect } from 'react';
import { getBudgets, createBudget, deleteBudget } from '../services/api';
import toast from 'react-hot-toast';

const fmt = (v) => '₹' + Math.abs(Number(v) || 0).toLocaleString('en-IN');
const CATEGORIES = ['Food','Rent','Transport','Entertainment','Utilities','Shopping','Health','Investment','Other'];
const CAT_ICONS = { Food:'🍔',Rent:'🏠',Transport:'🚗',Entertainment:'🎬',Utilities:'💡',Shopping:'🛍',Health:'🏥',Investment:'📈',Other:'📦' };

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    category: 'Food', limit: '', month: now.getMonth() + 1, year: now.getFullYear(), alertThreshold: 80
  });

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const res = await getBudgets({ month: now.getMonth() + 1, year: now.getFullYear() });
      setBudgets(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch { toast.error('Failed to load budgets'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBudgets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createBudget(form);
      toast.success('Budget created!');
      setShowModal(false);
      setForm({ category: 'Food', limit: '', month: now.getMonth() + 1, year: now.getFullYear(), alertThreshold: 80 });
      fetchBudgets();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await deleteBudget(id);
      toast.success('Budget deleted');
      fetchBudgets();
    } catch { toast.error('Failed to delete'); }
  };

  const getBarColor = (pct) => pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--green)';
  const getStatus = (pct) => pct > 90 ? '⚠ Over budget' : pct > 70 ? '⚡ Watch out' : '✓ On track';

  return (
    <div className="fade-up">
      <div className="page-header">
        <div>
          <h1>Budget Tracker</h1>
          <p>{now.toLocaleString('default', { month: 'long' })} {now.getFullYear()}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Budget</button>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Budgeted', value: fmt(summary.totalBudget), color: 'var(--text)' },
          { label: 'Spent So Far', value: fmt(summary.totalSpent), color: 'var(--amber)' },
          { label: 'Remaining', value: fmt(summary.totalRemaining), color: 'var(--green)' },
        ].map((s, i) => (
          <div key={i} className="card card-sm">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Budget list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      ) : budgets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          No budgets yet. <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowModal(true)}>Create one</button>
        </div>
      ) : (
        <div className="grid-2">
          {budgets.map(b => (
            <div key={b._id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{CAT_ICONS[b.category] || '📦'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.category}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(b.spent)} of {fmt(b.limit)}</div>
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b._id)}>Delete</button>
              </div>
              <div className="bar-track" style={{ marginBottom: 6 }}>
                <div className="bar-fill" style={{ width: `${b.pct}%`, background: getBarColor(b.pct) }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: getBarColor(b.pct) }}>{getStatus(b.pct)}</span>
                <span style={{ color: 'var(--text3)' }}>{b.pct}% used · {fmt(b.remaining)} left</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal fade-up">
            <div className="modal-header">
              <div className="modal-title">Create Budget</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Monthly Limit (₹)</label>
                <input type="number" min="1" placeholder="5000" value={form.limit}
                  onChange={e => setForm({ ...form, limit: e.target.value })} required />
              </div>
              <div className="form-row">
                <div>
                  <label>Month</label>
                  <select value={form.month} onChange={e => setForm({ ...form, month: parseInt(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Year</label>
                  <input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="form-group">
                <label>Alert Threshold (%)</label>
                <input type="number" min="1" max="100" value={form.alertThreshold}
                  onChange={e => setForm({ ...form, alertThreshold: parseInt(e.target.value) })} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}