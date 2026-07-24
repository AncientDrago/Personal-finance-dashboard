import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSummary, getCashFlow, getCategoryBreakdown, getTransactions } from '../services/api';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const fmt = (v) => '₹' + Math.abs(Number(v) || 0).toLocaleString('en-IN');

const CAT_COLORS = {
  Food: '#22c55e', Rent: '#3b82f6', Transport: '#f59e0b',
  Entertainment: '#a855f7', Utilities: '#06b6d4', Shopping: '#ec4899',
  Health: '#f87171', Investment: '#34d399', Salary: '#22c55e', Other: '#6b7280',
};
const CAT_ICONS = {
  Food: '🍔', Rent: '🏠', Transport: '🚗', Entertainment: '🎬',
  Utilities: '💡', Shopping: '🛍', Health: '🏥', Investment: '📈',
  Salary: '💼', Other: '📦',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [categories, setCategories] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSummary(),
      getCashFlow({ months: 6 }),
      getCategoryBreakdown(),
      getTransactions({ limit: 6, sortBy: 'date', sortOrder: 'desc' }),
    ]).then(([s, cf, cat, tx]) => {
      setSummary(s.data.data);
      setCashflow(cf.data.data);
      setCategories(cat.data.data || []);
      setRecentTx(tx.data.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 32, height: 32 }}></div>
    </div>
  );

  const chartDefaults = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  const cashflowData = cashflow ? {
    labels: cashflow.labels,
    datasets: [
      { label: 'Income', data: cashflow.income, backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 4 },
      { label: 'Expense', data: cashflow.expenses, backgroundColor: 'rgba(239,68,68,0.5)', borderRadius: 4 },
    ],
  } : null;

  const categoryData = categories.length ? {
    labels: categories.slice(0, 6).map(c => c._id),
    datasets: [{
      data: categories.slice(0, 6).map(c => c.total),
      backgroundColor: categories.slice(0, 6).map(c => CAT_COLORS[c._id] || '#6b7280'),
      borderWidth: 0, hoverOffset: 4,
    }],
  } : null;

  return (
    <div className="fade-up">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Good morning, {user?.name?.split(' ')[0]} 👋</h1>
          <p>Here's your financial snapshot</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.location.href = '/transactions'}>
          + Add Transaction
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Monthly Income', value: fmt(summary?.income), color: 'var(--green)', delta: `${summary?.incomeChange > 0 ? '+' : ''}${summary?.incomeChange || 0}% vs last month` },
          { label: 'Monthly Expenses', value: fmt(summary?.expenses), color: 'var(--text)', delta: `${summary?.expenseChange > 0 ? '+' : ''}${summary?.expenseChange || 0}% vs last month` },
          { label: 'Net Savings', value: fmt(summary?.netSavings), color: (summary?.netSavings || 0) >= 0 ? 'var(--green)' : 'var(--red)', delta: '' },
          { label: 'Savings Rate', value: `${summary?.savingsRate || 0}%`, color: 'var(--blue)', delta: 'of monthly income' },
        ].map((s, i) => (
          <div key={i} className="card card-sm">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            {s.delta && <div className="stat-delta" style={{ color: 'var(--text3)' }}>{s.delta}</div>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-21" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500 }}>Cash Flow — Last 6 Months</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span><span style={{ color: 'var(--green)' }}>■</span> Income</span>
              <span><span style={{ color: 'var(--red)' }}>■</span> Expense</span>
            </div>
          </div>
          <div style={{ height: 200 }}>
            {cashflowData && <Bar data={cashflowData} options={{ ...chartDefaults, scales: { x: { grid: { display: false }, ticks: { color: '#555', font: { size: 11 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555', font: { size: 10 }, callback: v => '₹' + (v / 1000) + 'K' } } } }} />}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 12 }}>Spending by Category</div>
          <div style={{ height: 160 }}>
            {categoryData && <Doughnut data={categoryData} options={{ ...chartDefaults, cutout: '68%' }} />}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {categories.slice(0, 4).map(c => (
              <span key={c._id} className="badge" style={{ background: (CAT_COLORS[c._id] || '#6b7280') + '22', color: CAT_COLORS[c._id] || '#6b7280' }}>
                {CAT_ICONS[c._id] || '📦'} {c._id} {c.pct}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500 }}>Recent Transactions</span>
          <a href="/transactions" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>View all →</a>
        </div>
        {recentTx.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)' }}>
            No transactions yet. <a href="/transactions" style={{ color: 'var(--green)' }}>Add one →</a>
          </div>
        ) : recentTx.map(tx => (
          <div key={tx._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: (CAT_COLORS[tx.category] || '#6b7280') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              {CAT_ICONS[tx.category] || '📦'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{tx.description}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tx.category} · {new Date(tx.date).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: tx.type === 'income' ? 'var(--green)' : 'var(--text)' }}>
                {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
              </div>
              <span className={`badge badge-${tx.type === 'income' ? 'green' : 'red'}`}>{tx.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}