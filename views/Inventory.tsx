
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem, InventoryType, UserRole, PaymentMethod, Transaction, Branch } from '../types.ts';
import { logSecurityEvent } from '../services/securityService.ts';

interface Props {
  items: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  branches: Branch[];
  branchId: string;
  currentUser: { id: string; role: UserRole; branchId: string | null };
}

type StockStatus = 'ALL' | 'LOW_STOCK' | 'OPTIMAL' | 'OUT_OF_STOCK';

const Inventory: React.FC<Props> = ({ items, setInventory, setTransactions, branches, branchId, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StockStatus>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [globalThreshold, setGlobalThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('fuppas_global_threshold');
    return saved ? parseInt(saved) : 5;
  });
  
  // Modal States
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [sellingItem, setSellingItem] = useState<InventoryItem | null>(null);
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  
  // Sale State
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePaymentMethod, setSalePaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;

  useEffect(() => {
    localStorage.setItem('fuppas_global_threshold', globalThreshold.toString());
  }, [globalThreshold]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(query) || 
        item.sku.toLowerCase().includes(query);
      
      const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
      const matchesBranch = !isSuperAdmin || selectedBranchId === 'ALL' || item.branchId === selectedBranchId;
      
      const isOutOfStock = item.stockLevel <= 0;
      const isLow = item.stockLevel <= (item.reorderPoint || globalThreshold) && !isOutOfStock;
      
      let matchesStatus = true;
      if (statusFilter === 'OUT_OF_STOCK') matchesStatus = isOutOfStock;
      if (statusFilter === 'LOW_STOCK') matchesStatus = isLow || isOutOfStock; // Low includes out of stock for safety
      if (statusFilter === 'OPTIMAL') matchesStatus = !isLow && !isOutOfStock;
      
      return matchesSearch && matchesType && matchesBranch && matchesStatus;
    });
  }, [items, searchTerm, typeFilter, statusFilter, selectedBranchId, isSuperAdmin, globalThreshold]);

  const stats = useMemo(() => {
    const activeItems = isSuperAdmin ? items : items.filter(i => i.branchId === branchId);
    const outOfStock = activeItems.filter(i => i.stockLevel <= 0);
    const lowStock = activeItems.filter(i => i.stockLevel <= (i.reorderPoint || globalThreshold) && i.stockLevel > 0);
    const healthy = activeItems.filter(i => i.stockLevel > (i.reorderPoint || globalThreshold));

    return {
      totalItems: activeItems.length,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      healthyCount: healthy.length,
      criticalTotal: outOfStock.length + lowStock.length,
      totalProcurementValue: activeItems.reduce((acc, i) => acc + (i.unitCost * i.stockLevel), 0),
      potentialRetailValue: activeItems.reduce((acc, i) => acc + ((i.retailPrice || 0) * i.stockLevel), 0)
    };
  }, [items, branchId, isSuperAdmin, globalThreshold]);

  const handleQuickAdjust = (itemId: string, delta: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const oldStock = item.stockLevel;
    const newStock = Math.max(0, oldStock + delta);
    
    setInventory(prev => prev.map(i => i.id === itemId ? { ...i, stockLevel: newStock } : i));
    
    logSecurityEvent(
      currentUser.id,
      `Stock Adjustment (${delta > 0 ? '+' : ''}${delta}): ${item.name}`,
      'Inventory',
      { stockLevel: oldStock },
      { stockLevel: newStock }
    );
  };

  const handleCompleteSale = async () => {
    if (!sellingItem) return;
    if (saleQuantity <= 0) return alert("Select a valid quantity.");
    if (saleQuantity > sellingItem.stockLevel) return alert("Insufficient stock for this sale.");

    setIsProcessingSale(true);
    await new Promise(r => setTimeout(r, 800));

    const totalAmount = (sellingItem.retailPrice || 0) * saleQuantity;
    const now = Date.now();

    const newTransaction: Transaction = {
      id: `trx-${now}`,
      branchId: sellingItem.branchId,
      orderId: `QS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      amountPaid: totalAmount,
      paymentMethod: salePaymentMethod,
      timestamp: now,
      type: 'RETAIL'
    };

    setInventory(prev => prev.map(i => 
      i.id === sellingItem.id ? { ...i, stockLevel: i.stockLevel - saleQuantity } : i
    ));

    setTransactions(prev => [...prev, newTransaction]);
    
    logSecurityEvent(
      currentUser.id,
      `Retail Sale Processed: ${sellingItem.name} x${saleQuantity}`,
      'Finance',
      null,
      { sku: sellingItem.sku, amount: totalAmount, method: salePaymentMethod }
    );

    setSellingItem(null);
    setSaleQuantity(1);
    setIsProcessingSale(false);
  };

  const handleCSVExport = () => {
    if (filteredItems.length === 0) {
      alert("No inventory records found for export.");
      return;
    }

    const headers = [
      'Branch', 'Asset Name', 'SKU', 'Category', 'Type', 'Stock Level', 'Reorder Point', 'Unit', 'Unit Cost ($)', 'Retail Price ($)', 'Total Value (Cost) ($)'
    ];

    const rows = filteredItems.map(item => {
      const branchName = branches.find(b => b.id === item.branchId)?.name || 'Unknown';
      return [
        branchName, item.name, item.sku, item.category, item.type, item.stockLevel, item.reorderPoint || globalThreshold, item.unitName || 'Units', item.unitCost.toFixed(2), item.retailPrice ? item.retailPrice.toFixed(2) : 'N/A', (item.unitCost * item.stockLevel).toFixed(2)
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fuppas_inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logSecurityEvent(currentUser.id, "Inventory CSV Export", "Inventory", null, { count: filteredItems.length });
  };

  const getStockHealth = (stock: number, reorder: number | undefined) => {
    const activeReorder = reorder !== undefined && reorder !== null ? reorder : globalThreshold;
    if (stock <= 0) return { color: 'bg-rose-600', label: 'Depleted', icon: 'fa-skull-crossbones' };
    if (stock <= activeReorder) return { color: 'bg-amber-500', label: 'Below Point', icon: 'fa-triangle-exclamation' };
    return { color: 'bg-emerald-500', label: 'Optimal', icon: 'fa-circle-check' };
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* View Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <i className="fas fa-boxes-stacked text-blue-600"></i>
            Inventory Registry
          </h2>
          <p className="text-slate-500 text-sm font-medium">Manage raw materials, procurement costs, and retail prices.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowThresholdSettings(true)}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all active-tap"
          >
            <i className="fas fa-cog"></i> Threshold
          </button>
          <button 
            onClick={handleCSVExport}
            className="bg-white border border-slate-200 hover:bg-blue-50 text-blue-600 px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all active-tap"
          >
            <i className="fas fa-file-csv"></i> Export
          </button>
          <button 
            onClick={() => setIsAddingNew(true)}
            className="bg-slate-900 hover:bg-black text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-xl shadow-slate-200 active-tap"
          >
            <i className="fas fa-plus"></i> Add New
          </button>
        </div>
      </header>

      {/* Modern Filter Ribbon */}
      <div className="flex flex-col gap-4">
        <div className="flex overflow-x-auto pb-2 gap-3 scrollbar-hide no-scrollbar">
          {[
            { id: 'ALL' as StockStatus, label: 'All Items', count: stats.totalItems, icon: 'fa-list-ul', color: 'bg-slate-900' },
            { id: 'OUT_OF_STOCK' as StockStatus, label: 'Out of Stock', count: stats.outOfStockCount, icon: 'fa-ban', color: 'bg-rose-600' },
            { id: 'LOW_STOCK' as StockStatus, label: 'Below Point', count: stats.lowStockCount, icon: 'fa-triangle-exclamation', color: 'bg-amber-500' },
            { id: 'OPTIMAL' as StockStatus, label: 'Optimal Stock', count: stats.healthyCount, icon: 'fa-check-circle', color: 'bg-emerald-500' }
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl whitespace-nowrap transition-all active-tap border-2 ${
                statusFilter === pill.id 
                  ? `${pill.color} text-white border-transparent shadow-lg shadow-${pill.color.split('-')[1]}-500/20` 
                  : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'
              }`}
            >
              <i className={`fas ${pill.icon} text-xs`}></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{pill.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                statusFilter === pill.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {pill.count}
              </span>
            </button>
          ))}
        </div>

        {/* Global Stats Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-coins text-xs"></i>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Procurement</p>
              <p className="text-sm font-black text-slate-800 font-mono">${stats.totalProcurementValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-chart-line text-xs"></i>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Retail Value</p>
              <p className="text-sm font-black text-emerald-600 font-mono">${stats.potentialRetailValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-triangle-exclamation text-xs"></i>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Critical</p>
              <p className="text-sm font-black text-rose-600 font-mono">{stats.criticalTotal}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-layer-group text-xs"></i>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Assets</p>
              <p className="text-sm font-black text-slate-800 font-mono">{stats.totalItems}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Search & Tool Bar */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4 items-center">
        
        {/* Branch Filter */}
        <div className="w-full lg:w-64">
          <div className="relative">
            {isSuperAdmin ? (
              <select 
                className="w-full pl-10 pr-10 py-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl text-[10px] font-black text-blue-700 uppercase tracking-widest appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                <option value="ALL">All Branch Locations</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <div className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                {branches.find(b => b.id === branchId)?.name || 'My Branch'}
              </div>
            )}
            <i className={`fas ${isSuperAdmin ? 'fa-store' : 'fa-lock'} absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 text-[10px]`}></i>
          </div>
        </div>

        <div className="relative flex-1 w-full">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Asset Name or SKU (Ctrl+F)..." 
            className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all font-bold placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="w-full lg:w-48">
          <div className="relative">
            <select 
              className="w-full pl-5 pr-10 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest appearance-none cursor-pointer outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Classes</option>
              <option value={InventoryType.RAW_MATERIAL}>Materials</option>
              <option value={InventoryType.RETAIL_PRODUCT}>Retail</option>
            </select>
            <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 pointer-events-none"></i>
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[9px]">Asset Details</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[9px]">Stock Status</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[9px]">Retail Value</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map(item => {
                const health = getStockHealth(item.stockLevel, item.reorderPoint);
                const isOutOfStock = item.stockLevel <= 0;
                const isLowStock = item.stockLevel <= (item.reorderPoint || globalThreshold);
                const branchName = branches.find(b => b.id === item.branchId)?.name || 'HQ';
                
                return (
                  <tr key={item.id} className={`transition-all group relative ${isOutOfStock ? 'bg-rose-50/20 shadow-[inset_4px_0_0_0_rgb(225,29,72)]' : isLowStock ? 'bg-amber-50/20 shadow-[inset_4px_0_0_0_rgb(245,158,11)]' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-8 py-5">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-base leading-tight truncate ${isOutOfStock ? 'text-rose-900' : 'text-slate-800'}`}>
                            {item.name}
                          </span>
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 bg-rose-600 text-white rounded-[6px] text-[7px] font-black uppercase tracking-[0.2em] shadow-sm">DEPLETED</span>
                          ) : isLowStock && (
                            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-[6px] text-[7px] font-black uppercase tracking-[0.2em] shadow-sm animate-pulse">REORDER</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{item.sku}</span>
                          <span className="text-[8px] text-slate-300 font-bold uppercase">• {item.category}</span>
                          {isSuperAdmin && selectedBranchId === 'ALL' && (
                            <span className="text-[8px] text-blue-500 font-black uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded ml-1">{branchName}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleQuickAdjust(item.id, -1)} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center font-black text-xs transition-all active-tap">-</button>
                          <div className="flex flex-col items-center">
                            <span className={`font-black font-mono text-base leading-none ${isOutOfStock ? 'text-rose-700' : isLowStock ? 'text-amber-700' : 'text-slate-800'}`}>
                              {item.stockLevel}
                            </span>
                            <span className="text-[8px] font-black uppercase text-slate-400 mt-1">{item.unitName || 'Units'}</span>
                          </div>
                          <button onClick={() => handleQuickAdjust(item.id, 1)} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center font-black text-xs transition-all active-tap">+</button>
                        </div>
                        <div className={`text-[8px] font-black uppercase flex items-center justify-center gap-1.5 ${health.color.replace('bg-', 'text-')}`}>
                          <i className={`fas ${health.icon} text-[7px]`}></i>
                          {health.label} <span className="opacity-40 italic">(Point: {item.reorderPoint || globalThreshold})</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        {item.type === InventoryType.RETAIL_PRODUCT && item.retailPrice ? (
                          <>
                            <span className="font-mono font-black text-base text-slate-800">${item.retailPrice.toFixed(2)}</span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 mt-0.5">Market Price</span>
                          </>
                        ) : (
                          <span className="text-slate-200 font-black italic text-[9px] uppercase tracking-widest">N/A (Material)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.type === InventoryType.RETAIL_PRODUCT && (
                           <button 
                            disabled={isOutOfStock}
                            onClick={() => { setSellingItem(item); setSaleQuantity(1); }}
                            className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-sm active-tap ${isOutOfStock ? 'bg-slate-100 text-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/10'}`}
                          >
                            <i className="fas fa-cart-shopping text-[10px]"></i>
                          </button>
                        )}
                        <button 
                          onClick={() => setEditingItem(item)}
                          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active-tap shadow-sm"
                        >
                          <i className="fas fa-pencil-alt text-[10px]"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <i className="fas fa-box-open text-6xl mb-4"></i>
                      <p className="text-sm font-black uppercase tracking-widest">Registry entry not found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* THRESHOLD SETTINGS MODAL */}
      {showThresholdSettings && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-slideUp relative">
             <button onClick={() => setShowThresholdSettings(false)} className="absolute top-8 right-8 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center active-tap">
                <i className="fas fa-times text-slate-400"></i>
             </button>
             <div className="text-center mb-10">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
                   <i className="fas fa-bell"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">System Thresholds</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Configure global asset safety margins.</p>
             </div>
             
             <div className="space-y-8">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Minimum Operating Level (Units)</label>
                   <input 
                    type="number" 
                    className="w-full px-6 py-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-4xl font-black font-mono text-center outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                    value={globalThreshold}
                    onChange={(e) => setGlobalThreshold(parseInt(e.target.value) || 0)}
                   />
                   <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed text-center italic">
                      Assets with stock levels at or below this value will trigger critical supply alerts across all dashboards.
                   </p>
                </div>
                <button 
                  onClick={() => setShowThresholdSettings(false)}
                  className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs active-tap shadow-2xl shadow-slate-200"
                >
                   Update Enterprise Logic
                </button>
             </div>
          </div>
        </div>
      )}

      {/* RETAIL SALE MODAL */}
      {sellingItem && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 animate-slideUp relative">
            <button onClick={() => setSellingItem(null)} className="absolute top-10 right-10 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors active-tap">
              <i className="fas fa-times text-slate-400"></i>
            </button>
            <header className="mb-10 text-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
                <i className="fas fa-cash-register"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Quick Sell Session</h3>
              <p className="text-slate-500 text-sm font-medium mt-1">{sellingItem.name}</p>
            </header>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Sell Quantity</label>
                  <input type="number" min="1" max={sellingItem.stockLevel} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black font-mono outline-none" value={saleQuantity} onChange={e => setSaleQuantity(Number(e.target.value))}/>
                  <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase text-center">Max Available: {sellingItem.stockLevel}</p>
                </div>
                <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col justify-center items-end text-white shadow-xl relative overflow-hidden group">
                  <div className="absolute -left-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><i className="fas fa-file-invoice-dollar text-7xl"></i></div>
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">Retail Total</span>
                  <span className="text-3xl font-black font-mono text-emerald-400 relative z-10">${((sellingItem.retailPrice || 0) * saleQuantity).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button onClick={() => setSellingItem(null)} className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-3xl font-black uppercase tracking-widest text-[10px] active-tap">Discard</button>
                <button onClick={handleCompleteSale} disabled={isProcessingSale} className="flex-[2] py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-500/20 active-tap">
                  {isProcessingSale ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-save mr-2"></i> Save Transaction</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSET MODAL */}
      {(isAddingNew || editingItem) && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 md:p-14 animate-slideUp relative max-h-[95vh] overflow-y-auto">
            <button onClick={() => { setIsAddingNew(false); setEditingItem(null); }} className="absolute top-10 right-10 w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
              <i className="fas fa-times text-slate-400"></i>
            </button>
            <div className="mb-10">
               <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{editingItem ? 'Asset Revision' : 'New Asset Protocol'}</h3>
               <p className="text-sm text-slate-500 font-medium mt-1">{editingItem ? 'Updating existing registry parameters.' : 'Provisioning new material or product to branch.'}</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const data = new FormData(form);
              const type = data.get('type') as InventoryType;
              const reorderPointValue = data.get('reorderPoint') ? Number(data.get('reorderPoint')) : undefined;

              if (editingItem) {
                setInventory(prev => prev.map(i => i.id === editingItem.id ? {
                  ...i,
                  sku: (data.get('sku') as string).toUpperCase(),
                  name: data.get('name') as string,
                  category: data.get('category') as string,
                  type: type,
                  stockLevel: Number(data.get('stockLevel')),
                  reorderPoint: reorderPointValue || globalThreshold,
                  unitCost: Number(data.get('unitCost')),
                  retailPrice: type === InventoryType.RETAIL_PRODUCT ? Number(data.get('retailPrice')) : undefined,
                  quantityPerUnit: Number(data.get('quantityPerUnit')) || undefined,
                  unitName: data.get('unitName') as string || 'Units',
                  bulkUnitName: data.get('bulkUnitName') as string || 'Bulk Units'
                } : i));
                setEditingItem(null);
              } else {
                const newItem: InventoryItem = {
                  id: `inv-${Date.now()}`,
                  branchId: branchId,
                  sku: (data.get('sku') as string).toUpperCase(),
                  name: data.get('name') as string,
                  category: data.get('category') as string,
                  type: type,
                  stockLevel: Number(data.get('stockLevel')),
                  reorderPoint: reorderPointValue || globalThreshold,
                  unitCost: Number(data.get('unitCost')),
                  retailPrice: type === InventoryType.RETAIL_PRODUCT ? Number(data.get('retailPrice')) : undefined,
                  quantityPerUnit: Number(data.get('quantityPerUnit')) || undefined,
                  unitName: data.get('unitName') as string || 'Units',
                  bulkUnitName: data.get('bulkUnitName') as string || 'Bulk Units'
                };
                setInventory(prev => [...prev, newItem]);
                setIsAddingNew(false);
              }
            }} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="col-span-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Asset Legal Name</label>
                  <input name="name" defaultValue={editingItem?.name} required className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-lg font-black outline-none focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Registry SKU</label>
                  <input name="sku" defaultValue={editingItem?.sku} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black outline-none uppercase font-mono"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Classification Type</label>
                  <select name="type" defaultValue={editingItem?.type || InventoryType.RAW_MATERIAL} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none appearance-none">
                    <option value={InventoryType.RAW_MATERIAL}>Material (Internal Use)</option>
                    <option value={InventoryType.RETAIL_PRODUCT}>Retail (External Sale)</option>
                  </select>
                </div>
                <div className="col-span-full pt-6 border-t border-slate-100">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><i className="fas fa-layer-group"></i> Logistic Dynamics</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Stock Level</label>
                      <input name="stockLevel" type="number" defaultValue={editingItem?.stockLevel || 0} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black font-mono outline-none"/>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Reorder Point</label>
                      <input name="reorderPoint" type="number" defaultValue={editingItem?.reorderPoint} className="w-full px-6 py-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-xl font-black font-mono outline-none" placeholder={globalThreshold.toString()}/>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Unit Descriptor</label>
                      <input name="unitName" defaultValue={editingItem?.unitName || 'Units'} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none" placeholder="Units / Sheets / Boxes"/>
                    </div>
                  </div>
                </div>
                
                <div className="col-span-full bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group/finance">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover/finance:scale-110 transition-transform"><i className="fas fa-wallet text-8xl"></i></div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-8 relative z-10">Financial Calibration</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Unit Procurement Cost ($)</label>
                      <input name="unitCost" defaultValue={editingItem?.unitCost} type="number" step="0.01" required className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] text-2xl font-black font-mono outline-none focus:bg-white/10 transition-all" placeholder="0.00"/>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 block">Retail Market Price ($)</label>
                      <input name="retailPrice" defaultValue={editingItem?.retailPrice} type="number" step="0.01" className="w-full px-6 py-5 bg-emerald-500/10 border border-emerald-500/20 rounded-[1.5rem] text-2xl font-black font-mono outline-none focus:bg-emerald-500/20 transition-all" placeholder="0.00"/>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-6 pt-6">
                <button type="button" onClick={() => { setIsAddingNew(false); setEditingItem(null); }} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest text-[10px] active-tap">Discard</button>
                <button type="submit" className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] active-tap shadow-2xl hover:bg-black transition-all">{editingItem ? 'Commence Update' : 'Finalize Registry Entry'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
