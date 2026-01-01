
import React, { useState, useMemo } from 'react';
import { StockTransfer, TransferStatus, Branch, InventoryItem, UserRole, AppNotification, InventoryType } from '../types.ts';

interface Props {
  transfers: StockTransfer[];
  setTransfers: React.Dispatch<React.SetStateAction<StockTransfer[]>>;
  branches: Branch[];
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  currentUser: { id: string; role: UserRole; branchId: string | null };
  activeBranchId: string;
  addNotification: (branchId: string | null, message: string, type?: AppNotification['type']) => void;
}

const StockTransferView: React.FC<Props> = ({ 
  transfers, setTransfers, branches, inventory, setInventory, currentUser, activeBranchId, addNotification 
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [formData, setFormData] = useState({
    itemId: '',
    destinationBranchId: '',
    quantity: 1
  });

  const localInventory = useMemo(() => 
    inventory.filter(i => i.branchId === activeBranchId),
  [inventory, activeBranchId]);

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const item = localInventory.find(i => i.id === formData.itemId);
    if (!item) return;

    if (item.stockLevel < formData.quantity) {
      alert("Insufficient stock in your branch.");
      return;
    }

    const newTransfer: StockTransfer = {
      id: `trf-${Date.now()}`,
      originBranchId: activeBranchId,
      destinationBranchId: formData.destinationBranchId,
      itemId: item.id,
      itemName: item.name, 
      sku: item.sku,       
      quantity: formData.quantity,
      status: TransferStatus.PENDING,
      timestamp: Date.now()
    };

    setTransfers(prev => [...prev, newTransfer]);
    setIsRequesting(false);
    
    const originName = branches.find(b => b.id === activeBranchId)?.name || 'Origin Branch';
    
    addNotification(
      formData.destinationBranchId, 
      `Incoming Stock Proposal: ${formData.quantity}x ${item.name} [${item.sku}] is being transferred from ${originName}. Review in Logistics.`, 
      'INFO'
    );
    
    setFormData({ itemId: '', destinationBranchId: '', quantity: 1 });
  };

  const updateTransferStatus = (transferId: string, newStatus: TransferStatus) => {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) return;

    const originName = branches.find(b => b.id === transfer.originBranchId)?.name || 'Origin';
    const destName = branches.find(b => b.id === transfer.destinationBranchId)?.name || 'Destination';

    if (newStatus === TransferStatus.APPROVED) {
      setInventory(prev => {
        let nextInv = [...prev];
        nextInv = nextInv.map(item => 
          (item.branchId === transfer.originBranchId && item.sku === transfer.sku)
            ? { ...item, stockLevel: Math.max(0, item.stockLevel - transfer.quantity) } 
            : item
        );
        const destItem = nextInv.find(i => i.branchId === transfer.destinationBranchId && i.sku === transfer.sku);
        if (destItem) {
          nextInv = nextInv.map(item => item.id === destItem.id ? { ...item, stockLevel: item.stockLevel + transfer.quantity } : item);
        } else {
          const originItem = inventory.find(i => i.sku === transfer.sku);
          nextInv.push({
            id: `inv-${Date.now()}`,
            branchId: transfer.destinationBranchId,
            sku: transfer.sku,
            name: transfer.itemName,
            category: originItem?.category || 'General',
            type: originItem?.type || InventoryType.RAW_MATERIAL,
            stockLevel: transfer.quantity,
            reorderPoint: originItem?.reorderPoint || 5,
            unitCost: originItem?.unitCost || 0,
            retailPrice: originItem?.retailPrice
          });
        }
        return nextInv;
      });

      addNotification(
        transfer.originBranchId, 
        `Transfer Completed: ${transfer.quantity}x ${transfer.itemName} to ${destName} has been fully processed.`, 
        'SUCCESS'
      );
      
      addNotification(
        transfer.destinationBranchId, 
        `Transit Alert: Transfer of ${transfer.quantity}x ${transfer.itemName} from ${originName} has been approved.`, 
        'SUCCESS'
      );

    } else if (newStatus === TransferStatus.DENIED) {
      addNotification(
        transfer.originBranchId, 
        `Logistics Denied: The proposed transfer of ${transfer.quantity}x ${transfer.itemName} to ${destName} was rejected.`, 
        'WARNING'
      );
    }

    setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: newStatus } : t));
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <i className="fas fa-truck-ramp-box text-blue-600"></i>
            Stock Logistics
          </h2>
          <p className="text-slate-500 text-sm font-medium">Inter-branch inventory movement and authorization registry.</p>
        </div>
        <button 
          onClick={() => setIsRequesting(true)}
          className="bg-slate-900 hover:bg-black text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-xl shadow-slate-200 active:scale-95"
        >
          <i className="fas fa-paper-plane"></i> Initiate Transfer Request
        </button>
      </header>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30">
          <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Logistics Manifest</h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest italic">All inter-branch stock movements are audited here.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Asset Details</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Qty</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Route Path</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Current Status</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Initiated</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transfers.slice().reverse().map(t => {
                const isRecipient = t.destinationBranchId === activeBranchId || currentUser.role === UserRole.SUPER_ADMIN;
                const canAction = t.status === TransferStatus.PENDING && isRecipient;

                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 text-base leading-tight group-hover:text-blue-600 transition-colors">{t.itemName}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                           <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded leading-none">{t.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-lg text-slate-700">{t.quantity}</span>
                        <span className="text-slate-300 text-[9px] uppercase font-black">Units</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Origin</span>
                          <span className="text-xs font-bold text-slate-500 truncate max-w-[90px]">{branches.find(b => b.id === t.originBranchId)?.name || 'Branch'}</span>
                        </div>
                        <div className="bg-slate-100 p-1.5 rounded-lg">
                           <i className="fas fa-arrow-right text-[10px] text-blue-400"></i>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-blue-300 uppercase leading-none mb-1">Target</span>
                          <span className="text-xs font-black text-slate-800 truncate max-w-[90px]">{branches.find(b => b.id === t.destinationBranchId)?.name || 'Branch'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        {t.status === TransferStatus.PENDING && (
                          <span className="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                            <i className="fas fa-clock animate-pulse"></i>
                            Pending Review
                          </span>
                        )}
                        {t.status === TransferStatus.APPROVED && (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                            <i className="fas fa-check-circle"></i>
                            Approved
                          </span>
                        )}
                        {t.status === TransferStatus.DENIED && (
                          <span className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                            <i className="fas fa-times-circle"></i>
                            Denied
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <span className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-tighter">{formatTime(t.timestamp)}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {canAction ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => updateTransferStatus(t.id, TransferStatus.APPROVED)}
                            className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                            title="Approve"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                          <button 
                            onClick={() => updateTransferStatus(t.id, TransferStatus.DENIED)}
                            className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 active:scale-95"
                            title="Deny"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase italic">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center text-slate-300 italic">No transfers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isRequesting && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-slideUp relative">
            <button 
              onClick={() => setIsRequesting(false)} 
              className="absolute top-8 right-8 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <i className="fas fa-times text-slate-400"></i>
            </button>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-8">Stock Dispatch</h3>
            <form onSubmit={handleRequest} className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Source Asset</label>
                <select 
                  required 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  value={formData.itemId}
                  onChange={e => setFormData({...formData, itemId: e.target.value})}
                >
                  <option value="">Select Local Stock...</option>
                  {localInventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} — [{i.sku}] ({i.stockLevel} left)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Target Facility</label>
                <select 
                  required 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  value={formData.destinationBranchId}
                  onChange={e => setFormData({...formData, destinationBranchId: e.target.value})}
                >
                  <option value="">Select Recipient...</option>
                  {branches.filter(b => b.id !== activeBranchId).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Transfer Quantity</label>
                <input 
                  type="number" 
                  min="1" 
                  required 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black font-mono"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
                />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-xl shadow-blue-500/30">
                Dispatch Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTransferView;
