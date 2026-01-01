
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { UserRole, Branch, InventoryItem, Job, Transaction, InventoryType, StockTransfer, AppNotification, TransferStatus, BackupLog, ManagerAccount, AuditEntry, Customer, CommunicationLog } from './types.ts';
import { HEAD_OFFICE_INFO, OWNER_ID, DEFAULT_MANAGER_PASSWORD, OWNER_PASSWORD } from './constants.ts';
import { logSecurityEvent, isSystemOwner } from './services/securityService.ts';

// Views
import Dashboard from './views/Dashboard.tsx';
import Inventory from './views/Inventory.tsx';
import JobCard from './views/JobCard.tsx';
import POS from './views/POS.tsx';
import BranchAdmin from './views/BranchAdmin.tsx';
import AISupport from './views/AISupport.tsx';
import StockTransferView from './views/StockTransfer.tsx';
import Reports from './views/Reports.tsx';
import CloudBackup from './views/CloudBackup.tsx';
import SecurityConsole from './views/SecurityConsole.tsx';
import AuditTrail from './views/AuditTrail.tsx';
import CRM from './views/CRM.tsx';

const useERPData = () => {
  const [branches, setBranches] = useState<Branch[]>(() => {
    const saved = localStorage.getItem('fuppas_branches');
    return saved ? JSON.parse(saved) : [
      { 
        id: 'br-1', 
        name: 'Main Branch (Head Office)', 
        address: HEAD_OFFICE_INFO.address, 
        branchNumber: 'FUP-001',
        branchEmail: HEAD_OFFICE_INFO.emails[0],
        managerId: 'mgr-1',
        managerName: 'Alpha Admin',
        managerAddress: HEAD_OFFICE_INFO.address,
        managerPhone: HEAD_OFFICE_INFO.phones[0],
        status: 'ACTIVE',
        establishedDate: Date.now()
      }
    ];
  });

  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('fuppas_inventory');
    return saved ? JSON.parse(saved) : [];
  });

  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('fuppas_jobs');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fuppas_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [transfers, setTransfers] = useState<StockTransfer[]>(() => {
    const saved = localStorage.getItem('fuppas_transfers');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('fuppas_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [backupLogs, setBackupLogs] = useState<BackupLog[]>(() => {
    const saved = localStorage.getItem('fuppas_backups');
    return saved ? JSON.parse(saved) : [];
  });

  const [managers, setManagers] = useState<ManagerAccount[]>(() => {
    const saved = localStorage.getItem('fuppas_managers');
    return saved ? JSON.parse(saved) : [
      { id: 'mgr-1', name: 'Admin Manager', branchId: 'br-1', isActive: true, password: DEFAULT_MANAGER_PASSWORD }
    ];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('fuppas_customers');
    return saved ? JSON.parse(saved) : [];
  });

  const [communications, setCommunications] = useState<CommunicationLog[]>(() => {
    const saved = localStorage.getItem('fuppas_communications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('fuppas_branches', JSON.stringify(branches));
    localStorage.setItem('fuppas_inventory', JSON.stringify(inventory));
    localStorage.setItem('fuppas_jobs', JSON.stringify(jobs));
    localStorage.setItem('fuppas_transactions', JSON.stringify(transactions));
    localStorage.setItem('fuppas_transfers', JSON.stringify(transfers));
    localStorage.setItem('fuppas_notifications', JSON.stringify(notifications));
    localStorage.setItem('fuppas_backups', JSON.stringify(backupLogs));
    localStorage.setItem('fuppas_managers', JSON.stringify(managers));
    localStorage.setItem('fuppas_customers', JSON.stringify(customers));
    localStorage.setItem('fuppas_communications', JSON.stringify(communications));
  }, [branches, inventory, jobs, transactions, transfers, notifications, backupLogs, managers, customers, communications]);

  const addNotification = (branchId: string | null, message: string, type: AppNotification['type'] = 'INFO') => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random()}`,
      branchId,
      message,
      type,
      isRead: false,
      timestamp: Date.now()
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markAllAsRead = (branchId: string | null, isSuperAdmin: boolean) => {
    setNotifications(prev => prev.map(n => {
      if (isSuperAdmin || n.branchId === branchId) {
        return { ...n, isRead: true };
      }
      return n;
    }));
  };

  const clearNotifications = (branchId: string | null, isSuperAdmin: boolean) => {
    setNotifications(prev => prev.filter(n => {
      if (isSuperAdmin) return false;
      return n.branchId !== branchId;
    }));
  };

  const restoreState = (snapshot: string) => {
    try {
      const data = JSON.parse(snapshot);
      if (data.branches) setBranches(data.branches);
      if (data.inventory) setInventory(data.inventory);
      if (data.jobs) setJobs(data.jobs);
      if (data.transactions) setTransactions(data.transactions);
      if (data.transfers) setTransfers(data.transfers);
      if (data.managers) setManagers(data.managers);
      if (data.customers) setCustomers(data.customers);
      if (data.communications) setCommunications(data.communications);
      logSecurityEvent(OWNER_ID, "Full System Restore Performed", "Backup", "N/A", "Restored Snapshot");
      return true;
    } catch (e) {
      console.error("Restore failed", e);
      return false;
    }
  };

  return { 
    branches, setBranches, inventory, setInventory, jobs, setJobs, 
    transactions, setTransactions, transfers, setTransfers,
    notifications, setNotifications, addNotification, markAllAsRead, clearNotifications,
    backupLogs, setBackupLogs, managers, setManagers, restoreState,
    customers, setCustomers, communications, setCommunications
  };
};

const Login: React.FC<{ 
  onLogin: (user: { id: string; role: UserRole; branchId: string | null }) => void, 
  managers: ManagerAccount[] 
}> = ({ onLogin, managers }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (userId === 'OWNER' && password === OWNER_PASSWORD) {
      onLogin({ id: OWNER_ID, role: UserRole.SUPER_ADMIN, branchId: null });
      return;
    }

    const mgr = managers.find(m => m.id === userId);
    if (mgr) {
      if (!mgr.isActive) {
        setError('Your account is locked. Contact Super Admin.');
        return;
      }
      if (mgr.password === password) {
        onLogin({ id: mgr.id, role: UserRole.BRANCH_MANAGER, branchId: mgr.branchId });
        return;
      }
    }

    setError('Invalid User ID or Password.');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[3rem] p-10 md:p-14 shadow-2xl animate-slideUp">
        <div className="text-center mb-10">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-[#eab308] rounded-2xl flex items-center justify-center text-black text-3xl font-black shadow-lg">
              FE
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Enterprise Portal</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-3">Identity Authenticator</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Enterprise User ID</label>
            <input 
              required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="e.g. OWNER or mgr-xxx"
              value={userId}
              onChange={e => setUserId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Security Credential</label>
            <input 
              required
              type="password"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl active:scale-95"
          >
            Authenticate
          </button>
        </form>

        <div className="mt-10 text-center border-t border-slate-50 pt-8">
          <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">
            Authorized Personnel Only. © FuPPAS Enterprise.
          </p>
          <p className="text-[10px] text-slate-900 font-black mt-3">
            developed by: Fulton S. Chenikan, 0778246111
          </p>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const data = useERPData();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<{ id: string; role: UserRole; branchId: string | null } | null>(() => {
    const saved = sessionStorage.getItem('fuppas_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('fuppas_session', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('fuppas_session');
    }
  }, [currentUser]);

  const activeBranchId = currentUser?.branchId || data.branches[0]?.id || '';

  const filtered = useMemo(() => ({
    inventory: currentUser?.role === UserRole.SUPER_ADMIN ? data.inventory : data.inventory.filter(i => i.branchId === currentUser?.branchId),
    jobs: currentUser?.role === UserRole.SUPER_ADMIN ? data.jobs : data.jobs.filter(j => j.branchId === currentUser?.branchId),
    transactions: currentUser?.role === UserRole.SUPER_ADMIN ? data.transactions : data.transactions.filter(t => t.branchId === currentUser?.branchId),
    transfers: currentUser?.role === UserRole.SUPER_ADMIN ? data.transfers : data.transfers.filter(t => t.originBranchId === currentUser?.branchId || t.destinationBranchId === currentUser?.branchId),
    notifications: data.notifications.filter(n => n.branchId === currentUser?.branchId || currentUser?.role === UserRole.SUPER_ADMIN),
    customers: currentUser?.role === UserRole.SUPER_ADMIN ? data.customers : data.customers.filter(c => c.branchId === currentUser?.branchId),
  }), [data, currentUser]);

  const unreadCount = filtered.notifications.filter(n => !n.isRead).length;

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const handleLogout = () => {
    if (confirm("Terminate security session? You will need to re-enter your password.")) {
      setCurrentUser(null);
    }
  };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} managers={data.managers} />;
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 font-sans relative overflow-x-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-40 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#eab308] rounded-lg flex items-center justify-center text-black text-[10px] font-black">
              FE
            </div>
            <span className="font-bold tracking-tight text-xs uppercase">FuPPAS Enterprise</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl active-tap border border-rose-500/20">
              <i className="fas fa-power-off"></i>
            </button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400">
              <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
            </button>
          </div>
        </header>

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col z-40 transform transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 hidden md:flex flex-col items-center border-b border-slate-800/50 mb-4">
             <div className="w-16 h-16 bg-[#eab308] rounded-2xl flex items-center justify-center text-black text-2xl font-black mb-3 shadow-lg">
              FE
            </div>
            <div className="mt-2 text-center">
              <h1 className="text-sm font-black tracking-tight leading-none uppercase text-white">FuPPAS Enterprise</h1>
              <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-[0.2em] font-black">Centralized Hub</p>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto" onClick={() => setIsSidebarOpen(false)}>
            <SidebarLink to="/" icon="fa-chart-line" label="Dashboard" />
            <SidebarLink to="/inventory" icon="fa-boxes-stacked" label="Inventory" />
            <SidebarLink to="/jobs" icon="fa-clipboard-list" label="Printing Jobs" />
            <SidebarLink to="/crm" icon="fa-users" label="CRM" />
            <SidebarLink to="/pos" icon="fa-cash-register" label="Point of Sale" />
            <SidebarLink to="/transfers" icon="fa-truck-arrow-right" label="Stock Transfer" />
            <SidebarLink to="/backup" icon="fa-cloud-arrow-up" label="Cloud Backup" />
            
            {isSystemOwner(currentUser.id) && (
              <>
                <div className="pt-4 pb-1">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-4">Administration</p>
                </div>
                <SidebarLink to="/reports" icon="fa-file-contract" label="Financial Reports" />
                <SidebarLink to="/security" icon="fa-shield-halved" label="Security Console" />
                <SidebarLink to="/audit" icon="fa-fingerprint" label="Audit Trail" />
                <SidebarLink to="/branches" icon="fa-network-wired" label="Branches" />
              </>
            )}

            <SidebarLink to="/ai-support" icon="fa-robot" label="AI Support" />
          </nav>

          <div className="p-4 border-t border-slate-800 space-y-4">
            <button 
              onClick={() => {
                setShowNotifications(true);
                data.markAllAsRead(currentUser.branchId, currentUser.role === UserRole.SUPER_ADMIN);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-800 relative group"
            >
              <div className="relative">
                <i className={`fas fa-bell w-5 text-center ${unreadCount > 0 ? 'animate-swing' : ''}`}></i>
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900"></span>}
              </div>
              <span className="font-medium">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-auto text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-black">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-2xl border border-white/5 relative group">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm shrink-0">
                {isSystemOwner(currentUser.id) ? '👑' : 'BM'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-black truncate">{isSystemOwner(currentUser.id) ? 'Owner' : 'Manager'}</p>
                <p className="text-[9px] text-slate-400 truncate uppercase font-bold tracking-widest">{currentUser.branchId ? data.branches.find(b => b.id === currentUser.branchId)?.name : 'Global'}</p>
              </div>
              <button onClick={handleLogout} className="text-rose-500 hover:text-rose-400 p-1 active-tap" title="Quick Exit">
                 <i className="fas fa-lock text-sm"></i>
              </button>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all bg-rose-600 text-white shadow-lg shadow-rose-900/40 hover:bg-rose-700 active-tap"
            >
              <i className="fas fa-sign-out-alt w-5 text-center"></i>
              <span className="font-black uppercase tracking-widest text-[10px]">End Security Session</span>
            </button>
          </div>
        </aside>

        {/* Notification Overlay */}
        {showNotifications && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
            <div className="relative w-full max-sm bg-white h-full shadow-2xl flex flex-col animate-slideInRight">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Notification Center</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time ERP Alerts</p>
                </div>
                <button onClick={() => setShowNotifications(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <i className="fas fa-times text-slate-400"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filtered.notifications.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 px-8 text-center">
                    <i className="fas fa-bell-slash text-5xl mb-4 opacity-20"></i>
                    <p className="text-sm font-bold uppercase tracking-widest">No Alerts</p>
                    <p className="text-xs mt-1">Your notification history is currently empty.</p>
                  </div>
                )}
                {filtered.notifications.map(notif => (
                  <div key={notif.id} className={`p-4 rounded-2xl border transition-all ${notif.isRead ? 'bg-white border-slate-100' : 'bg-blue-50/30 border-blue-100 shadow-sm'}`}>
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs ${
                        notif.type === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' :
                        notif.type === 'ERROR' ? 'bg-rose-100 text-rose-600' :
                        notif.type === 'WARNING' ? 'bg-amber-100 text-amber-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <i className={`fas ${
                          notif.type === 'SUCCESS' ? 'fa-check' :
                          notif.type === 'ERROR' ? 'fa-exclamation-triangle' :
                          notif.type === 'WARNING' ? 'fa-exclamation' :
                          'fa-info'
                        }`}></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{notif.message}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-2">{formatTime(notif.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filtered.notifications.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <button 
                    onClick={() => data.clearNotifications(currentUser.branchId, currentUser.role === UserRole.SUPER_ADMIN)}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Clear All Notifications
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className={`flex-1 md:ml-64 p-4 md:p-8 overflow-x-hidden transition-all ${showNotifications ? 'blur-sm pointer-events-none' : ''}`}>
          <Routes>
            <Route path="/" element={<Dashboard branches={data.branches} jobs={filtered.jobs} transactions={filtered.transactions} inventory={filtered.inventory} currentUser={currentUser} customers={filtered.customers} />} />
            <Route path="/inventory" element={<Inventory items={filtered.inventory} setInventory={data.setInventory} setTransactions={data.setTransactions} branches={data.branches} branchId={activeBranchId} currentUser={currentUser} />} />
            <Route path="/jobs" element={<JobCard jobs={filtered.jobs} setJobs={data.setJobs} inventory={data.inventory} setInventory={data.setInventory} transactions={data.transactions} setTransactions={data.setTransactions} branchId={activeBranchId} currentUser={currentUser} customers={filtered.customers} setCustomers={data.setCustomers} />} />
            <Route path="/crm" element={<CRM customers={filtered.customers} setCustomers={data.setCustomers} jobs={data.jobs} communications={data.communications} setCommunications={data.setCommunications} currentUser={currentUser} branchId={activeBranchId} />} />
            <Route path="/pos" element={<POS inventory={filtered.inventory} transactions={data.transactions} setTransactions={data.setTransactions} setInventory={data.setInventory} branchId={activeBranchId} currentUser={currentUser} />} />
            <Route path="/transfers" element={<StockTransferView transfers={filtered.transfers} setTransfers={data.setTransfers} branches={data.branches} inventory={data.inventory} setInventory={data.setInventory} currentUser={currentUser} activeBranchId={activeBranchId} addNotification={data.addNotification} />} />
            <Route path="/backup" element={<CloudBackup logs={data.backupLogs} data={data} setLogs={data.setBackupLogs} onRestore={data.restoreState} currentUser={currentUser} />} />
            <Route path="/ai-support" element={<AISupport inventory={filtered.inventory} jobs={filtered.jobs} transactions={filtered.transactions} customers={filtered.customers} />} />
            
            {isSystemOwner(currentUser.id) ? (
              <>
                <Route path="/reports" element={<Reports branches={data.branches} jobs={filtered.jobs} transactions={data.transactions} setTransactions={data.setTransactions} currentUser={currentUser} />} />
                <Route path="/security" element={<SecurityConsole managers={data.managers} setManagers={data.setManagers} branches={data.branches} />} />
                <Route path="/audit" element={<AuditTrail />} />
                <Route path="/branches" element={<BranchAdmin branches={data.branches} setBranches={data.setBranches} setInventory={data.setInventory} setJobs={data.setJobs} setTransactions={data.setTransactions} setCustomers={data.setCustomers} setManagers={data.setManagers} />} />
              </>
            ) : (
              <Route path="*" element={<Navigate to="/" replace />} />
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
};

const SidebarLink: React.FC<{ to: string; icon: string; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      <i className={`fas ${icon} w-5 text-center`}></i>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
};

export default App;
