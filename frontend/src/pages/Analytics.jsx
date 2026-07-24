import { useState, useEffect } from 'react';
import { getSummary, getCashFlow, getCategoryBreakdown } from '../services/api';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const fmt = (v) => '₹' + Math.abs(Number(v) || 0).toLocaleString('en-IN');
const CAT_COLORS = { Food:'#22c55e',Rent:'#3b82f6',Transport:'#f59e0b',Entertainment:'#a855f7',Utilities:'#06b6d4',Shopping:'#ec4899',Health:'#f87171',Investment:'#34d399',Other:'#6b7280' };

const chartBase = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#555', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555', font: { size: 10 }, callback: v => '₹' + (v / 1000) + 'K' } }
  }
};

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSummary(), getCashFlow({ months: 6 }), getCategoryBreakdown()])
      .then(([s, cf, cat]) => {
        setSummary(s.data.data);
        setCashflow(cf.data.data);
        setCategories(cat.data.data || []);
      }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: 32, height: 32 }}></div>
    </div>
  );

  const incomeExpData = cashflow ? {
    labels: cashflow.labels,
    datasets: [
      { label: 'Income', data: cashflow.income, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', tension: .4, fill: true, pointRadius: 4 },
      { label: 'Expense', data: cashflow.expenses, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)', tension: .4, fill: true, pointRadius: 4, borderDash: [4, 4] },
    ]
  } : null;

  const savingsData = cashflow ? {
    labels: cashflow.labels,
    datasets: [{
      label: 'Savings',
      data: cashflow.income.map((inc, i) => Math.max(0, inc - (cashflow.expenses[i] || 0))),
      borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',
      tension: .4, fill: true, pointRadius: 4,
    }]
  } : null;

  const categoryData = categories.length ? {
    labels: categories.map(c => c._id),
    datasets: [{
      data: categories.map(c => c.total),
      backgroundColor: categories.map(c => CAT_COLORS[c._id] || '#6b7280'),
      borderWidth: 0,
    }]
  } : null;

  const insights = [
    summary?.savingsRate > 50
      ? { ico: '🎯', title: `Saving ${summary.savingsRate}% of income`, body: 'Excellent! You\'re well above the recommended 20% savings rate.' }
      : { ico: '⚠', title: `Savings rate is ${summary?.savingsRate || 0}%`, body: 'Try to save at least 20% of your monthly income.' },
    categories[0] && { ico: '📊', title: `Top spend: ${categories[0]._id}`, body: `${fmt(categories[0].total)} spent — ${categories[0].pct}% of total expenses this month.` },
    { ico: '📈', title: 'Track monthly to spot trends', body: 'Consistent tracking helps identify spending patterns over 3–6 months.' },
  ].filter(Boolean);

  return (
    <div className="fade-up">
      <div className="page-header">
        <div><h1>Analytics</h1><p>Spending patterns and financial insights</p></div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {[
          { label: 'Monthly Income', value: fmt(summary?.income) },
          { label: 'Monthly Expenses', value: fmt(summary?.expenses) },
          { label: 'Savings Rate', value: `${summary?.savingsRate || 0}%`, color: 'var(--blue)' },
        ].map((s, i) => (
          <div key={i} className="card card-sm">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color || 'var(--text)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 12 }}>Income vs Expenses</div>
          <div style={{ height: 180 }}>
            {incomeExpData && <Line data={incomeExpData} options={{ ...chartBase, plugins: { legend: { display: true, labels: { color: '#999', font: { size: 11 }, boxWidth: 12 } } } }} />}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 12 }}>Monthly Savings</div>
          <div style={{ height: 180 }}>
            {savingsData && <Line data={savingsData} options={chartBase} />}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid-21" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 12 }}>Category Breakdown</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 180, height: 180, flexShrink: 0 }}>
              {categoryData && <Doughnut data={categoryData} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } }} />}
            </div>
            <div style={{ flex: 1 }}>
              {categories.map(c => (
                <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: CAT_COLORS[c._id] || '#6b7280' }}></div>
                    <span style={{ fontSize: 12 }}>{c._id}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(c.total)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{c.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 500, marginBottom: 12 }}>
            AI Insights <span className="badge badge-purple" style={{ marginLeft: 4 }}>ML</span>
          </div>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ins.ico}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{ins.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{ins.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}