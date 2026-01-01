
import React from 'react';
import { Branch, Job, Transaction, InventoryItem, UserRole, Customer } from '../types.ts';
import { isSystemOwner } from '../services/securityService.ts';

interface Props {
  branches: Branch[];
  jobs: Job[];
  transactions: Transaction[];
  inventory: InventoryItem[];
  currentUser: { id: string; role: UserRole; branchId: string | null };
  customers: Customer[];
}

const Dashboard: React.FC<Props> = ({ branches, jobs, transactions, inventory, currentUser, customers }) => {
  const isOwner = isSystemOwner(currentUser.id);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Executive Dashboard</h2>
        <p className="text-slate-500 text-sm">Overview of FuPPAS Enterprise operations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Jobs</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{jobs.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Revenue (Jobs)</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">
            ${jobs.reduce((sum, j) => sum + j.pricing.total, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Customers</p>
          <p className="text-3xl font-black text-purple-600 mt-1">{customers.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Inventory</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{inventory.length}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
