
import React, { useState } from 'react';
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

  const handleBackup = async () => {
    setIsBackingUp(true);
    const log = await performCloudBackup(data);
    setLogs(prev => [log, ...prev]);
    setIsBackingUp(false);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Cloud Data Integrity</h2>
        <p className="text-slate-500 text-sm">Create and manage full system state snapshots.</p>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800">Trigger Cloud Snapshot</h3>
          <p className="text-xs text-slate-400">Backs up all branches, inventory, and transactions.</p>
        </div>
        <button 
          onClick={handleBackup}
          disabled={isBackingUp}
          className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50"
        >
          {isBackingUp ? 'Processing...' : 'Run Backup Now'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-bold">Date</th>
              <th className="px-6 py-4 font-bold">Size</th>
              <th className="px-6 py-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map(log => (
              <tr key={log.id}>
                <td className="px-6 py-4 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-6 py-4">{log.sizeKb} KB</td>
                <td className="px-6 py-4 font-bold text-emerald-600">{log.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Fix: Added missing default export
export default CloudBackup;
