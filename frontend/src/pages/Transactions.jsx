import { useState, useEffect, useCallback } from 'react';
import { getTransactions, createTransaction, deleteTransaction } from '../services/api';
import toast from 'react-hot-toast';

const fmt = (v) => '₹' + Math.abs(Number(v) || 0).toLocaleString('en-IN');
const CATEGORIES = ['Food','Rent','Transport','Entertainment','Utilities','Shopping','Health','Investment','Salary','Other'];
const CAT_ICONS = { Food:'🍔',Rent:'🏠',Transport:'🚗',Entertainment:'🎬',Utilities:'💡',Shopping:'🛍',Health:'🏥',Investment:'📈',Salary:'💼',Other:'📦' };

const defaultForm = { type: 'expense', amount: '', description: '', category: 'Food', date: new Date().toISOString().split('T')[0], notes: '' };

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ search: '', type: '', category: '', sortBy: 'date', sortOrder: 'desc' });

  const fetchTx = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTransactions({ page, limit: 10, ...filters });
      setTransactions(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTransaction(form);
      toast.success('Transaction added!');
      setShowModal(false);
      setForm(defaultForm);
      fetchTx();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await deleteTransaction(id);
      toast.success('Deleted');
      fetchTx();
    } catch { toast.error('Failed to delete'); }
  };

  const exportCSV = () => {
    const hdr = 'Date,Description,Category,Type,Amount,Notes\n';
    const rows = transactions.map(t => `${new Date(t.date).toISOString().split('T')[0]},"${t.description}",${t.category},${t.type},${t.amount},"${t.notes || ''}"`).join('\n');
    const blob = new Blob([hdr + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'transactions.csv'; a.click();
    toast.success('CSV exported!');
  };

  return (
    <div className="fade-up">
      <div className="page-header">
        <div><h1>Transactions</h1><p>{total} total transactions</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportCSV}>⬇ Export</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input style={{ flex: 1, minWidth: 140 }} placeholder="Search..." value={filters.search}
            onChange={e => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} />
          <select style={{ width: 120 }} value={filters.type} onChange={e => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="investment">Investment</option>
          </select>
          <select style={{ width: 130 }} value={filters.category} onChange={e => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={{ width: 140 }} value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={e => { const [s, o] = e.target.value.split('-'); setFilters({ ...filters, sortBy: s, sortOrder: o }); }}>
            <option value="date-desc">Latest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No transactions found</td></tr>
            ) : transactions.map(tx => (
              <tr key={tx._id}>
                <td style={{ color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{tx.description}</div>
                  {tx.notes && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tx.notes}</div>}
                </td>
                <td><span style={{ fontSize: 12 }}>{CAT_ICONS[tx.category] || '📦'} {tx.category}</span></td>
                <td><span className={`badge badge-${tx.type === 'income' ? 'green' : tx.type === 'investment' ? 'blue' : 'red'}`}>{tx.type}</span></td>
                <td style={{ fontWeight: 600, color: tx.type === 'income' ? 'var(--green)' : 'var(--text)' }}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                </td>
                <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(tx._id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text3)' }}>
        <span>Page {page} of {pages}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal fade-up">
            <div className="modal-header">
              <div className="modal-title">Add Transaction</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div>
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
                <div>
                  <label>Amount (₹)</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" placeholder="e.g. Zomato dinner" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="form-row">
                <div>
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <input type="text" placeholder="Any extra details..." value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 14, height: 14 }}></span> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}