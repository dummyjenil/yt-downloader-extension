export type ThemeId =
  | "glassmorphism"
  | "neobrutalism"
  | "material"
  | "default"
  | "cyberpunk"
  | "nordic"
  | "emerald"
  | "sunset"
  | "dracula"
  | "retro"
  | "terminal"
  | "synthwave"
  | "claymorphism"
  | "parchment"
  | "oled"
  | "win95";

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
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    description: "Futuristic dark synthwave with glowing cyan and neon pink accents",
    container: "bg-slate-950 text-cyan-100",
    card: "bg-slate-900/90 border border-cyan-500/40 shadow-lg shadow-cyan-950/40",
    cardHeader: "bg-slate-950 border-b border-cyan-500/30",
    input: "bg-black/80 border border-cyan-500/50 text-cyan-200 placeholder-cyan-700 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30",
    badge: "bg-pink-500/20 text-pink-300 border border-pink-500/40",
    navContainer: "bg-slate-950 p-1 border border-cyan-500/30 rounded-xl",
    navTabActive: "bg-gradient-to-r from-cyan-600 to-pink-600 text-white font-bold border border-pink-400/40 shadow-md shadow-pink-950/50",
    navTabInactive: "text-cyan-400/70 hover:text-cyan-200 hover:bg-cyan-950/40 border border-transparent",
    subTabActive: "bg-pink-500/20 text-pink-300 border border-pink-500/40 font-semibold",
    subTabInactive: "bg-slate-900 text-cyan-400/60 border border-cyan-900/40 hover:text-cyan-200",
    primaryBtn: "bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-slate-950 font-extrabold shadow-lg shadow-cyan-900/40 active:scale-95 transition-all",
    secondaryBtn: "bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 active:scale-95",
    dangerBtn: "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/50 active:scale-95",
    accentText: "text-cyan-400",
    mutedText: "text-cyan-600/80",
    border: "border-cyan-500/30",
    shadow: "shadow-xl shadow-cyan-950/30",
    radius: "rounded-xl"
  },
  nordic: {
    id: "nordic",
    name: "Nordic Ice",
    description: "Cool Arctic slate palette with crisp ice blue & frost highlights",
    container: "bg-[#0f172a] text-slate-100",
    card: "bg-[#1e293b] border border-slate-700/60 shadow-lg",
    cardHeader: "bg-[#141e30] border-b border-slate-700/60",
    input: "bg-[#0f172a] border border-sky-600/40 text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20",
    badge: "bg-sky-500/15 text-sky-300 border border-sky-400/30",
    navContainer: "bg-[#0f172a]/80 p-1 border border-slate-700/80 rounded-xl",
    navTabActive: "bg-sky-600 text-white font-bold border border-sky-400/40 shadow-sm",
    navTabInactive: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent",
    subTabActive: "bg-sky-500/20 text-sky-300 border border-sky-400/30 font-semibold",
    subTabInactive: "bg-[#1e293b] text-slate-400 border border-slate-700 hover:text-slate-200",
    primaryBtn: "bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-slate-950 font-bold shadow-md shadow-sky-950/40 active:scale-95",
    secondaryBtn: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 active:scale-95",
    dangerBtn: "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 active:scale-95",
    accentText: "text-sky-400",
    mutedText: "text-slate-400",
    border: "border-slate-700/60",
    shadow: "shadow-lg",
    radius: "rounded-xl"
  },
  emerald: {
    id: "emerald",
    name: "Emerald Matrix",
    description: "Deep midnight green theme with luminous jade accents",
    container: "bg-[#041d1a] text-emerald-100",
    card: "bg-[#0a2e2a]/90 border border-emerald-500/30 shadow-md shadow-emerald-950/50",
    cardHeader: "bg-[#062420] border-b border-emerald-500/30",
    input: "bg-[#021311] border border-emerald-600/40 text-emerald-100 placeholder-emerald-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20",
    badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40",
    navContainer: "bg-[#021311]/80 p-1 border border-emerald-500/30 rounded-xl",
    navTabActive: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold border border-emerald-400/40 shadow-sm",
    navTabInactive: "text-emerald-400/70 hover:text-emerald-200 hover:bg-emerald-900/30 border border-transparent",
    subTabActive: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold",
    subTabInactive: "bg-[#0a2e2a] text-emerald-400/60 border border-emerald-900/50 hover:text-emerald-200",
    primaryBtn: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-md shadow-emerald-950/60 active:scale-95",
    secondaryBtn: "bg-[#0d3b36] hover:bg-[#124d47] text-emerald-200 border border-emerald-500/30 active:scale-95",
    dangerBtn: "bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40 active:scale-95",
    accentText: "text-emerald-400",
    mutedText: "text-emerald-600/90",
    border: "border-emerald-500/30",
    shadow: "shadow-md",
    radius: "rounded-xl"
  },
  sunset: {
    id: "sunset",
    name: "Sunset Horizon",
    description: "Warm twilight theme with amber glow, warm coral, and deep violet",
    container: "bg-[#180e29] text-amber-50",
    card: "bg-[#25153e]/90 border border-amber-500/20 shadow-md shadow-purple-950/40",
    cardHeader: "bg-[#1d0f33] border-b border-amber-500/20",
    input: "bg-[#120a20] border border-amber-500/30 text-amber-100 placeholder-amber-700/60 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20",
    badge: "bg-amber-500/20 text-amber-300 border border-amber-400/30",
    navContainer: "bg-[#120a20]/80 p-1 border border-amber-500/20 rounded-xl",
    navTabActive: "bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-extrabold border border-amber-300/40 shadow-sm",
    navTabInactive: "text-amber-200/60 hover:text-amber-100 hover:bg-purple-900/30 border border-transparent",
    subTabActive: "bg-amber-500/20 text-amber-300 border border-amber-400/30 font-semibold",
    subTabInactive: "bg-[#25153e] text-amber-200/60 border border-purple-900/40 hover:text-amber-100",
    primaryBtn: "bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-extrabold shadow-md shadow-amber-950/40 active:scale-95",
    secondaryBtn: "bg-[#331d54] hover:bg-[#41256b] text-amber-100 border border-amber-500/20 active:scale-95",
    dangerBtn: "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 active:scale-95",
    accentText: "text-amber-400",
    mutedText: "text-purple-300/60",
    border: "border-amber-500/20",
    shadow: "shadow-md",
    radius: "rounded-xl"
  },
  dracula: {
    id: "dracula",
    name: "Dracula Night",
    description: "Goth dark palette featuring rich purple, pink, and mint highlights",
    container: "bg-[#282a36] text-[#f8f8f2]",
    card: "bg-[#44475a]/70 border border-[#6272a4]/50 shadow-md",
    cardHeader: "bg-[#343746] border-b border-[#6272a4]/40",
    input: "bg-[#21222c] border border-[#6272a4] text-[#f8f8f2] placeholder-[#6272a4] focus:border-[#bd93f9] focus:ring-2 focus:ring-[#bd93f9]/20",
    badge: "bg-[#ff79c6]/20 text-[#ff79c6] border border-[#ff79c6]/40",
    navContainer: "bg-[#21222c] p-1 border border-[#6272a4]/40 rounded-xl",
    navTabActive: "bg-[#bd93f9] text-[#282a36] font-extrabold shadow-sm",
    navTabInactive: "text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a]/50 border border-transparent",
    subTabActive: "bg-[#ff79c6]/20 text-[#ff79c6] border border-[#ff79c6]/40 font-semibold",
    subTabInactive: "bg-[#343746] text-[#6272a4] border border-transparent hover:text-[#f8f8f2]",
    primaryBtn: "bg-[#ff79c6] hover:bg-[#ff92d0] text-[#282a36] font-extrabold shadow-md active:scale-95",
    secondaryBtn: "bg-[#6272a4] hover:bg-[#7384b7] text-[#f8f8f2] font-semibold active:scale-95",
    dangerBtn: "bg-[#ff5555]/20 hover:bg-[#ff5555]/30 text-[#ff5555] border border-[#ff5555]/40 active:scale-95",
    accentText: "text-[#bd93f9]",
    mutedText: "text-[#6272a4]",
    border: "border-[#6272a4]/40",
    shadow: "shadow-md",
    radius: "rounded-xl"
  },
  retro: {
    id: "retro",
    name: "Retro Light",
    description: "Clean high-contrast light theme with indigo and slate tones",
    container: "bg-slate-100 text-slate-900",
    card: "bg-white border border-slate-200 shadow-sm",
    cardHeader: "bg-slate-50 border-b border-slate-200",
    input: "bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
    badge: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    navContainer: "bg-slate-200/80 p-1 border border-slate-300 rounded-xl",
    navTabActive: "bg-indigo-600 text-white font-bold shadow-sm",
    navTabInactive: "text-slate-600 hover:text-slate-900 hover:bg-slate-300/50 border border-transparent",
    subTabActive: "bg-indigo-100 text-indigo-800 border border-indigo-300 font-semibold",
    subTabInactive: "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900",
    primaryBtn: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm active:scale-95",
    secondaryBtn: "bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold active:scale-95 border border-slate-300",
    dangerBtn: "bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 active:scale-95",
    accentText: "text-indigo-600 font-bold",
    mutedText: "text-slate-500",
    border: "border-slate-200",
    shadow: "shadow-sm",
    radius: "rounded-xl"
  },
  terminal: {
    id: "terminal",
    name: "Hacker Terminal CLI",
    description: "Monospaced green phosphor CLI look with pure pitch black background",
    container: "bg-black text-emerald-400 font-mono tracking-tight",
    card: "bg-zinc-950 border-2 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.25)] rounded-none",
    cardHeader: "bg-emerald-950/40 border-b-2 border-emerald-500/60 font-mono",
    input: "bg-black border border-emerald-500 text-emerald-300 placeholder-emerald-800 font-mono focus:ring-1 focus:ring-emerald-400 focus:outline-none rounded-none",
    badge: "bg-emerald-950 text-emerald-300 border border-emerald-500 font-mono text-xs rounded-none",
    navContainer: "bg-black p-1 border border-emerald-500/60 rounded-none",
    navTabActive: "bg-emerald-500 text-black font-extrabold shadow-[0_0_8px_rgba(16,185,129,0.5)] rounded-none",
    navTabInactive: "text-emerald-600 hover:text-emerald-400 hover:bg-emerald-950/30 rounded-none",
    subTabActive: "bg-emerald-950 text-emerald-300 border border-emerald-400 font-bold rounded-none",
    subTabInactive: "bg-black text-emerald-700 border border-emerald-900 hover:text-emerald-400 rounded-none",
    primaryBtn: "bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold border border-emerald-300 active:scale-95 rounded-none transition-all",
    secondaryBtn: "bg-black hover:bg-zinc-900 text-emerald-400 border border-emerald-600 active:scale-95 rounded-none",
    dangerBtn: "bg-rose-950 text-rose-400 border border-rose-500 hover:bg-rose-900 active:scale-95 rounded-none",
    accentText: "text-emerald-400 font-bold",
    mutedText: "text-emerald-700 font-mono",
    border: "border-emerald-500/60",
    shadow: "shadow-[0_0_12px_rgba(16,185,129,0.25)]",
    radius: "rounded-none"
  },
  synthwave: {
    id: "synthwave",
    name: "80s Synthwave Vapor",
    description: "Outrun 80s arcade vibe with neon hot pink, cyan text, & purple horizon",
    container: "bg-[#0d0221] text-[#00f5d4] font-sans",
    card: "bg-[#190938] border-2 border-[#ff007f] shadow-[0_0_15px_rgba(255,0,127,0.3)] rounded-lg",
    cardHeader: "bg-[#260c52] border-b-2 border-[#7b2cbf]",
    input: "bg-[#0d0221] border-2 border-[#00f5d4] text-[#ffe600] placeholder-[#00f5d4]/40 focus:border-[#ff007f] rounded-lg",
    badge: "bg-[#ff007f]/20 text-[#ff007f] border border-[#ff007f] font-bold rounded-lg",
    navContainer: "bg-[#0d0221] p-1.5 border-2 border-[#7b2cbf] rounded-xl",
    navTabActive: "bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] text-white font-extrabold border border-[#ffe600] shadow-[0_0_12px_rgba(255,0,127,0.5)] rounded-lg",
    navTabInactive: "text-[#00f5d4] hover:text-white hover:bg-[#260c52] rounded-lg",
    subTabActive: "bg-[#ff007f]/20 text-[#ffe600] border border-[#ff007f] font-bold rounded-lg",
    subTabInactive: "bg-[#190938] text-[#00f5d4]/70 border border-[#7b2cbf]/50 hover:text-white rounded-lg",
    primaryBtn: "bg-gradient-to-r from-[#ffe600] via-[#ff007f] to-[#7b2cbf] text-white font-extrabold shadow-[0_0_15px_rgba(255,230,0,0.4)] active:scale-95 rounded-lg",
    secondaryBtn: "bg-[#260c52] hover:bg-[#391375] text-[#00f5d4] border border-[#00f5d4] rounded-lg",
    dangerBtn: "bg-[#ff0055] hover:bg-[#ff2a70] text-white font-bold border border-white rounded-lg",
    accentText: "text-[#ffe600] font-bold",
    mutedText: "text-[#00f5d4]/70",
    border: "border-[#7b2cbf]",
    shadow: "shadow-[0_0_15px_rgba(255,0,127,0.3)]",
    radius: "rounded-lg"
  },
  claymorphism: {
    id: "claymorphism",
    name: "Soft Claymorphism",
    description: "Puffy 3D soft lavender pastel aesthetic with pneumatic inner & outer shadows",
    container: "bg-[#e0e5ec] text-[#2d3748] font-sans",
    card: "bg-[#e0e5ec] border border-white/60 shadow-[9px_9px_16px_rgba(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.8)] rounded-3xl",
    cardHeader: "bg-[#e0e5ec] border-b border-[#cbd5e0] rounded-t-3xl",
    input: "bg-[#e0e5ec] border border-[#cbd5e0] text-[#2d3748] placeholder-[#a0aec0] shadow-[inset_4px_4px_8px_rgba(163,177,198,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.8)] focus:ring-2 focus:ring-[#667eea] rounded-2xl",
    badge: "bg-[#667eea]/15 text-[#5a67d8] font-bold rounded-full px-3 py-0.5",
    navContainer: "bg-[#e0e5ec] p-2 shadow-[inset_3px_3px_6px_rgba(163,177,198,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] rounded-full",
    navTabActive: "bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-bold shadow-[4px_4px_10px_rgba(102,126,234,0.4)] rounded-full",
    navTabInactive: "text-[#718096] hover:text-[#2d3748] rounded-full",
    subTabActive: "bg-[#667eea]/20 text-[#5a67d8] font-bold border border-[#667eea]/30 rounded-2xl",
    subTabInactive: "bg-[#e0e5ec] text-[#718096] border border-transparent hover:text-[#2d3748] rounded-2xl",
    primaryBtn: "bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a67d8] hover:to-[#6b46c1] text-white font-bold shadow-[6px_6px_12px_rgba(102,126,234,0.35),-6px_-6px_12px_rgba(255,255,255,0.8)] active:scale-95 rounded-2xl",
    secondaryBtn: "bg-[#e0e5ec] hover:bg-[#d5dcde] text-[#4a5568] font-semibold shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.8)] rounded-2xl",
    dangerBtn: "bg-[#feb2b2] hover:bg-[#fc8181] text-[#9b2c2c] font-bold shadow-[4px_4px_8px_rgba(254,178,178,0.6)] rounded-2xl",
    accentText: "text-[#5a67d8] font-extrabold",
    mutedText: "text-[#718096]",
    border: "border-[#cbd5e0]",
    shadow: "shadow-[9px_9px_16px_rgba(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.8)]",
    radius: "rounded-3xl"
  },
  parchment: {
    id: "parchment",
    name: "Antique Parchment",
    description: "Vintage journal/newspaper feel with warm ivory canvas & coffee brown serif type",
    container: "bg-[#f4ebd0] text-[#3d2314] font-serif",
    card: "bg-[#fffdf5] border-2 border-[#b89c72] shadow-md shadow-[#3d2314]/10 rounded-lg",
    cardHeader: "bg-[#ede0c4] border-b-2 border-[#b89c72]",
    input: "bg-[#fffdf5] border border-[#a68a5b] text-[#2c180b] placeholder-[#8c734b] focus:border-[#7c3a17] focus:ring-1 focus:ring-[#7c3a17] rounded-md",
    badge: "bg-[#8c4a27]/15 text-[#7c3a17] font-semibold border border-[#a65d34]/40 rounded-md",
    navContainer: "bg-[#ede0c4] p-1 border border-[#b89c72] rounded-lg",
    navTabActive: "bg-[#7c3a17] text-[#fffdf5] font-bold shadow-sm rounded-md",
    navTabInactive: "text-[#6b523b] hover:text-[#2c180b] hover:bg-[#e3d3b1] rounded-md",
    subTabActive: "bg-[#8c4a27]/20 text-[#7c3a17] font-bold border border-[#7c3a17]/40 rounded-md",
    subTabInactive: "bg-[#fffdf5] text-[#6b523b] border border-[#b89c72]/40 hover:text-[#2c180b] rounded-md",
    primaryBtn: "bg-[#7c3a17] hover:bg-[#632d10] text-[#fffdf5] font-bold shadow-md border border-[#54250c] active:scale-95 rounded-md",
    secondaryBtn: "bg-[#e3d3b1] hover:bg-[#d4c19c] text-[#3d2314] border border-[#a68a5b] rounded-md",
    dangerBtn: "bg-[#a83232] hover:bg-[#8f2828] text-white font-bold border border-[#781e1e] rounded-md",
    accentText: "text-[#8c4a27] font-bold",
    mutedText: "text-[#7d6752]",
    border: "border-[#b89c72]",
    shadow: "shadow-md shadow-[#3d2314]/10",
    radius: "rounded-lg"
  },
  oled: {
    id: "oled",
    name: "Pure OLED Pitch Black",
    description: "Ultra minimalist #000000 true black background for AMOLED high contrast efficiency",
    container: "bg-black text-white font-sans",
    card: "bg-black border border-zinc-800 shadow-none rounded-xl",
    cardHeader: "bg-zinc-950 border-b border-zinc-800",
    input: "bg-black border border-zinc-700 text-white placeholder-zinc-600 focus:border-white focus:ring-1 focus:ring-white rounded-lg",
    badge: "bg-zinc-900 text-white border border-zinc-700 font-mono text-xs rounded-full",
    navContainer: "bg-zinc-950 p-1 border border-zinc-800 rounded-xl",
    navTabActive: "bg-white text-black font-extrabold rounded-lg",
    navTabInactive: "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg",
    subTabActive: "bg-zinc-800 text-white font-bold border border-zinc-700 rounded-lg",
    subTabInactive: "bg-black text-zinc-500 border border-zinc-900 hover:text-white rounded-lg",
    primaryBtn: "bg-white hover:bg-zinc-200 text-black font-bold border border-white active:scale-95 rounded-lg",
    secondaryBtn: "bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 active:scale-95 rounded-lg",
    dangerBtn: "bg-rose-600 hover:bg-rose-500 text-white font-bold active:scale-95 rounded-lg",
    accentText: "text-white font-bold",
    mutedText: "text-zinc-500",
    border: "border-zinc-800",
    shadow: "shadow-none",
    radius: "rounded-xl"
  },
  win95: {
    id: "win95",
    name: "Classic Retro Windows 95",
    description: "Nostalgic 90s OS style with gray 3D bevelled borders & classic blue titlebars",
    container: "bg-[#008080] text-black font-sans",
    card: "bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-zinc-800 border-r-zinc-800 shadow-md rounded-none",
    cardHeader: "bg-[#000080] text-white font-bold p-1 border-b border-zinc-800 rounded-none",
    input: "bg-white border-2 border-t-zinc-800 border-l-zinc-800 border-b-white border-r-white text-black placeholder-zinc-500 font-mono rounded-none",
    badge: "bg-[#c0c0c0] text-black font-bold border-2 border-t-white border-l-white border-b-zinc-800 border-r-zinc-800 rounded-none",
    navContainer: "bg-[#c0c0c0] p-1 border-2 border-t-zinc-800 border-l-zinc-800 border-b-white border-r-white rounded-none",
    navTabActive: "bg-[#c0c0c0] text-black font-bold border-2 border-t-white border-l-white border-b-zinc-800 border-r-zinc-800 rounded-none",
    navTabInactive: "bg-[#c0c0c0] text-zinc-700 border border-zinc-500 hover:bg-zinc-300 rounded-none",
    subTabActive: "bg-[#000080] text-white font-bold border border-black rounded-none",
    subTabInactive: "bg-[#c0c0c0] text-zinc-800 border border-zinc-600 hover:bg-zinc-300 rounded-none",
    primaryBtn: "bg-[#c0c0c0] hover:bg-[#d4d4d4] text-black font-bold border-2 border-t-white border-l-white border-b-zinc-900 border-r-zinc-900 active:border-t-zinc-900 active:border-l-zinc-900 active:border-b-white active:border-r-white rounded-none",
    secondaryBtn: "bg-[#c0c0c0] hover:bg-[#d4d4d4] text-black font-semibold border-2 border-t-white border-l-white border-b-zinc-800 border-r-zinc-800 rounded-none",
    dangerBtn: "bg-[#c0c0c0] hover:bg-[#d4d4d4] text-rose-700 font-bold border-2 border-t-white border-l-white border-b-zinc-800 border-r-zinc-800 rounded-none",
    accentText: "text-[#000080] font-black",
    mutedText: "text-zinc-700",
    border: "border-zinc-800",
    shadow: "shadow-md",
    radius: "rounded-none"
  }
};

export function getThemeConfig(themeId: ThemeId | string | undefined): ThemeConfig {
  if (themeId && themeId in themes) {
    return themes[themeId as ThemeId];
  }
  return themes.glassmorphism;
}
