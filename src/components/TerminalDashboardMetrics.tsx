import React, { useMemo } from 'react';
import { Shield, Users, Activity, CheckCircle2 } from 'lucide-react';

interface Props {
  terminalId: string;
  sessions: any[];
  transactions: any[];
  commandLogs: any[];
}

const TerminalDashboardMetrics: React.FC<Props> = ({ terminalId, sessions, transactions, commandLogs }) => {
  const metrics = useMemo(() => {
    // 1. Successful Connections (based on session status)
    const successfulConnections = sessions.filter(s => s.terminalId === terminalId && s.connected).length;

    // 2. Active Subscribers (completed payments)
    const activeSubscribers = transactions.filter(t => t.terminalId === terminalId && t.status === 'completed').length;

    // 3. Terminal Commands (filtered by terminal-related activity if possible)
    // Assuming commandLogs entries have a 'sender' or 'terminalId' that can be matched.
    // For now, let's try to match by JID/sender if the log contains session info
    const terminalLogs = commandLogs.filter(log => log.terminalId === terminalId || log.sender?.includes(terminalId));
    
    return {
      successfulConnections,
      activeSubscribers,
      terminalCommands: terminalLogs.length,
    };
  }, [terminalId, sessions, transactions, commandLogs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 mt-4">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-emerald-900/30 rounded-xl text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Successful Connections</p>
          <p className="text-2xl font-black text-slate-100">{metrics.successfulConnections}</p>
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-900/30 rounded-xl text-blue-400">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Subscribers</p>
          <p className="text-2xl font-black text-slate-100">{metrics.activeSubscribers}</p>
        </div>
      </div>

       <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-indigo-900/30 rounded-xl text-indigo-400">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Commands Executed</p>
          <p className="text-2xl font-black text-slate-100">{metrics.terminalCommands}</p>
        </div>
      </div>
    </div>
  );
};

export default TerminalDashboardMetrics;
