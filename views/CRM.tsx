
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Customer, CommunicationLog, Job, UserRole } from '../types.ts';
import { logSecurityEvent } from '../services/securityService.ts';

interface Props {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  jobs: Job[];
  communications: CommunicationLog[];
  setCommunications: React.Dispatch<React.SetStateAction<CommunicationLog[]>>;
  currentUser: { id: string; role: UserRole; branchId: string | null };
  branchId: string;
}

const CRM: React.FC<Props> = ({ customers, setCustomers, jobs, communications, setCommunications, currentUser, branchId }) => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newLog, setNewLog] = useState({ type: 'PHONE', notes: '' });

  // Handle cross-navigation from other modules
  useEffect(() => {
    if (location.state?.selectedCustomerId) {
      const cust = customers.find(c => c.id === location.state.selectedCustomerId);
      if (cust) setSelectedCustomer(cust);
    }
  }, [location.state, customers]);

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.email && c.email.toLowerCase().includes(q)) || 
      (c.phone && c.phone.includes(q))
    );
  }, [customers, searchTerm]);

  const customerJobs = useMemo(() => {
    if (!selectedCustomer) return [];
    return jobs.filter(j => j.customerId === selectedCustomer.id);
  }, [jobs, selectedCustomer]);

  const customerLogs = useMemo(() => {
    if (!selectedCustomer) return [];
    return communications.filter(l => l.customerId === selectedCustomer.id).sort((a,b) => b.timestamp - a.timestamp);
  }, [communications, selectedCustomer]);

  const addCommunicationLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !newLog.notes) return;

    const log: CommunicationLog = {
      id: `log-${Date.now()}`,
      customerId: selectedCustomer.id,
      timestamp: Date.now(),
      type: newLog.type as any,
      notes: newLog.notes,
      userId: currentUser.id
    };

    setCommunications(prev => [log, ...prev]);
    setNewLog({ type: 'PHONE', notes: '' });
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);

    const customer: Customer = {
      id: `cust-${Date.now()}`,
      name: data.get('name') as string,
      email: data.get('email') as string || undefined,
      phone: data.get('phone') as string || undefined,
      address: data.get('address') as string || undefined,
      branchId,
      createdAt: Date.now()
    };

    setCustomers(prev => [customer, ...prev]);
    setIsAddingCustomer(false);
    logSecurityEvent(currentUser.id, `Created Customer: ${customer.name}`, 'CRM', null, customer);
  };

  const handleUpdateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);

    const updatedCustomer: Customer = {
      ...selectedCustomer,
      name: data.get('name') as string,
      email: data.get('email') as string || undefined,
      phone: data.get('phone') as string || undefined,
      address: data.get('address') as string || undefined,
    };

    setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? updatedCustomer : c));
    setSelectedCustomer(updatedCustomer);
    setIsEditing(false);
    logSecurityEvent(currentUser.id, `Updated Customer Data: ${updatedCustomer.name}`, 'CRM', selectedCustomer, updatedCustomer);
  };

  const handleCSVExport = () => {
    if (filteredCustomers.length === 0) {
      alert("No customer records found for export.");
      return;
    }

    const headers = ['Client Name', 'Phone Number', 'Email Address', 'Physical Address', 'Enrollment Date'];
    const rows = filteredCustomers.map(c => [
      c.name,
      c.phone || 'N/A',
      c.email || 'N/A',
      (c.address || 'N/A').replace(/\n/g, ' '),
      new Date(c.createdAt).toLocaleDateString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fuppas_crm_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logSecurityEvent(currentUser.id, "CRM CSV Export", "CRM", null, { count: filteredCustomers.length });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <i className="fas fa-users-gear text-blue-600"></i>
            Client Relationship Core
          </h2>
          <p className="text-slate-500 text-sm font-medium">Capture contact intelligence and historical engagement data.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleCSVExport}
            className="bg-white border border-slate-200 text-slate-600 px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all active-tap shadow-sm"
          >
            <i className="fas fa-file-csv"></i> Export Registry
          </button>
          <button 
            onClick={() => setIsAddingCustomer(true)}
            className="bg-slate-900 hover:bg-black text-white flex-1 md:flex-none px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-xl shadow-slate-200 active-tap"
          >
            <i className="fas fa-user-plus"></i> Enroll New Client
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mx-2">
        {/* Customer Sidebar */}
        <div className="lg:col-span-4 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden h-[700px]">
          <div className="p-6 border-b border-slate-50 bg-slate-50/30">
            <div className="relative group">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
              <input 
                type="text" 
                placeholder="Find client by name or phone..." 
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filteredCustomers.map(c => (
              <button 
                key={c.id} 
                onClick={() => { setSelectedCustomer(c); setIsEditing(false); }}
                className={`w-full p-6 text-left hover:bg-slate-50 transition-all flex flex-col relative group ${selectedCustomer?.id === c.id ? 'bg-blue-50/50' : ''}`}
              >
                {selectedCustomer?.id === c.id && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600"></div>}
                <span className="font-black text-slate-800 truncate group-hover:text-blue-600 transition-colors">{c.name}</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${c.phone ? 'text-blue-500' : 'text-slate-300 italic'}`}>
                    <i className="fas fa-phone-alt text-[9px]"></i> {c.phone || 'No Contact Number'}
                  </span>
                </div>
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center opacity-20">
                <i className="fas fa-user-slash text-4xl mb-2"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">No Clients Registered</p>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Relationship View */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCustomer ? (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 md:p-10 animate-fadeIn relative overflow-hidden h-[700px] overflow-y-auto">
                {isEditing ? (
                  <form onSubmit={handleUpdateCustomer} className="space-y-8 animate-fadeIn">
                    <div className="flex justify-between items-center mb-8">
                       <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Modify Client Data</h3>
                       <button type="button" onClick={() => setIsEditing(false)} className="px-5 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-500">Cancel</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="col-span-full">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Client Full Legal Name</label>
                        <input name="name" defaultValue={selectedCustomer.name} required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-base font-black outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Enterprise Phone Link</label>
                        <input name="phone" type="tel" defaultValue={selectedCustomer.phone} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-base font-black outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Enterprise Email Index</label>
                        <input name="email" type="email" defaultValue={selectedCustomer.email} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-base font-black outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"/>
                      </div>
                      <div className="col-span-full">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Physical Operational Address</label>
                        <textarea name="address" defaultValue={selectedCustomer.address} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-medium min-h-[100px] outline-none resize-none focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"></textarea>
                      </div>
                    </div>
                    <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active-tap">Commit Information Update</button>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[2rem] bg-slate-900 flex items-center justify-center text-3xl text-white font-black shadow-2xl">
                          {selectedCustomer.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">{selectedCustomer.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-100 px-3 py-1 rounded-full border border-slate-200">ID: {selectedCustomer.id.split('-')[1]}</span>
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Verified Client</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setIsEditing(true)} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all active-tap shadow-sm border border-slate-100">
                          <i className="fas fa-user-pen text-sm"></i>
                        </button>
                        <button onClick={() => setSelectedCustomer(null)} className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active-tap shadow-sm border border-rose-100">
                          <i className="fas fa-times text-sm"></i>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                      <div className="bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 shadow-inner group/card">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <i className="fas fa-address-book text-blue-500"></i> Primary Contact
                        </p>
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 group-hover/card:translate-x-1 transition-transform">
                            <div className="w-10 h-10 rounded-xl bg-white text-blue-500 flex items-center justify-center shadow-sm"><i className="fas fa-phone-alt"></i></div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Phone Number</p>
                              <p className="text-sm font-black text-slate-800 tracking-tight truncate">{selectedCustomer.phone || 'Not Provisioned'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 group-hover/card:translate-x-1 transition-transform">
                            <div className="w-10 h-10 rounded-xl bg-white text-emerald-500 flex items-center justify-center shadow-sm"><i className="fas fa-envelope"></i></div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Email Index</p>
                              <p className="text-sm font-black text-slate-800 tracking-tight truncate">{selectedCustomer.email || 'Not Provisioned'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100 shadow-inner col-span-1 lg:col-span-2">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Fiscal Engagement Metrics</p>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{customerJobs.length}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Life Projects</p>
                            <div className="mt-4 w-full h-1.5 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 w-2/3"></div></div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-600 font-mono tracking-tighter leading-none">
                              ${customerJobs.reduce((s, j) => s + j.pricing.total, 0).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Gross Revenue Yield</p>
                            <p className="text-[9px] text-emerald-500 font-bold uppercase mt-1 italic">Client Grade: Enterprise</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                          <i className="fas fa-receipt text-blue-500"></i> Active Production Registry
                        </h4>
                        <div className="space-y-3">
                          {customerJobs.length > 0 ? customerJobs.map(j => (
                            <div key={j.id} className="flex justify-between items-center p-5 bg-white border border-slate-100 rounded-3xl hover:border-blue-300 transition-all shadow-sm group">
                              <div>
                                <p className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition-colors">{j.serviceType}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{new Date(j.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-black text-slate-800 text-sm block">${j.pricing.total.toFixed(2)}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${j.status === 'Completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>{j.status}</span>
                              </div>
                            </div>
                          )) : (
                            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-[2rem] opacity-30">
                              <i className="fas fa-folder-open text-3xl mb-2"></i>
                              <p className="text-[10px] font-black uppercase">No active projects</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                          <i className="fas fa-comments-dollar text-emerald-500"></i> Communication Chronicle
                        </h4>
                        
                        <form onSubmit={addCommunicationLog} className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                          <div className="flex gap-2">
                            <select 
                              className="px-3 py-3 bg-white border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                              value={newLog.type}
                              onChange={e => setNewLog({...newLog, type: e.target.value})}
                            >
                              <option value="PHONE">Phone Call</option>
                              <option value="EMAIL">Email Sent</option>
                              <option value="IN_PERSON">In-Office</option>
                            </select>
                            <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active-tap transition-all">Add Interaction Entry</button>
                          </div>
                          <textarea 
                            placeholder="Detail interaction notes (e.g., pricing discussed, callback requested)..." 
                            className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-emerald-500/5 resize-none h-24"
                            value={newLog.notes}
                            onChange={e => setNewLog({...newLog, notes: e.target.value})}
                          />
                        </form>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-3 scrollbar-hide">
                          {customerLogs.map(l => (
                            <div key={l.id} className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm relative group/log">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-[9px] px-3 py-1 bg-slate-100 text-slate-500 rounded-full font-black uppercase tracking-widest border border-slate-200">{l.type}</span>
                                <span className="text-[8px] text-slate-400 font-mono font-bold uppercase">{new Date(l.timestamp).toLocaleString()}</span>
                              </div>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{l.notes}"</p>
                              <p className="text-[8px] text-slate-300 font-black uppercase mt-3 tracking-[0.2em]">Agent ID: {l.userId}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
            </div>
          ) : (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-slate-300 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 p-10 text-center animate-pulse">
              <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner">
                <i className="fas fa-id-card-clip text-5xl opacity-20"></i>
              </div>
              <h4 className="text-xl font-black text-slate-400 uppercase tracking-widest">Awaiting Identity Selection</h4>
              <p className="text-sm mt-2 font-medium italic max-w-xs">Access deep-module contact intelligence and transaction auditing by selecting a client from the registry.</p>
            </div>
          )}
        </div>
      </div>

      {isAddingCustomer && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 md:p-14 animate-slideUp relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsAddingCustomer(false)} className="absolute top-10 right-10 w-12 h-12 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
              <i className="fas fa-times text-slate-400"></i>
            </button>
            <div className="mb-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Corporate Enrollment</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Registering a new client into the centralized CRM engine.</p>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Client Full Legal Name</label>
                <input name="name" required className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-base font-black outline-none focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all" placeholder="e.g. Acme Printing Services Ltd."/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Enterprise Phone Link</label>
                  <input name="phone" type="tel" placeholder="+231-XX-XXX-XXX" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-base font-black outline-none focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all"/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Enterprise Email Index</label>
                  <input name="email" type="email" placeholder="client@domain.com" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-base font-black outline-none focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all"/>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Physical Operational Address</label>
                <textarea name="address" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-medium min-h-[120px] outline-none resize-none focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all" placeholder="Complete office or residence address..."></textarea>
              </div>
              <div className="flex gap-6 pt-6">
                <button type="button" onClick={() => setIsAddingCustomer(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest text-[10px] active-tap">Abort Onboarding</button>
                <button type="submit" className="flex-[2] py-5 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl transition-all active-tap">Authorize Enrollment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRM;
