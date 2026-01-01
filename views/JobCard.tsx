
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, JobStatus, ServiceType, InventoryItem, UserRole, PaymentStatus, Transaction, PaymentMethod, Customer } from '../types.ts';
import { logSecurityEvent } from '../services/securityService.ts';
import { HEAD_OFFICE_INFO } from '../constants.ts';

interface Props {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  branchId: string;
  currentUser: { id: string; role: UserRole; branchId: string | null };
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const JobCard: React.FC<Props> = ({ jobs, setJobs, inventory, setInventory, transactions, setTransactions, branchId, currentUser, customers, setCustomers }) => {
  const navigate = useNavigate();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Payment recording state for existing jobs
  const [paymentModalJob, setPaymentModalJob] = useState<Job | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [recordPaymentMethod, setRecordPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  
  const [newJob, setNewJob] = useState({
    customerId: '', 
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    serviceType: ServiceType.PRINT,
    paymentStatus: PaymentStatus.UNPAID,
    quantity: '1',
    unitPrice: '1.00',
    total: '1.00',
    amountPaid: '0',
    size: 'A4',
    materialCost: '0',
    laborCost: '0',
    overhead: '0'
  });

  const filteredJobs = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return jobs.filter(j => 
      j.customerName.toLowerCase().includes(q) || 
      (j.customerPhone && j.customerPhone.includes(q)) ||
      j.serviceType.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q)
    );
  }, [jobs, searchTerm]);

  useEffect(() => {
    const q = parseFloat(newJob.quantity) || 0;
    const p = parseFloat(newJob.unitPrice) || 0;
    const calculatedTotal = (q * p).toFixed(2);
    setNewJob(prev => {
      let finalPaid = prev.amountPaid;
      if (prev.paymentStatus === PaymentStatus.PAID) {
        finalPaid = calculatedTotal;
      } else if (prev.paymentStatus === PaymentStatus.UNPAID) {
        finalPaid = '0';
      }
      return { ...prev, total: calculatedTotal, amountPaid: finalPaid };
    });
  }, [newJob.quantity, newJob.unitPrice, newJob.paymentStatus]);

  const toggleExpand = (id: string) => {
    setExpandedJobId(prev => prev === id ? null : id);
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    if (cid === 'NEW') {
      setNewJob(prev => ({ ...prev, customerId: '', customerName: '', customerEmail: '', customerPhone: '' }));
      return;
    }
    const cust = customers.find(c => c.id === cid);
    if (cust) {
      setNewJob(prev => ({ 
        ...prev, 
        customerId: cust.id, 
        customerName: cust.name, 
        customerEmail: cust.email || '', 
        customerPhone: cust.phone || '' 
      }));
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalJob) return;
    const amount = parseFloat(paymentAmount) || 0;
    const balance = paymentModalJob.pricing.total - paymentModalJob.amountPaid;
    
    if (amount <= 0 || amount > balance + 0.01) return alert("Invalid deduction amount.");

    const now = Date.now();
    const updatedAmountPaid = paymentModalJob.amountPaid + amount;
    const isFullyPaid = updatedAmountPaid >= paymentModalJob.pricing.total - 0.01;

    setJobs(prev => prev.map(j => j.id === paymentModalJob.id ? { 
      ...j, 
      amountPaid: updatedAmountPaid,
      paymentStatus: isFullyPaid ? PaymentStatus.PAID : (updatedAmountPaid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID)
    } : j));

    setTransactions(prev => [...prev, {
      id: `trx-${now}-jpay`, branchId: paymentModalJob.branchId, orderId: paymentModalJob.id, amountPaid: amount, paymentMethod: recordPaymentMethod, timestamp: now, type: 'JOB'
    }]);
    
    setPaymentModalJob(null);
    setPaymentAmount('');
  };

  const exportJobLedgerPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>FE Production Ledger - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #1e293b; line-height: 1.4; font-size: 12px; }
            .header { border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .logo-fe { background: #eab308; color: black; padding: 5px 12px; border-radius: 6px; font-weight: 900; font-size: 18px; margin-right: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; text-align: left; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; color: #64748b; }
            td { padding: 10px; border: 1px solid #e2e8f0; vertical-align: top; }
            .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 900; text-transform: uppercase; border: 1px solid transparent; }
            .status-completed { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
            .status-pending { background: #fef9c3; color: #854d0e; border-color: #fef08a; }
            .summary-bar { margin-top: 30px; display: flex; gap: 20px; background: #0f172a; color: white; padding: 20px; border-radius: 15px; }
            .summary-item { flex: 1; }
            .summary-label { font-size: 8px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
            .summary-value { font-size: 16px; font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="header">
            <div><span class="logo-fe">FE</span> <b style="font-size: 16px;">FuPPAS ENTERPRISE</b></div>
            <div style="text-align: right;"><b style="font-size: 14px; text-transform: uppercase;">Production Manifest</b><br><small>${new Date().toLocaleString()}</small></div>
          </div>
          
          <p>Active registry report for branch: <b>${branchId}</b></p>
          
          <table>
            <thead>
              <tr>
                <th>Job Reference</th>
                <th>Client Details</th>
                <th>Production Type</th>
                <th>Specs</th>
                <th>Status</th>
                <th>Valuation</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${filteredJobs.map(j => `
                <tr>
                  <td style="font-family: monospace; font-weight: bold;">${j.id.split('-')[1]}</td>
                  <td><b>${j.customerName}</b><br><small>${j.customerPhone || 'No Phone'}</small></td>
                  <td>${j.serviceType}</td>
                  <td>${j.specs.quantity}x ${j.specs.size}</td>
                  <td><span class="status-badge ${j.status === 'Completed' ? 'status-completed' : 'status-pending'}">${j.status}</span></td>
                  <td><b>$${j.pricing.total.toFixed(2)}</b></td>
                  <td style="color: ${j.pricing.total - j.amountPaid > 0 ? '#e11d48' : '#059669'}; font-weight: 900;">$${(j.pricing.total - j.amountPaid).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary-bar">
            <div class="summary-item">
              <div class="summary-label">Total Jobs Logged</div>
              <div class="summary-value">${filteredJobs.length}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Aggregate Valuation</div>
              <div class="summary-value">$${filteredJobs.reduce((s, j) => s + j.pricing.total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Outstanding Debt</div>
              <div class="summary-value" style="color: #fb7185;">$${filteredJobs.reduce((s, j) => s + (j.pricing.total - j.amountPaid), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          
          <div style="margin-top: 40px; font-size: 9px; color: #94a3b8; text-align: center;">
            This document is a system-generated production audit of FuPPAS Enterprise ERP. Page 1/1
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const exportInvoicePDF = (job: Job) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>FE Invoice - ${job.id}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
            .logo-fe { background: #eab308; color: black; padding: 8px 15px; border-radius: 8px; font-weight: 900; font-size: 24px; }
            .badge { padding: 6px 12px; border-radius: 99px; font-size: 11px; font-weight: 900; text-transform: uppercase; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
            .badge.paid { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            th { padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
            td { padding: 15px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .totals-row td { border-bottom: none; padding: 5px 12px; text-align: right; }
            .grand-total { font-size: 18px; font-weight: 900; color: #0f172a; border-top: 2px solid #0f172a !important; padding-top: 15px !important; }
            .footer { margin-top: 60px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 30px; }
            .thank-you { font-weight: 900; font-size: 18px; color: #0f172a; text-transform: uppercase; margin-bottom: 10px; }
            .contact-box { margin-bottom: 30px; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="font-weight: 900;"><span class="logo-fe">FE</span> FuPPAS ENTERPRISE</div>
            <div style="text-align: right;"><b style="font-size: 20px;">TAX INVOICE</b><br><small style="color:#64748b">Ref: #${job.id.toUpperCase()}</small></div>
          </div>
          <div class="contact-box">
            <div style="display:flex; justify-content: space-between;">
              <div>
                <b style="text-transform: uppercase; font-size: 11px; color: #94a3b8; letter-spacing: 0.1em;">Bill To:</b><br>
                <b style="font-size: 16px;">${job.customerName}</b><br>
                <b style="color: #3b82f6;">${job.customerPhone ? `Phone: ${job.customerPhone}` : 'No Phone Provided'}</b><br>
                ${job.customerEmail ? `Email: ${job.customerEmail}` : ''}
              </div>
              <div style="text-align: right;">
                <b style="text-transform: uppercase; font-size: 11px; color: #94a3b8; letter-spacing: 0.1em;">Status:</b><br>
                <span class="badge ${job.paymentStatus === PaymentStatus.PAID ? 'paid' : ''}">${job.paymentStatus}</span><br>
                <small style="color:#94a3b8">Date: ${new Date(job.createdAt).toLocaleDateString()}</small>
              </div>
            </div>
          </div>
          <table>
            <thead><tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>
              <tr>
                <td><b>${job.serviceType}</b><br><small style="color:#64748b">Format: ${job.specs.size}</small></td>
                <td style="text-align:center;">${job.specs.quantity}</td>
                <td style="text-align:right;">$${(job.pricing.total / job.specs.quantity).toFixed(2)}</td>
                <td style="text-align:right;">$${job.pricing.total.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="totals-row"><td colspan="3">Subtotal:</td><td>$${job.pricing.total.toFixed(2)}</td></tr>
              <tr class="totals-row"><td colspan="3">Amount Paid:</td><td>$${job.amountPaid.toFixed(2)}</td></tr>
              <tr class="totals-row"><td colspan="3" class="grand-total">Total Balance Due:</td><td class="grand-total">$${(job.pricing.total - job.amountPaid).toFixed(2)}</td></tr>
            </tfoot>
          </table>
          <div class="footer">
            <div class="thank-you">Thank you for your business!</div>
            <p style="font-size: 11px; color: #94a3b8; margin-top: 10px;">${HEAD_OFFICE_INFO.address}</p>
            <p style="font-size: 11px; color: #94a3b8;">Phones: ${HEAD_OFFICE_INFO.phones.join(' | ')}</p>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const exportDetailedReportPDF = (job: Job) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Job Analysis - ${job.id}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; background: #fff; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .section-title { font-size: 12px; font-weight: 900; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; }
            .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .data-card { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
            .value { font-size: 16px; font-weight: 700; color: #1e293b; }
            .cost-bar-container { margin-bottom: 15px; }
            .cost-bar-label { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
            .cost-bar-outer { width: 100%; height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
            .cost-bar-inner { height: 100%; border-radius: 6px; }
            .material { background: #3b82f6; }
            .labor { background: #a855f7; }
            .overhead { background: #f59e0b; }
            .profit { background: #10b981; }
            .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div><b style="font-size: 20px; color: #0f172a;">PRODUCTION COST AUDIT</b><br><small>Job Reference: ${job.id}</small></div>
            <div style="text-align: right;"><b style="font-size: 14px; color: #3b82f6;">${job.branchId}</b><br><small>${new Date().toLocaleDateString()}</small></div>
          </div>

          <div class="section-title">Operational Context</div>
          <div class="data-grid">
            <div class="data-card">
              <div class="label">Client Identity</div>
              <div class="value">${job.customerName}</div>
              <div style="font-size: 11px; color: #3b82f6; font-weight: 900; margin-top: 4px;">Phone Index: ${job.customerPhone || 'N/A'}</div>
            </div>
            <div class="data-card">
              <div class="label">Production Specs</div>
              <div class="value">${job.serviceType} (${job.specs.quantity} Units)</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Format: ${job.specs.size} | Status: ${job.status}</div>
            </div>
          </div>

          <div class="section-title">Fiscal Breakdown Analysis</div>
          <div class="data-grid">
            <div class="data-card" style="grid-column: span 2;">
              <div class="cost-bar-container">
                <div class="cost-bar-label"><span>Material Contribution</span> <span>$${job.pricing.materialCost.toFixed(2)} (${((job.pricing.materialCost / job.pricing.total) * 100).toFixed(1)}%)</span></div>
                <div class="cost-bar-outer"><div class="cost-bar-inner material" style="width: ${((job.pricing.materialCost / job.pricing.total) * 100)}%"></div></div>
              </div>
              <div class="cost-bar-container">
                <div class="cost-bar-label"><span>Labor Allocation</span> <span>$${job.pricing.laborCost.toFixed(2)} (${((job.pricing.laborCost / job.pricing.total) * 100).toFixed(1)}%)</span></div>
                <div class="cost-bar-outer"><div class="cost-bar-inner labor" style="width: ${((job.pricing.laborCost / job.pricing.total) * 100)}%"></div></div>
              </div>
              <div class="cost-bar-container">
                <div class="cost-bar-label"><span>Facility Overhead</span> <span>$${job.pricing.overhead.toFixed(2)} (${((job.pricing.overhead / job.pricing.total) * 100).toFixed(1)}%)</span></div>
                <div class="cost-bar-outer"><div class="cost-bar-inner overhead" style="width: ${((job.pricing.overhead / job.pricing.total) * 100)}%"></div></div>
              </div>
              <div class="cost-bar-container">
                <div class="cost-bar-label"><span>Net Profit Margin</span> <span>$${(job.pricing.total - (job.pricing.materialCost + job.pricing.laborCost + job.pricing.overhead)).toFixed(2)} (${(((job.pricing.total - (job.pricing.materialCost + job.pricing.laborCost + job.pricing.overhead)) / job.pricing.total) * 100).toFixed(1)}%)</span></div>
                <div class="cost-bar-outer"><div class="cost-bar-inner profit" style="width: ${(((job.pricing.total - (job.pricing.materialCost + job.pricing.laborCost + job.pricing.overhead)) / job.pricing.total) * 100)}%"></div></div>
              </div>
            </div>
          </div>

          <div class="data-grid">
            <div class="data-card" style="background: #0f172a; color: #fff;">
              <div class="label" style="color: #64748b;">Total Contract Value</div>
              <div class="value" style="color: #fff; font-size: 24px;">$${job.pricing.total.toFixed(2)}</div>
            </div>
            <div class="data-card" style="background: #10b981; color: #fff;">
              <div class="label" style="color: #ecfdf5;">Efficiency Markup</div>
              <div class="value" style="color: #fff; font-size: 24px;">${(job.pricing.markup * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div class="footer">
            FuPPAS Enterprise ERP • Comprehensive Production Analysis System • Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const submitJob = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const total = parseFloat(newJob.total) || 0;
    const paid = parseFloat(newJob.amountPaid) || 0;
    
    // Detailed costs (simulated or entered)
    const mCost = parseFloat(newJob.materialCost) || total * 0.3;
    const lCost = parseFloat(newJob.laborCost) || total * 0.2;
    const oHead = parseFloat(newJob.overhead) || total * 0.1;

    const jobRecord: Job = {
      id: `job-${now}`,
      branchId,
      customerId: newJob.customerId || undefined,
      customerName: newJob.customerName,
      customerEmail: newJob.customerEmail,
      customerPhone: newJob.customerPhone,
      serviceType: newJob.serviceType,
      paymentStatus: newJob.paymentStatus,
      specs: { quantity: parseInt(newJob.quantity) || 0, size: newJob.size },
      pricing: { 
        materialCost: mCost, 
        laborCost: lCost, 
        overhead: oHead, 
        subtotal: total, 
        markup: (total - (mCost + lCost + oHead)) / (mCost + lCost + oHead || 1), 
        total, 
        breakdown: { costPerSheet: 0, inkUsage: 0, inkUnitPrice: 0, inkCost: 0, hours: 0, staffRate: 0, machineHours: 0, wastePercentage: 0 } 
      },
      status: JobStatus.QUOTED,
      amountPaid: paid,
      createdAt: now
    };

    setJobs(prev => [jobRecord, ...prev]);
    if (paid > 0) setTransactions(prev => [...prev, { id: `trx-${now}-init`, branchId, orderId: jobRecord.id, amountPaid: paid, paymentMethod: PaymentMethod.CASH, timestamp: now, type: 'JOB' }]);
    setIsAddingJob(false);
    setNewJob({ 
      customerId: '', customerName: '', customerEmail: '', customerPhone: '', 
      serviceType: ServiceType.PRINT, paymentStatus: PaymentStatus.UNPAID, 
      quantity: '1', unitPrice: '1.00', total: '1.00', amountPaid: '0', 
      size: 'A4', materialCost: '0', laborCost: '0', overhead: '0' 
    });
  };

  const askAIAboutJob = (job: Job) => {
    const context = `Job Cost Analysis: Total: $${job.pricing.total}, Materials: $${job.pricing.materialCost}, Labor: $${job.pricing.laborCost}, Overhead: $${job.pricing.overhead}. Service: ${job.serviceType}.`;
    navigate('/ai-support', { state: { initialPrompt: `Analyze this job's costs and suggest optimization strategies: ${context}` } });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <i className="fas fa-clipboard-list text-blue-600"></i>
            Production Pipeline
          </h2>
          <p className="text-slate-500 text-xs font-medium">Manage jobs, analytics, and financial statements.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={exportJobLedgerPDF}
            className="bg-white border border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all active-tap shadow-sm"
          >
            <i className="fas fa-file-pdf"></i> Export Ledger
          </button>
          <button onClick={() => setIsAddingJob(true)} className="bg-slate-900 text-white flex-1 md:flex-none px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] active-tap shadow-xl">
            Launch New Job
          </button>
        </div>
      </header>

      {/* Global Filter Bar */}
      <div className="px-2">
        <div className="relative group">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
          <input 
            type="text" 
            placeholder="Search production by client, phone, or job type..." 
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Job Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden mx-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 font-black text-slate-400 uppercase text-[9px]">Client Details</th>
                <th className="px-4 py-5 font-black text-slate-400 uppercase text-[9px]">Production Status</th>
                <th className="px-4 py-5 font-black text-slate-400 uppercase text-[9px] text-right">Financial Liability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredJobs.map(job => (
                <React.Fragment key={job.id}>
                  <tr onClick={() => toggleExpand(job.id)} className={`active:bg-slate-50 transition-colors cursor-pointer group ${expandedJobId === job.id ? 'bg-blue-50/20' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{job.customerName}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-slate-400 font-bold font-mono tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded leading-none">{job.serviceType}</span>
                          {job.customerPhone && (
                            <span className="text-[9px] text-blue-500 font-black flex items-center gap-1">
                              <i className="fas fa-phone-alt text-[8px]"></i> {job.customerPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-col gap-2">
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border w-fit ${
                          job.paymentStatus === PaymentStatus.PAID ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          job.paymentStatus === PaymentStatus.PARTIALLY_PAID ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                        }`}>
                          {job.paymentStatus}
                        </span>
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full bg-blue-500 transition-all ${job.status === JobStatus.COMPLETED ? 'w-full' : job.status === JobStatus.READY ? 'w-3/4' : 'w-1/4'}`}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-black text-slate-800 font-mono text-base">${job.pricing.total.toFixed(2)}</span>
                        <span className="text-[9px] text-rose-500 font-black mt-0.5">Bal: ${(job.pricing.total - job.amountPaid).toFixed(2)}</span>
                      </div>
                    </td>
                  </tr>
                  {expandedJobId === job.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={3} className="px-6 py-8 border-t border-blue-100/30">
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Cost Dynamics View */}
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                               <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                                  <div>
                                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Production Cost Audit</h4>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Resource allocation mapping</p>
                                  </div>
                                  <button onClick={() => askAIAboutJob(job)} className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 transition-all shadow-sm">
                                    <i className="fas fa-robot animate-pulse"></i> AI Optimizer
                                  </button>
                               </div>
                               
                               <div className="space-y-5">
                                  {[
                                    { label: 'Raw Materials', value: job.pricing.materialCost, color: 'bg-blue-500', icon: 'fa-box-open' },
                                    { label: 'Workforce Labor', value: job.pricing.laborCost, color: 'bg-purple-500', icon: 'fa-user-clock' },
                                    { label: 'Facility Overhead', value: job.pricing.overhead, color: 'bg-amber-500', icon: 'fa-bolt-lightning' },
                                    { label: 'Projected Profit', value: Math.max(0, job.pricing.total - (job.pricing.materialCost + job.pricing.laborCost + job.pricing.overhead)), color: 'bg-emerald-500', icon: 'fa-sack-dollar' }
                                  ].map((c, i) => (
                                    <div key={i} className="group/bar">
                                       <div className="flex justify-between text-[10px] font-black uppercase mb-2 px-1">
                                          <span className="text-slate-400 flex items-center gap-2"><i className={`fas ${c.icon} w-4`}></i> {c.label}</span>
                                          <span className="text-slate-800 font-mono">${c.value.toFixed(2)} <span className="text-slate-300 ml-1">({((c.value / (job.pricing.total || 1)) * 100).toFixed(1)}%)</span></span>
                                       </div>
                                       <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                          <div className={`h-full ${c.color} rounded-full transition-all duration-1000 group-hover/bar:brightness-110`} style={{ width: `${(c.value / (job.pricing.total || 1)) * 100}%` }}></div>
                                       </div>
                                    </div>
                                  ))}
                               </div>
                               <button 
                                 onClick={() => exportDetailedReportPDF(job)}
                                 className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
                               >
                                 <i className="fas fa-file-export mr-2"></i> Export Detailed Production Report (PDF)
                               </button>
                            </div>

                            {/* Actions & Payment Ledger */}
                            <div className="flex flex-col gap-6">
                               <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-2xl relative overflow-hidden group/ledger">
                                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/ledger:scale-110 transition-transform">
                                    <i className="fas fa-file-invoice-dollar text-7xl text-white"></i>
                                  </div>
                                  <div className="z-10 text-center md:text-left mb-6 md:mb-0">
                                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Settlement Dashboard</p>
                                     <p className="text-3xl font-black text-white font-mono mt-2 tracking-tighter">${job.amountPaid.toFixed(2)}</p>
                                     <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                                       <span className="text-[10px] font-bold text-slate-400 uppercase">of</span>
                                       <span className="text-[11px] font-black text-emerald-400 font-mono">$${job.pricing.total.toFixed(2)} Total</span>
                                     </div>
                                  </div>
                                  <button onClick={() => setPaymentModalJob(job)} className="z-10 bg-blue-500 hover:bg-blue-600 text-white px-8 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active-tap transition-all">
                                    Process Payment
                                  </button>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-4 flex-1">
                                  <button 
                                    onClick={() => exportInvoicePDF(job)} 
                                    className="p-8 bg-white border border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-sm hover:border-blue-500 hover:shadow-lg transition-all active-tap"
                                  >
                                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl">
                                      <i className="fas fa-file-invoice"></i>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Client Invoice</span>
                                  </button>
                                  <button 
                                    onClick={() => navigate('/crm', { state: { selectedCustomerId: job.customerId } })} 
                                    className="p-8 bg-white border border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 shadow-sm hover:border-emerald-500 hover:shadow-lg transition-all active-tap"
                                  >
                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-xl">
                                      <i className="fas fa-user-tag"></i>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">View Client Profile</span>
                                  </button>
                               </div>
                            </div>
                         </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-24 text-center">
                    <div className="opacity-10 flex flex-col items-center">
                      <i className="fas fa-clipboard-list text-6xl mb-4"></i>
                      <p className="text-sm font-black uppercase tracking-widest">No active jobs found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEDUCTION MODAL */}
      {paymentModalJob && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 animate-slideUp shadow-2xl relative">
            <button onClick={() => setPaymentModalJob(null)} className="absolute top-8 right-8 w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center active-tap">
              <i className="fas fa-times text-slate-400"></i>
            </button>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
                <i className="fas fa-hand-holding-dollar"></i>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Record Payment</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ref: {paymentModalJob.id.split('-')[1]}</p>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Deduction Amount ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  autoFocus 
                  required 
                  className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-4xl font-black font-mono text-center outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-500 transition-all" 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  placeholder="0.00" 
                />
                <p className="text-center mt-3 text-[10px] font-black text-rose-500 uppercase">Outstanding Balance: $${(paymentModalJob.pricing.total - paymentModalJob.amountPaid).toFixed(2)}</p>
              </div>
              <div className="flex gap-4">
                 <select 
                   className="flex-1 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase outline-none focus:bg-white" 
                   value={recordPaymentMethod} 
                   onChange={e => setRecordPaymentMethod(e.target.value as PaymentMethod)}
                 >
                    {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
                 <button type="submit" className="flex-[2] bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active-tap">Commit Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW JOB MODAL */}
      {isAddingJob && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-end md:items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl h-[95vh] md:h-auto rounded-t-[3rem] md:rounded-[3rem] p-8 md:p-12 animate-slideUp overflow-y-auto">
            <div className="flex justify-between items-center mb-10 sticky top-0 bg-white z-10 py-2 border-b border-slate-50">
              <h3 className="text-2xl font-black uppercase tracking-tight">Production Provisioning</h3>
              <button onClick={() => setIsAddingJob(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center active-tap">
                <i className="fas fa-times text-slate-400"></i>
              </button>
            </div>

            <form onSubmit={submitJob} className="space-y-8 pb-10">
              {/* Group 1: Client Info */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                  <i className="fas fa-user-circle"></i> 1. Client Identity Hub
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select className="col-span-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none focus:bg-white transition-all shadow-sm" onChange={handleCustomerSelect}>
                    <option value="NEW">-- Anonymous / Walk-in Client --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No Phone'})</option>)}
                  </select>
                  <input required placeholder="Client Full Name" className="p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none focus:bg-white transition-all shadow-sm" value={newJob.customerName} onChange={e => setNewJob({...newJob, customerName: e.target.value})} />
                  <input placeholder="Client Phone (+231...)" className="p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none focus:bg-white transition-all shadow-sm" value={newJob.customerPhone} onChange={e => setNewJob({...newJob, customerPhone: e.target.value})} />
                </div>
              </div>

              {/* Group 2: Job Specs */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                  <i className="fas fa-cog"></i> 2. Production Specification
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <select className="col-span-2 p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none focus:bg-white transition-all shadow-sm" value={newJob.serviceType} onChange={e => setNewJob({...newJob, serviceType: e.target.value as ServiceType})}>
                    {Object.values(ServiceType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <div className="relative group">
                    <label className="absolute -top-2 left-4 px-1 bg-white text-[8px] font-black text-slate-400 uppercase">Quantity</label>
                    <input type="number" min="1" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-black font-mono outline-none focus:bg-white" value={newJob.quantity} onChange={e => setNewJob({...newJob, quantity: e.target.value})} />
                  </div>
                  <div className="relative group">
                    <label className="absolute -top-2 left-4 px-1 bg-white text-[8px] font-black text-slate-400 uppercase">Format/Size</label>
                    <input placeholder="e.g. A4, A3, Legal" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none focus:bg-white" value={newJob.size} onChange={e => setNewJob({...newJob, size: e.target.value})} />
                  </div>
                  <div className="col-span-full relative group">
                    <label className="absolute -top-2 left-4 px-1 bg-white text-[8px] font-black text-slate-400 uppercase">Unit Retail Price ($)</label>
                    <input type="number" step="0.01" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-2xl font-black font-mono text-center outline-none focus:bg-white" value={newJob.unitPrice} onChange={e => setNewJob({...newJob, unitPrice: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Group 3: Financial Estimates */}
              <div className="space-y-4 pt-4 border-t border-slate-50 bg-slate-50/50 p-6 rounded-[2rem]">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                  <i className="fas fa-chart-pie"></i> 3. Cost-Breakdown Forecast
                </p>
                <div className="grid grid-cols-3 gap-3">
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Materials ($)</label>
                      <input type="number" step="0.01" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-black font-mono outline-none" value={newJob.materialCost} onChange={e => setNewJob({...newJob, materialCost: e.target.value})} />
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Labor ($)</label>
                      <input type="number" step="0.01" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-black font-mono outline-none" value={newJob.laborCost} onChange={e => setNewJob({...newJob, laborCost: e.target.value})} />
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Overhead ($)</label>
                      <input type="number" step="0.01" className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-black font-mono outline-none" value={newJob.overhead} onChange={e => setNewJob({...newJob, overhead: e.target.value})} />
                   </div>
                </div>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Note: Providing accurate cost estimates enables deep-module financial reporting and AI-driven efficiency audits.
                </p>
              </div>

              {/* Group 4: Fiscal Settlement */}
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                  <i className="fas fa-wallet"></i> 4. Settlement Protocol
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <button type="button" onClick={() => setNewJob({...newJob, paymentStatus: PaymentStatus.UNPAID})} className={`py-4 rounded-2xl font-black uppercase text-[10px] border transition-all active-tap ${newJob.paymentStatus === PaymentStatus.UNPAID ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>Unpaid</button>
                  <button type="button" onClick={() => setNewJob({...newJob, paymentStatus: PaymentStatus.PARTIALLY_PAID})} className={`py-4 rounded-2xl font-black uppercase text-[10px] border transition-all active-tap ${newJob.paymentStatus === PaymentStatus.PARTIALLY_PAID ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>Partial</button>
                  <button type="button" onClick={() => setNewJob({...newJob, paymentStatus: PaymentStatus.PAID})} className={`py-4 rounded-2xl font-black uppercase text-[10px] border transition-all active-tap ${newJob.paymentStatus === PaymentStatus.PAID ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>Paid</button>
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex justify-between items-center shadow-2xl relative overflow-hidden group/total">
                  <div className="z-10">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calculated Gross Total</span>
                    <p className="text-3xl font-black font-mono tracking-tighter text-blue-400 mt-1">${newJob.total}</p>
                  </div>
                  {newJob.paymentStatus === PaymentStatus.PARTIALLY_PAID && (
                    <div className="z-10 text-right bg-white/5 p-4 rounded-3xl border border-white/10">
                       <span className="text-[9px] font-black text-blue-400 uppercase block mb-1">Down Payment ($)</span>
                       <input 
                         type="number" 
                         step="0.01" 
                         className="bg-transparent text-right text-xl font-black font-mono w-28 border-b-2 border-blue-500 outline-none text-white focus:border-blue-400 transition-all" 
                         value={newJob.amountPaid} 
                         onChange={e => setNewJob({...newJob, amountPaid: e.target.value})} 
                       />
                    </div>
                  )}
                  <div className="absolute -right-6 -bottom-6 opacity-5 group-hover/total:scale-110 transition-transform">
                    <i className="fas fa-file-invoice-dollar text-9xl"></i>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 sticky bottom-0 bg-white/95 backdrop-blur-sm py-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddingJob(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-[10px] tracking-widest active-tap">Discard</button>
                <button type="submit" className="flex-[2] py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-500/30 active-tap transition-all">Execute Production</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;
