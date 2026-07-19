import React from "react";

export const Header: React.FC = () => {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="text-lg font-bold bg-gradient-to-r from-rose-500 via-purple-500 to-violet-500 bg-clip-text text-transparent tracking-tight">
        YTD Premium
      </div>
      <div className="bg-violet-500/10 text-violet-300 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-violet-500/20 tracking-wider uppercase">
        Local-First
      </div>
    </div>
  );
};
