import React, { useMemo } from 'react';
import { Shield, Users, Activity, CheckCircle2 } from 'lucide-react';

interface Props {
  terminalId: string;
  sessions: any[];
  transactions: any[];
}

const TerminalDashboardMetrics: React.FC<Props> = ({ terminalId, sessions, transactions }) => {
  const metrics = useMemo(() => {
    // 1. Successful Connections (based on session status)
    const successfulConnections = sessions.filter(s => s.terminalId === terminalId && s.connected).length;

    // 2. Active Subscribers (completed payments)
    const activeSubscribers = transactions.filter(t => t.terminalId === terminalId && t.status === 'completed').length;

    // 3. Lifetime Commands (aggregated global, as-is)
    // Note: Terminal-specific commands might not be tracked individually yet.
    return {
      successfulConnections,
      activeSubscribers,
    };
  }, [terminalId, sessions, transactions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 mt-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Successful Connections</p>
          <p className="text-2xl font-black text-slate-800">{metrics.successfulConnections}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Subscribers</p>
          <p className="text-2xl font-black text-slate-800">{metrics.activeSubscribers}</p>
        </div>
      </div>

       <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lifetime Commands</p>
          <p className="text-2xl font-black text-slate-800 italic text-slate-500 text-sm">System Wide</p>
        </div>
      </div>
    </div>
  );
};

export default TerminalDashboardMetrics;
