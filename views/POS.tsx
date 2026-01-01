
import React, { useState, useEffect } from 'react';
import { InventoryItem, Transaction, PaymentMethod, InventoryType, UserRole } from '../types.ts';

interface Props {
  inventory: InventoryItem[];
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  branchId: string;
  currentUser: { id: string; role: UserRole; branchId: string | null };
}

const POS: React.FC<Props> = ({ inventory, setTransactions, setInventory, branchId, currentUser }) => {
  const [cart, setCart] = useState<{ item: InventoryItem; quantity: number }[]>([]);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const retailItems = inventory.filter(i => 
    i.type === InventoryType.RETAIL_PRODUCT && 
    (i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (item: InventoryItem) => {
    if (item.stockLevel <= 0) return alert("Out of stock!");
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  const subtotal = cart.reduce((sum, c) => sum + (c.item.retailPrice || 0) * c.quantity, 0);

  const completeSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1000));

    const now = Date.now();
    const newTransaction: Transaction = {
      id: `trx-${now}`,
      branchId,
      orderId: `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      amountPaid: subtotal,
      paymentMethod,
      timestamp: now,
      type: 'RETAIL'
    };

    setInventory(prev => prev.map(invItem => {
      const cartItem = cart.find(c => c.item.id === invItem.id);
      return cartItem ? { ...invItem, stockLevel: invItem.stockLevel - cartItem.quantity } : invItem;
    }));

    setTransactions(prev => [...prev, newTransaction]);
    setCart([]);
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full pb-20">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col gap-4">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Retail POS</h2>
            <p className="text-sm text-slate-500 font-medium italic">Terminal #{branchId.split('-')[1] || '001'}</p>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
               {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>
        </header>

        <div className="relative">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input 
            type="text" 
            placeholder="Search items..." 
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto max-h-[60vh] md:max-h-full pr-1 pb-10">
          {retailItems.map(item => (
            <button 
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-left active-tap transition-all hover:border-blue-300 relative group"
            >
              <p className="font-black text-slate-800 text-sm truncate leading-tight group-hover:text-blue-600">{item.name}</p>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1 mb-4">{item.sku}</p>
              <div className="flex justify-between items-end">
                <span className="text-lg font-black text-slate-900 font-mono">${item.retailPrice?.toFixed(2)}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border ${item.stockLevel > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {item.stockLevel} IN STOCK
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Basket Sidebar */}
      <div className="w-full lg:w-80 bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col overflow-hidden shrink-0 animate-fadeIn">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-tight">
            <i className="fas fa-shopping-basket text-blue-600"></i> Basket
          </span>
          <span className="text-[10px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-black">{cart.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(c => (
            <div key={c.item.id} className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 animate-fadeIn">
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-xs font-black text-slate-800 truncate">{c.item.name}</p>
                <p className="text-[9px] text-slate-400 font-bold font-mono">{c.quantity} x ${c.item.retailPrice?.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-xs text-slate-800">${((c.item.retailPrice || 0) * c.quantity).toFixed(2)}</span>
                <button onClick={() => removeFromCart(c.item.id)} className="text-rose-400 active-tap px-1">
                  <i className="fas fa-times-circle"></i>
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="py-20 text-center text-slate-300 opacity-20 flex flex-col items-center">
              <i className="fas fa-cart-arrow-down text-4xl mb-2"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">Basket Empty</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-5">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-slate-400 font-black uppercase text-[9px] tracking-widest">Grand Total</span>
              <p className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter">{currentTime.toLocaleDateString()}</p>
            </div>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter">${subtotal.toFixed(2)}</span>
          </div>

          <button 
            disabled={cart.length === 0 || isProcessing}
            onClick={completeSale}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active-tap shadow-lg ${cart.length === 0 ? 'bg-slate-200 text-slate-400 shadow-none' : 'bg-emerald-600 text-white shadow-emerald-500/30'}`}
          >
            {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-save"></i> Save Transaction</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POS;