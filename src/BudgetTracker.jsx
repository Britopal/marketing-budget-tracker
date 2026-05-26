import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const fmt = (n) => "$" + Math.round(n || 0).toLocaleString();

const ROI_CHANNELS = new Set([
  "Client Events & Experiences",
  "Advertising/Leads",
  "AI Prospecting Tools",
  "PR",
  "Social Media",
  "Website/SEO",
]);

function getStatus(spent, budget) {
  if (!budget) return { label: "No budget", color: "gray" };
  const p = (spent / budget) * 100;
  if (p > 100) return { label: "Over", color: "red" };
  if (p === 100) return { label: "Even", color: "blue" };
  if (p >= 80) return { label: "At risk", color: "amber" };
  return { label: "On track", color: "green" };
}

const badgeStyles = {
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  gray: "bg-gray-100 text-gray-500",
};

const barColor = (spent, budget) => {
  if (!budget) return "#94a3b8";
  const p = (spent / budget) * 100;
  if (p > 100) return "#fca5a5";
  if (p === 100) return "#93c5fd";
  if (p >= 80) return "#fcd34d";
  return "#6ee7b7";
};

export default function BudgetTracker() {
  const [annualBudget, setAnnualBudget] = useState(400000);
  const [annualInput, setAnnualInput] = useState("400000");
  const [channels, setChannels] = useState([]);
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [quarterFilter, setQuarterFilter] = useState("All");
  const [editCell, setEditCell] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newChannel, setNewChannel] = useState("");
  const [newItems, setNewItems] = useState({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: ch } = await supabase.from("channels").select("*").order("created_at");
    const { data: it, error: itemsError } = await supabase.from("items").select("*").order("created_at");
    if (itemsError) console.error("loadData items error:", itemsError.message);
    // Verify revenue/leads columns exist — if not, migrations need to be applied in Supabase dashboard
    const { error: schemaError } = await supabase.from("items").select("revenue, leads").limit(0);
    if (schemaError) {
      console.error(
        "Schema error: revenue/leads columns missing from items table.\n" +
        "Apply migrations in the Supabase SQL editor:\n" +
        "  alter table items add column if not exists revenue numeric default 0;\n" +
        "  alter table items add column if not exists leads integer default 0;"
      );
    }
    setChannels(ch || []);
    setItems(it || []);
    setLoading(false);
  }

  function getChannelItems(channelId) {
    return items.filter(i => i.channel_id === channelId &&
      (quarterFilter === "All" || i.quarter === quarterFilter));
  }

  function channelSpent(channelId) {
    return getChannelItems(channelId).reduce((s, i) => s + (i.spent || 0), 0);
  }

  function channelRevenue(channelId) {
    const channelItems = items.filter(i => String(i.channel_id) === String(channelId));
    return channelItems.reduce((s, i) => s + (Number(i.revenue) || 0), 0);
  }

  function channelLeads(channelId) {
    const channelItems = items.filter(i => String(i.channel_id) === String(channelId));
    console.log("[channelLeads]", channelId, channelItems.map(i => ({ id: i.id, leads: i.leads, channel_id: i.channel_id })));
    return channelItems.reduce((s, i) => s + (Number(i.leads) || 0), 0);
  }

  function calcROI(revenue, spent) {
    if (!spent) return null;
    return Math.round(((revenue - spent) / spent) * 100);
  }

  const totalAllocated = channels.reduce((s, c) => s + (c.annual_budget || 0), 0);
  const totalSpent = channels.reduce((s, c) => s + channelSpent(c.id), 0);
  const totalRevenue = channels.reduce((s, c) => s + channelRevenue(c.id), 0);
  const overallROI = calcROI(totalRevenue, totalSpent);
  const unallocated = annualBudget - totalAllocated;
  const remaining = annualBudget - totalSpent;
  const pctUsed = annualBudget > 0 ? Math.round((totalSpent / annualBudget) * 100) : 0;

  async function addChannel() {
    if (!newChannel.trim()) return;
    const { data } = await supabase.from("channels")
      .insert({ name: newChannel.trim(), annual_budget: 0 }).select().single();
    if (data) { setChannels(prev => [...prev, data]); setNewChannel(""); }
  }

  async function deleteChannel(id) {
    await supabase.from("channels").delete().eq("id", id);
    setChannels(prev => prev.filter(c => c.id !== id));
    setItems(prev => prev.filter(i => i.channel_id !== id));
  }

  async function updateChannel(id, field, value) {
    const update = { [field]: field === "annual_budget" ? Number(value) : value };
    await supabase.from("channels").update(update).eq("id", id);
    setChannels(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
    setEditCell(null);
  }

  async function addItem(channelId) {
    const ni = newItems[channelId] || { name: "", quarter: "Q1", spent: "", revenue: "", leads: "" };
    if (!ni.name.trim()) return;
    const { data } = await supabase.from("items")
      .insert({
        channel_id: channelId,
        name: ni.name.trim(),
        quarter: ni.quarter,
        spent: Number(ni.spent) || 0,
        revenue: Number(ni.revenue) || 0,
        leads: Number(ni.leads) || 0,
      })
      .select().single();
    if (data) {
      setItems(prev => [...prev, data]);
      setNewItems(prev => ({ ...prev, [channelId]: { name: "", quarter: "Q1", spent: "", revenue: "", leads: "" } }));
    }
  }

  async function deleteItem(id) {
    await supabase.from("items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function updateItem(id, field, value) {
    const numericFields = new Set(["spent", "revenue", "leads"]);
    const update = { [field]: numericFields.has(field) ? Number(value) : value };
    const { error } = await supabase.from("items").update(update).eq("id", id);
    if (error) {
      console.error("updateItem failed:", error.message, { field, value });
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...update } : i));
    }
    setEditCell(null);
  }

  function exportCSV() {
    const rows = [["Channel", "Item", "Quarter", "Annual Budget", "Spent", "Revenue", "Leads", "ROI", "Remaining", "Status"]];
    channels.forEach(c => {
      const its = getChannelItems(c.id);
      if (its.length === 0) {
        const s = getStatus(0, c.annual_budget);
        rows.push([c.name, "", "", c.annual_budget, 0, 0, 0, "—", c.annual_budget, s.label]);
      } else {
        its.forEach(i => {
          const roi = i.spent ? Math.round(((i.revenue - i.spent) / i.spent) * 100) + "%" : "—";
          rows.push([c.name, i.name, i.quarter, c.annual_budget, i.spent, i.revenue || 0, i.leads || 0, roi, "", ""]);
        });
      }
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "marketing-budget.csv";
    a.click();
  }

  const chartData = channels.map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
    budget: c.annual_budget || 0,
    spent: channelSpent(c.id),
    fullName: c.name,
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Budget Tracker</h1>
          <p className="text-sm text-gray-400">Track spend vs. budget across channels</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500">Quarter</label>
          <select value={quarterFilter} onChange={e => setQuarterFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
            {["All","Q1","Q2","Q3","Q4"].map(q => <option key={q}>{q}</option>)}
          </select>
          <button onClick={exportCSV}
            className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-700 flex items-center gap-2">
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Annual budget input */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Annual Budget</div>
          <div className="text-3xl font-bold text-gray-900">{fmt(annualBudget)}</div>
          <div className={`text-sm mt-1 ${unallocated < 0 ? "text-red-500" : "text-gray-400"}`}>
            {fmt(Math.abs(unallocated))} {unallocated >= 0 ? "unallocated" : "over-allocated"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input type="number" value={annualInput}
            onChange={e => setAnnualInput(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36"
            placeholder="Set annual budget..." />
          <button onClick={() => setAnnualBudget(Number(annualInput))}
            className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-gray-700">
            Set
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total Allocated", value: fmt(totalAllocated), accent: "border-purple-400", sub: "across channels" },
          { label: "Unallocated", value: fmt(Math.abs(unallocated)), accent: "border-gray-300", sub: unallocated >= 0 ? "available to assign" : "over-allocated", highlight: unallocated < 0 },
          { label: "Total Spent", value: fmt(totalSpent), accent: "border-purple-400", sub: "across all channels" },
          { label: "Remaining", value: fmt(remaining), accent: "border-green-400", sub: "of annual budget", highlight: remaining < 0 },
          { label: "% Used", value: pctUsed + "%", accent: "border-purple-400", sub: "of annual budget", highlight: pctUsed > 100 },
          { label: "Overall ROI", value: overallROI !== null ? (overallROI >= 0 ? "+" : "") + overallROI + "%" : "—", accent: overallROI > 0 ? "border-emerald-400" : overallROI < 0 ? "border-red-400" : "border-gray-300", sub: "revenue vs. spend", highlight: overallROI !== null && overallROI < 0 },
        ].map(m => (
          <div key={m.label} className={`bg-white border border-gray-200 rounded-xl p-4 border-l-4 ${m.accent}`}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{m.label}</div>
            <div className={`text-xl font-bold ${m.highlight ? "text-red-600" : "text-gray-900"}`}>{m.value}</div>
            <div className="text-xs text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Budget vs. Spent by Channel</div>
        <div className="flex gap-4 mb-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block"></span>Budget</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-300 inline-block"></span>Spent</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-300 inline-block"></span>At risk</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-300 inline-block"></span>Over</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barGap={4}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => "$" + (v >= 1000 ? v/1000 + "k" : v)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n, p) => [fmt(v), n]} labelFormatter={(l, p) => p[0]?.payload?.fullName || l} />
            <Bar dataKey="budget" fill="#bfdbfe" radius={[4,4,0,0]} name="Budget" />
            <Bar dataKey="spent" radius={[4,4,0,0]} name="Spent">
              {chartData.map((d, i) => <Cell key={i} fill={barColor(d.spent, d.budget)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Channel breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-sm font-semibold text-gray-700 mb-4">Channel Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Channel / Item</th>
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Annual Budget</th>
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Spent</th>
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Revenue</th>
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Leads</th>
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">ROI</th>
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Progress</th>
                <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-3">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {channels.map(c => {
                const cItems = getChannelItems(c.id);
                const spent = channelSpent(c.id);
                const revenue = channelRevenue(c.id);
                const leads = channelLeads(c.id);
                const roi = calcROI(revenue, spent);
                const p = c.annual_budget > 0 ? Math.round((spent / c.annual_budget) * 100) : 0;
                const s = getStatus(spent, c.annual_budget);
                const isExp = expanded[c.id];
                const allItems = items.filter(i => i.channel_id === c.id);
                const showROI = ROI_CHANNELS.has(c.name);

                return [
                  // Channel row
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="py-2.5 pr-3 font-semibold" onClick={() => setExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
                      <span className="mr-2 text-gray-400">{isExp ? "▼" : "▶"}</span>
                      {editCell?.id === c.id && editCell?.field === "name" ? (
                        <input autoFocus defaultValue={c.name} className="border border-blue-300 rounded px-1 text-sm w-40"
                          onBlur={e => updateChannel(c.id, "name", e.target.value)}
                          onKeyDown={e => e.key === "Enter" && updateChannel(c.id, "name", e.target.value)} />
                      ) : (
                        <span onClick={e => { e.stopPropagation(); setEditCell({ id: c.id, field: "name" }); }}>{c.name}</span>
                      )}
                      <span className="ml-2 text-xs text-gray-400 font-normal">({allItems.length})</span>
                    </td>
                    <td className="py-2.5 pr-3 cursor-pointer hover:text-blue-600"
                      onClick={() => setEditCell({ id: c.id, field: "annual_budget" })}>
                      {editCell?.id === c.id && editCell?.field === "annual_budget" ? (
                        <input autoFocus type="number" defaultValue={c.annual_budget}
                          className="border border-blue-300 rounded px-1 w-24 text-sm"
                          onBlur={e => updateChannel(c.id, "annual_budget", e.target.value)}
                          onKeyDown={e => e.key === "Enter" && updateChannel(c.id, "annual_budget", e.target.value)} />
                      ) : fmt(c.annual_budget)}
                    </td>
                    <td className="py-2.5 pr-3">{fmt(spent)}</td>
                    <td className="py-2.5 pr-3 text-gray-500">
                      {showROI
                        ? (revenue > 0 ? fmt(revenue) : <span className="text-gray-300">—</span>)
                        : <span className="text-gray-300 text-xs">n/a</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-500">
                      {showROI
                        ? (leads > 0 ? leads.toLocaleString() : <span className="text-gray-300">—</span>)
                        : <span className="text-gray-300 text-xs">n/a</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      {showROI
                        ? (roi !== null
                          ? <span className={`text-xs font-semibold ${roi >= 0 ? "text-emerald-600" : "text-red-500"}`}>{roi >= 0 ? "+" : ""}{roi}%</span>
                          : <span className="text-gray-300 text-xs">—</span>)
                        : <span className="text-gray-300 text-xs">n/a</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5 mb-0.5">
                        <div className="h-1.5 rounded-full" style={{ width: Math.min(p,100)+"%", background: barColor(spent, c.annual_budget) }} />
                      </div>
                      <span className="text-xs text-gray-400">{p}%</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyles[s.color]}`}>{s.label}</span>
                    </td>
                    <td className="py-2.5">
                      <button onClick={() => deleteChannel(c.id)} className="text-gray-300 hover:text-red-400 text-base">×</button>
                    </td>
                  </tr>,

                  // Sub-items
                  isExp && cItems.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 bg-gray-50/50">
                      <td className="py-2 pr-3 pl-8 text-gray-600">
                        {editCell?.id === item.id && editCell?.field === "name" ? (
                          <input autoFocus defaultValue={item.name} className="border border-blue-300 rounded px-1 text-sm w-36"
                            onBlur={e => updateItem(item.id, "name", e.target.value)}
                            onKeyDown={e => e.key === "Enter" && updateItem(item.id, "name", e.target.value)} />
                        ) : (
                          <span className="cursor-pointer hover:text-blue-600"
                            onClick={() => setEditCell({ id: item.id, field: "name" })}>{item.name}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {editCell?.id === item.id && editCell?.field === "quarter" ? (
                          <select autoFocus defaultValue={item.quarter}
                            className="border border-blue-300 rounded px-1 text-sm"
                            onBlur={e => updateItem(item.id, "quarter", e.target.value)}
                            onChange={e => updateItem(item.id, "quarter", e.target.value)}>
                            {["Q1","Q2","Q3","Q4"].map(q => <option key={q}>{q}</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-400 cursor-pointer hover:text-blue-600 text-xs"
                            onClick={() => setEditCell({ id: item.id, field: "quarter" })}>{item.quarter}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {editCell?.id === item.id && editCell?.field === "spent" ? (
                          <input autoFocus type="number" defaultValue={item.spent}
                            className="border border-blue-300 rounded px-1 w-24 text-sm"
                            onBlur={e => updateItem(item.id, "spent", e.target.value)}
                            onKeyDown={e => e.key === "Enter" && updateItem(item.id, "spent", e.target.value)} />
                        ) : (
                          <span className="cursor-pointer hover:text-blue-600"
                            onClick={() => setEditCell({ id: item.id, field: "spent" })}>{fmt(item.spent)}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {editCell?.id === item.id && editCell?.field === "revenue" ? (
                          <input autoFocus type="number" defaultValue={item.revenue || ""}
                            className="border border-blue-300 rounded px-1 w-24 text-sm"
                            onBlur={e => updateItem(item.id, "revenue", e.target.value)}
                            onKeyDown={e => e.key === "Enter" && updateItem(item.id, "revenue", e.target.value)} />
                        ) : (
                          <span className="cursor-pointer hover:text-blue-600 text-gray-500"
                            onClick={() => setEditCell({ id: item.id, field: "revenue" })}>
                            {item.revenue ? fmt(item.revenue) : <span className="text-gray-300 text-xs">click to add</span>}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {editCell?.id === item.id && editCell?.field === "leads" ? (
                          <input autoFocus type="number" defaultValue={item.leads || ""}
                            className="border border-blue-300 rounded px-1 w-20 text-sm"
                            onBlur={e => updateItem(item.id, "leads", e.target.value)}
                            onKeyDown={e => e.key === "Enter" && updateItem(item.id, "leads", e.target.value)} />
                        ) : (
                          <span className="cursor-pointer hover:text-blue-600 text-gray-500"
                            onClick={() => setEditCell({ id: item.id, field: "leads" })}>
                            {item.leads ? item.leads.toLocaleString() : <span className="text-gray-300 text-xs">click to add</span>}
                          </span>
                        )}
                      </td>
                      <td colSpan={2}></td>
                      <td className="py-2">
                        <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 text-base">×</button>
                      </td>
                    </tr>
                  )),

                  // Add item row
                  isExp && (
                    <tr key={`add-${c.id}`} className="bg-gray-50/50 border-b border-gray-100">
                      <td className="py-2 pr-3 pl-8">
                        <input placeholder="Item name"
                          value={newItems[c.id]?.name || ""}
                          onChange={e => setNewItems(prev => ({ ...prev, [c.id]: { ...prev[c.id], name: e.target.value } }))}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-36" />
                      </td>
                      <td className="py-2 pr-3">
                        <select value={newItems[c.id]?.quarter || "Q1"}
                          onChange={e => setNewItems(prev => ({ ...prev, [c.id]: { ...prev[c.id], quarter: e.target.value } }))}
                          className="border border-gray-200 rounded px-1 py-1 text-xs">
                          {["Q1","Q2","Q3","Q4"].map(q => <option key={q}>{q}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" placeholder="Spent ($)"
                          value={newItems[c.id]?.spent || ""}
                          onChange={e => setNewItems(prev => ({ ...prev, [c.id]: { ...prev[c.id], spent: e.target.value } }))}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" placeholder="Revenue ($)"
                          value={newItems[c.id]?.revenue || ""}
                          onChange={e => setNewItems(prev => ({ ...prev, [c.id]: { ...prev[c.id], revenue: e.target.value } }))}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" placeholder="Leads"
                          value={newItems[c.id]?.leads || ""}
                          onChange={e => setNewItems(prev => ({ ...prev, [c.id]: { ...prev[c.id], leads: e.target.value } }))}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-20" />
                      </td>
                      <td colSpan={2}>
                        <button onClick={() => addItem(c.id)}
                          className="text-xs bg-gray-900 text-white rounded px-3 py-1 hover:bg-gray-700">
                          + Add
                        </button>
                      </td>
                      <td></td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>

        {/* Add channel */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
          <input placeholder="New channel name" value={newChannel}
            onChange={e => setNewChannel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addChannel()}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48" />
          <button onClick={addChannel}
            className="bg-gray-900 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-gray-700">
            + Add channel
          </button>
        </div>
      </div>
    </div>
  );
}
