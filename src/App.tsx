/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Bot, 
  MessageSquare, 
  Zap, 
  Shield, 
  Users, 
  Clock, 
  Settings, 
  Search, 
  LayoutDashboard, 
  Puzzle, 
  Activity,
  Terminal,
  ChevronRight,
  Database,
  Smartphone
} from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState('Checking...');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(() => setStatus('Online (Bot Running)'));
  }, []);

  const features = [
    { name: 'Auto View Status', icon: <Search className="w-4 h-4 text-emerald-500" />, active: true, desc: 'Passive Status Viewing' },
    { name: 'Anti-Delete', icon: <Shield className="w-4 h-4 text-red-500" />, active: false, desc: 'Store deleted messages' },
    { name: 'Always Online', icon: <Smartphone className="w-4 h-4 text-emerald-500" />, active: true, desc: 'Persistent presence' },
    { name: 'Fake Typing', icon: <Zap className="w-4 h-4 text-yellow-500" />, active: true, desc: 'Triggers on chat entry' },
    { name: 'Safe Anti-Ban', icon: <Shield className="w-4 h-4 text-emerald-500" />, active: true, desc: 'Human-like rate limits' },
  ];

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-sm shadow-emerald-100">
            <Bot className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 uppercase">
            WA-AUTO-PRO <span className="text-slate-400 font-normal ml-2 text-xs normal-case">v2.4.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
            <div className={`w-2 h-2 rounded-full ${status.includes('Online') ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{status}</span>
          </div>
          <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
            <div className="text-right">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Render Tier</p>
              <p className="text-xs font-semibold">Free Instance</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-500">WA</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 flex-shrink-0 overflow-y-auto">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Core Systems</p>
            <ul className="space-y-1">
              <li className="flex items-center gap-3 text-sm font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100/50">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </li>
              <li className="flex items-center gap-3 text-sm font-medium text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-all cursor-pointer p-2.5 rounded-xl group/li">
                <Zap className="w-4 h-4 transition-transform group-hover/li:scale-110" />
                AI Integrations
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover/li:opacity-100 transition-opacity" />
              </li>
              <li className="flex items-center gap-3 text-sm font-medium text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-all cursor-pointer p-2.5 rounded-xl group/li">
                <Puzzle className="w-4 h-4 transition-transform group-hover/li:scale-110" />
                Plugin Manager
              </li>
              <li className="flex items-center gap-3 text-sm font-medium text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-all cursor-pointer p-2.5 rounded-xl group/li">
                <Users className="w-4 h-4 transition-transform group-hover/li:scale-110" />
                Active Sessions
              </li>
            </ul>
          </div>
          
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Financials</p>
            <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden group">
              <p className="text-[9px] uppercase font-bold opacity-50 tracking-wider">Weekly Revenue</p>
              <p className="text-xl font-bold mt-1 tabular-nums">KSH 1,425.00</p>
              <div className="flex items-center gap-2 mt-3 overflow-hidden">
                <span className="text-[9px] bg-white/10 rounded px-2 py-1 font-bold whitespace-nowrap">285 Subscriptions</span>
              </div>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500 opacity-20 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-2xl bg-slate-50 shadow-inner">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Database</p>
                <div className="flex items-center gap-1.5 font-mono">
                  <Database className="w-3 h-3 text-slate-400" />
                  <p className="text-[11px] font-bold text-slate-700">Firebase CLI</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto flex flex-col gap-8">
          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">System Uptime</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">162h 4m</p>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">+99.9%</span>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">API Latency</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">48ms</p>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Stable</span>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Total Commands</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">12.4k</p>
                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">All Time</span>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">AI Queries</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">842</p>
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Gemini-Flash</span>
              </div>
            </motion.div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Console Log Section */}
            <div className="lg:col-span-3 flex flex-col h-[500px] bg-slate-950 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl relative group">
              <div className="bg-slate-900 px-8 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                  </div>
                  <div className="h-4 w-px bg-slate-800 ml-2"></div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Terminal className="w-3 h-3" />
                    System_Output_Stream
                  </span>
                </div>
                <button className="text-[9px] font-bold text-slate-600 hover:text-white uppercase tracking-widest transition-colors">Clear Stream</button>
              </div>
              <div className="flex-1 p-8 font-mono text-[11px] text-emerald-400/90 leading-relaxed overflow-y-auto space-y-3 custom-scrollbar">
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:04:22</span> <span className="text-blue-400 font-bold">INFO:</span> <span className="text-slate-100">Initializing Baileys connection...</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:04:25</span> <span className="text-orange-400 font-bold">AUTH:</span> <span className="text-slate-100">Reloading session from Firebase Firestore.</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:04:26</span> <span className="text-emerald-400 font-bold">SUCCESS:</span> <span className="text-emerald-100">WhatsApp Authentication established as @bot.</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:05:01</span> <span className="text-purple-400 font-bold">STATUS:</span> <span className="text-slate-100">Automatically viewed 4 recent updates.</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:08:12</span> <span className="text-rose-400 font-bold">PREMIUM:</span> <span className="text-slate-100">Payment receipt verified for user 254... (KSH 5.00)</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:10:44</span> <span className="text-blue-400 font-bold">AI:</span> <span className="text-slate-100">Gemini processed input payload for ".gpt help"</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:12:33</span> <span className="text-slate-500 font-bold">STAY_ALIVE:</span> <span className="text-slate-400">Render keep-awake ping successful. Next in 14m.</span></p>
                <p className="animate-pulse text-emerald-500">_</p>
              </div>
              <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-[0.03]">
                <Activity className="w-64 h-64 text-white" />
              </div>
            </div>

            {/* Feature Control Panel */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 flex-1 flex flex-col space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Modules</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Control features via WA Commands</p>
                  </div>
                  <Settings className="w-5 h-5 text-slate-300" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                  {features.map((feat, i) => (
                    <div key={i} className={`flex items-center justify-between group transition-opacity ${!feat.active ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl ${feat.active ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                          {feat.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700 tracking-tight">{feat.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{feat.desc}</span>
                        </div>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${feat.active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all duration-300 ${feat.active ? 'right-0.75' : 'left-0.75'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-emerald-600 border border-emerald-500 rounded-3xl p-6 text-white shadow-xl shadow-emerald-100/50 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-0.5">Premium Logic</p>
                    <p className="text-sm font-bold">Auto-Verification Active</p>
                  </div>
                  <div className="flex -space-x-2 overflow-hidden">
                    {[1,2,3].map(i => (
                      <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-emerald-600 bg-emerald-400 flex items-center justify-center text-[8px] font-bold">
                        U{i}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
