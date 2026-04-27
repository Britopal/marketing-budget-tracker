import { useState, useEffect, Fragment } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const STORAGE_KEY = 'marketing-budget-entries'
const ANNUAL_BUDGET_KEY = 'marketing-annual-budget'

const SAMPLE_DATA = [
  {
    id: 1, channel: 'Paid Search', budget: 50000, spent: 42000, quarter: 'Q1',
    subs: [
      { id: 1, name: 'Google Ads', budget: 35000, spent: 29000 },
      { id: 2, name: 'Bing Ads', budget: 15000, spent: 13000 },
    ],
  },
  {
    id: 2, channel: 'Social Ads', budget: 30000, spent: 31500, quarter: 'Q1',
    subs: [
      { id: 1, name: 'Facebook', budget: 18000, spent: 20000 },
      { id: 2, name: 'Instagram', budget: 12000, spent: 11500 },
    ],
  },
  { id: 3, channel: 'Email', budget: 10000, spent: 7200, quarter: 'Q1', subs: [] },
  { id: 4, channel: 'Content', budget: 20000, spent: 17800, quarter: 'Q2', subs: [] },
  { id: 5, channel: 'Events', budget: 40000, spent: 38000, quarter: 'Q2', subs: [] },
  { id: 6, channel: 'SEO', budget: 15000, spent: 9500, quarter: 'Q3', subs: [] },
]

function getStatus(budget, spent) {
  const pct = budget > 0 ? (spent / budget) * 100 : 0
  if (pct > 100) return 'Over'
  if (pct === 100) return 'Even'
  if (pct >= 80) return 'At risk'
  return 'On track'
}

function statusStyle(status) {
  if (status === 'Over') return 'bg-red-100 text-red-700 border border-red-300'
  if (status === 'Even') return 'bg-blue-100 text-blue-700 border border-blue-300'
  if (status === 'At risk') return 'bg-amber-100 text-amber-700 border border-amber-300'
  return 'bg-green-100 text-green-700 border border-green-300'
}

function progressBgColor(status) {
  if (status === 'Over') return '#ef4444'
  if (status === 'Even') return '#3b82f6'
  if (status === 'At risk') return '#f59e0b'
  return '#22c55e'
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function nextId(entries) {
  return entries.length > 0 ? Math.max(...entries.map((e) => e.id)) + 1 : 1
}

function nextSubId(subs) {
  return subs.length > 0 ? Math.max(...subs.map((s) => s.id)) + 1 : 1
}

function effectiveBudget(entry) {
  const subs = entry.subs || []
  return subs.length > 0 ? subs.reduce((s, sub) => s + sub.budget, 0) : entry.budget
}

function effectiveSpent(entry) {
  const subs = entry.subs || []
  return subs.length > 0 ? subs.reduce((s, sub) => s + sub.spent, 0) : entry.spent
}

const QUARTERS = ['All', 'Q1', 'Q2', 'Q3', 'Q4']

export default function BudgetTracker() {
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : SAMPLE_DATA
    } catch {
      return SAMPLE_DATA
    }
  })

  const [annualBudget, setAnnualBudget] = useState(() => {
    const saved = localStorage.getItem(ANNUAL_BUDGET_KEY)
    return saved ? Number(saved) : 0
  })
  const [annualInput, setAnnualInput] = useState('')

  const [quarter, setQuarter] = useState('All')
  const [form, setForm] = useState({ channel: '', budget: '', spent: '', quarter: 'Q1' })
  const [editing, setEditing] = useState({})
  const [expanded, setExpanded] = useState(new Set())
  const [subForms, setSubForms] = useState({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  useEffect(() => {
    localStorage.setItem(ANNUAL_BUDGET_KEY, String(annualBudget))
  }, [annualBudget])

  const totalAllocated = entries.reduce((s, e) => s + effectiveBudget(e), 0)
  const unallocated = annualBudget - totalAllocated

  function handleAnnualSubmit(e) {
    e.preventDefault()
    const val = parseFloat(annualInput)
    if (!isNaN(val) && val >= 0) setAnnualBudget(val)
    setAnnualInput('')
  }

  const filtered = quarter === 'All' ? entries : entries.filter((e) => e.quarter === quarter)

  // Summary metrics derived from effective values
  const totalBudget = filtered.reduce((s, e) => s + effectiveBudget(e), 0)
  const totalSpent = filtered.reduce((s, e) => s + effectiveSpent(e), 0)
  const remaining = totalBudget - totalSpent
  const pctUsed = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : '0.0'
  const annualRemaining = annualBudget - totalSpent
  const annualPctUsed = annualBudget > 0 ? ((totalSpent / annualBudget) * 100).toFixed(1) : '0.0'

  // Chart data
  const chartData = filtered.map((e) => {
    const budget = effectiveBudget(e)
    const spent = effectiveSpent(e)
    return { name: e.channel, Budget: budget, Spent: spent, status: getStatus(budget, spent) }
  })

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleDelete(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function handleAdd(e) {
    e.preventDefault()
    const budget = parseFloat(form.budget)
    const spent = parseFloat(form.spent)
    if (!form.channel.trim() || isNaN(budget) || isNaN(spent)) return
    setEntries((prev) => [
      ...prev,
      { id: nextId(prev), channel: form.channel.trim(), budget, spent, quarter: form.quarter, subs: [] },
    ])
    setForm({ channel: '', budget: '', spent: '', quarter: 'Q1' })
  }

  // Channel-level inline editing (only active when the channel has no sub-rows)
  function startEdit(id, field, value) {
    setEditing((prev) => ({ ...prev, [`${id}-${field}`]: String(value) }))
  }

  function commitEdit(id, field) {
    const key = `${id}-${field}`
    const raw = editing[key]
    if (raw === undefined) return
    if (field === 'channel') {
      const trimmed = raw.trim()
      if (trimmed) setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, channel: trimmed } : e)))
    } else {
      const parsed = parseFloat(raw)
      if (!isNaN(parsed) && parsed >= 0) {
        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: parsed } : e)))
      }
    }
    setEditing((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // Sub-row inline editing
  function startEditSub(entryId, subId, field, value) {
    setEditing((prev) => ({ ...prev, [`sub-${entryId}-${subId}-${field}`]: String(value) }))
  }

  function commitEditSub(entryId, subId, field) {
    const key = `sub-${entryId}-${subId}-${field}`
    const raw = editing[key]
    if (raw === undefined) return
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed >= 0) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id !== entryId
            ? e
            : { ...e, subs: (e.subs || []).map((sub) => (sub.id === subId ? { ...sub, [field]: parsed } : sub)) }
        )
      )
    }
    setEditing((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function addSub(entryId) {
    const sf = subForms[entryId] || {}
    const name = (sf.name || '').trim()
    const budget = parseFloat(sf.budget || '')
    const spent = parseFloat(sf.spent || '')
    if (!name || isNaN(budget) || isNaN(spent)) return
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e
        const subs = e.subs || []
        return { ...e, subs: [...subs, { id: nextSubId(subs), name, budget, spent }] }
      })
    )
    setSubForms((prev) => ({ ...prev, [entryId]: { name: '', budget: '', spent: '' } }))
  }

  function deleteSub(entryId, subId) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id !== entryId ? e : { ...e, subs: (e.subs || []).filter((sub) => sub.id !== subId) }
      )
    )
  }

  function exportCSV() {
    const headers = ['Channel', 'Quarter', 'Budget', 'Spent', 'Remaining', 'Status']
    const rows = []
    filtered.forEach((e) => {
      const budget = effectiveBudget(e)
      const spent = effectiveSpent(e)
      rows.push([e.channel, e.quarter, budget, spent, budget - spent, getStatus(budget, spent)])
      ;(e.subs || []).forEach((sub) => {
        rows.push([`  ${sub.name}`, e.quarter, sub.budget, sub.spent, sub.budget - sub.spent, getStatus(sub.budget, sub.spent)])
      })
    })
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `marketing-budget-${quarter.toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Marketing Budget Tracker</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track spend vs. budget across channels</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-600">Quarter</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {QUARTERS.map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg shadow-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Annual Budget */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Annual Budget</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{annualBudget > 0 ? fmt(annualBudget) : '—'}</p>
              {annualBudget > 0 && (
                <p className={`text-sm mt-1 font-medium ${unallocated < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  {unallocated < 0
                    ? `${fmt(Math.abs(unallocated))} over-allocated across channels`
                    : `${fmt(unallocated)} unallocated`}
                </p>
              )}
            </div>
            <form onSubmit={handleAnnualSubmit} className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Set annual budget…"
                value={annualInput}
                onChange={(e) => setAnnualInput(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Set
              </button>
            </form>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Annual Budget"
            value={annualBudget > 0 ? fmt(annualBudget) : '—'}
            sub="set above"
            color="blue"
          />
          <MetricCard label="Total Spent" value={fmt(totalSpent)} sub="across all channels" color="indigo" />
          <MetricCard
            label="Remaining"
            value={annualBudget > 0 ? fmt(annualRemaining) : '—'}
            sub={annualBudget > 0 && annualRemaining < 0 ? 'Over annual budget!' : 'of annual budget'}
            color={annualBudget > 0 && annualRemaining < 0 ? 'red' : 'green'}
            valueClass={annualBudget > 0 && annualRemaining < 0 ? 'text-red-600' : 'text-green-600'}
          />
          <MetricCard
            label="% Used"
            value={annualBudget > 0 ? `${annualPctUsed}%` : '—'}
            sub="of annual budget"
            color="purple"
          />
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Budget vs. Spent by Channel</h2>
          {chartData.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">No data for this quarter.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
                <Bar dataKey="Budget" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Spent" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={progressBgColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Channel Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Channel Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Channel</th>
                  <th className="text-left px-4 py-3 font-medium">Quarter</th>
                  <th className="text-right px-4 py-3 font-medium">Budget</th>
                  <th className="text-right px-4 py-3 font-medium">Spent</th>
                  <th className="px-4 py-3 font-medium w-40">Progress</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">No entries for this quarter.</td>
                  </tr>
                )}
                {filtered.map((entry) => {
                  const subs = entry.subs || []
                  const hasSubs = subs.length > 0
                  const isExpanded = expanded.has(entry.id)
                  const budget = effectiveBudget(entry)
                  const spent = effectiveSpent(entry)
                  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
                  const status = getStatus(budget, spent)
                  const channelKey = `${entry.id}-channel`
                  const quarterKey = `${entry.id}-quarter`
                  const budgetKey = `${entry.id}-budget`
                  const spentKey = `${entry.id}-spent`
                  const editingChannel = channelKey in editing
                  const editingQuarter = quarterKey in editing
                  const editingBudget = !hasSubs && budgetKey in editing
                  const editingSpent = !hasSubs && spentKey in editing
                  const sf = subForms[entry.id] || { name: '', budget: '', spent: '' }

                  return (
                    <Fragment key={entry.id}>
                      {/* Channel row */}
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpand(entry.id)}
                              className="p-0.5 rounded hover:bg-slate-200 transition-colors flex-shrink-0"
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            {editingChannel ? (
                              <input
                                autoFocus
                                type="text"
                                value={editing[channelKey]}
                                onChange={(e) => setEditing((prev) => ({ ...prev, [channelKey]: e.target.value }))}
                                onBlur={() => commitEdit(entry.id, 'channel')}
                                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(entry.id, 'channel') }}
                                className="border border-blue-400 rounded px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 w-36"
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                                title="Click to edit"
                                onClick={() => startEdit(entry.id, 'channel', entry.channel)}
                              >
                                {entry.channel}
                              </span>
                            )}
                            {hasSubs && (
                              <span className="text-xs text-slate-400 font-normal">({subs.length})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {editingQuarter ? (
                            <select
                              autoFocus
                              value={editing[quarterKey]}
                              onChange={(e) => {
                                setEditing((prev) => ({ ...prev, [quarterKey]: e.target.value }))
                                setEntries((prev) => prev.map((en) => en.id === entry.id ? { ...en, quarter: e.target.value } : en))
                                setEditing((prev) => { const next = { ...prev }; delete next[quarterKey]; return next })
                              }}
                              onBlur={() => commitEdit(entry.id, 'quarter')}
                              className="border border-blue-400 rounded px-2 py-0.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q}>{q}</option>)}
                            </select>
                          ) : (
                            <span
                              className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                              title="Click to edit"
                              onClick={() => startEdit(entry.id, 'quarter', entry.quarter)}
                            >
                              {entry.quarter}
                            </span>
                          )}
                        </td>

                        {/* Budget */}
                        <td className="px-4 py-3 text-right">
                          {hasSubs ? (
                            <span className="text-slate-600" title="Sum of sub-rows">{fmt(budget)}</span>
                          ) : editingBudget ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              value={editing[budgetKey]}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [budgetKey]: e.target.value }))}
                              onBlur={() => commitEdit(entry.id, 'budget')}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(entry.id, 'budget') }}
                              className="w-24 text-right border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                              title="Click to edit"
                              onClick={() => startEdit(entry.id, 'budget', entry.budget)}
                            >
                              {fmt(budget)}
                            </span>
                          )}
                        </td>

                        {/* Spent */}
                        <td className="px-4 py-3 text-right">
                          {hasSubs ? (
                            <span className="text-slate-600" title="Sum of sub-rows">{fmt(spent)}</span>
                          ) : editingSpent ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              value={editing[spentKey]}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [spentKey]: e.target.value }))}
                              onBlur={() => commitEdit(entry.id, 'spent')}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(entry.id, 'spent') }}
                              className="w-24 text-right border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                              title="Click to edit"
                              onClick={() => startEdit(entry.id, 'spent', entry.spent)}
                            >
                              {fmt(spent)}
                            </span>
                          )}
                        </td>

                        {/* Progress bar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: progressBgColor(status) }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-8 text-right">
                              {budget > 0 ? `${Math.round((spent / budget) * 100)}%` : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyle(status)}`}>
                            {status}
                          </span>
                        </td>

                        {/* Delete channel */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete channel"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {/* Sub-rows */}
                      {isExpanded && subs.map((sub) => {
                        const subStatus = getStatus(sub.budget, sub.spent)
                        const subPct = sub.budget > 0 ? Math.min((sub.spent / sub.budget) * 100, 100) : 0
                        const subBudgetKey = `sub-${entry.id}-${sub.id}-budget`
                        const subSpentKey = `sub-${entry.id}-${sub.id}-spent`

                        return (
                          <tr key={`sub-${entry.id}-${sub.id}`} className="bg-slate-50/60 border-l-2 border-l-slate-200">
                            <td className="pl-12 pr-4 py-2 text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-300 select-none">└</span>
                                {sub.name}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-slate-400 text-xs">{entry.quarter}</td>

                            {/* Sub budget — inline editable */}
                            <td className="px-4 py-2 text-right">
                              {subBudgetKey in editing ? (
                                <input
                                  autoFocus
                                  type="number"
                                  min="0"
                                  value={editing[subBudgetKey]}
                                  onChange={(e) => setEditing((prev) => ({ ...prev, [subBudgetKey]: e.target.value }))}
                                  onBlur={() => commitEditSub(entry.id, sub.id, 'budget')}
                                  onKeyDown={(e) => { if (e.key === 'Enter') commitEditSub(entry.id, sub.id, 'budget') }}
                                  className="w-24 text-right border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed text-slate-600"
                                  title="Click to edit"
                                  onClick={() => startEditSub(entry.id, sub.id, 'budget', sub.budget)}
                                >
                                  {fmt(sub.budget)}
                                </span>
                              )}
                            </td>

                            {/* Sub spent — inline editable */}
                            <td className="px-4 py-2 text-right">
                              {subSpentKey in editing ? (
                                <input
                                  autoFocus
                                  type="number"
                                  min="0"
                                  value={editing[subSpentKey]}
                                  onChange={(e) => setEditing((prev) => ({ ...prev, [subSpentKey]: e.target.value }))}
                                  onBlur={() => commitEditSub(entry.id, sub.id, 'spent')}
                                  onKeyDown={(e) => { if (e.key === 'Enter') commitEditSub(entry.id, sub.id, 'spent') }}
                                  className="w-24 text-right border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed text-slate-600"
                                  title="Click to edit"
                                  onClick={() => startEditSub(entry.id, sub.id, 'spent', sub.spent)}
                                >
                                  {fmt(sub.spent)}
                                </span>
                              )}
                            </td>

                            {/* Sub progress */}
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="h-1.5 rounded-full transition-all"
                                    style={{ width: `${subPct}%`, backgroundColor: progressBgColor(subStatus) }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400 w-8 text-right">
                                  {sub.budget > 0 ? `${Math.round((sub.spent / sub.budget) * 100)}%` : '—'}
                                </span>
                              </div>
                            </td>

                            {/* Sub status */}
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyle(subStatus)}`}>
                                {subStatus}
                              </span>
                            </td>

                            {/* Delete sub */}
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => deleteSub(entry.id, sub.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                                title="Delete sub-row"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        )
                      })}

                      {/* Add sub-row form */}
                      {isExpanded && (
                        <tr className="bg-slate-50/40 border-l-2 border-l-slate-200">
                          <td colSpan={7} className="pl-12 pr-5 py-2">
                            <form
                              onSubmit={(e) => { e.preventDefault(); addSub(entry.id) }}
                              className="flex items-center gap-2 flex-wrap"
                            >
                              <input
                                type="text"
                                placeholder="Name"
                                value={sf.name}
                                onChange={(e) => setSubForms((prev) => ({ ...prev, [entry.id]: { ...sf, name: e.target.value } }))}
                                className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="number"
                                placeholder="Budget ($)"
                                min="0"
                                value={sf.budget}
                                onChange={(e) => setSubForms((prev) => ({ ...prev, [entry.id]: { ...sf, budget: e.target.value } }))}
                                className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="number"
                                placeholder="Spent ($)"
                                min="0"
                                value={sf.spent}
                                onChange={(e) => setSubForms((prev) => ({ ...prev, [entry.id]: { ...sf, spent: e.target.value } }))}
                                className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="submit"
                                className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                              >
                                + Add
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Row Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Add Channel</h2>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Channel name"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
              className="flex-1 min-w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              placeholder="Budget ($)"
              min="0"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              className="w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              placeholder="Spent ($)"
              min="0"
              value={form.spent}
              onChange={(e) => setForm((f) => ({ ...f, spent: e.target.value }))}
              className="w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={form.quarter}
              onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2 rounded-lg shadow-sm transition-colors"
            >
              Add
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color, valueClass }) {
  const borderMap = {
    blue: 'border-l-blue-500',
    indigo: 'border-l-indigo-500',
    green: 'border-l-green-500',
    red: 'border-l-red-500',
    purple: 'border-l-purple-500',
  }
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 border-l-4 ${borderMap[color] || 'border-l-slate-400'} p-4`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass || 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
