import React from 'react';

const PlaceholderCard: React.FC<{ title: string; badge?: string }> = ({ title, badge = "Coming Soon" }) => (
  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 relative overflow-hidden group">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
      <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-tighter">
        {badge}
      </span>
    </div>
    <div className="space-y-3">
      <div className="h-4 w-3/4 bg-[#1a1a1a] rounded animate-pulse" />
      <div className="h-4 w-1/2 bg-[#1a1a1a] rounded animate-pulse opacity-50" />
      <div className="h-20 w-full border border-dashed border-[#1a1a1a] rounded-lg flex items-center justify-center">
        <span className="text-[10px] text-gray-600 font-mono italic">awaiting_data_stream...</span>
      </div>
    </div>
  </div>
);

const Placeholders: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-[#050505]">
      <PlaceholderCard title="Order Book" badge="On-Demand" />
      <PlaceholderCard title="7D Performance" />
      <PlaceholderCard title="Whale Alerts" badge="Live Stream" />
      <PlaceholderCard title="Backtest Engine" badge="Premium" />
    </div>
  );
};

export default Placeholders;
