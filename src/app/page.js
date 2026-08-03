'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Package, Tag, Send, CheckCircle, AlertTriangle, 
  BarChart2, Layers, Plus, Trash, Edit, Check 
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ResellerHub() {
  const [activeTab, setActiveTab] = useState('bought');
  const [inventory, setInventory] = useState([]);
  const [unmatchedSales, setUnmatchedSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [categorizeModalItem, setCategorizeModalItem] = useState(null);
  const [listModalItem, setListModalItem] = useState(null);

  // Form States
  const [formData, setFormData] = useState({
    brand: '', category: '', size: '', color: '', condition: '',
    isBundle: false, bundleCount: 2, customProps: []
  });

  const [seoPattern, setSeoPattern] = useState('{brand} {category} {color} {size} - {condition}');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: invData } = await supabase.from('inventory').select('*').order('date_bought', { ascending: false });
    const { data: unmData } = await supabase.from('unmatched_sales').select('*').eq('status', 'Pending');
    if (invData) setInventory(invData);
    if (unmData) setUnmatchedSales(unmData);
    setLoading(false);
  }

  // Handle Categorize & Bundle Split
  async function handleSaveCategorize() {
    if (!categorizeModalItem) return;

    if (formData.isBundle && formData.bundleCount > 1) {
      const splitPrice = (categorizeModalItem.bought_price / formData.bundleCount).toFixed(2);
      
      await supabase.from('inventory').delete().eq('id', categorizeModalItem.id);

      const newItems = Array.from({ length: formData.bundleCount }).map((_, i) => ({
        original_title: `${categorizeModalItem.original_title} (Deel ${i + 1}/${formData.bundleCount})`,
        brand: formData.brand,
        category: formData.category,
        size: formData.size,
        color: formData.color,
        condition: formData.condition,
        bought_price: splitPrice,
        status: 'Categorized',
        custom_properties: formData.customProps,
        date_categorized: new Date().toISOString()
      }));

      await supabase.from('inventory').insert(newItems);
    } else {
      await supabase.from('inventory').update({
        brand: formData.brand,
        category: formData.category,
        size: formData.size,
        color: formData.color,
        condition: formData.condition,
        status: 'Categorized',
        custom_properties: formData.customProps,
        date_categorized: new Date().toISOString()
      }).eq('id', categorizeModalItem.id);
    }

    setCategorizeModalItem(null);
    fetchData();
  }

  // Handle Listing with SEO Pattern
  async function handleSaveListing() {
    if (!listModalItem) return;

    let generatedSeoTitle = seoPattern
      .replace('{brand}', formData.brand || listModalItem.brand || '')
      .replace('{category}', formData.category || listModalItem.category || '')
      .replace('{color}', formData.color || listModalItem.color || '')
      .replace('{size}', formData.size || listModalItem.size || '')
      .replace('{condition}', formData.condition || listModalItem.condition || '')
      .trim();

    const generatedSeoDesc = `Te koop: ${generatedSeoTitle}.\nMerk: ${formData.brand || listModalItem.brand}\nMaat: ${formData.size || listModalItem.size}\nStaat: ${formData.condition || listModalItem.condition}`;

    await supabase.from('inventory').update({
      seo_title: generatedSeoTitle,
      seo_description: generatedSeoDesc,
      status: 'Listed',
      date_listed: new Date().toISOString()
    }).eq('id', listModalItem.id);

    setListModalItem(null);
    fetchData();
  }

  // Manual Match Unmatched Sale
  async function handleLinkUnmatchedSale(unmatchedId, inventoryId) {
    const unmatched = unmatchedSales.find(u => u.id === unmatchedId);
    if (!unmatched) return;

    await supabase.from('inventory').update({
      status: 'Sold',
      sold_price: unmatched.sold_price,
      date_sold: unmatched.date_sold || new Date().toISOString()
    }).eq('id', inventoryId);

    await supabase.from('unmatched_sales').update({ status: 'Resolved' }).eq('id', unmatchedId);
    fetchData();
  }

  const totalProfit = inventory.filter(i => i.status === 'Sold').reduce((sum, i) => sum + ((i.sold_price || 0) - (i.bought_price || 0)), 0);
  const totalRevenue = inventory.filter(i => i.status === 'Sold').reduce((sum, i) => sum + (i.sold_price || 0), 0);
  const countBought = inventory.filter(i => i.status === 'Bought').length;
  const countCategorized = inventory.filter(i => i.status === 'Categorized').length;
  const countListed = inventory.filter(i => i.status === 'Listed').length;
  const countSold = inventory.filter(i => i.status === 'Sold').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Vinted Reseller Hub</h1>
          <p className="text-slate-400 text-sm">Automated Inventory Management & Analytics</p>
        </div>
        {unmatchedSales.length > 0 && (
          <button 
            onClick={() => setActiveTab('unmatched')}
            className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg text-sm animate-pulse"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{unmatchedSales.length} Ongekoppelde verkopen!</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Totale Winst</p>
          <p className="text-xl font-bold text-emerald-400">€ {totalProfit.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Omzet</p>
          <p className="text-xl font-bold text-blue-400">€ {totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Pakketten (Bought)</p>
          <p className="text-xl font-bold">{countBought}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Concepten</p>
          <p className="text-xl font-bold">{countCategorized}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Gelist op Vinted</p>
          <p className="text-xl font-bold text-indigo-400">{countListed}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <p className="text-xs text-slate-400">Verkocht</p>
          <p className="text-xl font-bold text-emerald-500">{countSold}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-3">
        {[
          { id: 'bought', label: `Pakketten (${countBought})`, icon: Package },
          { id: 'categorized', label: `Concepten (${countCategorized})`, icon: Tag },
          { id: 'listed', label: `Listings (${countListed})`, icon: Send },
          { id: 'inventory', label: 'Volledige Inventaris', icon: Layers },
          { id: 'stats', label: 'Analytics & Grafieken', icon: BarChart2 },
          { id: 'unmatched', label: `Unmatched (${unmatchedSales.length})`, icon: AlertTriangle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-emerald-500 text-slate-950' 
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Laden...</div>
      ) : (
        <main>
          {activeTab === 'bought' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.filter(i => i.status === 'Bought').map(item => (
                <div key={item.id} className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md">Binnengekomen Pakket</span>
                    <h3 className="font-semibold text-lg mt-3 text-slate-100">{item.original_title}</h3>
                    <p className="text-slate-400 text-sm mt-1">Aankoopprijs: <span className="text-slate-200 font-medium">€ {item.bought_price}</span></p>
                  </div>
                  <button
                    onClick={() => {
                      setCategorizeModalItem(item);
                      setFormData({ brand: '', category: '', size: '', color: '', condition: 'Goed', isBundle: false, bundleCount: 2, customProps: [] });
                    }}
                    className="mt-6 w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium py-2 rounded-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Tag className="w-4 h-4" />
                    <span>Categoriseer & Uitpakken</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'categorized' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.filter(i => i.status === 'Categorized').map(item => (
                <div key={item.id} className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-md">Klaar om te Listen</span>
                    <h3 className="font-semibold text-lg mt-3 text-slate-100">{item.original_title}</h3>
                    <div className="flex flex-wrap gap-2 my-3 text-xs">
                      {item.brand && <span className="bg-slate-700 px-2 py-1 rounded">{item.brand}</span>}
                      {item.size && <span className="bg-slate-700 px-2 py-1 rounded">{item.size}</span>}
                      {item.color && <span className="bg-slate-700 px-2 py-1 rounded">{item.color}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setListModalItem(item);
                      setFormData({ brand: item.brand, category: item.category, size: item.size, color: item.color, condition: item.condition });
                    }}
                    className="mt-4 w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>Genereer SEO & List op Vinted</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'unmatched' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">Ongekoppelde verkopen via e-mail:</p>
              {unmatchedSales.map(unmatched => (
                <div key={unmatched.id} className="bg-slate-800 border border-amber-500/30 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h4 className="font-semibold text-amber-300">{unmatched.raw_title}</h4>
                    <p className="text-xs text-slate-400">Verkocht voor: € {unmatched.sold_price}</p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <select id={`select-${unmatched.id}`} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 flex-1 md:w-64">
                      <option value="">Selecteer bijbehorende listing...</option>
                      {inventory.filter(i => i.status === 'Listed').map(i => (
                        <option key={i.id} value={i.id}>{i.seo_title || i.original_title}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const selectEl = document.getElementById(`select-${unmatched.id}`);
                        if (selectEl.value) handleLinkUnmatchedSale(unmatched.id, selectEl.value);
                      }}
                      className="bg-emerald-500 text-slate-950 font-medium px-4 py-2 rounded-lg text-sm"
                    >
                      Koppel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
              <h3 className="font-semibold mb-4 text-slate-200">Verkoopoverzicht</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pakketten', count: countBought },
                    { name: 'Concepten', count: countCategorized },
                    { name: 'Gelist', count: countListed },
                    { name: 'Verkocht', count: countSold }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </main>
      )}

      {categorizeModalItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">Categoriseer: {categorizeModalItem.original_title}</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Merk" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
              <input type="text" placeholder="Categorie" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Maat" className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} />
                <input type="text" placeholder="Kleur" className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
              </div>
              <div className="border-t border-slate-700 pt-3 mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isBundle} onChange={e => setFormData({...formData, isBundle: e.target.checked})} />
                  <span className="text-sm font-medium">Dit is een Bundel Aankoop</span>
                </label>
                {formData.isBundle && (
                  <div className="mt-2 text-xs text-slate-400">
                    <p>Aantal stuks in bundel:</p>
                    <input type="number" min="2" max="20" className="mt-1 w-24 bg-slate-900 border border-slate-700 rounded p-1 text-sm" value={formData.bundleCount} onChange={e => setFormData({...formData, bundleCount: parseInt(e.target.value) || 2})} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t border-slate-700">
              <button onClick={() => setCategorizeModalItem(null)} className="w-1/2 bg-slate-700 py-2 rounded-lg text-sm">Annuleren</button>
              <button onClick={handleSaveCategorize} className="w-1/2 bg-emerald-500 text-slate-950 font-bold py-2 rounded-lg text-sm">Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {listModalItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">SEO Template Configurator</h3>
            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-mono text-emerald-400" value={seoPattern} onChange={e => setSeoPattern(e.target.value)} />
            <div className="flex gap-2 pt-4 border-t border-slate-700">
              <button onClick={() => setListModalItem(null)} className="w-1/2 bg-slate-700 py-2 rounded-lg text-sm">Annuleren</button>
              <button onClick={handleSaveListing} className="w-1/2 bg-indigo-500 text-white font-bold py-2 rounded-lg text-sm">Bevestig Listing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
