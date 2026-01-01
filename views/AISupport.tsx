
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { startAIChatSession, analyzeMultimodalContent } from '../services/geminiService.ts';
import { InventoryItem, Job, JobStatus, Transaction, Customer } from '../types.ts';

interface Message {
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: number;
}

interface Props {
  inventory: InventoryItem[];
  jobs: Job[];
  transactions: Transaction[];
  customers: Customer[];
}

const AISupport: React.FC<Props> = ({ inventory, jobs, transactions, customers }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPromptTriggered = useRef(false);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "Welcome to the FuPPAS Intelligence Hub. I have analyzed your complete branch ecosystem. I can help you with supply optimization, production summaries, financial trends, or customer engagement strategies. How can I assist you today?",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Multimodal Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Speech Recognition Setup
  const recognitionRef = useRef<any>(null);

  // Helper to build tailored context
  const getDetailedContext = () => {
    const lowStockItems = inventory
      .filter(i => i.stockLevel <= (i.reorderPoint || 5))
      .map(i => `${i.name} (Stock: ${i.stockLevel}, Reorder: ${i.reorderPoint || 5})`);
    
    const activeJobs = jobs
      .filter(j => j.status !== JobStatus.COMPLETED)
      .slice(0, 5)
      .map(j => `${j.customerName}: ${j.serviceType} [Status: ${j.status}]`);

    const totalJobRevenue = jobs.reduce((sum, j) => sum + j.pricing.total, 0);
    const recentTrx = transactions.slice(-3).map(t => `$${t.amountPaid} via ${t.paymentMethod} (${t.type})`);

    return `
      BRANCH LIVE DATA SUMMARY:
      - TOTAL CUSTOMERS: ${customers.length}
      - TOTAL INVENTORY ASSETS: ${inventory.length}
      - CRITICAL LOW STOCK: ${lowStockItems.length > 0 ? lowStockItems.join(', ') : 'All stock levels are currently optimal.'}
      - TOTAL ACTIVE JOBS: ${jobs.filter(j => j.status !== JobStatus.COMPLETED).length}
      - AGGREGATE JOB REVENUE: $${totalJobRevenue.toLocaleString()}
      - RECENT PRODUCTION QUEUE: ${activeJobs.length > 0 ? activeJobs.join('; ') : 'No active jobs currently in production.'}
      - LAST TRANSACTIONS: ${recentTrx.length > 0 ? recentTrx.join(', ') : 'No recent transactions recorded.'}
    `;
  };

  useEffect(() => {
    const context = getDetailedContext();
    chatRef.current = startAIChatSession(context);

    // Check for initial prompt from navigation state
    if (location.state?.initialPrompt && !initialPromptTriggered.current) {
      initialPromptTriggered.current = true;
      handleQuickQuestion(location.state.initialPrompt);
    }

    // Initialize Speech Recognition if supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => (result as any)[0])
          .map((result: any) => result.transcript)
          .join('');
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Recognition Error", event.error);
        setIsListening(false);
      };
    }
  }, [inventory.length, jobs.length, transactions.length, customers.length, location.state]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert("Speech recognition is not supported in this browser.");
        return;
      }
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert("Only image uploads are supported for visual analysis.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be under 5MB.");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const performAISend = async (text: string, file: File | null, preview: string | null) => {
    const userMessage: Message = {
      role: 'user',
      text: text || "Please analyze this system screenshot.",
      image: preview || undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    removeAttachment();
    setIsLoading(true);

    try {
      let aiResponseText = "";
      const context = getDetailedContext();

      if (file) {
        const base64Data = await fileToBase64(file);
        aiResponseText = await analyzeMultimodalContent(
          text || "Explain the visual data in this screenshot in relation to my current branch status.",
          { data: base64Data, mimeType: file.type },
          context
        ) || "I successfully processed the image but was unable to generate a text summary.";
      } else {
        const response = await chatRef.current.sendMessage({ message: text });
        aiResponseText = response.text || "Communication error with AI core.";
      }

      setMessages(prev => [...prev, {
        role: 'model',
        text: aiResponseText,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "System communication failed. Please check your connectivity or try a smaller image.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;
    if (isListening) recognitionRef.current?.stop();
    await performAISend(input, selectedFile, filePreview);
  };

  const handleQuickQuestion = (q: string) => {
    if (isLoading) return;
    performAISend(q, null, null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] max-w-5xl mx-auto bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn relative">
      
      {/* Hidden File Input Trigger */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      {/* Chat Header */}
      <header className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fas fa-eye text-xl"></i>
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Smart-Instructor</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Intelligence Engine Ready</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-rose-500 text-white flex items-center justify-center transition-all active-tap"
        >
          <i className="fas fa-times"></i>
        </button>
      </header>

      {/* Messages Scroll Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth bg-slate-50/50"
      >
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}
          >
            <div className={`max-w-[85%] md:max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.image && (
                <div className="mb-3 rounded-3xl overflow-hidden border-4 border-white shadow-xl max-w-xs md:max-w-sm">
                  <img src={msg.image} alt="System Screenshot" className="w-full h-auto object-cover" />
                </div>
              )}
              <div className={`p-6 rounded-[2.5rem] text-sm font-medium leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
              }`}>
                {msg.text}
                <p className={`text-[8px] mt-3 font-black uppercase tracking-widest opacity-40 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 p-6 rounded-[2.5rem] rounded-bl-none flex items-center gap-4 shadow-sm animate-pulse">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {selectedFile ? 'Synthesizing Visuals...' : 'Computing Intelligence...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Control Area */}
      <footer className="p-6 md:p-8 bg-white border-t border-slate-100 shrink-0">
        
        {/* Attachment HUD */}
        {filePreview && (
          <div className="mb-6 flex items-center gap-4 p-4 bg-slate-900 rounded-[2rem] animate-slideUp shadow-xl">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20">
              <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
              <button 
                onClick={removeAttachment}
                className="absolute inset-0 bg-rose-500/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              >
                <i className="fas fa-trash-alt text-white"></i>
              </button>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Screenshot Attached</p>
              <p className="text-[9px] text-emerald-400 font-bold mt-1 uppercase">Ready for Live Analysis</p>
            </div>
            <button 
              onClick={removeAttachment}
              className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-rose-500 transition-colors active-tap"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {/* Quick Question Bar - Refined for tailored insights */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => handleQuickQuestion("What items need reordering right now based on my current stock?")}
            className="whitespace-nowrap px-5 py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active-tap"
          >
            <i className="fas fa-boxes-stacked mr-2"></i> What items need reordering?
          </button>
          <button 
            onClick={() => handleQuickQuestion("Summarize my current active production jobs and their status.")}
            className="whitespace-nowrap px-5 py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active-tap"
          >
            <i className="fas fa-clipboard-list mr-2"></i> Summarize current jobs
          </button>
          <button 
            onClick={() => handleQuickQuestion("Analyze our financial performance and recent transactions today.")}
            className="whitespace-nowrap px-5 py-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 border border-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active-tap"
          >
            <i className="fas fa-chart-line mr-2"></i> Branch Performance
          </button>
          <button 
            onClick={() => handleQuickQuestion("Tell me about our customer base and engagement statistics.")}
            className="whitespace-nowrap px-5 py-2.5 bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-600 border border-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active-tap"
          >
            <i className="fas fa-users mr-2"></i> Customer Insights
          </button>
        </div>

        {/* Main Input Field */}
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all active-tap border-2 ${
                selectedFile 
                  ? 'bg-blue-50 text-blue-600 border-blue-500' 
                  : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
              }`}
              title="Attach System Screenshot"
            >
              <i className={`fas ${selectedFile ? 'fa-check-circle' : 'fa-camera-retro'} text-lg`}></i>
            </button>
            <button 
              onClick={toggleListening}
              className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all active-tap border-2 ${
                isListening 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-500 animate-pulse shadow-lg shadow-emerald-100' 
                  : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
              }`}
              title="Voice Dictation"
            >
              <i className={`fas ${isListening ? 'fa-microphone' : 'fa-microphone-slash'} text-lg`}></i>
            </button>
          </div>
          
          <div className="relative flex-1 group">
            <input 
              type="text"
              className="w-full pl-8 pr-16 py-6 bg-slate-50 border border-slate-200 rounded-[2.5rem] font-bold outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-500 transition-all text-slate-700"
              placeholder={isListening ? "Listening to your instruction..." : (selectedFile ? "Ask about this image..." : "Ask the Smart-Instructor...")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              disabled={(!input.trim() && !selectedFile) || isLoading}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 rounded-3xl flex items-center justify-center transition-all ${
                (!input.trim() && !selectedFile) || isLoading 
                  ? 'bg-slate-200 text-slate-400 shadow-none' 
                  : 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 active-tap hover:scale-105'
              }`}
            >
              <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
            </button>
          </div>
        </div>
        
        <p className="text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.4em] mt-8">
          FuPPAS Intelligence Hub • Data-Aware Guidance
        </p>
      </footer>
    </div>
  );
};

export default AISupport;
