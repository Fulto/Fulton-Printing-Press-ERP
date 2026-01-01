
import React, { useState } from 'react';
import { AuditEntry } from '../types.ts';

const AuditTrail: React.FC = () => {
  const [logs] = useState<AuditEntry[]>(() => {
    const saved = localStorage.getItem('fuppas_audit');
    return saved ? JSON.parse(saved) : [];
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderJson = (data: any) => {
    if (!data) return <span className="text-slate-300 italic text-[10px]">No Data Captured</span>;
    return (
      <pre className="text-[10px] font-mono leading-relaxed text-slate-600 bg-slate-50 p-4 rounded-xl overflow-x-auto border border-slate-100 max-h-48">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <i className="fas fa-fingerprint text-blue-600"></i>
            Security Audit Trail
          </h2>
          <p className="text-slate-500 text-sm font-medium">Chronological forensics of system modifications and administrative actions.</p>
        </div>
        <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center text-right">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Logs</span>
          <span className="text-sm font-black text-blue-600 font-mono">
            {logs.length} Records
          </span>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px] w-48">Timestamp</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Administrative Action</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px] w-32">Module</th>
                <th className="px-6 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px] w-32">Origin IP</th>
                <th className="px-8 py-6 font-black text-slate-400 uppercase tracking-widest text-[10px] text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map(log => (
                <React.Fragment key={log.id}>
                  <tr 
                    className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${expandedId === log.id ? 'bg-blue-50/30' : ''}`}
                    onClick={() => toggleExpand(log.id)}
                  >
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-black text-slate-500 font-mono uppercase tracking-tighter">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{log.action}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">UID: {log.userId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-mono text-xs text-slate-400">
                      {log.ipAddress}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 ${
                          expandedId === log.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                        }`}
                      >
                        <i className={`fas ${expandedId === log.id ? 'fa-eye-slash' : 'fa-eye'} text-[10px]`}></i>
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Detail View */}
                  {expandedId === log.id && (
                    <tr className="bg-slate-50/30">
                      <td colSpan={5} className="px-8 py-8 animate-slideDown">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Before Snapshot */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                              <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">State Pre-Modification</h4>
                            </div>
                            <div className="rounded-2xl border border-rose-100 overflow-hidden shadow-inner">
                              {renderJson(log.before)}
                            </div>
                          </div>

                          {/* After Snapshot */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">State Post-Modification</h4>
                            </div>
                            <div className="rounded-2xl border border-emerald-100 overflow-hidden shadow-inner">
                              {renderJson(log.after)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center">
                           <div className="flex items-center gap-2">
                             <i className="fas fa-shield-check text-blue-500 text-[10px]"></i>
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Immutable Integrity Record Hash Verified</span>
                           </div>
                           <span className="text-[9px] font-mono text-slate-300">LOG_ID: {log.id}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-32 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <i className="fas fa-shield-virus text-4xl opacity-10"></i>
                      </div>
                      <h4 className="text-lg font-black text-slate-400 uppercase tracking-tight">System Integrity Intact</h4>
                      <p className="text-sm mt-1 font-medium italic text-slate-400">No security events or administrative modifications recorded.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Informational Panel */}
      <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-blue-500/20">
             <i className="fas fa-shield-halved"></i>
           </div>
           <div>
             <h4 className="font-black uppercase tracking-tight text-lg">Immutable Ledger Technology</h4>
             <p className="text-slate-400 text-xs font-medium max-w-sm">Every mutation of branch state, inventory level, or transaction record is captured with full data snapshots for absolute accountability.</p>
           </div>
        </div>
        <div className="flex gap-4">
           <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 text-center">
              <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Retention Period</span>
              <span className="text-sm font-black text-white">500 Records</span>
           </div>
           <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 text-center">
              <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Audit Mode</span>
              <span className="text-sm font-black text-emerald-400">ACTIVE</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;
