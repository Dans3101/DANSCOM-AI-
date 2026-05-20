/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
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
  Smartphone,
  QrCode,
  Link as LinkIcon,
  RefreshCw,
  X
} from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState('Checking...');
  const [connection, setConnection] = useState<{qr: string | null, pairingCode: string | null, connected: boolean, pairingNumber: string | null, user?: {id: string, name: string}}>({
    qr: null,
    pairingCode: null,
    connected: false,
    pairingNumber: null
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [pairingSessionId, setPairingSessionId] = useState('default_bot');
  const [showPairing, setShowPairing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isRequestingPairing, setIsRequestingPairing] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isRestarting, setIsRestarting] = useState(false);

  const [stats, setStats] = useState({ totalCommands: 12400, activeUsers: 842, uptime: 0, latency: 48 });
  const [plugins, setPlugins] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState<any>(null);

  useEffect(() => {
    const safeFetch = async (url: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return await res.json();
            } else {
                const text = await res.text();
                throw new Error(`Expected JSON but got ${contentType || 'unknown'}: ${text.substring(0, 50)}...`);
            }
        } catch (err) {
            console.error(`Fetch failed for ${url}:`, err);
            throw err;
        }
    };

    const checkStatus = () => {
        safeFetch('/api/connection')
          .then(data => {
            setConnection(data);
            if (data.connected) {
                setStatus('Online (DANSCOM Running)');
            } else {
                safeFetch('/api/health')
                  .then(hData => setStatus(hData.status))
                  .catch(() => setStatus('Connecting...'));
            }
          })
          .catch(() => setStatus('Connection Error'));

        safeFetch('/api/sessions')
          .then(data => {
            if (Array.isArray(data)) {
                setSessions(data);
            }
          })
          .catch(() => {});

        safeFetch('/api/stats')
          .then(data => setStats(data))
          .catch(() => {});
    };

    safeFetch('/api/plugins').then(setPlugins).catch(() => {});
    safeFetch('/api/ai-config').then(setAiConfig).catch(() => {});

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestPairingCode = async () => {
    if (!phoneNumber) return;
    setIsRequestingPairing(true);
    setPairingError(null);
    try {
      const res = await fetch('/api/request-pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phoneNumber, sessionId: pairingSessionId })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || 'Failed to request pairing code');
      }

      const data = await res.json();
      if (data.code) {
        setConnection(prev => ({ ...prev, pairingCode: data.code }));
        setSessions(prev => prev.map(s => s.sessionId === pairingSessionId ? { ...s, pairingCode: data.code } : s));
      } else {
        setPairingError(data.error || 'Failed to generate code. Is your phone number correct?');
      }
    } catch (error: any) {
      console.error('Request pairing error:', error);
      setPairingError(error.message || 'Network error. Please check your internet connection.');
    } finally {
      setIsRequestingPairing(false);
    }
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      if (pairingSessionId && pairingSessionId !== 'default_bot') {
        await fetch(`/api/sessions/${pairingSessionId}/restart`, { method: 'POST' });
      } else {
        await fetch('/api/restart', { method: 'POST' });
      }
      setPhoneNumber('');
      setPairingError(null);
    } catch (error) {
      console.error('Restart error:', error);
    } finally {
      setTimeout(() => setIsRestarting(false), 2000);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionName) return;
    const cleanName = newSessionName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanName) return;
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: cleanName })
      });
      if (res.ok) {
        setNewSessionName('');
        const sessionsRes = await fetch('/api/sessions');
        if (sessionsRes.ok) {
          const data = await sessionsRes.json();
          if (Array.isArray(data)) setSessions(data);
        }
      }
    } catch (error) {
        console.error('Failed to create session:', error);
    }
  };

  const handleDeleteSession = async (sessId: string) => {
    if (sessId === 'default_bot') {
      alert('The primary/default session cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete session "${sessId}"?`)) return;
    try {
      const res = await fetch(`/api/sessions/${sessId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.sessionId !== sessId));
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

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
            DANSCOM <span className="text-slate-400 font-normal ml-2 text-xs normal-case">v2.4.0</span>
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
              <span className="text-sm font-bold text-slate-500">DS</span>
            </div>
          </div>
        </div>
      </nav>
      
      <AnimatePresence>
        {showPairing && (() => {
          const activePairingSess = sessions.find(s => s.sessionId === pairingSessionId) || connection;
          return (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden my-8"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Bot Connection</h3>
                    <p className="text-sm text-slate-400">Link your WhatsApp account</p>
                  </div>
                  <button 
                    onClick={() => setShowPairing(false)}
                    className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Session Selector */}
                <div className="px-8 pt-6 pb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target Bot Account</label>
                  <select 
                    value={pairingSessionId}
                    onChange={(e) => {
                      setPairingSessionId(e.target.value);
                      setPhoneNumber('');
                      setPairingError(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all cursor-pointer"
                  >
                    {sessions.map(s => (
                      <option key={s.sessionId} value={s.sessionId}>
                        {s.sessionId === 'default_bot' ? '🌐 Primary Bot (default)' : `🤖 Account: ${s.sessionId}`} {s.connected ? '● (Active)' : '○ (Click to Link)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="px-8 pb-8 pt-2">
                  <div className="flex justify-end mb-4">
                    <button 
                      onClick={handleRestart}
                      disabled={isRestarting}
                      className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRestarting ? 'animate-spin' : ''}`} />
                      Refresh Connection
                    </button>
                  </div>
                  {activePairingSess.connected ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bot className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-800">Connected Successfully!</h4>
                      <p className="text-sm text-slate-500 mt-1">Bot "{pairingSessionId === 'default_bot' ? 'Primary' : pairingSessionId}" is active and ready.</p>
                      <button 
                        onClick={() => setShowPairing(false)}
                        className="mt-6 w-full py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="flex flex-col items-center">
                        <div className="p-4 bg-white border-4 border-slate-100 rounded-3xl mb-4 min-w-[200px] min-h-[200px] flex items-center justify-center">
                          {activePairingSess.qr ? (
                            <QRCodeSVG value={activePairingSess.qr} size={200} />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300">
                              {activePairingSess.connected ? (
                                  <Bot className="w-12 h-12 text-emerald-500 mb-2" />
                              ) : (
                                  <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                              )}
                              <p className="text-[10px] uppercase font-bold tracking-widest">
                                  {activePairingSess.connected ? 'Connected' : 'Initializing...'}
                              </p>
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {activePairingSess.qr ? 'Scan QR with WhatsApp' : 'Waiting for connection...'}
                        </p>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase font-bold text-slate-300">
                          <span className="bg-white px-4 tracking-widest">OR</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Pairing Code Method</p>
                        
                        {!activePairingSess.pairingCode ? (
                          <div className="space-y-4">
                            <div className="relative">
                              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                type="text" 
                                placeholder="254712345678"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                              />
                            </div>
                            <motion.button 
                              whileTap={{ scale: 0.98 }}
                              onClick={handleRequestPairingCode}
                              disabled={!phoneNumber || isRequestingPairing}
                              className="w-full py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                              {isRequestingPairing ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <LinkIcon className="w-4 h-4" />
                              )}
                              Generate Pairing Code
                            </motion.button>

                            {pairingError && (
                              <motion.p 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="text-[10px] font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100"
                              >
                                Error: {pairingError}
                              </motion.p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="text-2xl font-mono font-black tracking-[0.2em] text-slate-800 bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm inline-block">
                              {activePairingSess.pairingCode}
                            </div>
                            <div className="flex justify-center">
                              <button 
                                onClick={() => {
                                  setSessions(prev => prev.map(s => s.sessionId === pairingSessionId ? { ...s, pairingCode: null } : s));
                                  setPhoneNumber('');
                                }}
                                className="text-[10px] font-bold text-slate-400 uppercase hover:text-rose-500 transition-colors"
                              >
                                Reset and use another number
                              </button>
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-slate-400 mt-6 leading-relaxed px-4 font-medium italic">
                          Open WhatsApp {'>'} Linked Devices {'>'} Link with Phone Number Instead
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 flex-shrink-0 overflow-y-auto">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Core Systems</p>
            <ul className="space-y-1">
              <li 
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-3 text-sm font-bold p-2.5 rounded-xl border transition-all cursor-pointer ${activeTab === 'dashboard' ? 'text-emerald-600 bg-emerald-50 border-emerald-100/50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </li>
              <li 
                onClick={() => setActiveTab('ai')}
                className={`flex items-center gap-3 text-sm font-medium p-2.5 rounded-xl border transition-all cursor-pointer group/li ${activeTab === 'ai' ? 'text-emerald-600 bg-emerald-50 border-emerald-100/50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
              >
                <Zap className="w-4 h-4 transition-transform group-hover/li:scale-110" />
                AI Integrations
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover/li:opacity-100 transition-opacity" />
              </li>
              <li 
                onClick={() => setActiveTab('plugins')}
                className={`flex items-center gap-3 text-sm font-medium p-2.5 rounded-xl border transition-all cursor-pointer group/li ${activeTab === 'plugins' ? 'text-emerald-600 bg-emerald-50 border-emerald-100/50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
              >
                <Puzzle className="w-4 h-4 transition-transform group-hover/li:scale-110" />
                Plugin Manager
              </li>
              <li 
                onClick={() => setActiveTab('console')}
                className={`flex items-center gap-3 text-sm font-medium p-2.5 rounded-xl border transition-all cursor-pointer group/li ${activeTab === 'console' ? 'text-emerald-600 bg-emerald-50 border-emerald-100/50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
              >
                <Terminal className="w-4 h-4 transition-transform group-hover/li:scale-110" />
                Log Console
              </li>
              <li 
                onClick={() => setShowPairing(true)}
                className="flex items-center gap-3 text-sm font-medium text-slate-500 hover:text-emerald-600 hover:bg-slate-50 transition-all cursor-pointer p-2.5 rounded-xl group/li mt-4 bg-slate-50/50 border border-slate-100"
              >
                <QrCode className="w-4 h-4 transition-transform group-hover/li:scale-110" />
                Connect Bot
                {connection.connected && <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
              </li>
              <li 
                onClick={() => setActiveTab('sessions')}
                className={`flex items-center gap-3 text-sm font-medium p-2.5 rounded-xl border transition-all cursor-pointer group/li ${activeTab === 'sessions' ? 'text-emerald-600 bg-emerald-50 border-emerald-100/50' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
              >
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
          {activeTab === 'dashboard' ? (
            <>
              {/* Top Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">System Uptime</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">
                        {Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m
                    </p>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">+99.9%</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">API Latency</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">{stats.latency}ms</p>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Stable</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Total Commands</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">{(stats.totalCommands / 1000).toFixed(1)}k</p>
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">All Time</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Active Users</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">{stats.activeUsers}</p>
                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Live</span>
                  </div>
                </motion.div>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Console Log Section (Minified for Dashboard) */}
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
                        Live_Stream
                      </span>
                    </div>
                    <button onClick={() => setActiveTab('console')} className="text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors">Expand View</button>
                  </div>
                  <div className="flex-1 p-8 font-mono text-[11px] text-emerald-400/90 leading-relaxed overflow-hidden space-y-3">
                    <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:04:22</span> <span className="text-blue-400 font-bold">INFO:</span> <span className="text-slate-100">Initializing Baileys connection...</span></p>
                    <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:04:25</span> <span className="text-orange-400 font-bold">AUTH:</span> <span className="text-slate-100">Reloading session from Firebase Firestore.</span></p>
                    <p className="flex gap-4"><span className="text-slate-600 shrink-0">12:04:26</span> <span className="text-emerald-400 font-bold">SUCCESS:</span> <span className="text-emerald-100">WhatsApp Authentication established as @danscom_bot.</span></p>
                    <p className="flex gap-4 opacity-50"><span className="text-slate-600 shrink-0">...</span></p>
                    <p className="animate-pulse text-emerald-500">_</p>
                  </div>
                </div>

                {/* Feature Control Panel */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 flex-1 flex flex-col space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Modules</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Control features via DANSCOM Commands</p>
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
                </div>
              </div>

              {/* DANSCOM COMMANDS & IMAGERY REFERENCE */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row items-stretch">
                <div className="md:w-2/5 relative min-h-[250px] bg-slate-900 overflow-hidden">
                  <img 
                    src="/src/assets/images/danscom_menu_banner_1779306614113.png" 
                    alt="DANSCOM Cybernetic Headquarters" 
                    className="w-full h-full object-cover object-center absolute inset-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-slate-950/90 via-slate-900/40 to-transparent flex flex-col justify-end p-8">
                    <span className="text-[9px] bg-blue-500 text-white font-black px-2 py-0.5 rounded uppercase tracking-wider w-max mb-2">INTELLIGENCE PLATFORM</span>
                    <h3 className="text-xl font-bold text-white tracking-tight">DANSCOM Command Suite</h3>
                    <p className="text-xs text-slate-300 mt-1">Multi-device automation running securely on 3000</p>
                  </div>
                </div>
                <div className="flex-1 p-8 md:p-10 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6">WhatsApp Interactive Commands list</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-slate-400">📱 USER & CHAT UTILITIES</p>
                        <ul className="text-xs text-slate-600 space-y-2">
                          <li>• <strong className="text-slate-800">.menu</strong> or <strong className="text-slate-800">.help</strong> : Display all active commands</li>
                          <li>• <strong className="text-slate-800">.ping</strong> : Check socket response latency & status</li>
                          <li>• <strong className="text-slate-800">.ai [prompt]</strong> : Ask any question to Gemini AI</li>
                          <li>• <strong className="text-slate-800">.image [prompt]</strong> : Generate custom graphics</li>
                          <li>• <strong className="text-slate-800">.settings</strong> : View present chat automation switches</li>
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-slate-400">📥 MEDIA DOWNLOADERS</p>
                        <ul className="text-xs text-slate-600 space-y-2">
                          <li>• <strong className="text-slate-800">.video [url]</strong> : Download videos from YouTube</li>
                          <li>• <strong className="text-slate-800">.fb [url]</strong> : Scrape Facebook video links</li>
                          <li>• <strong className="text-slate-800">.ig [url]</strong> : Fetch Instagram feed media</li>
                          <li>• <strong className="text-slate-800">.tiktok [url]</strong> : Copy TikTok watermarked videos</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">⚡ TYPE ANY PREFIX (. / !) COMMAND IN WHATSAPP TO TEST</span>
                    <button 
                      onClick={() => setShowPairing(true)}
                      className="px-6 py-2.5 bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-2xl hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-50 flex items-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      View QR Code / Add Number
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'ai' ? (
            <div className="flex-1 flex flex-col gap-8">
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">AI Engine Configuration</h2>
                            <p className="text-sm text-slate-400 font-medium tracking-wide">Gemini Advanced Integration Settings</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Primary Model</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                                    <span className="font-bold text-slate-700">{aiConfig?.model || 'Gemini 1.5 Flash'}</span>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold">Stable</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">System Instruction</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                    <p className="text-sm text-slate-600 italic leading-relaxed">"{aiConfig?.instruction}"</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 rounded-[2rem] border border-blue-100 p-8">
                            <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-4">Active Capabilities</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {aiConfig?.capabilities.map((cap: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2 bg-white/50 border border-blue-100 p-3 rounded-xl">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        <span className="text-[10px] font-bold text-blue-800 uppercase">{cap}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          ) : activeTab === 'plugins' ? (
            <div className="flex-1">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Plugin Manager</h2>
                        <p className="text-sm text-slate-400">Manage {plugins.length} active command modules</p>
                    </div>
                    <button className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2">
                        <RefreshCw className="w-3 h-3" />
                        Reload Plugins
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {plugins.map((plugin, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                    <Puzzle className="w-5 h-5" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{plugin.category}</span>
                            </div>
                            <h3 className="text-sm font-black text-slate-800 uppercase mb-2 tracking-tight">{plugin.name}</h3>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">{plugin.desc}</p>
                            <div className="mt-6 flex items-center justify-between pt-6 border-t border-slate-50">
                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    Active
                                </span>
                                <Settings className="w-4 h-4 text-slate-200 hover:text-slate-400 cursor-pointer transition-colors" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
          ) : activeTab === 'sessions' ? (
            <div className="flex-grow flex flex-col gap-10 max-w-6xl mx-auto w-full pb-10">
              {/* Overview Header */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Multi-Account Dashboard</h2>
                  <p className="text-sm text-slate-400 font-medium tracking-wide">Configure, link, and run multiple WhatsApp instances on your server</p>
                </div>
                <div className="p-1 px-4 bg-emerald-50 border border-emerald-100 rounded-full flex items-center gap-2 self-start md:self-auto">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    {sessions.filter(s => s.connected).length} / {sessions.length} Active Bots
                  </span>
                </div>
              </div>

              {/* Account Creator & Active Inventory split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Account Creator Column */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Create New Bot</h3>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                      Deploy another parallel WhatsApp instance. Provide a simple lowercase key (no spaces / special characters).
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Bot Identifier</label>
                        <input 
                          type="text"
                          placeholder="e.g. work_bot"
                          value={newSessionName}
                          onChange={(e) => setNewSessionName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                        />
                      </div>

                      <button 
                        onClick={handleCreateSession}
                        disabled={!newSessionName.trim()}
                        className="w-full py-3.5 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Initialize Instance
                      </button>
                    </div>
                  </div>
                </div>

                {/* Grid list column */}
                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Deployed WhatsApp Bot Instances</h3>
                  
                  {sessions.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10 text-center">
                      <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="font-bold text-slate-500">No bot accounts found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {sessions.map((sess) => {
                        const isOriginal = sess.sessionId === 'default_bot';
                        return (
                          <div 
                            key={sess.sessionId} 
                            className={`bg-white rounded-[2rem] border shadow-sm p-6 flex flex-col justify-between transition-all hover:shadow-md ${
                              sess.connected ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-100'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                  isOriginal ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {isOriginal ? '🌐 Primary Bot' : '🤖 Sub-Account'}
                                </span>
                                
                                <span className={`w-2.5 h-2.5 rounded-full ${
                                  sess.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                                }`} />
                              </div>

                              <h4 className="text-base font-black text-slate-800 truncate uppercase mt-1">
                                {isOriginal ? 'DANSCOM BOT' : sess.sessionId}
                              </h4>
                              
                              {sess.connected ? (
                                <div className="mt-4 space-y-2">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Linked Account</p>
                                    <p className="text-xs font-bold text-slate-700">{sess.user?.name || 'WhatsApp Client'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Phone Number</p>
                                    <p className="text-xs font-semibold text-slate-700 font-mono tabular-nums">
                                      {sess.user?.id ? sess.user.id.split(':')[0] : 'Connected'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 font-semibold mt-4">
                                  Inactive/Disconnected account. Needs device linking authentication.
                                </p>
                              )}
                            </div>

                            <div className="mt-8 pt-4 border-t border-slate-50 flex items-center gap-3">
                              {sess.connected ? (
                                <>
                                  <button 
                                    onClick={() => {
                                      setPairingSessionId(sess.sessionId);
                                      handleRestart();
                                    }}
                                    className="flex-1 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-600 border border-slate-200 transition-colors"
                                  >
                                    Restart
                                  </button>
                                  {!isOriginal && (
                                    <button 
                                      onClick={() => handleDeleteSession(sess.sessionId)}
                                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-[10px] font-bold uppercase tracking-widest text-rose-500 border border-rose-100 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => {
                                      setPairingSessionId(sess.sessionId);
                                      setPhoneNumber('');
                                      setPairingError(null);
                                      setShowPairing(true);
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white transition-colors flex items-center justify-center gap-2"
                                  >
                                    <LinkIcon className="w-3.5 h-3.5" />
                                    Link Account
                                  </button>
                                  {!isOriginal && (
                                    <button 
                                      onClick={() => handleDeleteSession(sess.sessionId)}
                                      className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-[10px] font-bold uppercase tracking-widest text-rose-500 border border-rose-100 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'console' ? (
            <div className="flex-1 flex flex-col bg-slate-950 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl">
              <div className="bg-slate-900 px-8 py-6 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <Terminal className="w-6 h-6 text-emerald-500" />
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">System Output Stream</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Process ID: 8274 | Status: Live</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-8 font-mono text-sm text-emerald-400/90 leading-relaxed overflow-y-auto space-y-4 custom-scrollbar">
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">[12:04:22]</span> <span className="text-blue-400 font-bold">INFO:</span> <span className="text-slate-100">Initializing Baileys connection...</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">[12:04:25]</span> <span className="text-orange-400 font-bold">AUTH:</span> <span className="text-slate-100">Reloading session from Firebase Firestore.</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">[12:04:26]</span> <span className="text-emerald-400 font-bold">SUCCESS:</span> <span className="text-emerald-100">WhatsApp Authentication established as @danscom_bot.</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">[12:05:01]</span> <span className="text-purple-400 font-bold">STATUS:</span> <span className="text-slate-100">Automatically viewed 4 recent updates.</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">[12:08:12]</span> <span className="text-rose-400 font-bold">PREMIUM:</span> <span className="text-slate-100">Payment receipt verified for user 254... (KSH 5.00)</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">[12:10:44]</span> <span className="text-blue-400 font-bold">AI:</span> <span className="text-slate-100">Gemini processed input payload for ".gpt help"</span></p>
                <p className="flex gap-4"><span className="text-slate-600 shrink-0">[12:12:33]</span> <span className="text-slate-500 font-bold">STAY_ALIVE:</span> <span className="text-slate-400">Render keep-awake ping successful. Next in 14m.</span></p>
                <p className="animate-pulse text-emerald-500 font-bold text-lg">_</p>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
