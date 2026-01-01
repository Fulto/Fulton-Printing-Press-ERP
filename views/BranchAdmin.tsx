
import React, { useState } from 'react';
import { Branch, ManagerAccount, InventoryItem, Job, Transaction, Customer, UserRole } from '../types.ts';
import { MAX_BRANCHES, OWNER_ID, DEFAULT_MANAGER_PASSWORD } from '../constants.ts';
import { logSecurityEvent } from '../services/securityService.ts';

interface Props {
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  setManagers: React.Dispatch<React.SetStateAction<ManagerAccount[]>>;
}

const BranchAdmin: React.FC<Props> = ({ 
  branches, setBranches, setInventory, setJobs, 
  setTransactions, setCustomers, setManagers 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    branchCode: '', // User enters suffix only, e.g. SNK01
    branchEmail: '',
    managerName: '',
    managerAddress: '',
    managerPhone: ''
  });

  const handleDeleteBranch = (id: string) => {
    if (branches.length <= 1) {
      alert("System must have at least one active branch (Head Office).");
      return;
    }
    const branch = branches.find(b => b.id === id);
    if (confirm(`CRITICAL ACTION: Are you sure you want to decommission "${branch?.name}"? \n\nThis will orphan all branch-specific data and revoke the associated manager's access.`)) {
      setBranches(prev => prev.filter(b => b.id !== id));
      setManagers(prev => prev.filter(m => m.branchId !== id));
      logSecurityEvent(OWNER_ID, `Decommissioned Branch: ${branch?.name}`, 'Infrastructure', branch, null);
    }
  };

  const handleClearBranchData = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (confirm(`WIPE DATA: Are you sure you want to delete ALL inventory, jobs, transactions, and customers for "${branch?.name}"? \n\nThis cannot be undone.`)) {
      setInventory(prev => prev.filter(i => i.branchId !== branchId));
      setJobs(prev => prev.filter(j => j.branchId !== branchId));
      setTransactions(prev => prev.filter(t => t.branchId !== branchId));
      setCustomers(prev => prev.filter(c => c.branchId !== branchId));
      logSecurityEvent(OWNER_ID, `Wiped Branch Data: ${branch?.name}`, 'Data Management', 'Multiple Entries', 'Cleared');
      alert(`All data associated with ${branch?.name} has been purged.`);
    }
  };

  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedCode = formData.branchCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError("Branch identification code is required.");
      return;
    }
    
    const finalBranchNumber = `FUP-${normalizedCode}`;
    const isDuplicateCode = branches.some(b => b.branchNumber.toUpperCase() === finalBranchNumber);
    if (isDuplicateCode) {
      setError(`CRITICAL COLLISION: Branch identifier "${finalBranchNumber}" is already registered.`);
      return;
    }

    if (branches.length >= MAX_BRANCHES) {
      setError(`Enterprise scale limit reached. Maximum ${MAX_BRANCHES} branches allowed.`);
      return;
    }

    const branchId = `br-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const managerId = `mgr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newBranch: Branch = {
      id: branchId,
      name: formData.name,
      address: formData.address,
      branchNumber: finalBranchNumber,
      branchEmail: formData.branchEmail,
      managerId: managerId,
      managerName: formData.managerName,
      managerAddress: formData.managerAddress,
      managerPhone: formData.managerPhone,
      status: 'ACTIVE',
      establishedDate: Date.now()
    };

    const newManager: ManagerAccount = {
      id: managerId,
      name: formData.managerName,
      branchId: branchId,
      isActive: true,
      password: DEFAULT_MANAGER_PASSWORD
    };

    setBranches(prev => [...prev, newBranch]);
    setManagers(prev => [...prev, newManager]);
    logSecurityEvent(OWNER_ID, `Provisioned Branch & Manager: ${newBranch.name}`, 'Infrastructure', null, newBranch);
    
    setIsAdding(false);
    setFormData({
      name: '',
      address: '',
      branchCode: '',
      branchEmail: '',
      managerName: '',
      managerAddress: '',
      managerPhone: ''
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <i className="fas fa-network-wired text-blue-600"></i>
            Enterprise Network
          </h2>
          <p className="text-slate-500 text-sm font-medium">Global physical infrastructure management. ({branches.length}/{MAX_BRANCHES})</p>
        </div>
        <button 
          onClick={() => { setError(''); setIsAdding(true); }}
          className="bg-slate-900 hover:bg-black text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-xl shadow-slate-200 active:scale-95"
        >
          <i className="fas fa-plus"></i> New Branch Provisioning
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map(branch => (
          <div key={branch.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:border-blue-200 transition-all relative overflow-hidden flex flex-col">
            <div className="absolute top-6 right-6 flex gap-2">
              <button 
                onClick={() => handleClearBranchData(branch.id)}
                className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                title="Clear Branch Data"
              >
                <i className="fas fa-eraser text-xs"></i>
              </button>
              <button 
                onClick={() => handleDeleteBranch(branch.id)}
                className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                title="Decommission Branch"
              >
                <i className="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shadow-inner">
                <i className="fas fa-building text-2xl"></i>
              </div>
              <div className="overflow-hidden">
                <h3 className="font-black text-lg text-slate-800 leading-tight truncate">{branch.name}</h3>
                <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-lg font-black uppercase tracking-widest border border-slate-700">{branch.branchNumber}</span>
              </div>
            </div>

            <div className="space-y-5 text-sm flex-1">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <i className="fas fa-map-pin text-slate-300 text-xs"></i>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Physical Facility</p>
                  <p className="text-slate-600 leading-snug font-medium text-xs">{branch.address}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <i className="fas fa-user-tie text-slate-300 text-xs"></i>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Authorized Manager</p>
                  <p className="font-black text-slate-800 text-sm">{branch.managerName}</p>
                  <p className="text-[10px] text-blue-500 uppercase font-black tracking-tighter mt-1">{branch.managerPhone}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active</span>
              </div>
              <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">Internal ID: {branch.id.split('-')[2]}</span>
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 md:p-14 animate-slideUp relative max-h-[95vh] overflow-y-auto">
            <button 
              onClick={() => setIsAdding(false)} 
              className="absolute top-10 right-10 w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <i className="fas fa-times text-slate-400"></i>
            </button>

            <header className="mb-10">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-blue-500/20 mb-6">
                <i className="fas fa-plus"></i>
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Provision New Branch</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">Assign a unique identity to the new enterprise location.</p>
            </header>

            {error && (
              <div className="mb-8 p-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-3xl text-xs font-bold flex gap-4 animate-fadeIn">
                <i className="fas fa-shield-virus mt-0.5 text-lg"></i>
                <div>
                  <p className="uppercase tracking-widest text-[10px] mb-1">Authorization Rejected</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleAddBranch} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="col-span-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Facility Legal Name</label>
                  <input 
                    required 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="e.g. Mamba Point Stationery Hub"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div className="col-span-full md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Identity Code (Suffix)</label>
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm tracking-widest">FUP-</span>
                    <input 
                      required 
                      className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black tracking-widest focus:ring-4 focus:ring-blue-500/10 outline-none transition-all uppercase placeholder:normal-case placeholder:font-bold"
                      placeholder="e.g. SNK01"
                      value={formData.branchCode}
                      onChange={e => setFormData({...formData, branchCode: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-id-badge text-blue-500"></i>
                    Registry Entry: <span className="text-slate-800 font-black">FUP-{formData.branchCode || 'XXXX'}</span>
                  </p>
                </div>

                <div className="col-span-full md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Facility Email</label>
                  <input 
                    type="email"
                    required 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                    placeholder="hq@fuppas.tech"
                    value={formData.branchEmail}
                    onChange={e => setFormData({...formData, branchEmail: e.target.value})}
                  />
                </div>

                <div className="col-span-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Physical Street Address</label>
                  <textarea 
                    required 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all min-h-[100px] resize-none"
                    placeholder="Provide full location details..."
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="col-span-full pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <i className="fas fa-user-shield text-blue-600"></i>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Management Appointment</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Manager Full Name</label>
                      <input 
                        required 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        placeholder="e.g. Alpha Omega"
                        value={formData.managerName}
                        onChange={e => setFormData({...formData, managerName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Primary Contact Phone</label>
                      <input 
                        required 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        placeholder="077XXXXXXX"
                        value={formData.managerPhone}
                        onChange={e => setFormData({...formData, managerPhone: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-6 pt-10">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)} 
                  className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-2xl"
                >
                  Finalize Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchAdmin;
