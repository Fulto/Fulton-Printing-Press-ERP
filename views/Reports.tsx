
import React, { useState, useMemo } from 'react';
import { Branch, Transaction, UserRole, PaymentMethod, Job } from '../types.ts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { logSecurityEvent } from '../services/securityService.ts';

interface Props {
  branches: Branch[];
  jobs: Job[];
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currentUser: { id: string; role: UserRole; branchId: string | null };
}

const Reports: React.FC<Props> = ({ branches, jobs, transactions, setTransactions, currentUser }) => {
  const [isVoiding, setIsVoiding] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidConfirmWord, setVoidConfirmWord] = useState('');

  const handleVoid = (id: string) => {
    if (!voidReason.trim()) {
      alert("A reason is required to void a transaction.");
      return;
    }

    if (voidConfirmWord.toUpperCase() !== 'VOID') {
      alert("Confirmation mismatch. Please type VOID exactly.");
      return;
    }

    const transactionToVoid = transactions.find(t => t.id === id);
    if (!transactionToVoid) return;

    setTransactions(prev => prev.map(t => 
      t.id === id ? { ...t, isVoid: true, voidReason: voidReason.trim() } : t
    ));

    logSecurityEvent(
      currentUser.id, 
      `Voided Transaction ${transactionToVoid.orderId}`, 
      'Finance', 
      { isVoid: false }, 
      { isVoid: true, voidReason: voidReason.trim() }
    );

    setIsVoiding(null);
    setVoidReason('');
    setVoidConfirmWord('');
  };

  const totalRevenue = useMemo(() => 
    transactions.filter(t => !t.isVoid).reduce((sum, t) => sum + t.amountPaid, 0),
  [transactions]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">Financial Audit</h2>
          <p className="text-slate-500 text-sm font-medium">Enterprise liquidity and transaction auditing.</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-right">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Verified Revenue</span>
          <span className="text-2xl font-black text-emerald-600 font-mono">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </header>

      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight text-sm">
          <i className="fas fa-chart-line text-blue-500"></i>
          Liquidity Flow (Snapshot)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={transactions.filter(t => !t.isVoid).slice(-15)}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="timestamp" hide />
              <YAxis tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '15px' }}
                itemStyle={{ color: '#2563eb', fontWeight: '900', fontSize: '14px' }}
              />
              <Area type="monotone" dataKey="amountPaid" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div>
            <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Transaction Ledger</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Audit-ready settlement records.</p>
          </div>
          <span className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest border border-slate-700">
            {transactions.length} Records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Reference</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Method</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Amount</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Authorization</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.slice().reverse().map(t => (
                <tr key={t.id} className={`hover:bg-slate-50/50 transition-colors group ${t.isVoid ? 'opacity-40 grayscale' : ''}`}>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors uppercase">{t.orderId}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-bold mt-1">
                        {new Date(t.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">{t.paymentMethod}</td>
                  <td className="px-6 py-4">
                    <span className={`font-mono font-black text-base ${t.isVoid ? 'line-through text-slate-300' : 'text-slate-800'}`}>
                      ${t.amountPaid.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {t.isVoid ? (
                      <span className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">VOIDED</span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">SETTLED</span>
                    )}
                  </td>
                  <td className="px-8 py-4 text-right">
                    {!t.isVoid && (
                      <button 
                        onClick={() => { setIsVoiding(t.id); setVoidReason(''); setVoidConfirmWord(''); }}
                        className="w-8 h-8 rounded-lg bg-slate-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                        title="Void Transaction"
                      >
                        <i className="fas fa-ban text-[10px]"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Confirmation Modal */}
      {isVoiding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-slideUp">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-2">Void Transaction</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">Type <span className="font-black text-rose-600">VOID</span> below to confirm this intentional deletion from the verified ledger.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Void Reason (Required)</label>
                <textarea 
                  autoFocus
                  className="w-full h-20 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-500 text-sm font-medium resize-none"
                  placeholder="Explain why this is being voided..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 block">Security Confirmation</label>
                <input 
                  type="text"
                  className="w-full px-5 py-3 bg-white border border-rose-200 rounded-xl outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 text-sm font-black tracking-widest text-center uppercase"
                  placeholder="Type 'VOID' here"
                  value={voidConfirmWord}
                  onChange={(e) => setVoidConfirmWord(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsVoiding(null)}
                className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500 uppercase tracking-widest text-[10px]"
              >
                Abort
              </button>
              <button 
                disabled={voidConfirmWord.toUpperCase() !== 'VOID' || !voidReason.trim()}
                onClick={() => handleVoid(isVoiding)}
                className={`flex-[2] py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${
                  voidConfirmWord.toUpperCase() === 'VOID' && voidReason.trim()
                    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xl shadow-rose-500/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
