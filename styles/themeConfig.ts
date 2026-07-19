export type ThemeId = "glassmorphism" | "neobrutalism" | "material" | "default";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  // Container & Surfaces
  container: string;
  card: string;
  cardHeader: string;
  input: string;
  badge: string;
  // Navigation & Tabs
  navContainer: string;
  navTabActive: string;
  navTabInactive: string;
  subTabActive: string;
  subTabInactive: string;
  // Buttons & Controls
  primaryBtn: string;
  secondaryBtn: string;
  dangerBtn: string;
  // Accent colors
  accentText: string;
  mutedText: string;
  border: string;
  // Special features
  shadow: string;
  radius: string;
}

export const themes: Record<ThemeId, ThemeConfig> = {
  glassmorphism: {
    id: "glassmorphism",
    name: "Glassmorphism",
    description: "Translucent glass with soft blur and neon glow accents",
    container: "bg-slate-950/90 text-slate-100 backdrop-blur-xl border border-white/10",
    card: "bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-lg shadow-purple-950/20",
    cardHeader: "bg-white/[0.06] backdrop-blur-md border-b border-white/10",
    input: "bg-black/30 backdrop-blur-md border border-white/15 text-slate-100 placeholder-slate-400 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20",
    badge: "bg-violet-500/15 text-violet-300 border border-violet-400/30",
    navContainer: "bg-black/40 backdrop-blur-md p-1 border border-white/10 rounded-2xl",
    navTabActive: "bg-gradient-to-r from-violet-600/60 to-purple-600/60 text-white border border-violet-400/40 shadow-md shadow-violet-900/30",
    navTabInactive: "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent",
    subTabActive: "bg-violet-500/20 text-violet-300 border border-violet-400/40",
    subTabInactive: "bg-white/[0.03] text-slate-400 border border-white/5 hover:text-slate-200",
    primaryBtn: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-violet-900/40 border border-violet-400/30 active:scale-[0.98]",
    secondaryBtn: "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 active:scale-[0.98]",
    dangerBtn: "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 active:scale-[0.98]",
    accentText: "text-violet-400",
    mutedText: "text-slate-400",
    border: "border-white/10",
    shadow: "shadow-xl",
    radius: "rounded-2xl"
  },
  neobrutalism: {
    id: "neobrutalism",
    name: "Neobrutalism",
    description: "Bold black borders, hard offset shadows, high contrast pop style",
    container: "bg-[#fffbeb] text-zinc-900 border-4 border-black font-sans",
    card: "bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    cardHeader: "bg-[#fef08a] border-b-2 border-black",
    input: "bg-white border-2 border-black text-zinc-900 placeholder-zinc-500 focus:bg-[#fef08a] focus:outline-none font-bold",
    badge: "bg-[#f472b6] text-black font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
    navContainer: "bg-[#fde047] p-1.5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-xl",
    navTabActive: "bg-[#38bdf8] text-black font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
    navTabInactive: "bg-white text-zinc-800 font-bold border border-black hover:bg-zinc-100",
    subTabActive: "bg-[#a855f7] text-white font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
    subTabInactive: "bg-white text-zinc-800 font-bold border border-black hover:bg-zinc-100",
    primaryBtn: "bg-[#4ade80] hover:bg-[#22c55e] text-black font-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
    secondaryBtn: "bg-white hover:bg-zinc-100 text-black font-bold border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
    dangerBtn: "bg-[#ff7676] hover:bg-[#f87171] text-black font-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
    accentText: "text-purple-700 font-black",
    mutedText: "text-zinc-700 font-medium",
    border: "border-black",
    shadow: "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    radius: "rounded-xl"
  },
  material: {
    id: "material",
    name: "Material Theme",
    description: "Google Material Design 3 style with rounded surfaces and elevation",
    container: "bg-[#1d1b20] text-[#e6e1e5]",
    card: "bg-[#2b2930] rounded-3xl border border-[#49454f]/40 shadow-md",
    cardHeader: "bg-[#36343b] rounded-t-3xl border-b border-[#49454f]/30",
    input: "bg-[#36343b] border border-[#79747e] rounded-2xl text-[#e6e1e5] placeholder-[#938f96] focus:border-[#d0bcff] focus:ring-2 focus:ring-[#d0bcff]/20",
    badge: "bg-[#4a4458] text-[#e8def8] rounded-full px-3 py-0.5 text-xs font-semibold",
    navContainer: "bg-[#2b2930] p-1.5 rounded-full border border-[#49454f]/30",
    navTabActive: "bg-[#d0bcff] text-[#381e72] font-bold rounded-full shadow-sm",
    navTabInactive: "text-[#cac4d0] hover:text-[#e6e1e5] hover:bg-[#36343b] rounded-full",
    subTabActive: "bg-[#4a4458] text-[#e8def8] rounded-2xl font-semibold border border-[#d0bcff]/30",
    subTabInactive: "bg-[#36343b] text-[#cac4d0] rounded-2xl border border-transparent hover:text-white",
    primaryBtn: "bg-[#d0bcff] hover:bg-[#e8def8] text-[#381e72] font-bold rounded-full shadow-md active:scale-95",
    secondaryBtn: "bg-[#4a4458] hover:bg-[#605a70] text-[#e8def8] font-medium rounded-full active:scale-95",
    dangerBtn: "bg-[#f2b8b5] hover:bg-[#f9dedc] text-[#601410] font-bold rounded-full active:scale-95",
    accentText: "text-[#d0bcff]",
    mutedText: "text-[#938f96]",
    border: "border-[#49454f]/50",
    shadow: "shadow-md",
    radius: "rounded-3xl"
  },
  default: {
    id: "default",
    name: "Default Dark",
    description: "Sleek, modern dark mode with subtle zinc tones",
    container: "bg-zinc-950 text-zinc-100",
    card: "bg-zinc-900/90 border border-zinc-800 shadow-md",
    cardHeader: "bg-zinc-900 border-b border-zinc-800",
    input: "bg-zinc-900 border border-zinc-700/60 text-zinc-100 placeholder-zinc-500 focus:border-violet-500/50",
    badge: "bg-violet-500/10 text-violet-300 border border-violet-500/20",
    navContainer: "bg-zinc-900/60 p-1 border border-zinc-800 rounded-xl",
    navTabActive: "bg-zinc-800 text-violet-300 border border-violet-500/30 shadow-sm",
    navTabInactive: "text-zinc-400 border border-transparent hover:text-zinc-200",
    subTabActive: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
    subTabInactive: "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200",
    primaryBtn: "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium shadow-md active:scale-95",
    secondaryBtn: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 active:scale-95",
    dangerBtn: "bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 active:scale-95",
    accentText: "text-violet-400",
    mutedText: "text-zinc-400",
    border: "border-zinc-800",
    shadow: "shadow-md",
    radius: "rounded-xl"
  }
};

export function getThemeConfig(themeId: ThemeId | string | undefined): ThemeConfig {
  if (themeId && themeId in themes) {
    return themes[themeId as ThemeId];
  }
  return themes.glassmorphism;
}
