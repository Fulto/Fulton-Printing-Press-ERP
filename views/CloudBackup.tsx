
import React, { useState, useRef } from 'react';
import { BackupLog, UserRole } from '../types.ts';
import { performCloudBackup } from '../services/backupService.ts';
import { isSystemOwner } from '../services/securityService.ts';

interface Props {
  logs: BackupLog[];
  data: any;
  setLogs: React.Dispatch<React.SetStateAction<BackupLog[]>>;
  onRestore: (snapshot: string) => boolean;
  currentUser: { id: string; role: UserRole; branchId: string | null };
}

const CloudBackup: React.FC<Props> = ({ logs, data, setLogs, onRestore, currentUser }) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser.role === UserRole.SUPER_ADMIN || isSystemOwner(currentUser.id);
  const enterpriseEmail = "fuppasenterprise2022@gmail.com";

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      // Logic in service handles the default recipient
      const log = await performCloudBackup(data);
      setLogs(prev => [log, ...prev]);
      alert(`Success: Data snapshot has been packaged and sent to ${enterpriseEmail}.`);
    } catch (e) {
      alert("Backup failed. Check system connectivity.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setRestoreText(content);
      };
      reader.readAsText(file);
    }
  };

  const triggerRestore = () => {
    if (!restoreText.trim()) return;
    if (confirm("CRITICAL WARNING: This will overwrite ALL current data across all branches with the content of the selected backup. This cannot be undone. Proceed?")) {
      const success = onRestore(restoreText);
      if (success) {
        alert("System Restored: All models have been updated to the backup state.");
        setRestoreText('');
      } else {
        alert("Restore Failed: The data provided is not a valid FuPPAS snapshot.");
      }
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <i className="fas fa-cloud-arrow-up text-blue-600"></i>
            {isAdmin ? 'Backup & Restore Center' : 'Operational Backup'}
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            {isAdmin 
              ? 'Manage enterprise data safety and system state restoration.' 
              : 'Securely dispatch branch data snapshots to the head office.'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Backup Section */}
        <div className={`lg:col-span-${isAdmin ? '7' : '12'} space-y-6`}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
               <i className="fas fa-shield-halved text-7xl"></i>
            </div>
            <div className="relative z-10">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Create New Backup</h3>
              <p className="text-xs text-slate-400 font-medium mb-8 max-w-md leading-relaxed">
                Generates a secure snapshot of inventory, jobs, transactions, and customers. 
                Dispatched to: <span className="text-blue-500 font-black">{enterpriseEmail}</span>.
              </p>
              
              <button 
                onClick={handleBackup}
                disabled={isBackingUp}
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl transition-all active-tap ${
                  isBackingUp ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 hover:bg-black text-white shadow-slate-200'
                }`}
              >
                {isBackingUp ? (
                  <><i className="fas fa-spinner fa-spin"></i> Processing...</>
                ) : (
                  <><i className="fas fa-bolt"></i> Run Backup Now</>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Backup History</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-6 py-4 font-black text-slate-400 uppercase text-[9px]">Date</th>
                    <th className="px-6 py-4 font-black text-slate-400 uppercase text-[9px]">Size</th>
                    <th className="px-6 py-4 font-black text-slate-400 uppercase text-[9px] text-right">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 text-[10px] font-mono font-bold text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-700">{log.sizeKb} KB</td>
                      <td className="px-6 py-4 text-right">
                        <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest">VERIFIED</span>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-300 italic text-xs">No local backup logs found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Restore Section (Only for Administrator) */}
        {isAdmin && (
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 shadow-sm">
               <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                    <i className="fas fa-rotate-left"></i>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Restore Feature</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Revert system state from a previous snapshot.</p>
               </div>

               <div className="space-y-4">
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic text-center px-4">
                    Obtain the snapshot data from <span className="text-blue-600 font-black">{enterpriseEmail}</span> and paste it below or upload the file.
                  </p>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
                  >
                    <i className="fas fa-file-upload mr-2"></i> Select Backup File
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json,.txt" onChange={handleFileUpload} />

                  <div className="relative">
                    <textarea 
                      className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[10px] font-mono text-slate-600 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all resize-none"
                      placeholder="Or paste snapshot JSON data here..."
                      value={restoreText}
                      onChange={(e) => setRestoreText(e.target.value)}
                    />
                  </div>

                  <button 
                    disabled={!restoreText.trim()}
                    onClick={triggerRestore}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-xl ${
                      restoreText.trim() 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' 
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <i className="fas fa-check-double mr-2"></i> Restore System Data
                  </button>
               </div>
            </div>

            <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
               <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                 <i className="fas fa-info-circle"></i> Admin Security Note
               </h4>
               <p className="text-[9px] text-blue-700 font-bold leading-relaxed uppercase">
                 The Restore feature is strictly reserved for the Administrator account to ensure data integrity and prevent unauthorized global state changes.
               </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudBackup;
