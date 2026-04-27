import { useState, useEffect, Fragment } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

const STORAGE_KEY = 'mbt-channels'
const ANNUAL_KEY = 'mbt-annual-budget'

const SAMPLE_DATA = [
  {
    id: 1,
    channel: 'Client Events & Experiences',
    budget: 105000,
    items: [
      { id: 1, name: 'Malcolm Gladwell', quarter: 'Q1', spent: 27782 },
      { id: 2, name: 'March Market Outlook Dinner', quarter: 'Q1', spent: 10198 },
    ],
  },
  {
    id: 2,
    channel: 'Specialist Vendors',
    budget: 50000,
    items: [
      { id: 1, name: 'Jodi Designer', quarter: 'Q1', spent: 1340 },
      { id: 2, name: 'Dee Nick Media', quarter: 'Q2', spent: 7500 },
      { id: 3, name: 'Tiny Frog', quarter: 'Q1', spent: 2100 },
      { id: 4, name: 'Wealthtender', quarter: 'Q1', spent: 1272 },
    ],
  },
  {
    id: 3,
    channel: 'Advertising',
    budget: 0,
    items: [
      { id: 1, name: 'Facebook Ads', quarter: 'Q1', spent: 6437 },
    ],
  },
]

function getStatus(budget, spent) {
  if (budget === 0) return spent > 0 ? 'Over' : 'On track'
  const pct = (spent / budget) * 100
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

function nextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map((x) => x.id)) + 1 : 1
}

const QUARTERS = ['All', 'Q1', 'Q2', 'Q3', 'Q4']

export default function BudgetTracker() {
  const [channels, setChannels] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : SAMPLE_DATA
    } catch {
      return SAMPLE_DATA
    }
  })

  const [annualBudget, setAnnualBudget] = useState(() => {
    const saved = localStorage.getItem(ANNUAL_KEY)
    return saved ? Number(saved) : 0
  })
  const [annualInput, setAnnualInput] = useState('')
  const [quarter, setQuarter] = useState('All')
  const [expanded, setExpanded] = useState(new Set())
  const [editing, setEditing] = useState({})
  const [newItemForms, setNewItemForms] = useState({})

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(channels)) }, [channels])
  useEffect(() => { localStorage.setItem(ANNUAL_KEY, String(annualBudget)) }, [annualBudget])

  function handleAnnualSubmit(e) {
    e.preventDefault()
    const val = parseFloat(annualInput)
    if (!isNaN(val) && val >= 0) setAnnualBudget(val)
    setAnnualInput('')
  }

  const totalAllocated = channels.reduce((s, ch) => s + ch.budget, 0)
  const unallocated = annualBudget - totalAllocated

  function getFilteredItems(ch) {
    return quarter === 'All' ? ch.items : ch.items.filter((i) => i.quarter === quarter)
  }

  function channelSpent(ch) {
    return getFilteredItems(ch).reduce((s, i) => s + i.spent, 0)
  }

  const totalSpent = channels.reduce((s, ch) => s + channelSpent(ch), 0)
  const annualRemaining = annualBudget - totalSpent
  const annualPctUsed = annualBudget > 0 ? ((totalSpent / annualBudget) * 100).toFixed(1) : '0.0'

  const chartData = channels.map((ch) => {
    const spent = channelSpent(ch)
    return { name: ch.channel, Budget: ch.budget, Spent: spent, status: getStatus(ch.budget, spent) }
  })

  // ── Inline editing ──────────────────────────────────────────────────────────

  function startEdit(key, value) {
    setEditing((prev) => ({ ...prev, [key]: String(value) }))
  }

  function closeEdit(key) {
    setEditing((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  function commitChannelField(chId, field) {
    const key = `ch-${chId}-${field}`
    const raw = editing[key]
    if (raw === undefined) return
    if (field === 'channel') {
      const v = raw.trim()
      if (v) setChannels((prev) => prev.map((ch) => ch.id === chId ? { ...ch, channel: v } : ch))
    } else if (field === 'budget') {
      const v = parseFloat(raw)
      if (!isNaN(v) && v >= 0) setChannels((prev) => prev.map((ch) => ch.id === chId ? { ...ch, budget: v } : ch))
    }
    closeEdit(key)
  }

  function commitItemField(chId, itemId, field) {
    const key = `item-${chId}-${itemId}-${field}`
    const raw = editing[key]
    if (raw === undefined) return
    if (field === 'name') {
      const v = raw.trim()
      if (v) setChannels((prev) => prev.map((ch) => ch.id !== chId ? ch : {
        ...ch, items: ch.items.map((i) => i.id === itemId ? { ...i, name: v } : i),
      }))
    } else if (field === 'spent') {
      const v = parseFloat(raw)
      if (!isNaN(v) && v >= 0) setChannels((prev) => prev.map((ch) => ch.id !== chId ? ch : {
        ...ch, items: ch.items.map((i) => i.id === itemId ? { ...i, spent: v } : i),
      }))
    }
    closeEdit(key)
  }

  function updateItemQuarter(chId, itemId, q) {
    setChannels((prev) => prev.map((ch) => ch.id !== chId ? ch : {
      ...ch, items: ch.items.map((i) => i.id === itemId ? { ...i, quarter: q } : i),
    }))
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function addItem(chId) {
    const sf = newItemForms[chId] || {}
    const name = (sf.name || '').trim()
    const spent = parseFloat(sf.spent || '')
    if (!name || isNaN(spent)) return
    const q = sf.quarter || (quarter !== 'All' ? quarter : 'Q1')
    setChannels((prev) => prev.map((ch) => {
      if (ch.id !== chId) return ch
      return { ...ch, items: [...ch.items, { id: nextId(ch.items), name, quarter: q, spent }] }
    }))
    setNewItemForms((prev) => ({ ...prev, [chId]: { name: '', quarter: q, spent: '' } }))
  }

  function deleteItem(chId, itemId) {
    setChannels((prev) => prev.map((ch) => ch.id !== chId ? ch : {
      ...ch, items: ch.items.filter((i) => i.id !== itemId),
    }))
  }

  function addChannel() {
    const id = nextId(channels)
    setChannels((prev) => [...prev, { id, channel: 'New Channel', budget: 0, items: [] }])
    setExpanded((prev) => new Set([...prev, id]))
  }

  function deleteChannel(chId) {
    setChannels((prev) => prev.filter((ch) => ch.id !== chId))
  }

  function exportCSV() {
    const headers = ['Channel', 'Item', 'Quarter', 'Channel Budget', 'Spent', 'Channel Remaining', 'Status']
    const rows = []
    channels.forEach((ch) => {
      const chSpent = ch.items.reduce((s, i) => s + i.spent, 0)
      const remaining = ch.budget - chSpent
      const status = getStatus(ch.budget, chSpent)
      if (ch.items.length === 0) {
        rows.push([`"${ch.channel}"`, '', '', ch.budget, 0, ch.budget, status])
      }
      ch.items.forEach((i) => {
        rows.push([`"${ch.channel}"`, `"${i.name}"`, i.quarter, ch.budget, i.spent, remaining, status])
      })
    })
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'marketing-budget.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
              {QUARTERS.map((q) => <option key={q}>{q}</option>)}
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

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Annual Budget" value={annualBudget > 0 ? fmt(annualBudget) : '—'} sub="set above" color="blue" />
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
            <p className="text-slate-400 text-sm text-center py-10">No channels yet.</p>
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
                  <th className="text-left px-5 py-3 font-medium">Channel / Item</th>
                  <th className="text-right px-4 py-3 font-medium">Budget / Qtr</th>
                  <th className="text-right px-4 py-3 font-medium">Spent</th>
                  <th className="px-4 py-3 font-medium w-40">Progress</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {channels.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No channels yet. Add one below.
                    </td>
                  </tr>
                )}

                {channels.map((ch) => {
                  const filteredItems = getFilteredItems(ch)
                  const spent = filteredItems.reduce((s, i) => s + i.spent, 0)
                  const pct = ch.budget === 0
                    ? (spent > 0 ? 100 : 0)
                    : Math.min((spent / ch.budget) * 100, 100)
                  const status = getStatus(ch.budget, spent)
                  const isExpanded = expanded.has(ch.id)
                  const chNameKey = `ch-${ch.id}-channel`
                  const chBudgetKey = `ch-${ch.id}-budget`
                  const sf = newItemForms[ch.id] || { name: '', quarter: quarter !== 'All' ? quarter : 'Q1', spent: '' }

                  return (
                    <Fragment key={ch.id}>

                      {/* ── Channel row ── */}
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpand(ch.id)}
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
                            {chNameKey in editing ? (
                              <input
                                autoFocus
                                type="text"
                                value={editing[chNameKey]}
                                onChange={(e) => setEditing((prev) => ({ ...prev, [chNameKey]: e.target.value }))}
                                onBlur={() => commitChannelField(ch.id, 'channel')}
                                onKeyDown={(e) => { if (e.key === 'Enter') commitChannelField(ch.id, 'channel') }}
                                className="border border-blue-400 rounded px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                                title="Click to edit"
                                onClick={() => startEdit(chNameKey, ch.channel)}
                              >
                                {ch.channel}
                              </span>
                            )}
                            <span className="text-xs text-slate-400 font-normal">({ch.items.length})</span>
                          </div>
                        </td>

                        {/* Channel budget */}
                        <td className="px-4 py-3 text-right">
                          {chBudgetKey in editing ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              value={editing[chBudgetKey]}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [chBudgetKey]: e.target.value }))}
                              onBlur={() => commitChannelField(ch.id, 'budget')}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitChannelField(ch.id, 'budget') }}
                              className="w-28 text-right border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                              title="Click to edit"
                              onClick={() => startEdit(chBudgetKey, ch.budget)}
                            >
                              {fmt(ch.budget)}
                            </span>
                          )}
                        </td>

                        {/* Total spent — derived, read-only */}
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(spent)}</td>

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
                              {ch.budget > 0 ? `${Math.round((spent / ch.budget) * 100)}%` : '—'}
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
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => deleteChannel(ch.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Delete channel"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {/* ── Item rows ── */}
                      {isExpanded && filteredItems.map((item) => {
                        const itemNameKey = `item-${ch.id}-${item.id}-name`
                        const itemSpentKey = `item-${ch.id}-${item.id}-spent`
                        const itemQtrKey = `item-${ch.id}-${item.id}-quarter`

                        return (
                          <tr key={item.id} className="bg-slate-50/60 border-l-2 border-l-slate-200">
                            {/* Item name */}
                            <td className="pl-12 pr-4 py-2 text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-300 select-none">└</span>
                                {itemNameKey in editing ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={editing[itemNameKey]}
                                    onChange={(e) => setEditing((prev) => ({ ...prev, [itemNameKey]: e.target.value }))}
                                    onBlur={() => commitItemField(ch.id, item.id, 'name')}
                                    onKeyDown={(e) => { if (e.key === 'Enter') commitItemField(ch.id, item.id, 'name') }}
                                    className="border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
                                  />
                                ) : (
                                  <span
                                    className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                                    title="Click to edit"
                                    onClick={() => startEdit(itemNameKey, item.name)}
                                  >
                                    {item.name}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Quarter */}
                            <td className="px-4 py-2 text-right text-slate-500">
                              {itemQtrKey in editing ? (
                                <select
                                  autoFocus
                                  value={editing[itemQtrKey]}
                                  onChange={(e) => {
                                    updateItemQuarter(ch.id, item.id, e.target.value)
                                    closeEdit(itemQtrKey)
                                  }}
                                  onBlur={() => closeEdit(itemQtrKey)}
                                  className="border border-blue-400 rounded px-2 py-0.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                  {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q}>{q}</option>)}
                                </select>
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                                  title="Click to edit"
                                  onClick={() => startEdit(itemQtrKey, item.quarter)}
                                >
                                  {item.quarter}
                                </span>
                              )}
                            </td>

                            {/* Spent */}
                            <td className="px-4 py-2 text-right text-slate-600">
                              {itemSpentKey in editing ? (
                                <input
                                  autoFocus
                                  type="number"
                                  min="0"
                                  value={editing[itemSpentKey]}
                                  onChange={(e) => setEditing((prev) => ({ ...prev, [itemSpentKey]: e.target.value }))}
                                  onBlur={() => commitItemField(ch.id, item.id, 'spent')}
                                  onKeyDown={(e) => { if (e.key === 'Enter') commitItemField(ch.id, item.id, 'spent') }}
                                  className="w-24 text-right border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              ) : (
                                <span
                                  className="cursor-pointer hover:text-blue-600 hover:underline decoration-dashed"
                                  title="Click to edit"
                                  onClick={() => startEdit(itemSpentKey, item.spent)}
                                >
                                  {fmt(item.spent)}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-2" />
                            <td className="px-4 py-2" />

                            {/* Delete item */}
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => deleteItem(ch.id, item.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                                title="Delete item"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        )
                      })}

                      {/* ── Add item form ── */}
                      {isExpanded && (
                        <tr className="bg-slate-50/40 border-l-2 border-l-slate-200">
                          <td colSpan={6} className="pl-12 pr-5 py-2">
                            <form
                              onSubmit={(e) => { e.preventDefault(); addItem(ch.id) }}
                              className="flex items-center gap-2 flex-wrap"
                            >
                              <input
                                type="text"
                                placeholder="Name"
                                value={sf.name}
                                onChange={(e) => setNewItemForms((prev) => ({ ...prev, [ch.id]: { ...sf, name: e.target.value } }))}
                                className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <select
                                value={sf.quarter || 'Q1'}
                                onChange={(e) => setNewItemForms((prev) => ({ ...prev, [ch.id]: { ...sf, quarter: e.target.value } }))}
                                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q}>{q}</option>)}
                              </select>
                              <input
                                type="number"
                                placeholder="Spent ($)"
                                min="0"
                                value={sf.spent}
                                onChange={(e) => setNewItemForms((prev) => ({ ...prev, [ch.id]: { ...sf, spent: e.target.value } }))}
                                className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="submit"
                                className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                              >
                                + Add item
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

          {/* Add channel */}
          <div className="px-5 py-4 border-t border-slate-100">
            <button
              onClick={addChannel}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add channel
            </button>
          </div>
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
