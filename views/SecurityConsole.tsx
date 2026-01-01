
import React, { useState } from 'react';
import { ManagerAccount, Branch } from '../types.ts';
import { logSecurityEvent } from '../services/securityService.ts';
import { OWNER_ID, DEFAULT_MANAGER_PASSWORD } from '../constants.ts';

interface Props {
  managers: ManagerAccount[];
  setManagers: React.Dispatch<React.SetStateAction<ManagerAccount[]>>;
  branches: Branch[];
}

const SecurityConsole: React.FC<Props> = ({ managers, setManagers, branches }) => {
  const handleResetPassword = (id: string) => {
    const manager = managers.find(m => m.id === id);
    if (!manager) return;

    const confirmed = window.confirm(
      `SECURITY OVERRIDE: Reset password for ${manager.name} to default ("${DEFAULT_MANAGER_PASSWORD}")? \n\nThe account will be LOCKED until you manually unlock it below.`
    );

    if (confirmed) {
      setManagers(prev => prev.map(m => 
        m.id === id ? { ...m, password: DEFAULT_MANAGER_PASSWORD, isActive: false } : m
      ));

      logSecurityEvent(
        OWNER_ID,
        `Credential Reset: ${manager.name} (${id})`,
        'Security',
        'Current Credentials',
        { isActive: false, password: DEFAULT_MANAGER_PASSWORD }
      );

      alert(`Password for ${manager.name} has been reset and account is locked.`);
    }
  };

  const toggleAccountStatus = (id: string) => {
    const manager = managers.find(m => m.id === id);
    if (!manager) return;

    setManagers(prev => prev.map(m => 
      m.id === id ? { ...m, isActive: !m.isActive } : m
    ));

    logSecurityEvent(
      OWNER_ID,
      `${manager.isActive ? 'Locked' : 'Unlocked'} Account: ${manager.name}`,
      'Access Control',
      { isActive: manager.isActive },
      { isActive: !manager.isActive }
    );
  };

  const handleDeleteManager = (id: string) => {
    const manager = managers.find(m => m.id === id);
    if (!manager) return;

    if (confirm(`PURGE USER: Are you sure you want to delete manager "${manager.name}"? \n\nThis will permanently revoke their access. You should decommission their branch if no longer needed.`)) {
      setManagers(prev => prev.filter(m => m.id !== id));
      logSecurityEvent(OWNER_ID, `Deleted Manager: ${manager.name}`, 'Security', manager, null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Security & Access Control</h2>
          <p className="text-slate-500 text-sm font-medium">Manage manager credentials and system-wide security settings.</p>
        </div>
        <div className="flex items-center gap-2 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
          <i className="fas fa-shield-halved text-rose-500"></i>
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">High Security Zone</span>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30">
          <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Authorized Personnel</h3>
          <p className="text-xs text-slate-400 font-medium mt-1">Direct management of branch administrative credentials.</p>
        </div>
        <div className="p-4 md:p-8 space-y-4">
          {managers.map(mgr => (
            <div key={mgr.id} className="flex flex-col md:flex-row items-center justify-between p-6 bg-white border border-slate-100 rounded-[2rem] hover:shadow-md transition-all group">
              <div className="flex items-center gap-4 mb-4 md:mb-0 w-full md:w-auto">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center font-black text-xl group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                  {mgr.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-800 text-lg leading-tight">{mgr.name}</p>
                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                      mgr.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {mgr.isActive ? 'Active' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    ID: <span className="text-slate-900 font-mono">{mgr.id}</span>
                  </p>
                  <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest mt-0.5">
                    {branches.find(b => b.id === mgr.branchId)?.name || 'Orphaned Account'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={() => handleResetPassword(mgr.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all active-tap"
                  title="Reset to Default"
                >
                  <i className="fas fa-key"></i>
                  <span>Reset Password</span>
                </button>
                
                <button 
                  onClick={() => toggleAccountStatus(mgr.id)}
                  className={`flex-1 md:flex-none px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active-tap ${
                    mgr.isActive 
                      ? 'bg-white text-rose-500 border-rose-100 hover:bg-rose-50' 
                      : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100'
                  }`}
                >
                  {mgr.isActive ? 'Lock Account' : 'Unlock Account'}
                </button>

                <button 
                  onClick={() => handleDeleteManager(mgr.id)}
                  className="w-10 h-10 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active-tap"
                  title="Purge Manager"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>
          ))}

          {managers.length === 0 && (
            <div className="py-20 text-center text-slate-300">
              <i className="fas fa-users-slash text-5xl mb-4 opacity-20"></i>
              <p className="text-sm font-black uppercase tracking-widest">No managers provisioned</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        <div className="bg-slate-900 rounded-[2rem] p-8 text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <i className="fas fa-fingerprint text-blue-400"></i>
            </div>
            <div>
              <h4 className="font-black uppercase tracking-tight">Enterprise Security</h4>
              <p className="text-slate-400 text-xs font-medium">Head office policy enforcement</p>
            </div>
          </div>
          <ul className="space-y-4">
            <li className="flex items-start gap-3 text-sm font-medium text-slate-300">
              <i className="fas fa-check-circle text-emerald-500 mt-1"></i>
              <span>All administrative actions require Super Admin authentication.</span>
            </li>
            <li className="flex items-start gap-3 text-sm font-medium text-slate-300">
              <i className="fas fa-check-circle text-emerald-500 mt-1"></i>
              <span>Default manager credentials: <span className="text-white font-black underline">{DEFAULT_MANAGER_PASSWORD}</span></span>
            </li>
            <li className="flex items-start gap-3 text-sm font-medium text-slate-300">
              <i className="fas fa-check-circle text-emerald-500 mt-1"></i>
              <span>Branch managers can only access their assigned data nodes.</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-500">
            <i className="fas fa-user-lock text-2xl"></i>
          </div>
          <h4 className="font-black text-slate-800 uppercase tracking-tight">Identity Enforcement</h4>
          <p className="text-slate-500 text-xs font-medium mt-2 max-w-xs">
            Admin accounts can decommission branches and purge manager access instantly in case of security compromise.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecurityConsole;
