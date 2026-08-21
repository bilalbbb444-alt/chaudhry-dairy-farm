import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient.js";
import {
  Home, Droplet, ShoppingCart, Users, MoreHorizontal, Plus, AlertTriangle,
  ChevronRight, ChevronLeft, X, Check, TrendingUp, Package, Wallet, FileText,
  Settings as SettingsIcon, Bell, Search, ArrowLeft, Phone, MapPin, Calendar,
  Banknote, Truck, PawPrint, Printer, Share2, UserCog, Stethoscope, Pencil, Trash2,
  Download, Lock, Mail, Delete
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip
} from "recharts";

/* ---------------------------------------------------------------- */
/*  Design tokens                                                    */
/* ---------------------------------------------------------------- */
const C = {
  green: "#1F4D2C",
  greenDark: "#123018",
  greenLight: "#2F6B3E",
  greenPale: "#E7EFE5",
  cream: "#F6F1E2",
  creamDark: "#ECE2C6",
  white: "#FFFFFF",
  gray: "#6B7360",
  grayLight: "#9AA192",
  line: "#E1DAC4",
  warn: "#DB8A2C",
  danger: "#C74B3F",
  gold: "#C79A2E",
  text: "#20281F",
};

const LOGO_SRC = "/logo.jpg";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => "Rs. " + Math.round(n || 0).toLocaleString("en-US");
const fmtL = (n) => (Math.round((n || 0) * 10) / 10) + " L";
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
// Staggered entrance delay for list rows — capped so long lists don't feel sluggish.
const rowAnim = (i) => ({ className: "animate-row-in", style: { animationDelay: `${Math.min(i, 10) * 30}ms` } });

/* ---------------------------------------------------------------- */
/*  Supabase data layer                                              */
/* ---------------------------------------------------------------- */
const snakeToCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const camelToSnake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

function rowToCamel(row) {
  if (!row) return row;
  const out = {};
  for (const k of Object.keys(row)) {
    if (k === "farm_id" || k === "created_at") continue;
    out[snakeToCamel(k)] = row[k];
  }
  return out;
}
function payloadToSnake(obj) {
  const out = {};
  for (const k of Object.keys(obj)) out[camelToSnake(k)] = obj[k];
  return out;
}

// table name (app-side key) -> actual Supabase table name
const TABLES = {
  animals: "animals",
  milk: "milk_production",
  customers: "customers",
  sales: "milk_sales",
  custPayments: "customer_payments",
  inventory: "inventory",
  purchases: "purchases",
  expenses: "expenses",
  employees: "employees",
  salaryPayments: "salary_payments",
  closings: "daily_closings",
  health: "animal_health",
  vaccinations: "vaccinations",
  breeding: "breeding_records",
};

// Set once per session right after the user's farm membership is resolved.
// Every insert call below uses it, so components don't need farmId threaded
// through props everywhere — there is exactly one active farm per session.
let CURRENT_FARM_ID = null;

async function dbInsert(key, payload) {
  const { data, error } = await supabase
    .from(TABLES[key])
    .insert({ ...payloadToSnake(payload), farm_id: CURRENT_FARM_ID })
    .select()
    .single();
  if (error) throw error;
  return rowToCamel(data);
}
async function dbUpdate(key, id, payload) {
  const { data, error } = await supabase
    .from(TABLES[key])
    .update(payloadToSnake(payload))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToCamel(data);
}
async function dbDelete(key, id) {
  const { error } = await supabase.from(TABLES[key]).delete().eq("id", id);
  if (error) throw error;
}

function farmRowToSettings(farm) {
  return {
    farmName: farm.name,
    ownerName: farm.owner_name || "",
    phone: farm.phone || "",
    address: farm.address || "",
    city: farm.city || "",
    country: farm.country || "Pakistan",
    currency: farm.currency || "PKR",
    language: farm.language || "English",
    morningTime: farm.morning_time || "06:00",
    eveningTime: farm.evening_time || "17:00",
    defaultMilkPrice: farm.default_milk_price || 0,
    appLock: { enabled: !!farm.app_lock_enabled, pin: farm.app_lock_pin || "" },
    notifications: farm.notifications || { lowStock: true, paymentOverdue: true, vaccinationDue: true, salaryDue: true },
    inviteCode: farm.invite_code,
  };
}

async function fetchFarmData(farmId) {
  const [farm, animals, milk, customers, sales, custPayments, inventory, purchases, expenses, employees, salaryPayments, closings, health, vaccinations, breeding] =
    await Promise.all([
      supabase.from("farms").select("*").eq("id", farmId).single(),
      supabase.from("animals").select("*").eq("farm_id", farmId),
      supabase.from("milk_production").select("*").eq("farm_id", farmId),
      supabase.from("customers").select("*").eq("farm_id", farmId),
      supabase.from("milk_sales").select("*").eq("farm_id", farmId),
      supabase.from("customer_payments").select("*").eq("farm_id", farmId),
      supabase.from("inventory").select("*").eq("farm_id", farmId),
      supabase.from("purchases").select("*").eq("farm_id", farmId),
      supabase.from("expenses").select("*").eq("farm_id", farmId),
      supabase.from("employees").select("*").eq("farm_id", farmId),
      supabase.from("salary_payments").select("*").eq("farm_id", farmId),
      supabase.from("daily_closings").select("*").eq("farm_id", farmId),
      supabase.from("animal_health").select("*").eq("farm_id", farmId),
      supabase.from("vaccinations").select("*").eq("farm_id", farmId),
      supabase.from("breeding_records").select("*").eq("farm_id", farmId),
    ]);
  if (farm.error) throw farm.error;
  return {
    settings: farmRowToSettings(farm.data),
    animals: (animals.data || []).map(rowToCamel),
    milk: (milk.data || []).map(rowToCamel),
    customers: (customers.data || []).map(rowToCamel),
    sales: (sales.data || []).map(rowToCamel),
    custPayments: (custPayments.data || []).map(rowToCamel),
    inventory: (inventory.data || []).map(rowToCamel),
    purchases: (purchases.data || []).map(rowToCamel),
    expenses: (expenses.data || []).map(rowToCamel),
    employees: (employees.data || []).map(rowToCamel),
    salaryPayments: (salaryPayments.data || []).map(rowToCamel),
    closings: (closings.data || []).map(rowToCamel),
    health: (health.data || []).map(rowToCamel),
    vaccinations: (vaccinations.data || []).map(rowToCamel),
    breeding: (breeding.data || []).map(rowToCamel),
  };
}

/* ---------------------------------------------------------------- */
/*  Small building blocks                                            */
/* ---------------------------------------------------------------- */
function Logo({ size = 44 }) {
  return (
    <div
      className="rounded-full overflow-hidden shrink-0"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${C.gold}` }}
    >
      <img src={LOGO_SRC} alt="Chaudhry Dairy Farm" width={size} height={size} className="w-full h-full object-cover" />
    </div>
  );
}

// Signature loading motif: a drop falls, lands in the glass, the glass fills.
// Loops continuously — used everywhere the app is waiting on something.
function MilkLoader({ label, dark }) {
  const fg = dark ? "#FFFFFF" : C.green;
  const track = dark ? "rgba(255,255,255,0.25)" : C.line;
  return (
    <div className="flex flex-col items-center">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <g style={{ animation: "dropFall 1.6s cubic-bezier(0.55,0,1,0.45) infinite" }}>
          <path d="M28 4c3 5 6 9 6 13a6 6 0 1 1-12 0c0-4 3-8 6-13Z" fill={fg} opacity="0.9" />
        </g>
        <ellipse cx="28" cy="26" rx="7" ry="2.4" style={{ transformOrigin: "28px 26px", animation: "ripple 1.6s cubic-bezier(0.55,0,1,0.45) infinite" }} stroke={fg} strokeWidth="1.4" opacity="0.6" />
        <path d="M18 26h20l-2.5 22a3 3 0 0 1-3 2.7H23.5a3 3 0 0 1-3-2.7L18 26Z" stroke={track} strokeWidth="2" fill="none" />
        <clipPath id="glassClip"><path d="M18.6 27h18.8l-2.4 20.7a2 2 0 0 1-2 1.8H23a2 2 0 0 1-2-1.8L18.6 27Z" /></clipPath>
        <g clipPath="url(#glassClip)">
          <rect x="17" y="27" width="22" height="22" fill={fg} style={{ transformOrigin: "28px 49px", animation: "glassFill 1.6s cubic-bezier(0.55,0,1,0.45) infinite" }} />
        </g>
      </svg>
      {label && <p className="text-xs mt-2" style={{ color: dark ? "rgba(255,255,255,0.8)" : C.gray }}>{label}</p>}
    </div>
  );
}

function Skeleton({ className = "", style = {} }) {
  return <div className={"skeleton rounded-lg " + className} style={style} />;
}

function DashboardSkeleton() {
  return (
    <Screen>
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="w-[46px] h-[46px] rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[64px]" />)}
      </div>
      <Skeleton className="h-3 w-28 mb-2" />
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    </Screen>
  );
}

function PinLockScreen({ pin, onSuccess }) {
  const [entered, setEntered] = useState("");
  const [shake, setShake] = useState(false);

  const press = (d) => {
    if (entered.length >= 6) return;
    const next = entered + d;
    setEntered(next);
    if (next.length === pin.length) {
      if (next === pin) {
        setTimeout(() => onSuccess(), 120);
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setEntered(""); }, 500);
      }
    }
  };
  const backspace = () => setEntered((e) => e.slice(0, -1));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-body px-8" style={{ background: C.green }}>
      <style>{fontImport}</style>
      <Logo size={64} />
      <p className="font-display text-white text-lg font-bold mt-3">Enter PIN</p>
      <p className="text-white/70 text-xs mb-6">Chaudhry Dairy Farm is locked</p>
      <div className={"flex gap-3 mb-8" + (shake ? " animate-pulse" : "")}>
        {[...Array(pin.length)].map((_, i) => (
          <span key={i} className="w-3.5 h-3.5 rounded-full" style={{ background: i < entered.length ? C.gold : "rgba(255,255,255,0.3)" }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button key={n} onClick={() => press(n)} className="aspect-square rounded-full text-white text-xl font-semibold active:bg-white/10" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => press("0")} className="aspect-square rounded-full text-white text-xl font-semibold active:bg-white/10" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>0</button>
        <button onClick={backspace} className="aspect-square rounded-full flex items-center justify-center text-white active:bg-white/10">
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const submit = async () => {
    setErr(""); setInfo("");
    if (!email || password.length < 6) { setErr("Enter a valid email and a password of at least 6 characters."); return; }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Account created. If email confirmation is required, check your inbox, then sign in.");
        setMode("signin");
      }
    } catch (e) {
      setErr(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-body" style={{ background: C.cream }}>
      <style>{fontImport}</style>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <Logo size={80} />
        <h1 className="font-display text-2xl font-bold mt-4" style={{ color: C.text }}>Chaudhry Dairy Farm</h1>
        <p className="text-sm mb-8" style={{ color: C.gray }}>Dairy Farm Management System</p>

        <div className="w-full flex gap-2 mb-5">
          <button onClick={() => setMode("signin")} className="flex-1 rounded-xl py-2 text-sm font-semibold" style={mode === "signin" ? { background: C.green, color: C.white } : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }}>Sign In</button>
          <button onClick={() => setMode("signup")} className="flex-1 rounded-xl py-2 text-sm font-semibold" style={mode === "signup" ? { background: C.green, color: C.white } : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }}>Create Account</button>
        </div>

        <div className="w-full">
          <Field label="Email">
            <input type="email" className={inputCls} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" />
          </Field>
          <Field label="Password">
            <input type="password" className={inputCls} style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </Field>
        </div>

        {err && <p className="text-xs mb-3 w-full" style={{ color: C.danger }}>{err}</p>}
        {info && <p className="text-xs mb-3 w-full" style={{ color: C.green }}>{info}</p>}

        <Btn full onClick={submit} disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}</Btn>
      </div>
      <p className="text-center text-[11px] pb-6" style={{ color: C.grayLight }}>
        Your data is saved securely to your account and kept year over year.
      </p>
    </div>
  );
}

function FarmOnboarding({ userId, userEmail, onDone }) {
  const [mode, setMode] = useState("create"); // create | join
  const [farmName, setFarmName] = useState("Chaudhry Dairy Farm");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const createFarm = async () => {
    setErr("");
    if (!farmName) { setErr("Enter a farm name."); return; }
    setBusy(true);
    try {
      const { data: farm, error: farmErr } = await supabase
        .from("farms")
        .insert({ name: farmName, owner_name: ownerName, phone, city })
        .select()
        .single();
      if (farmErr) throw farmErr;
      const { error: memberErr } = await supabase
        .from("farm_members")
        .insert({ farm_id: farm.id, user_id: userId, email: userEmail, role: "Owner" });
      if (memberErr) throw memberErr;
      onDone({ farmId: farm.id, role: "Owner" });
    } catch (e) {
      setErr(e.message || "Could not create the farm.");
    } finally {
      setBusy(false);
    }
  };

  const joinFarm = async () => {
    setErr("");
    if (!inviteCode) { setErr("Enter the invite code your farm owner shared with you."); return; }
    setBusy(true);
    try {
      const { data: farm, error: farmErr } = await supabase
        .from("farms")
        .select("id")
        .eq("invite_code", inviteCode.trim())
        .single();
      if (farmErr || !farm) throw new Error("Invite code not found. Check it and try again.");
      const { error: memberErr } = await supabase
        .from("farm_members")
        .insert({ farm_id: farm.id, user_id: userId, email: userEmail, role: "Employee" });
      if (memberErr) throw memberErr;
      onDone({ farmId: farm.id, role: "Employee" });
    } catch (e) {
      setErr(e.message || "Could not join that farm.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-body" style={{ background: C.cream }}>
      <style>{fontImport}</style>
      <Screen>
        <div className="flex flex-col items-center pt-8 mb-6">
          <Logo size={64} />
          <h1 className="font-display text-xl font-bold mt-3" style={{ color: C.text }}>Set Up Your Farm</h1>
          <p className="text-xs text-center mt-1" style={{ color: C.gray }}>Create a new farm, or join one using an invite code from your owner.</p>
        </div>

        <div className="flex gap-2 mb-5">
          <button onClick={() => setMode("create")} className="flex-1 rounded-xl py-2 text-sm font-semibold" style={mode === "create" ? { background: C.green, color: C.white } : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }}>Create New Farm</button>
          <button onClick={() => setMode("join")} className="flex-1 rounded-xl py-2 text-sm font-semibold" style={mode === "join" ? { background: C.green, color: C.white } : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }}>Join Existing Farm</button>
        </div>

        {mode === "create" ? (
          <Card>
            <Field label="Farm Name"><input className={inputCls} style={inputStyle} value={farmName} onChange={(e) => setFarmName(e.target.value)} /></Field>
            <Field label="Owner Name"><input className={inputCls} style={inputStyle} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></Field>
            <Field label="Phone"><input className={inputCls} style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="City"><input className={inputCls} style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            {err && <p className="text-xs mb-3" style={{ color: C.danger }}>{err}</p>}
            <Btn full onClick={createFarm} disabled={busy}>{busy ? "Creating…" : "Create Farm"}</Btn>
          </Card>
        ) : (
          <Card>
            <Field label="Invite Code"><input className={inputCls} style={inputStyle} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="e.g. a1b2c3d4" /></Field>
            <p className="text-[11px] mb-3" style={{ color: C.gray }}>Ask the farm owner for this code in Settings &rarr; Team.</p>
            {err && <p className="text-xs mb-3" style={{ color: C.danger }}>{err}</p>}
            <Btn full onClick={joinFarm} disabled={busy}>{busy ? "Joining…" : "Join Farm"}</Btn>
          </Card>
        )}
      </Screen>
    </div>
  );
}

function Screen({ children }) {
  return <div className="px-4 pt-4 pb-28 max-w-md mx-auto animate-screen-in">{children}</div>;
}

function TopBar({ title, subtitle, onBack, right }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {onBack && (
        <button onClick={onBack} className="p-2 -ml-2 rounded-full tap active:bg-black/5">
          <ArrowLeft size={20} color={C.green} />
        </button>
      )}
      <div className="flex-1">
        <h1 className="font-display text-xl font-semibold leading-tight" style={{ color: C.text }}>{title}</h1>
        {subtitle && <p className="text-xs" style={{ color: C.gray }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={"rounded-2xl bg-white p-4 shadow-sm press " + className}
      style={{ border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(31,77,44,0.05), 0 1px 1px rgba(31,77,44,0.03)", ...style }}
    >
      {children}
    </div>
  );
}

function Badge({ children, tone = "green" }) {
  const tones = {
    green: { bg: C.greenPale, fg: C.green },
    warn: { bg: "#FBEBD6", fg: C.warn },
    danger: { bg: "#F6DEDB", fg: C.danger },
    gray: { bg: "#EFEFE9", fg: C.gray },
  };
  const t = tones[tone] || tones.gray;
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

function StatCard({ icon, label, value, tone = "green" }) {
  const tones = { green: C.green, warn: C.warn, danger: C.danger, gray: C.gray };
  return (
    <div
      className="rounded-2xl bg-white p-3 relative overflow-hidden press"
      style={{ border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(31,77,44,0.05), 0 1px 1px rgba(31,77,44,0.03)" }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: tones[tone] }} />
      <div className="pl-2">
        <div className="flex items-center gap-1.5 mb-1" style={{ color: C.gray }}>
          {icon}
          <span className="text-[11px] font-medium">{label}</span>
        </div>
        <div className="font-display text-lg font-bold" style={{ color: C.text }}>{value}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-medium mb-1 block" style={{ color: C.gray }}>{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm outline-none bg-white transition-shadow duration-150 focus:ring-2";
const inputStyle = { border: `1px solid ${C.line}`, color: C.text, "--tw-ring-color": "rgba(31,77,44,0.18)" };

function Btn({ children, onClick, variant = "primary", full, className = "", type = "button", disabled }) {
  const base = "rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 tap";
  const styles = {
    primary: { background: C.green, color: C.white, boxShadow: "0 2px 6px rgba(31,77,44,0.25)" },
    outline: { background: "transparent", color: C.green, border: `1.5px solid ${C.green}` },
    danger: { background: C.danger, color: C.white, boxShadow: "0 2px 6px rgba(199,75,63,0.25)" },
    ghost: { background: C.greenPale, color: C.green },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={base + (full ? " w-full" : "") + className + (disabled ? " opacity-50" : "")}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

function Sheet({ title, onClose, children, footer }) {
  const [closing, setClosing] = useState(false);
  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={closing ? "" : "animate-backdrop-in"}
        style={{ position: "absolute", inset: 0, background: "rgba(18,48,24,0.45)", opacity: closing ? 0 : undefined, transition: closing ? "opacity 0.18s ease" : undefined }}
        onClick={handleClose}
      />
      <div
        className={"relative w-full max-w-md bg-white rounded-t-3xl max-h-[88vh] flex flex-col " + (closing ? "" : "animate-sheet-up")}
        style={{ transform: closing ? "translateY(100%)" : undefined, opacity: closing ? 0 : undefined, transition: closing ? "transform 0.18s ease, opacity 0.18s ease" : undefined }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: C.line }} />
        </div>
        <div className="flex items-center justify-between px-5 pt-1 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <h2 className="font-display text-lg font-semibold" style={{ color: C.text }}>{title}</h2>
          <button onClick={handleClose} className="p-1 rounded-full tap active:bg-black/5">
            <X size={20} color={C.gray} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>{footer}</div>}
      </div>
    </div>
  );
}

function Empty({ icon, title, note, actionLabel, onAction }) {
  return (
    <div className="text-center py-12 animate-row-in">
      <div className="mx-auto mb-3 w-14 h-14 rounded-full flex items-center justify-center" style={{ background: C.greenPale }}>
        {icon}
      </div>
      <p className="font-display font-semibold text-base" style={{ color: C.text }}>{title}</p>
      <p className="text-xs mt-1 mb-4" style={{ color: C.gray }}>{note}</p>
      {actionLabel && (
        <Btn variant="ghost" onClick={onAction}><Plus size={16} /> {actionLabel}</Btn>
      )}
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-full tap active:bg-black/5"
          aria-label="Edit"
        >
          <Pencil size={14} color={C.gray} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("Delete this entry? This cannot be undone.")) onDelete();
          }}
          className="p-1.5 rounded-full tap active:bg-black/5"
          aria-label="Delete"
        >
          <Trash2 size={14} color={C.danger} />
        </button>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 bg-white" style={{ border: `1px solid ${C.line}` }}>
      <Search size={16} color={C.gray} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm outline-none bg-transparent"
        style={{ color: C.text }}
      />
    </div>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
          style={
            value === o
              ? { background: C.green, color: C.white }
              : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }
          }
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  App                                                               */
/* ---------------------------------------------------------------- */
export default function ChaudhryDairyFarm() {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null); // { farmId, role }
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [data, setData] = useState(null);
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [moreScreen, setMoreScreen] = useState(null);
  const [custId, setCustId] = useState(null);
  const [animalId, setAnimalId] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  // ---- PWA install prompt capture (Android/desktop Chrome) ----
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ---- Auth session ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setMembership(null);
        setData(null);
        setRole(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- Farm membership lookup once signed in ----
  useEffect(() => {
    if (!session) return;
    (async () => {
      setMembershipLoading(true);
      const { data: rows } = await supabase
        .from("farm_members")
        .select("farm_id, role")
        .eq("user_id", session.user.id)
        .limit(1);
      if (rows && rows[0]) {
        CURRENT_FARM_ID = rows[0].farm_id;
        setMembership({ farmId: rows[0].farm_id, role: rows[0].role });
        setRole(rows[0].role);
      }
      setMembershipLoading(false);
    })();
  }, [session]);

  // ---- Load farm data once membership is known ----
  useEffect(() => {
    if (!membership) return;
    (async () => {
      try {
        const farmData = await fetchFarmData(membership.farmId);
        setData(farmData);
      } catch (e) {
        setToast("Could not load farm data. Please refresh.");
      }
    })();
  }, [membership]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg) => setToast(msg);

  const refreshFarm = async () => {
    if (!membership) return;
    const farmData = await fetchFarmData(membership.farmId);
    setData(farmData);
  };

  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: C.green }}>
        <style>{fontImport}</style>
        <Logo size={72} />
        <p className="font-display text-white text-xl font-bold mt-4">Chaudhry Dairy Farm</p>
        <p className="text-white/70 text-xs mt-1 mb-6">Dairy Farm Management System</p>
        <MilkLoader dark />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (membershipLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: C.green }}>
        <style>{fontImport}</style>
        <MilkLoader dark label="Loading your farm…" />
      </div>
    );
  }

  if (!membership) {
    return <FarmOnboarding userId={session.user.id} userEmail={session.user.email} onDone={(m) => { setMembership(m); setRole(m.role); }} />;
  }

  if (!data) {
    return (
      <div className="min-h-screen font-body animate-screen-in" style={{ background: C.cream }}>
        <style>{fontImport}</style>
        <DashboardSkeleton />
      </div>
    );
  }

  const needsLock = !!(data.settings.appLock && data.settings.appLock.enabled);

  if (needsLock && !unlocked) {
    return <PinLockScreen pin={data.settings.appLock.pin} onSuccess={() => setUnlocked(true)} />;
  }

  const update = (key, updater) => setData((d) => ({ ...d, [key]: updater(d[key]) }));
  const set = (patch) => setData((d) => ({ ...d, ...patch }));

  const goMore = (s) => { setMoreScreen(s); setTab("more"); };

  const farmId = membership.farmId;
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen font-body" style={{ background: C.cream }}>
      <style>{fontImport}</style>

      {tab === "dashboard" && (
        <Dashboard data={data} role={role} setModal={setModal} goMore={goMore} />
      )}
      {tab === "milk" && <MilkScreen data={data} update={update} notify={notify} />}
      {tab === "sales" && <SalesScreen data={data} setData={setData} notify={notify} setModal={setModal} />}
      {tab === "customers" && !custId && (
        <CustomersScreen data={data} setData={setData} onOpen={setCustId} setModal={setModal} notify={notify} />
      )}
      {tab === "customers" && custId && (
        <CustomerProfile data={data} setData={setData} custId={custId} onBack={() => setCustId(null)} notify={notify} />
      )}
      {tab === "more" && !moreScreen && <MoreMenu role={role} onOpen={setMoreScreen} />}
      {tab === "more" && moreScreen === "animals" && !animalId && (
        <AnimalsScreen data={data} setData={setData} onBack={() => setMoreScreen(null)} onOpen={setAnimalId} notify={notify} />
      )}
      {tab === "more" && moreScreen === "animals" && animalId && (
        <AnimalProfile data={data} setData={setData} animalId={animalId} onBack={() => setAnimalId(null)} notify={notify} />
      )}
      {tab === "more" && moreScreen === "inventory" && (
        <InventoryScreen data={data} setData={setData} onBack={() => setMoreScreen(null)} notify={notify} />
      )}
      {tab === "more" && moreScreen === "purchases" && (
        <PurchasesScreen data={data} setData={setData} onBack={() => setMoreScreen(null)} notify={notify} />
      )}
      {tab === "more" && moreScreen === "expenses" && (
        <ExpensesScreen data={data} setData={setData} onBack={() => setMoreScreen(null)} notify={notify} />
      )}
      {tab === "more" && moreScreen === "employees" && (
        <EmployeesScreen data={data} setData={setData} onBack={() => setMoreScreen(null)} notify={notify} />
      )}
      {tab === "more" && moreScreen === "reports" && (
        <ReportsScreen data={data} setData={setData} onBack={() => setMoreScreen(null)} notify={notify} />
      )}
      {tab === "more" && moreScreen === "settings" && (
        <SettingsScreen data={data} setData={setData} role={role} onBack={() => setMoreScreen(null)} onSignOut={signOut} userEmail={session.user.email} installPrompt={installPrompt} onInstalled={() => setInstallPrompt(null)} />
      )}

      {modal === "addMilk" && (
        <QuickMilkModal data={data} update={update} onClose={() => setModal(null)} notify={notify} />
      )}
      {modal === "addSale" && (
        <SaleModal data={data} setData={setData} onClose={() => setModal(null)} notify={notify} />
      )}
      {modal === "addExpense" && (
        <ExpenseModal setData={setData} onClose={() => setModal(null)} notify={notify} />
      )}
      {modal === "addPayment" && (
        <PaymentModal data={data} setData={setData} onClose={() => setModal(null)} notify={notify} />
      )}
      {modal === "addPurchase" && (
        <PurchaseModal data={data} setData={setData} onClose={() => setModal(null)} notify={notify} />
      )}

      {toast && (
        <div className="fixed top-4 left-1/2 z-[60] animate-toast-in" style={{ transform: "translateX(-50%)" }}>
          <div className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-sm font-medium text-white" style={{ background: C.greenDark, boxShadow: "0 8px 20px rgba(18,48,24,0.35)" }}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
              <Check size={11} strokeWidth={3} />
            </div>
            {toast}
          </div>
        </div>
      )}

      <BottomNav tab={tab} setTab={(t) => { setTab(t); setMoreScreen(null); setCustId(null); setAnimalId(null); }} />
    </div>
  );
}

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
.font-display{font-family:'Zilla Slab',serif;}
.font-body{font-family:'Inter',sans-serif;}
`;

/* ---------------------------------------------------------------- */
/*  Bottom Nav                                                       */
/* ---------------------------------------------------------------- */
function BottomNav({ tab, setTab }) {
  const items = [
    { key: "dashboard", label: "Home", icon: Home },
    { key: "milk", label: "Milk", icon: Droplet },
    { key: "sales", label: "Sales", icon: ShoppingCart },
    { key: "customers", label: "Customers", icon: Users },
    { key: "more", label: "More", icon: MoreHorizontal },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white" style={{ borderTop: `1px solid ${C.line}`, boxShadow: "0 -2px 10px rgba(31,77,44,0.06)" }}>
      <div className="max-w-md mx-auto flex">
        {items.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 tap relative"
            >
              <span
                className="absolute top-1 w-8 h-8 rounded-full transition-all duration-200"
                style={{ background: active ? C.greenPale : "transparent", transform: active ? "scale(1)" : "scale(0.6)", opacity: active ? 1 : 0 }}
              />
              <Icon size={20} color={active ? C.green : C.grayLight} strokeWidth={active ? 2.4 : 2} className="relative transition-transform duration-200" style={{ transform: active ? "translateY(-1px)" : "none" }} />
              <span className="text-[10px] font-semibold relative transition-colors duration-200" style={{ color: active ? C.green : C.grayLight }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Dashboard                                                         */
/* ---------------------------------------------------------------- */
function computeDayTotals(data, date) {
  const milkProduced = data.milk.filter((m) => m.date === date).reduce((s, m) => s + m.quantity, 0);
  const daySales = data.sales.filter((s) => s.date === date);
  const milkSold = daySales.reduce((s, x) => s + x.quantity, 0);
  const salesTotal = daySales.reduce((s, x) => s + x.total, 0);
  const dayExpenses = data.expenses.filter((e) => e.date === date).reduce((s, e) => s + e.amount, 0);
  const paymentsReceived = data.custPayments.filter((p) => p.date === date).reduce((s, p) => s + p.amount, 0);
  const paymentsMade = data.purchases.filter((p) => p.date === date).reduce((s, p) => s + p.paid, 0);
  const profit = salesTotal - dayExpenses;
  return { milkProduced, milkSold, salesTotal, dayExpenses, paymentsReceived, paymentsMade, profit };
}

function computeRangeTotals(data, from, to) {
  const inRange = (d) => d >= from && d <= to;
  const milkRecs = data.milk.filter((m) => inRange(m.date));
  const salesRecs = data.sales.filter((s) => inRange(s.date));
  const expenseRecs = data.expenses.filter((e) => inRange(e.date));
  const paymentRecs = data.custPayments.filter((p) => inRange(p.date));
  const purchaseRecs = data.purchases.filter((p) => inRange(p.date));

  const milkProduced = milkRecs.reduce((s, m) => s + m.quantity, 0);
  const milkSold = salesRecs.reduce((s, x) => s + x.quantity, 0);
  const salesTotal = salesRecs.reduce((s, x) => s + x.total, 0);
  const dayExpenses = expenseRecs.reduce((s, e) => s + e.amount, 0);
  const paymentsReceived = paymentRecs.reduce((s, p) => s + p.amount, 0);
  const paymentsMade = purchaseRecs.reduce((s, p) => s + p.paid, 0);
  const profit = salesTotal - dayExpenses;

  // per-day breakdown for the chart
  const days = [];
  let cur = new Date(from);
  const end = new Date(to);
  while (cur <= end && days.length < 62) {
    const dStr = cur.toISOString().slice(0, 10);
    const day = computeDayTotals(data, dStr);
    days.push({ date: dStr, day: cur.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), milk: Math.round(day.milkProduced), profit: day.profit });
    cur.setDate(cur.getDate() + 1);
  }

  return { milkProduced, milkSold, salesTotal, dayExpenses, paymentsReceived, paymentsMade, profit, days, saleCount: salesRecs.length };
}

function Dashboard({ data, role, setModal, goMore }) {
  const t = computeDayTotals(data, today());
  const custOutstanding = data.customers.reduce((s, c) => s + Math.max(c.balance, 0), 0);
  const supplierBalance = data.purchases.reduce((s, p) => s + p.credit, 0);
  const stockValue = data.inventory.reduce((s, i) => s + i.currentStock * i.avgCost, 0);
  const activeAnimals = data.animals.filter((a) => !["Sold", "Deceased"].includes(a.status)).length;
  const isEmployee = role === "Employee";

  const lowStock = data.inventory.filter((i) => i.currentStock <= i.minimumStock);
  const overdueCustomers = data.customers.filter((c) => c.balance > c.creditLimit);
  const salaryDue = data.employees.filter((e) => {
    const paid = data.salaryPayments.filter((p) => p.employeeId === e.id && p.month === today().slice(0, 7)).reduce((s, p) => s + p.paidAmount, 0);
    return paid < e.salary;
  });
  const vaccinationsDue = data.vaccinations.filter((v) => v.nextDueDate && v.nextDueDate <= daysAgo(-7));

  return (
    <Screen>
      <div className="flex items-center gap-3 mb-5">
        <Logo size={46} />
        <div>
          <p className="text-xs" style={{ color: C.gray }}>Good morning 👋</p>
          <h1 className="font-display text-lg font-bold" style={{ color: C.text }}>{data.settings.farmName}</h1>
          <p className="text-[11px]" style={{ color: C.grayLight }}>{fmtDate(today())} &middot; {role}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard icon={<Droplet size={14} />} label="Milk Produced" value={fmtL(t.milkProduced)} />
        <StatCard icon={<Droplet size={14} />} label="Milk Sold" value={fmtL(t.milkSold)} />
        <StatCard icon={<Banknote size={14} />} label="Sales" value={fmt(t.salesTotal)} />
        {!isEmployee && <StatCard icon={<Wallet size={14} />} label="Expenses" value={fmt(t.dayExpenses)} tone="warn" />}
        {!isEmployee && <StatCard icon={<TrendingUp size={14} />} label="Profit" value={fmt(t.profit)} tone={t.profit >= 0 ? "green" : "danger"} />}
        {!isEmployee && <StatCard icon={<Users size={14} />} label="Customer Due" value={fmt(custOutstanding)} tone="warn" />}
        {!isEmployee && <StatCard icon={<Truck size={14} />} label="Supplier Due" value={fmt(supplierBalance)} tone="warn" />}
        {!isEmployee && <StatCard icon={<Package size={14} />} label="Stock Value" value={fmt(stockValue)} />}
        <StatCard icon={<PawPrint size={14} />} label="Animals" value={activeAnimals} />
      </div>

      <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>QUICK ACTIONS</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <QuickAction icon={<Droplet size={18} />} label="Add Milk" onClick={() => setModal("addMilk")} />
        <QuickAction icon={<ShoppingCart size={18} />} label="Sell Milk" onClick={() => setModal("addSale")} />
        {!isEmployee && <QuickAction icon={<Wallet size={18} />} label="Expense" onClick={() => setModal("addExpense")} />}
        {!isEmployee && <QuickAction icon={<Banknote size={18} />} label="Payment" onClick={() => setModal("addPayment")} />}
        {!isEmployee && <QuickAction icon={<Truck size={18} />} label="Purchase" onClick={() => setModal("addPurchase")} />}
      </div>

      <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>ALERTS</p>
      <div className="flex flex-col gap-2">
        {lowStock.map((i) => (
          <AlertRow key={i.id} title={`${i.name} stock is low`} detail={`Current: ${i.currentStock} ${i.unit} · Minimum: ${i.minimumStock} ${i.unit}`} onClick={() => goMore("inventory")} />
        ))}
        {!isEmployee && overdueCustomers.map((c) => (
          <AlertRow key={c.id} title={`${c.name} exceeded credit limit`} detail={`Balance ${fmt(c.balance)} of limit ${fmt(c.creditLimit)}`} onClick={() => {}} />
        ))}
        {!isEmployee && salaryDue.length > 0 && (
          <AlertRow title={`Salary due for ${salaryDue.length} employee(s)`} detail={salaryDue.map((e) => e.name).join(", ")} onClick={() => goMore("employees")} />
        )}
        {data.animals.some((a) => a.status === "Sick") && (
          <AlertRow title="Animal under treatment" detail={data.animals.filter((a) => a.status === "Sick").map((a) => `${a.name} (${a.code})`).join(", ")} onClick={() => goMore("animals")} />
        )}
        {vaccinationsDue.length > 0 && (
          <AlertRow
            title={`Vaccination due/overdue for ${vaccinationsDue.length} animal(s)`}
            detail={vaccinationsDue.map((v) => {
              const a = data.animals.find((x) => x.id === v.animalId);
              return `${a ? a.name : "Unknown"} — ${v.vaccine} (${fmtDate(v.nextDueDate)})`;
            }).join(", ")}
            onClick={() => goMore("animals")}
          />
        )}
        {lowStock.length === 0 && overdueCustomers.length === 0 && salaryDue.length === 0 && vaccinationsDue.length === 0 && !data.animals.some((a) => a.status === "Sick") && (
          <p className="text-xs" style={{ color: C.grayLight }}>No alerts right now. Everything looks good.</p>
        )}
      </div>
    </Screen>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="rounded-2xl bg-white flex flex-col items-center justify-center gap-1.5 py-3 press" style={{ border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(31,77,44,0.05)" }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.greenPale, color: C.green }}>{icon}</div>
      <span className="text-[11px] font-semibold" style={{ color: C.text }}>{label}</span>
    </button>
  );
}

function AlertRow({ title, detail, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl px-3 py-2.5 flex items-start gap-2.5 tap animate-row-in" style={{ background: "#FBEBD6" }}>
      <AlertTriangle size={16} color={C.warn} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold" style={{ color: C.text }}>{title}</p>
        <p className="text-[11px]" style={{ color: C.gray }}>{detail}</p>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- */
/*  Milk Screen                                                       */
/* ---------------------------------------------------------------- */
function MilkScreen({ data, update, notify }) {
  const [view, setView] = useState("bulk");
  const [session, setSession] = useState("Morning");
  const [entries, setEntries] = useState({});
  const [date] = useState(today());

  const milkingAnimals = data.animals.filter((a) => a.status === "Milking");

  const existingFor = (animalId) => {
    const rec = data.milk.find((m) => m.animalId === animalId && m.date === date && m.session === session);
    return rec ? rec.quantity : "";
  };

  const total = milkingAnimals.reduce((s, a) => {
    const v = entries[a.id] !== undefined ? entries[a.id] : existingFor(a.id);
    return s + (parseFloat(v) || 0);
  }, 0);

  const [saving, setSaving] = useState(false);
  const save = async () => {
    const rows = milkingAnimals
      .filter((a) => entries[a.id] !== undefined && entries[a.id] !== "")
      .map((a) => ({ animal_id: a.id, date, session, quantity: parseFloat(entries[a.id]) || 0, farm_id: CURRENT_FARM_ID }));
    if (rows.length === 0) return;
    setSaving(true);
    const { data: rowsBack, error } = await supabase
      .from("milk_production")
      .upsert(rows, { onConflict: "animal_id,date,session" })
      .select();
    setSaving(false);
    if (error) { notify("Could not save milk entries"); return; }
    const camelRows = rowsBack.map(rowToCamel);
    update("milk", (milk) => {
      let next = [...milk];
      camelRows.forEach((r) => {
        const idx = next.findIndex((m) => m.id === r.id);
        if (idx >= 0) next[idx] = r; else next.push(r);
      });
      return next;
    });
    setEntries({});
    notify("Milk production saved");
  };

  const recent = [...data.milk].sort((a, b) => (b.date + b.session).localeCompare(a.date + a.session)).slice(0, 25);

  return (
    <Screen>
      <TopBar title="Milk Production" subtitle={`${data.settings.morningTime} morning · ${data.settings.eveningTime} evening`} />
      <Chips options={["bulk", "log"].map((v) => (v === "bulk" ? "Bulk Entry" : "Production Log"))} value={view === "bulk" ? "Bulk Entry" : "Production Log"} onChange={(v) => setView(v === "Bulk Entry" ? "bulk" : "log")} />

      {view === "bulk" && (
        <>
          <div className="flex gap-2 mb-3">
            {["Morning", "Evening"].map((s) => (
              <button key={s} onClick={() => setSession(s)} className="flex-1 rounded-xl py-2 text-sm font-semibold" style={session === s ? { background: C.green, color: C.white } : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }}>
                {s}
              </button>
            ))}
          </div>
          {milkingAnimals.length === 0 ? (
            <Empty icon={<PawPrint size={22} color={C.green} />} title="No milking animals" note="Mark animals as Milking to record production." />
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {milkingAnimals.map((a) => (
                <Card key={a.id} className="flex items-center justify-between !py-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.text }}>{a.name} <span style={{ color: C.grayLight }}>· {a.code}</span></p>
                    <p className="text-[11px]" style={{ color: C.gray }}>{a.type} · {a.breed}</p>
                  </div>
                  <input
                    type="number" inputMode="decimal" placeholder="0"
                    value={entries[a.id] !== undefined ? entries[a.id] : existingFor(a.id)}
                    onChange={(e) => setEntries((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    className="w-20 text-right rounded-lg px-2 py-1.5 text-sm font-semibold"
                    style={{ border: `1px solid ${C.line}`, color: C.text }}
                  />
                </Card>
              ))}
            </div>
          )}
          <Card className="flex items-center justify-between mb-4" style={{ background: C.greenPale, border: "none" }}>
            <span className="text-sm font-semibold" style={{ color: C.green }}>Total {session} Milk</span>
            <span className="font-display text-lg font-bold" style={{ color: C.green }}>{fmtL(total)}</span>
          </Card>
          {milkingAnimals.length > 0 && <Btn full onClick={save} disabled={saving}><Check size={16} /> {saving ? "Saving…" : "Save Entries"}</Btn>}
        </>
      )}

      {view === "log" && (
        <div className="flex flex-col gap-2">
          {recent.length === 0 ? (
            <Empty icon={<Droplet size={22} color={C.green} />} title="No records yet" note="Recorded milk entries will appear here." />
          ) : recent.map((m, i) => {
            const a = data.animals.find((x) => x.id === m.animalId);
            return (
              <Card key={m.id} className="flex items-center justify-between !py-3 animate-row-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{a ? `${a.name} · ${a.code}` : "Unknown"}</p>
                  <p className="text-[11px]" style={{ color: C.gray }}>{fmtDate(m.date)} · {m.session}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-sm" style={{ color: C.green }}>{fmtL(m.quantity)}</span>
                  <RowActions onDelete={() => dbDelete("milk", m.id).then(() => update("milk", (milk) => milk.filter((x) => x.id !== m.id)))} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

function QuickMilkModal({ data, update, onClose, notify }) {
  const [animalId, setAnimalId] = useState(data.animals.find((a) => a.status === "Milking")?.id || "");
  const [session, setSession] = useState("Morning");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!animalId || !qty) return;
    setSaving(true);
    const { data: row, error } = await supabase
      .from("milk_production")
      .upsert([{ animal_id: animalId, date: today(), session, quantity: parseFloat(qty) || 0, farm_id: CURRENT_FARM_ID }], { onConflict: "animal_id,date,session" })
      .select()
      .single();
    setSaving(false);
    if (error) { notify("Could not save entry"); return; }
    const r = rowToCamel(row);
    update("milk", (milk) => {
      const idx = milk.findIndex((m) => m.id === r.id);
      if (idx >= 0) { const n = [...milk]; n[idx] = r; return n; }
      return [...milk, r];
    });
    notify("Milk entry added");
    onClose();
  };

  return (
    <Sheet title="Add Milk" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Entry"}</Btn>}>
      <Field label="Animal">
        <select className={inputCls} style={inputStyle} value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
          {data.animals.filter((a) => a.status === "Milking").map((a) => <option key={a.id} value={a.id}>{a.name} · {a.code}</option>)}
        </select>
      </Field>
      <Field label="Session">
        <select className={inputCls} style={inputStyle} value={session} onChange={(e) => setSession(e.target.value)}>
          <option>Morning</option><option>Evening</option>
        </select>
      </Field>
      <Field label="Quantity (Liters)">
        <input type="number" inputMode="decimal" className={inputCls} style={inputStyle} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 8.5" />
      </Field>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  Sales Screen                                                      */
/* ---------------------------------------------------------------- */
function SalesScreen({ data, setData, notify, setModal }) {
  const [filter, setFilter] = useState("All");
  const list = [...data.sales].sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => filter === "All" || s.paymentStatus === filter);

  const removeSale = async (sale) => {
    try {
      await dbDelete("sales", sale.id);
      if (sale.paymentStatus === "Unpaid") {
        const c = data.customers.find((x) => x.id === sale.customerId);
        if (c) await dbUpdate("customers", c.id, { balance: c.balance - sale.total });
      }
    } catch (e) { notify("Could not delete sale"); return; }
    setData((d) => ({
      ...d,
      sales: d.sales.filter((s) => s.id !== sale.id),
      customers: sale.paymentStatus === "Unpaid"
        ? d.customers.map((c) => c.id === sale.customerId ? { ...c, balance: c.balance - sale.total } : c)
        : d.customers,
    }));
    notify("Sale deleted");
  };

  return (
    <Screen>
      <TopBar title="Milk Sales" subtitle={`${data.sales.length} total sales`} right={
        <button onClick={() => setModal("addSale")} className="p-2 rounded-full" style={{ background: C.green }}>
          <Plus size={18} color="white" />
        </button>
      } />
      <Chips options={["All", "Paid", "Unpaid"]} value={filter} onChange={setFilter} />
      {list.length === 0 ? (
        <Empty icon={<ShoppingCart size={22} color={C.green} />} title="No sales yet" note="Record your first milk sale." actionLabel="Add Sale" onAction={() => setModal("addSale")} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((s, i) => {
            const c = data.customers.find((x) => x.id === s.customerId);
            return (
              <Card key={s.id} className="!py-3 animate-row-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{c ? c.name : "Unknown"}</p>
                  <Badge tone={s.paymentStatus === "Paid" ? "green" : "warn"}>{s.paymentStatus}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: C.gray }}>
                  <span>{fmtDate(s.date)} · {fmtL(s.quantity)} @ {fmt(s.pricePerLiter)}/L · {s.paymentMethod}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-sm" style={{ color: C.green }}>{fmt(s.total)}</span>
                    <RowActions onDelete={() => removeSale(s)} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

function SaleModal({ data, setData, onClose, notify, presetCustomerId }) {
  const [customerId, setCustomerId] = useState(presetCustomerId || data.customers[0]?.id || "");
  const customer = data.customers.find((c) => c.id === customerId);
  const [qty, setQty] = useState(customer ? String(customer.dailyQuantity) : "");
  const [price, setPrice] = useState(customer ? String(customer.defaultPrice) : String(data.settings.defaultMilkPrice));
  const [method, setMethod] = useState("Cash");
  const total = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  useEffect(() => {
    if (customer) { setPrice(String(customer.defaultPrice)); }
  }, [customerId]);

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!customerId || !qty || !price) return;
    const status = method === "Credit" ? "Unpaid" : "Paid";
    setSaving(true);
    try {
      const sale = await dbInsert("sales", { customerId, date: today(), quantity: parseFloat(qty), pricePerLiter: parseFloat(price), total, paymentMethod: method, paymentStatus: status, notes: "" });
      let updatedCustomer = null;
      if (status === "Unpaid") {
        const c = data.customers.find((x) => x.id === customerId);
        updatedCustomer = await dbUpdate("customers", customerId, { balance: c.balance + total });
      }
      setData((d) => ({
        ...d,
        sales: [...d.sales, sale],
        customers: updatedCustomer ? d.customers.map((c) => c.id === customerId ? updatedCustomer : c) : d.customers,
      }));
      notify("Sale recorded");
      onClose();
    } catch (e) {
      notify("Could not save sale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Sell Milk" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : `Save Sale · ${fmt(total)}`}</Btn>}>
      <Field label="Customer">
        <select className={inputCls} style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity (L)"><input type="number" inputMode="decimal" className={inputCls} style={inputStyle} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Price / Liter"><input type="number" inputMode="decimal" className={inputCls} style={inputStyle} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      </div>
      <Field label="Payment Method">
        <select className={inputCls} style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>Cash</option><option>Bank</option><option>JazzCash</option><option>Easypaisa</option><option>Credit</option>
        </select>
      </Field>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  Customers                                                         */
/* ---------------------------------------------------------------- */
function CustomersScreen({ data, setData, onOpen, setModal, notify }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editCust, setEditCust] = useState(null);
  const list = data.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => filter === "All" || (filter === "Credit Due" ? c.balance > 0 : c.status === filter));

  const totalOutstanding = data.customers.reduce((s, c) => s + Math.max(c.balance, 0), 0);

  const removeCustomer = async (c) => {
    try {
      await dbDelete("customers", c.id);
    } catch (e) { notify && notify("Could not delete customer"); return; }
    setData((d) => ({
      ...d,
      customers: d.customers.filter((x) => x.id !== c.id),
      sales: d.sales.filter((s) => s.customerId !== c.id),
      custPayments: d.custPayments.filter((p) => p.customerId !== c.id),
    }));
    notify && notify("Customer deleted");
  };

  return (
    <Screen>
      <TopBar title="Customers" subtitle={`${data.customers.length} customers · ${fmt(totalOutstanding)} outstanding`} right={
        <button onClick={() => setShowAdd(true)} className="p-2 rounded-full" style={{ background: C.green }}><Plus size={18} color="white" /></button>
      } />
      <SearchBox value={q} onChange={setQ} placeholder="Search customers..." />
      <Chips options={["All", "Active", "Credit Due"]} value={filter} onChange={setFilter} />
      {list.length === 0 ? (
        <Empty icon={<Users size={22} color={C.green} />} title="No customers yet" note="Add your first customer to start tracking milk sales." actionLabel="Add Customer" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((c, i) => (
            <div key={c.id} onClick={() => onOpen(c.id)} className="w-full text-left cursor-pointer animate-row-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <Card className="flex items-center justify-between !py-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{c.name}</p>
                  <p className="text-[11px]" style={{ color: C.gray }}>{fmtL(c.dailyQuantity)}/day @ {fmt(c.defaultPrice)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-right">
                    <p className="font-display font-bold text-sm" style={{ color: c.balance > 0 ? C.warn : C.green }}>{fmt(c.balance)}</p>
                    <p className="text-[10px]" style={{ color: C.grayLight }}>{c.balance > 0 ? "due" : "settled"}</p>
                  </div>
                  <RowActions onEdit={() => setEditCust(c)} onDelete={() => removeCustomer(c)} />
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
      {showAdd && <CustomerModal setData={setData} onClose={() => setShowAdd(false)} notify={notify} />}
      {editCust && <CustomerModal setData={setData} customer={editCust} onClose={() => setEditCust(null)} notify={notify} />}
    </Screen>
  );
}

function CustomerModal({ setData, onClose, customer, notify }) {
  const isEdit = !!customer;
  const [f, setF] = useState(customer
    ? { name: customer.name, phone: customer.phone, address: customer.address, dailyQuantity: String(customer.dailyQuantity), defaultPrice: String(customer.defaultPrice), creditLimit: String(customer.creditLimit) }
    : { name: "", phone: "", address: "", dailyQuantity: "", defaultPrice: "", creditLimit: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name) return;
    setSaving(true);
    const payload = {
      name: f.name, phone: f.phone, address: f.address,
      dailyQuantity: parseFloat(f.dailyQuantity) || 0, defaultPrice: parseFloat(f.defaultPrice) || 0, creditLimit: parseFloat(f.creditLimit) || 0,
    };
    try {
      if (isEdit) {
        const row = await dbUpdate("customers", customer.id, payload);
        setData((d) => ({ ...d, customers: d.customers.map((c) => c.id === customer.id ? row : c) }));
      } else {
        const row = await dbInsert("customers", { ...payload, status: "Active", balance: 0 });
        setData((d) => ({ ...d, customers: [...d.customers, row] }));
      }
      onClose();
    } catch (e) {
      notify && notify("Could not save customer");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title={isEdit ? "Rename / Edit Customer" : "Add Customer"} onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Save Customer"}</Btn>}>
      <Field label="Name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Phone"><input className={inputCls} style={inputStyle} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Address"><input className={inputCls} style={inputStyle} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Daily Milk (L)"><input type="number" className={inputCls} style={inputStyle} value={f.dailyQuantity} onChange={(e) => setF({ ...f, dailyQuantity: e.target.value })} /></Field>
        <Field label="Price / Liter"><input type="number" className={inputCls} style={inputStyle} value={f.defaultPrice} onChange={(e) => setF({ ...f, defaultPrice: e.target.value })} /></Field>
      </div>
      <Field label="Credit Limit"><input type="number" className={inputCls} style={inputStyle} value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: e.target.value })} /></Field>
    </Sheet>
  );
}

function CustomerProfile({ data, setData, custId, onBack, notify }) {
  const c = data.customers.find((x) => x.id === custId);
  const [showSale, setShowSale] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  if (!c) return null;

  const removeCustomer = async () => {
    if (!window.confirm(`Delete ${c.name}? This also removes their sales and payment history.`)) return;
    try {
      await dbDelete("customers", c.id);
    } catch (e) { notify("Could not delete customer"); return; }
    setData((d) => ({
      ...d,
      customers: d.customers.filter((x) => x.id !== c.id),
      sales: d.sales.filter((s) => s.customerId !== c.id),
      custPayments: d.custPayments.filter((p) => p.customerId !== c.id),
    }));
    notify("Customer deleted");
    onBack();
  };

  const monthPrefix = today().slice(0, 7);
  const monthSales = data.sales.filter((s) => s.customerId === c.id && s.date.startsWith(monthPrefix));
  const monthMilk = monthSales.reduce((s, x) => s + x.quantity, 0);
  const monthBill = monthSales.reduce((s, x) => s + x.total, 0);
  const monthPaid = data.custPayments.filter((p) => p.customerId === c.id && p.date.startsWith(monthPrefix)).reduce((s, p) => s + p.amount, 0);

  const history = [...data.sales.filter((s) => s.customerId === c.id), ...data.custPayments.filter((p) => p.customerId === c.id).map((p) => ({ ...p, isPayment: true }))]
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <TopBar title={c.name} subtitle={c.address} onBack={onBack} right={
        <div className="flex items-center gap-1">
          <button onClick={() => setShowEdit(true)} className="p-2 rounded-full active:bg-black/5"><Pencil size={16} color={C.gray} /></button>
          <button onClick={removeCustomer} className="p-2 rounded-full active:bg-black/5"><Trash2 size={16} color={C.danger} /></button>
        </div>
      } />
      <Card className="mb-4">
        <div className="flex items-center gap-2 text-xs mb-2" style={{ color: C.gray }}><Phone size={13} /> {c.phone}</div>
        <div className="flex items-center gap-2 text-xs mb-3" style={{ color: C.gray }}><MapPin size={13} /> {c.address}</div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl py-2" style={{ background: C.greenPale }}>
            <p className="font-display font-bold text-base" style={{ color: C.green }}>{fmtL(c.dailyQuantity)}</p>
            <p className="text-[10px]" style={{ color: C.gray }}>Daily Milk</p>
          </div>
          <div className="rounded-xl py-2" style={{ background: C.greenPale }}>
            <p className="font-display font-bold text-base" style={{ color: C.green }}>{fmt(c.defaultPrice)}</p>
            <p className="text-[10px]" style={{ color: C.gray }}>Price / L</p>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>THIS MONTH</p>
        <Row label="Total Milk" value={fmtL(monthMilk)} />
        <Row label="Bill" value={fmt(monthBill)} />
        <Row label="Paid" value={fmt(monthPaid)} />
        <Row label="Balance" value={fmt(c.balance)} bold tone={c.balance > 0 ? "warn" : "green"} />
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Btn onClick={() => setShowSale(true)}><Plus size={15} /> Add Sale</Btn>
        <Btn variant="outline" onClick={() => setShowPay(true)}><Banknote size={15} /> Add Payment</Btn>
        <Btn variant="ghost" onClick={() => setShowBill(true)}><FileText size={15} /> Generate Bill</Btn>
        <Btn variant="ghost" onClick={() => setShowBill(true)}><Share2 size={15} /> Share Bill</Btn>
      </div>

      <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>HISTORY</p>
      <div className="flex flex-col gap-2">
        {history.length === 0 && <p className="text-xs" style={{ color: C.grayLight }}>No transactions yet.</p>}
        {history.map((h, i) => (
          <Card key={i} className="flex items-center justify-between !py-2.5">
            <div>
              <p className="text-xs font-semibold" style={{ color: C.text }}>{h.isPayment ? "Payment received" : `Milk sale · ${fmtL(h.quantity)}`}</p>
              <p className="text-[10px]" style={{ color: C.gray }}>{fmtDate(h.date)} · {h.isPayment ? h.method : h.paymentMethod}</p>
            </div>
            <span className="font-display font-bold text-sm" style={{ color: h.isPayment ? C.green : C.text }}>
              {h.isPayment ? "-" : "+"}{fmt(h.isPayment ? h.amount : h.total)}
            </span>
          </Card>
        ))}
      </div>

      {showSale && <SaleModal data={data} setData={setData} onClose={() => setShowSale(false)} notify={notify} presetCustomerId={c.id} />}
      {showPay && <QuickPaymentModal data={data} setData={setData} customerId={c.id} onClose={() => setShowPay(false)} notify={notify} />}
      {showBill && <BillSheet data={data} customer={c} monthMilk={monthMilk} monthBill={monthBill} monthPaid={monthPaid} allSales={data.sales.filter((s) => s.customerId === c.id)} allPayments={data.custPayments.filter((p) => p.customerId === c.id)} onClose={() => setShowBill(false)} />}
      {showEdit && <CustomerModal setData={setData} customer={c} onClose={() => setShowEdit(false)} notify={notify} />}
    </Screen>
  );
}

function Row({ label, value, bold, tone }) {
  const color = tone === "warn" ? C.warn : tone === "green" ? C.green : C.text;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: C.gray }}>{label}</span>
      <span className={"text-sm " + (bold ? "font-display font-bold" : "font-medium")} style={{ color }}>{value}</span>
    </div>
  );
}

function QuickPaymentModal({ data, setData, customerId, onClose, notify }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!amount) return;
    const amt = parseFloat(amount);
    setSaving(true);
    try {
      const payment = await dbInsert("custPayments", { customerId, amount: amt, date: today(), method, reference: "", notes: "" });
      const c = data.customers.find((x) => x.id === customerId);
      const updatedCustomer = await dbUpdate("customers", customerId, { balance: c.balance - amt });
      setData((d) => ({
        ...d,
        custPayments: [...d.custPayments, payment],
        customers: d.customers.map((x) => x.id === customerId ? updatedCustomer : x),
      }));
      notify("Payment recorded");
      onClose();
    } catch (e) {
      notify("Could not save payment");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title="Add Payment" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Payment"}</Btn>}>
      <Field label="Amount"><input type="number" inputMode="decimal" className={inputCls} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
      <Field label="Method">
        <select className={inputCls} style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>Cash</option><option>Bank</option><option>JazzCash</option><option>Easypaisa</option>
        </select>
      </Field>
    </Sheet>
  );
}

function PaymentModal({ data, setData, onClose, notify }) {
  const [customerId, setCustomerId] = useState(data.customers[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!amount || !customerId) return;
    const amt = parseFloat(amount);
    setSaving(true);
    try {
      const payment = await dbInsert("custPayments", { customerId, amount: amt, date: today(), method, reference: "", notes: "" });
      const c = data.customers.find((x) => x.id === customerId);
      const updatedCustomer = await dbUpdate("customers", customerId, { balance: c.balance - amt });
      setData((d) => ({
        ...d,
        custPayments: [...d.custPayments, payment],
        customers: d.customers.map((x) => x.id === customerId ? updatedCustomer : x),
      }));
      notify("Payment recorded");
      onClose();
    } catch (e) {
      notify("Could not save payment");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title="Customer Payment" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Payment"}</Btn>}>
      <Field label="Customer">
        <select className={inputCls} style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name} · due {fmt(c.balance)}</option>)}
        </select>
      </Field>
      <Field label="Amount"><input type="number" inputMode="decimal" className={inputCls} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
      <Field label="Method">
        <select className={inputCls} style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>Cash</option><option>Bank</option><option>JazzCash</option><option>Easypaisa</option>
        </select>
      </Field>
    </Sheet>
  );
}

function BillSheet({ data, customer, monthMilk, monthBill, monthPaid, allSales, allPayments, onClose }) {
  const remaining = monthBill - monthPaid;
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const message = `Dear ${customer.name}, your ${monthName} milk bill from ${data.settings.farmName} is ${fmt(monthBill)}. You have paid ${fmt(monthPaid)}. Total credit remaining is ${fmt(customer.balance)}.`;
  const [busy, setBusy] = useState(false);

  const buildPdf = async () => {
    const { buildCustomerStatementPdf } = await import("./pdf.js");
    return buildCustomerStatementPdf(data.settings, customer, allSales, allPayments);
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const doc = await buildPdf();
      doc.save(`${customer.name.replace(/\s+/g, "-")}-statement.pdf`);
    } finally { setBusy(false); }
  };

  const shareWhatsApp = async () => {
    setBusy(true);
    try {
      const doc = await buildPdf();
      const blob = doc.output("blob");
      const file = new File([blob], `${customer.name.replace(/\s+/g, "-")}-statement.pdf`, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Milk Bill", text: message });
      } else {
        doc.save(`${customer.name.replace(/\s+/g, "-")}-statement.pdf`);
        const phone = (customer.phone || "").replace(/\D/g, "");
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message + " (PDF statement downloaded — attach it here.)")}`;
        window.open(waUrl, "_blank");
      }
    } catch (e) {
      // user cancelled share sheet — no-op
    } finally { setBusy(false); }
  };

  return (
    <Sheet title="Customer Statement" onClose={onClose} footer={
      <div className="flex gap-2">
        <Btn variant="outline" full onClick={downloadPdf} disabled={busy}><Download size={15} /> Download PDF</Btn>
        <Btn full onClick={shareWhatsApp} disabled={busy}><Share2 size={15} /> Share on WhatsApp</Btn>
      </div>
    }>
      <div className="rounded-2xl p-4 mb-3" style={{ border: `1.5px dashed ${C.line}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Logo size={34} />
          <div>
            <p className="font-display font-bold text-sm" style={{ color: C.text }}>{data.settings.farmName}</p>
            <p className="text-[10px]" style={{ color: C.gray }}>{data.settings.address} · {data.settings.phone}</p>
          </div>
        </div>
        <Row label="Customer" value={customer.name} />
        <Row label="Phone" value={customer.phone} />
        <Row label="This Month's Milk" value={fmtL(monthMilk)} />
        <Row label="This Month's Bill" value={fmt(monthBill)} />
        <Row label="This Month's Paid" value={fmt(monthPaid)} />
        <Row label="Total Credit Remaining" value={fmt(customer.balance)} bold tone={customer.balance > 0 ? "warn" : "green"} />
        <div className="mt-2">
          <Badge tone={customer.balance > 0 ? "warn" : "green"}>{customer.balance > 0 ? "Credit Due" : "Settled"}</Badge>
        </div>
      </div>
      <p className="text-[11px] mb-2" style={{ color: C.gray }}>The PDF includes the complete transaction history — every sale and payment with a running balance, not just this month.</p>
      <p className="text-xs italic" style={{ color: C.gray }}>{message}</p>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  More menu                                                         */
/* ---------------------------------------------------------------- */
function MoreMenu({ role, onOpen }) {
  const all = [
    { key: "animals", label: "Animals", icon: PawPrint },
    { key: "inventory", label: "Inventory", icon: Package },
    { key: "purchases", label: "Purchases", icon: Truck },
    { key: "expenses", label: "Expenses", icon: Wallet },
    { key: "employees", label: "Employees", icon: UserCog },
    { key: "reports", label: "Reports", icon: FileText },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];
  const hiddenForEmployee = ["purchases", "expenses", "reports"];
  const items = role === "Employee" ? all.filter((i) => !hiddenForEmployee.includes(i.key)) : all;

  return (
    <Screen>
      <TopBar title="More" subtitle="Manage every part of your farm" />
      <div className="grid grid-cols-3 gap-2.5">
        {items.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onOpen(key)} className="rounded-2xl bg-white flex flex-col items-center justify-center gap-2 py-5 active:opacity-80" style={{ border: `1px solid ${C.line}` }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.greenPale, color: C.green }}><Icon size={19} /></div>
            <span className="text-[11px] font-semibold text-center" style={{ color: C.text }}>{label}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- */
/*  Animals                                                            */
/* ---------------------------------------------------------------- */
function AnimalsScreen({ data, setData, onBack, onOpen, notify }) {
  const [filter, setFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editAnimal, setEditAnimal] = useState(null);
  const list = data.animals.filter((a) => filter === "All" || a.status === filter);

  const remove = async (id) => {
    try { await dbDelete("animals", id); } catch (e) { notify && notify("Could not delete animal"); return; }
    setData((d) => ({ ...d, animals: d.animals.filter((a) => a.id !== id), milk: d.milk.filter((m) => m.animalId !== id) }));
  };

  return (
    <Screen>
      <TopBar title="Animals" subtitle={`${data.animals.length} total`} onBack={onBack} right={
        <button onClick={() => setShowAdd(true)} className="p-2 rounded-full" style={{ background: C.green }}><Plus size={18} color="white" /></button>
      } />
      <Chips options={["All", "Milking", "Dry", "Pregnant", "Sick"]} value={filter} onChange={setFilter} />
      {list.length === 0 ? (
        <Empty icon={<PawPrint size={22} color={C.green} />} title="No animals" note="Add your first animal to the herd." actionLabel="Add Animal" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((a, i) => (
            <button key={a.id} onClick={() => onOpen(a.id)} className="w-full text-left animate-row-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <Card className="flex items-center justify-between !py-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{a.name} <span style={{ color: C.grayLight }}>· {a.code}</span></p>
                  <p className="text-[11px]" style={{ color: C.gray }}>{a.type} · {a.breed}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={a.status === "Sick" ? "danger" : a.status === "Milking" ? "green" : "gray"}>{a.status}</Badge>
                  <RowActions onEdit={() => setEditAnimal(a)} onDelete={() => remove(a.id)} />
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
      {showAdd && <AnimalModal setData={setData} onClose={() => setShowAdd(false)} notify={notify} />}
      {editAnimal && <AnimalModal setData={setData} animal={editAnimal} onClose={() => setEditAnimal(null)} notify={notify} />}
    </Screen>
  );
}

function AnimalModal({ setData, onClose, animal, notify }) {
  const isEdit = !!animal;
  const [f, setF] = useState(animal
    ? { code: animal.code, name: animal.name, type: animal.type, breed: animal.breed, gender: animal.gender, status: animal.status, purchasePrice: String(animal.purchasePrice || "") }
    : { code: "", name: "", type: "Cow", breed: "", gender: "Female", status: "Milking", purchasePrice: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.code || !f.name) return;
    setSaving(true);
    try {
      if (isEdit) {
        const row = await dbUpdate("animals", animal.id, { ...f, purchasePrice: parseFloat(f.purchasePrice) || 0 });
        setData((d) => ({ ...d, animals: d.animals.map((a) => a.id === animal.id ? row : a) }));
      } else {
        const row = await dbInsert("animals", { ...f, purchasePrice: parseFloat(f.purchasePrice) || 0, purchaseDate: today(), notes: "" });
        setData((d) => ({ ...d, animals: [...d.animals, row] }));
      }
      onClose();
    } catch (e) {
      notify && notify("Could not save animal");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title={isEdit ? "Rename / Edit Animal" : "Add Animal"} onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Save Animal"}</Btn>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Animal ID"><input className={inputCls} style={inputStyle} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="C-006" /></Field>
        <Field label="Name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className={inputCls} style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option>Cow</option><option>Buffalo</option><option>Calf</option><option>Bull</option><option>Other</option>
          </select>
        </Field>
        <Field label="Breed"><input className={inputCls} style={inputStyle} value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} /></Field>
      </div>
      <Field label="Status">
        <select className={inputCls} style={inputStyle} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option>Milking</option><option>Dry</option><option>Pregnant</option><option>Sick</option>
        </select>
      </Field>
      <Field label="Purchase Price"><input type="number" className={inputCls} style={inputStyle} value={f.purchasePrice} onChange={(e) => setF({ ...f, purchasePrice: e.target.value })} /></Field>
    </Sheet>
  );
}

function AnimalProfile({ data, setData, animalId, onBack, notify }) {
  const a = data.animals.find((x) => x.id === animalId);
  const [showEdit, setShowEdit] = useState(false);
  if (!a) return null;

  const remove = async () => {
    if (!window.confirm(`Delete ${a.name}? This also removes its milk records.`)) return;
    try { await dbDelete("animals", a.id); } catch (e) { notify && notify("Could not delete animal"); return; }
    setData((d) => ({ ...d, animals: d.animals.filter((x) => x.id !== a.id), milk: d.milk.filter((m) => m.animalId !== a.id) }));
    onBack();
  };
  const records = data.milk.filter((m) => m.animalId === a.id);
  const todayTotal = records.filter((m) => m.date === today()).reduce((s, m) => s + m.quantity, 0);
  const days = [...new Set(records.map((r) => r.date))];
  const avg = days.length ? records.reduce((s, r) => s + r.quantity, 0) / days.length : 0;
  const monthTotal = records.filter((r) => r.date.startsWith(today().slice(0, 7))).reduce((s, r) => s + r.quantity, 0);

  return (
    <Screen>
      <TopBar title={a.name} subtitle={`${a.code} · ${a.type} · ${a.breed}`} onBack={onBack} right={
        <div className="flex items-center gap-1">
          <button onClick={() => setShowEdit(true)} className="p-2 rounded-full active:bg-black/5"><Pencil size={16} color={C.gray} /></button>
          <button onClick={remove} className="p-2 rounded-full active:bg-black/5"><Trash2 size={16} color={C.danger} /></button>
        </div>
      } />
      <Card className="mb-4 text-center">
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: C.greenPale }}>
          <PawPrint size={28} color={C.green} />
        </div>
        <Badge tone={a.status === "Sick" ? "danger" : a.status === "Milking" ? "green" : "gray"}>{a.status}</Badge>
        {a.notes && <p className="text-xs mt-2" style={{ color: C.gray }}>{a.notes}</p>}
      </Card>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard icon={<Droplet size={13} />} label="Today" value={fmtL(todayTotal)} />
        <StatCard icon={<TrendingUp size={13} />} label="Average / day" value={fmtL(avg)} />
        <StatCard icon={<Calendar size={13} />} label="This Month" value={fmtL(monthTotal)} />
      </div>
      <Card className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>DETAILS</p>
        <Row label="Gender" value={a.gender} />
        <Row label="Purchase Date" value={a.purchaseDate ? fmtDate(a.purchaseDate) : "—"} />
        <Row label="Purchase Price" value={fmt(a.purchasePrice)} />
      </Card>

      <AnimalHealthSection data={data} setData={setData} animal={a} notify={notify} />
      <AnimalVaccinationSection data={data} setData={setData} animal={a} notify={notify} />
      <AnimalBreedingSection data={data} setData={setData} animal={a} notify={notify} />

      {showEdit && <AnimalModal setData={setData} animal={a} onClose={() => setShowEdit(false)} notify={notify} />}
    </Screen>
  );
}

/* ---------------------------------------------------------------- */
/*  Animal Health / Vaccination / Breeding                            */
/* ---------------------------------------------------------------- */
function AnimalHealthSection({ data, setData, animal, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const records = data.health.filter((h) => h.animalId === animal.id).sort((a, b) => b.date.localeCompare(a.date));

  const remove = async (id) => {
    try { await dbDelete("health", id); setData((d) => ({ ...d, health: d.health.filter((h) => h.id !== id) })); }
    catch (e) { notify("Could not delete record"); }
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: C.gray }}>VETERINARY & TREATMENTS</p>
        <button onClick={() => setShowAdd(true)} className="p-1.5 rounded-full" style={{ background: C.greenPale }}><Plus size={14} color={C.green} /></button>
      </div>
      {records.length === 0 ? (
        <p className="text-xs" style={{ color: C.grayLight }}>No veterinary records yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((h) => (
            <div key={h.id} className="rounded-xl p-2.5" style={{ background: C.creamDark }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold" style={{ color: C.text }}>{h.type}{h.problem ? ` — ${h.problem}` : ""}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]" style={{ color: C.gray }}>{fmtDate(h.date)}</span>
                  <RowActions onDelete={() => remove(h.id)} />
                </div>
              </div>
              <p className="text-[11px]" style={{ color: C.gray }}>
                {[h.doctor && `Dr. ${h.doctor}`, h.medicine, h.cost ? fmt(h.cost) : null].filter(Boolean).join(" · ")}
              </p>
              {h.nextDate && <p className="text-[10px] mt-1" style={{ color: C.warn }}>Follow-up: {fmtDate(h.nextDate)}</p>}
            </div>
          ))}
        </div>
      )}
      {showAdd && <HealthModal setData={setData} animal={animal} onClose={() => setShowAdd(false)} notify={notify} />}
    </Card>
  );
}

function HealthModal({ setData, animal, onClose, notify }) {
  const [f, setF] = useState({ type: "Checkup", doctor: "", problem: "", medicine: "", cost: "", nextDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const row = await dbInsert("health", { animalId: animal.id, date: today(), type: f.type, doctor: f.doctor, problem: f.problem, medicine: f.medicine, cost: parseFloat(f.cost) || 0, nextDate: f.nextDate || null, notes: f.notes });
      setData((d) => ({ ...d, health: [...d.health, row] }));
      onClose();
    } catch (e) { notify("Could not save record"); } finally { setSaving(false); }
  };
  return (
    <Sheet title="Add Veterinary Record" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Record"}</Btn>}>
      <Field label="Type">
        <select className={inputCls} style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option>Checkup</option><option>Illness</option><option>Injury</option><option>Deworming</option><option>Other</option>
        </select>
      </Field>
      <Field label="Doctor"><input className={inputCls} style={inputStyle} value={f.doctor} onChange={(e) => setF({ ...f, doctor: e.target.value })} /></Field>
      <Field label="Problem / Diagnosis"><input className={inputCls} style={inputStyle} value={f.problem} onChange={(e) => setF({ ...f, problem: e.target.value })} /></Field>
      <Field label="Medicine Given"><input className={inputCls} style={inputStyle} value={f.medicine} onChange={(e) => setF({ ...f, medicine: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost"><input type="number" className={inputCls} style={inputStyle} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
        <Field label="Follow-up Date"><input type="date" className={inputCls} style={inputStyle} value={f.nextDate} onChange={(e) => setF({ ...f, nextDate: e.target.value })} /></Field>
      </div>
      <Field label="Notes"><input className={inputCls} style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Sheet>
  );
}

function AnimalVaccinationSection({ data, setData, animal, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const records = data.vaccinations.filter((v) => v.animalId === animal.id).sort((a, b) => b.date.localeCompare(a.date));

  const remove = async (id) => {
    try { await dbDelete("vaccinations", id); setData((d) => ({ ...d, vaccinations: d.vaccinations.filter((v) => v.id !== id) })); }
    catch (e) { notify("Could not delete record"); }
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: C.gray }}>VACCINATIONS</p>
        <button onClick={() => setShowAdd(true)} className="p-1.5 rounded-full" style={{ background: C.greenPale }}><Plus size={14} color={C.green} /></button>
      </div>
      {records.length === 0 ? (
        <p className="text-xs" style={{ color: C.grayLight }}>No vaccination records yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((v) => {
            const overdue = v.nextDueDate && v.nextDueDate < today();
            const dueSoon = v.nextDueDate && !overdue && v.nextDueDate <= daysAgo(-7);
            return (
              <div key={v.id} className="rounded-xl p-2.5" style={{ background: C.creamDark }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold" style={{ color: C.text }}>{v.vaccine}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: C.gray }}>{fmtDate(v.date)}</span>
                    <RowActions onDelete={() => remove(v.id)} />
                  </div>
                </div>
                {v.doctor && <p className="text-[11px]" style={{ color: C.gray }}>Dr. {v.doctor}</p>}
                {v.nextDueDate && (
                  <p className="text-[10px] mt-1" style={{ color: overdue ? C.danger : dueSoon ? C.warn : C.gray }}>
                    Next due: {fmtDate(v.nextDueDate)}{overdue ? " — overdue" : dueSoon ? " — due soon" : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showAdd && <VaccinationModal setData={setData} animal={animal} onClose={() => setShowAdd(false)} notify={notify} />}
    </Card>
  );
}

function VaccinationModal({ setData, animal, onClose, notify }) {
  const [f, setF] = useState({ vaccine: "", doctor: "", nextDueDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.vaccine) return;
    setSaving(true);
    try {
      const row = await dbInsert("vaccinations", { animalId: animal.id, vaccine: f.vaccine, date: today(), doctor: f.doctor, nextDueDate: f.nextDueDate || null, notes: f.notes });
      setData((d) => ({ ...d, vaccinations: [...d.vaccinations, row] }));
      onClose();
    } catch (e) { notify("Could not save vaccination"); } finally { setSaving(false); }
  };
  return (
    <Sheet title="Add Vaccination" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Vaccination"}</Btn>}>
      <Field label="Vaccine Name"><input className={inputCls} style={inputStyle} value={f.vaccine} onChange={(e) => setF({ ...f, vaccine: e.target.value })} placeholder="e.g. FMD" /></Field>
      <Field label="Doctor"><input className={inputCls} style={inputStyle} value={f.doctor} onChange={(e) => setF({ ...f, doctor: e.target.value })} /></Field>
      <Field label="Next Due Date"><input type="date" className={inputCls} style={inputStyle} value={f.nextDueDate} onChange={(e) => setF({ ...f, nextDueDate: e.target.value })} /></Field>
      <Field label="Notes"><input className={inputCls} style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Sheet>
  );
}

function AnimalBreedingSection({ data, setData, animal, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const records = data.breeding.filter((b) => b.animalId === animal.id).sort((a, b) => (b.matingDate || "").localeCompare(a.matingDate || ""));

  const remove = async (id) => {
    try { await dbDelete("breeding", id); setData((d) => ({ ...d, breeding: d.breeding.filter((b) => b.id !== id) })); }
    catch (e) { notify("Could not delete record"); }
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: C.gray }}>BREEDING</p>
        <button onClick={() => setShowAdd(true)} className="p-1.5 rounded-full" style={{ background: C.greenPale }}><Plus size={14} color={C.green} /></button>
      </div>
      {records.length === 0 ? (
        <p className="text-xs" style={{ color: C.grayLight }}>No breeding records yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((b) => (
            <div key={b.id} className="rounded-xl p-2.5" style={{ background: C.creamDark }}>
              <div className="flex items-center justify-between mb-1">
                <Badge tone={b.pregnancyStatus === "Confirmed" ? "green" : b.pregnancyStatus === "Delivered" ? "gray" : "warn"}>{b.pregnancyStatus}</Badge>
                <RowActions onDelete={() => remove(b.id)} />
              </div>
              <p className="text-[11px]" style={{ color: C.gray }}>
                {b.matingDate && `Mated: ${fmtDate(b.matingDate)}`}{b.method ? ` (${b.method})` : ""}
              </p>
              {b.expectedDelivery && <p className="text-[10px] mt-1" style={{ color: C.warn }}>Expected delivery: {fmtDate(b.expectedDelivery)}</p>}
              {b.actualDelivery && <p className="text-[10px] mt-1" style={{ color: C.green }}>Delivered: {fmtDate(b.actualDelivery)}{b.calfDetails ? ` — ${b.calfDetails}` : ""}</p>}
            </div>
          ))}
        </div>
      )}
      {showAdd && <BreedingModal setData={setData} animal={animal} onClose={() => setShowAdd(false)} notify={notify} />}
    </Card>
  );
}

function BreedingModal({ setData, animal, onClose, notify }) {
  const [f, setF] = useState({ heatDate: "", matingDate: "", method: "Natural", pregnancyStatus: "Pending", expectedDelivery: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const row = await dbInsert("breeding", { animalId: animal.id, heatDate: f.heatDate || null, matingDate: f.matingDate || null, method: f.method, pregnancyStatus: f.pregnancyStatus, expectedDelivery: f.expectedDelivery || null, notes: f.notes });
      setData((d) => ({ ...d, breeding: [...d.breeding, row] }));
      onClose();
    } catch (e) { notify("Could not save record"); } finally { setSaving(false); }
  };
  return (
    <Sheet title="Add Breeding Record" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Record"}</Btn>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Heat Date"><input type="date" className={inputCls} style={inputStyle} value={f.heatDate} onChange={(e) => setF({ ...f, heatDate: e.target.value })} /></Field>
        <Field label="Mating Date"><input type="date" className={inputCls} style={inputStyle} value={f.matingDate} onChange={(e) => setF({ ...f, matingDate: e.target.value })} /></Field>
      </div>
      <Field label="Method">
        <select className={inputCls} style={inputStyle} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          <option>Natural</option><option>Artificial Insemination</option>
        </select>
      </Field>
      <Field label="Pregnancy Status">
        <select className={inputCls} style={inputStyle} value={f.pregnancyStatus} onChange={(e) => setF({ ...f, pregnancyStatus: e.target.value })}>
          <option>Pending</option><option>Confirmed</option><option>Not Pregnant</option><option>Delivered</option>
        </select>
      </Field>
      <Field label="Expected Delivery"><input type="date" className={inputCls} style={inputStyle} value={f.expectedDelivery} onChange={(e) => setF({ ...f, expectedDelivery: e.target.value })} /></Field>
      <Field label="Notes"><input className={inputCls} style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  Inventory                                                          */
/* ---------------------------------------------------------------- */
function InventoryScreen({ data, setData, onBack, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const stockValue = data.inventory.reduce((s, i) => s + i.currentStock * i.avgCost, 0);

  const remove = async (id) => {
    try { await dbDelete("inventory", id); setData((d) => ({ ...d, inventory: d.inventory.filter((i) => i.id !== id) })); notify("Item deleted"); }
    catch (e) { notify("Could not delete item"); }
  };

  return (
    <Screen>
      <TopBar title="Inventory" subtitle={`Stock value ${fmt(stockValue)}`} onBack={onBack} right={
        <button onClick={() => setShowAdd(true)} className="p-2 rounded-full" style={{ background: C.green }}><Plus size={18} color="white" /></button>
      } />
      {data.inventory.length === 0 ? (
        <Empty icon={<Package size={22} color={C.green} />} title="No inventory items" note="Add feed, medicine or supplies." actionLabel="Add Item" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {data.inventory.map((i, idx) => {
            const low = i.currentStock <= i.minimumStock;
            const pct = Math.min(100, Math.round((i.currentStock / (i.minimumStock * 2 || 1)) * 100));
            return (
              <Card key={i.id} className="!py-3 animate-row-in" style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{i.name}</p>
                  <div className="flex items-center gap-1.5">
                    {low && <Badge tone="warn">Low Stock</Badge>}
                    <RowActions onEdit={() => setEditItem(i)} onDelete={() => remove(i.id)} />
                  </div>
                </div>
                <p className="text-[11px] mb-2" style={{ color: C.gray }}>{i.category} · {i.currentStock} {i.unit} in stock · min {i.minimumStock} {i.unit}</p>
                <div className="h-1.5 rounded-full w-full" style={{ background: C.line }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: low ? C.warn : C.green }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {showAdd && <InventoryModal setData={setData} onClose={() => setShowAdd(false)} notify={notify} />}
      {editItem && <InventoryModal setData={setData} item={editItem} onClose={() => setEditItem(null)} notify={notify} />}
    </Screen>
  );
}

function InventoryModal({ setData, onClose, notify, item }) {
  const isEdit = !!item;
  const [f, setF] = useState(item
    ? { name: item.name, category: item.category, unit: item.unit, currentStock: String(item.currentStock), minimumStock: String(item.minimumStock), avgCost: String(item.avgCost) }
    : { name: "", category: "Feed", unit: "kg", currentStock: "", minimumStock: "", avgCost: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name) return;
    const payload = { name: f.name, category: f.category, unit: f.unit, currentStock: parseFloat(f.currentStock) || 0, minimumStock: parseFloat(f.minimumStock) || 0, avgCost: parseFloat(f.avgCost) || 0 };
    setSaving(true);
    try {
      if (isEdit) {
        const row = await dbUpdate("inventory", item.id, payload);
        setData((d) => ({ ...d, inventory: d.inventory.map((i) => i.id === item.id ? row : i) }));
        notify("Item updated");
      } else {
        const row = await dbInsert("inventory", payload);
        setData((d) => ({ ...d, inventory: [...d.inventory, row] }));
        notify("Item added");
      }
      onClose();
    } catch (e) {
      notify("Could not save item");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title={isEdit ? "Rename / Edit Item" : "Add Inventory Item"} onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Save Item"}</Btn>}>
      <Field label="Item Name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select className={inputCls} style={inputStyle} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option>Feed</option><option>Minerals</option><option>Medicines</option><option>Cleaning</option><option>Equipment</option><option>Other</option>
          </select>
        </Field>
        <Field label="Unit">
          <select className={inputCls} style={inputStyle} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            <option>kg</option><option>bag</option><option>liter</option><option>unit</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Current Stock"><input type="number" className={inputCls} style={inputStyle} value={f.currentStock} onChange={(e) => setF({ ...f, currentStock: e.target.value })} /></Field>
        <Field label="Minimum Stock"><input type="number" className={inputCls} style={inputStyle} value={f.minimumStock} onChange={(e) => setF({ ...f, minimumStock: e.target.value })} /></Field>
      </div>
      <Field label="Average Cost / unit"><input type="number" className={inputCls} style={inputStyle} value={f.avgCost} onChange={(e) => setF({ ...f, avgCost: e.target.value })} /></Field>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  Purchases                                                          */
/* ---------------------------------------------------------------- */
function PurchasesScreen({ data, setData, onBack, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const totalDue = data.purchases.reduce((s, p) => s + p.credit, 0);

  const removePurchase = async (p) => {
    if (!window.confirm("Delete this purchase? Stock added by it will be reversed.")) return;
    try {
      await dbDelete("purchases", p.id);
      const item = data.inventory.find((i) => i.name === p.product);
      let updatedItem = null;
      if (item) updatedItem = await dbUpdate("inventory", item.id, { currentStock: Math.max(0, item.currentStock - p.quantity) });
      setData((d) => ({
        ...d,
        purchases: d.purchases.filter((x) => x.id !== p.id),
        inventory: updatedItem ? d.inventory.map((i) => i.id === updatedItem.id ? updatedItem : i) : d.inventory,
      }));
      notify("Purchase deleted");
    } catch (e) {
      notify("Could not delete purchase");
    }
  };

  return (
    <Screen>
      <TopBar title="Purchases" subtitle={`Supplier balance due ${fmt(totalDue)}`} onBack={onBack} right={
        <button onClick={() => setShowAdd(true)} className="p-2 rounded-full" style={{ background: C.green }}><Plus size={18} color="white" /></button>
      } />
      {data.purchases.length === 0 ? (
        <Empty icon={<Truck size={22} color={C.green} />} title="No purchases yet" note="Record purchases from suppliers." actionLabel="Add Purchase" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {[...data.purchases].sort((a, b) => b.date.localeCompare(a.date)).map((p, i) => (
            <Card key={p.id} className="!py-3 animate-row-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold" style={{ color: C.text }}>{p.supplier}</p>
                <div className="flex items-center gap-1.5">
                  <Badge tone={p.status === "Paid" ? "green" : "warn"}>{p.status}</Badge>
                  <RowActions onDelete={() => removePurchase(p)} />
                </div>
              </div>
              <p className="text-[11px] mb-1" style={{ color: C.gray }}>{fmtDate(p.date)} · {p.product} · {p.quantity} {p.unit} @ {fmt(p.unitPrice)}</p>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: C.gray }}>Paid {fmt(p.paid)}</span>
                <span className="font-display font-bold" style={{ color: p.credit > 0 ? C.warn : C.green }}>{fmt(p.total)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {showAdd && <PurchaseModal data={data} setData={setData} onClose={() => setShowAdd(false)} notify={notify} />}
    </Screen>
  );
}

function PurchaseModal({ data, setData, onClose, notify }) {
  const [mode, setMode] = useState(data.inventory.length === 0 ? "new" : "existing");
  const [f, setF] = useState({
    supplier: "", productId: data.inventory[0]?.id || "", quantity: "", unitPrice: "", paid: "",
    newName: "", newCategory: "Feed", newUnit: "kg",
  });
  const existingProduct = data.inventory.find((i) => i.id === f.productId);
  const unit = mode === "new" ? f.newUnit : (existingProduct?.unit || "");
  const total = (parseFloat(f.quantity) || 0) * (parseFloat(f.unitPrice) || 0);
  const paid = parseFloat(f.paid) || 0;
  const credit = Math.max(total - paid, 0);

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.supplier || !f.quantity) return;
    if (mode === "existing" && !existingProduct) return;
    if (mode === "new" && !f.newName) return;
    const status = credit === 0 ? "Paid" : paid === 0 ? "Unpaid" : "Partial";
    const qty = parseFloat(f.quantity);
    const price = parseFloat(f.unitPrice) || 0;

    setSaving(true);
    try {
      let productName, productUnit, updatedInventoryItem = null, newInventoryItem = null;
      if (mode === "new") {
        newInventoryItem = await dbInsert("inventory", { name: f.newName, category: f.newCategory, unit: f.newUnit, currentStock: qty, minimumStock: 0, avgCost: price });
        productName = newInventoryItem.name; productUnit = newInventoryItem.unit;
      } else {
        updatedInventoryItem = await dbUpdate("inventory", existingProduct.id, { currentStock: existingProduct.currentStock + qty });
        productName = existingProduct.name; productUnit = existingProduct.unit;
      }
      const purchase = await dbInsert("purchases", { supplier: f.supplier, date: today(), product: productName, quantity: qty, unit: productUnit, unitPrice: price, total, paid, credit, status });

      setData((d) => ({
        ...d,
        purchases: [...d.purchases, purchase],
        inventory: newInventoryItem
          ? [...d.inventory, newInventoryItem]
          : d.inventory.map((i) => i.id === updatedInventoryItem.id ? updatedInventoryItem : i),
      }));
      notify("Purchase recorded, stock updated");
      onClose();
    } catch (e) {
      notify("Could not save purchase");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Add Purchase" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : `Save Purchase · ${fmt(total)}`}</Btn>}>
      <Field label="Supplier"><input className={inputCls} style={inputStyle} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="Supplier name" /></Field>

      {data.inventory.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => setMode("existing")} className="flex-1 rounded-xl py-2 text-xs font-semibold" style={mode === "existing" ? { background: C.green, color: C.white } : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }}>Existing Item</button>
          <button onClick={() => setMode("new")} className="flex-1 rounded-xl py-2 text-xs font-semibold" style={mode === "new" ? { background: C.green, color: C.white } : { background: C.white, color: C.gray, border: `1px solid ${C.line}` }}>New Item</button>
        </div>
      )}

      {mode === "existing" && data.inventory.length > 0 ? (
        <Field label="Product">
          <select className={inputCls} style={inputStyle} value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
            {data.inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Product Name"><input className={inputCls} style={inputStyle} value={f.newName} onChange={(e) => setF({ ...f, newName: e.target.value })} placeholder="e.g. Maize" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className={inputCls} style={inputStyle} value={f.newCategory} onChange={(e) => setF({ ...f, newCategory: e.target.value })}>
                <option>Feed</option><option>Minerals</option><option>Medicines</option><option>Cleaning</option><option>Equipment</option><option>Other</option>
              </select>
            </Field>
            <Field label="Unit">
              <select className={inputCls} style={inputStyle} value={f.newUnit} onChange={(e) => setF({ ...f, newUnit: e.target.value })}>
                <option>kg</option><option>bag</option><option>liter</option><option>unit</option>
              </select>
            </Field>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantity (${unit || ""})`}><input type="number" className={inputCls} style={inputStyle} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
        <Field label="Unit Price"><input type="number" className={inputCls} style={inputStyle} value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} /></Field>
      </div>
      <Field label="Paid Amount"><input type="number" className={inputCls} style={inputStyle} value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} placeholder="0" /></Field>
      <p className="text-xs" style={{ color: C.gray }}>Credit remaining: <strong style={{ color: C.warn }}>{fmt(credit)}</strong></p>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  Expenses                                                           */
/* ---------------------------------------------------------------- */
function ExpensesScreen({ data, setData, onBack, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const monthTotal = data.expenses.filter((e) => e.date.startsWith(today().slice(0, 7))).reduce((s, e) => s + e.amount, 0);
  return (
    <Screen>
      <TopBar title="Expenses" subtitle={`${fmt(monthTotal)} this month`} onBack={onBack} right={
        <button onClick={() => setShowAdd(true)} className="p-2 rounded-full" style={{ background: C.green }}><Plus size={18} color="white" /></button>
      } />
      {data.expenses.length === 0 ? (
        <Empty icon={<Wallet size={22} color={C.green} />} title="No expenses yet" note="Track feed, salaries and other costs." actionLabel="Add Expense" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {[...data.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e, i) => (
            <Card key={e.id} className="flex items-center justify-between !py-3 animate-row-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: C.text }}>{e.category}</p>
                <p className="text-[11px]" style={{ color: C.gray }}>{fmtDate(e.date)} · {e.paymentMethod}{e.description ? " · " + e.description : ""}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-sm" style={{ color: C.danger }}>{fmt(e.amount)}</span>
                <RowActions onDelete={() => dbDelete("expenses", e.id).then(() => { setData((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) })); notify("Expense deleted"); }).catch(() => notify("Could not delete expense"))} />
              </div>
            </Card>
          ))}
        </div>
      )}
      {showAdd && <ExpenseModal setData={setData} onClose={() => setShowAdd(false)} notify={notify} />}
    </Screen>
  );
}

function ExpenseModal({ setData, onClose, notify }) {
  const [f, setF] = useState({ category: "Feed", amount: "", method: "Cash", description: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.amount) return;
    setSaving(true);
    try {
      const row = await dbInsert("expenses", { category: f.category, amount: parseFloat(f.amount), date: today(), paymentMethod: f.method, description: f.description });
      setData((d) => ({ ...d, expenses: [...d.expenses, row] }));
      notify("Expense added");
      onClose();
    } catch (e) {
      notify("Could not save expense");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title="Add Expense" onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Expense"}</Btn>}>
      <Field label="Category">
        <select className={inputCls} style={inputStyle} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option>Feed</option><option>Salaries</option><option>Electricity</option><option>Water</option><option>Veterinary</option>
          <option>Medicine</option><option>Transport</option><option>Repairs</option><option>Rent</option><option>Fuel</option><option>Other</option>
        </select>
      </Field>
      <Field label="Amount"><input type="number" inputMode="decimal" className={inputCls} style={inputStyle} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></Field>
      <Field label="Payment Method">
        <select className={inputCls} style={inputStyle} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          <option>Cash</option><option>Bank</option><option>JazzCash</option><option>Easypaisa</option>
        </select>
      </Field>
      <Field label="Description"><input className={inputCls} style={inputStyle} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Optional note" /></Field>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  Employees                                                          */
/* ---------------------------------------------------------------- */
function EmployeesScreen({ data, setData, onBack, notify }) {
  const [showAdd, setShowAdd] = useState(false);
  const [payEmp, setPayEmp] = useState(null);
  const [editEmp, setEditEmp] = useState(null);
  const monthKey = today().slice(0, 7);

  const removeEmp = async (id) => {
    if (!window.confirm("Delete this employee? Their salary history will also be removed.")) return;
    try { await dbDelete("employees", id); } catch (e) { notify("Could not delete employee"); return; }
    setData((d) => ({ ...d, employees: d.employees.filter((e) => e.id !== id), salaryPayments: d.salaryPayments.filter((p) => p.employeeId !== id) }));
    notify("Employee deleted");
  };

  return (
    <Screen>
      <TopBar title="Employees" subtitle={`${data.employees.length} on payroll`} onBack={onBack} right={
        <button onClick={() => setShowAdd(true)} className="p-2 rounded-full" style={{ background: C.green }}><Plus size={18} color="white" /></button>
      } />
      {data.employees.length === 0 ? (
        <Empty icon={<UserCog size={22} color={C.green} />} title="No employees" note="Add your farm staff." actionLabel="Add Employee" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="flex flex-col gap-2">
          {data.employees.map((e, i) => {
            const paid = data.salaryPayments.filter((p) => p.employeeId === e.id && p.month === monthKey).reduce((s, p) => s + p.paidAmount, 0);
            const remaining = e.salary - paid;
            return (
              <Card key={e.id} className="!py-3 animate-row-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold" style={{ color: C.text }}>{e.name}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={remaining > 0 ? "warn" : "green"}>{remaining > 0 ? "Due " + fmt(remaining) : "Paid"}</Badge>
                    <RowActions onEdit={() => setEditEmp(e)} onDelete={() => removeEmp(e.id)} />
                  </div>
                </div>
                <p className="text-[11px] mb-2" style={{ color: C.gray }}>{e.role} · Salary {fmt(e.salary)}</p>
                <Btn variant="ghost" onClick={() => setPayEmp(e.id)}><Banknote size={14} /> Pay Salary</Btn>
              </Card>
            );
          })}
        </div>
      )}
      {showAdd && <EmployeeModal setData={setData} onClose={() => setShowAdd(false)} notify={notify} />}
      {editEmp && <EmployeeModal setData={setData} employee={editEmp} onClose={() => setEditEmp(null)} notify={notify} />}
      {payEmp && <SalaryModal data={data} setData={setData} employeeId={payEmp} onClose={() => setPayEmp(null)} notify={notify} />}
    </Screen>
  );
}

function EmployeeModal({ setData, onClose, notify, employee }) {
  const isEdit = !!employee;
  const [f, setF] = useState(employee
    ? { name: employee.name, phone: employee.phone, role: employee.role, salary: String(employee.salary) }
    : { name: "", phone: "", role: "Farm worker", salary: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name || !f.salary) return;
    setSaving(true);
    try {
      if (isEdit) {
        const row = await dbUpdate("employees", employee.id, { name: f.name, phone: f.phone, role: f.role, salary: parseFloat(f.salary) });
        setData((d) => ({ ...d, employees: d.employees.map((e) => e.id === employee.id ? row : e) }));
        notify("Employee updated");
      } else {
        const row = await dbInsert("employees", { name: f.name, phone: f.phone, role: f.role, salary: parseFloat(f.salary), joiningDate: today(), status: "Active" });
        setData((d) => ({ ...d, employees: [...d.employees, row] }));
        notify("Employee added");
      }
      onClose();
    } catch (e) {
      notify("Could not save employee");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title={isEdit ? "Rename / Edit Employee" : "Add Employee"} onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Save Employee"}</Btn>}>
      <Field label="Name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Phone"><input className={inputCls} style={inputStyle} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Role">
        <select className={inputCls} style={inputStyle} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option>Farm worker</option><option>Driver</option><option>Manager</option><option>Cleaner</option><option>Accountant</option><option>Other</option>
        </select>
      </Field>
      <Field label="Monthly Salary"><input type="number" className={inputCls} style={inputStyle} value={f.salary} onChange={(e) => setF({ ...f, salary: e.target.value })} /></Field>
    </Sheet>
  );
}

function SalaryModal({ data, setData, employeeId, onClose, notify }) {
  const emp = data.employees.find((e) => e.id === employeeId);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!amount) return;
    setSaving(true);
    try {
      const row = await dbInsert("salaryPayments", { employeeId, month: today().slice(0, 7), salary: emp.salary, advance: 0, deduction: 0, paidAmount: parseFloat(amount), date: today() });
      setData((d) => ({ ...d, salaryPayments: [...d.salaryPayments, row] }));
      notify("Salary payment recorded");
      onClose();
    } catch (e) {
      notify("Could not save payment");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet title={`Pay ${emp?.name || ""}`} onClose={onClose} footer={<Btn full onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Payment"}</Btn>}>
      <Field label="Amount"><input type="number" inputMode="decimal" className={inputCls} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(emp?.salary || 0)} /></Field>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/*  Reports                                                            */
/* ---------------------------------------------------------------- */
function ReportsScreen({ data, setData, onBack, notify }) {
  const [mode, setMode] = useState("day");
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());

  const dayTotals = computeDayTotals(data, date);
  const alreadyClosed = data.closings.some((c) => c.date === date);
  const isToday = date === today();

  const rangeValid = from && to && from <= to;
  const rangeTotals = rangeValid ? computeRangeTotals(data, from, to) : null;

  const t = mode === "day" ? dayTotals : (rangeTotals || dayTotals);

  const chartData = mode === "day"
    ? [...Array(7)].map((_, idx) => {
        const d = daysAgo(6 - idx);
        const day = computeDayTotals(data, d);
        return { day: new Date(d).toLocaleDateString("en-GB", { weekday: "short" }), milk: Math.round(day.milkProduced), profit: day.profit };
      })
    : (rangeTotals ? rangeTotals.days : []);

  const closeDay = async () => {
    if (alreadyClosed) return;
    try {
      const row = await dbInsert("closings", { date, milkProduced: dayTotals.milkProduced, milkSold: dayTotals.milkSold, sales: dayTotals.salesTotal, expenses: dayTotals.dayExpenses, paymentsReceived: dayTotals.paymentsReceived, paymentsMade: dayTotals.paymentsMade, profit: dayTotals.profit });
      setData((d) => ({ ...d, closings: [...d.closings, row] }));
      notify("Day closed and saved");
    } catch (e) {
      notify("Could not close the day");
    }
  };

  const [downloading, setDownloading] = useState(false);
  const downloadReport = async () => {
    setDownloading(true);
    try {
      const { buildProfitLossPdf } = await import("./pdf.js");
      const doc = await buildProfitLossPdf(data.settings, { mode, date, from, to, totals: t });
      const filename = mode === "day"
        ? `${data.settings.farmName.replace(/\s+/g, "-")}-PL-report-${date}.pdf`
        : `${data.settings.farmName.replace(/\s+/g, "-")}-PL-report-${from}-to-${to}.pdf`;
      doc.save(filename);
      notify("Report downloaded");
    } catch (e) {
      notify("Could not generate report");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Reports" subtitle="Daily, weekly and custom-range performance" onBack={onBack} />

      <Chips options={["Single Day", "Date Range"]} value={mode === "day" ? "Single Day" : "Date Range"} onChange={(v) => setMode(v === "Single Day" ? "day" : "range")} />

      {mode === "day" ? (
        <Field label="View Report For">
          <input type="date" max={today()} className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="From">
            <input type="date" max={to || today()} className={inputCls} style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" max={today()} min={from} className={inputCls} style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      )}

      {mode === "range" && !rangeValid && (
        <p className="text-xs mb-3" style={{ color: C.danger }}>Please choose a valid date range (from date must be before to date).</p>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: C.gray }}>
            {mode === "day" ? <>DAILY REPORT &middot; {fmtDate(date)}</> : <>RANGE REPORT &middot; {fmtDate(from)} &ndash; {fmtDate(to)}</>}
          </p>
          {mode === "day" && alreadyClosed && <Badge tone="green">Closed</Badge>}
          {mode === "range" && rangeTotals && <Badge tone="gray">{rangeTotals.saleCount} sales</Badge>}
        </div>
        <Row label="Milk Produced" value={fmtL(t.milkProduced)} />
        <Row label="Milk Sold" value={fmtL(t.milkSold)} />
        {mode === "day" && <Row label="Milk Remaining" value={fmtL(t.milkProduced - t.milkSold)} />}
        <Row label="Milk Revenue" value={fmt(t.salesTotal)} />
        <Row label="Expenses" value={fmt(t.dayExpenses)} />
        <Row label="Customer Payments" value={fmt(t.paymentsReceived)} />
        <Row label="Supplier Payments" value={fmt(t.paymentsMade)} />
        <Row label="Net Profit" value={fmt(t.profit)} bold tone={t.profit >= 0 ? "green" : "warn"} />
      </Card>

      <Btn full variant="outline" onClick={downloadReport} className="mb-4" disabled={(mode === "range" && !rangeValid) || downloading}><Download size={16} /> {downloading ? "Generating PDF…" : "Download Profit & Loss PDF"}</Btn>

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>MILK PRODUCTION &middot; {mode === "day" ? "LAST 7 DAYS" : "SELECTED RANGE"}</p>
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.gray }} axisLine={false} tickLine={false} interval={mode === "range" && chartData.length > 10 ? Math.ceil(chartData.length / 8) : 0} />
              <YAxis tick={{ fontSize: 11, fill: C.gray }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="milk" fill={C.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>PROFIT TREND &middot; {mode === "day" ? "LAST 7 DAYS" : "SELECTED RANGE"}</p>
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.gray }} axisLine={false} tickLine={false} interval={mode === "range" && chartData.length > 10 ? Math.ceil(chartData.length / 8) : 0} />
              <YAxis tick={{ fontSize: 11, fill: C.gray }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="profit" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {mode === "day" && isToday && (
        <Btn full variant={alreadyClosed ? "ghost" : "primary"} disabled={alreadyClosed} onClick={closeDay}>
          {alreadyClosed ? <><Check size={16} /> Day Already Closed</> : "Close Day"}
        </Btn>
      )}
    </Screen>
  );
}

/* ---------------------------------------------------------------- */
/*  Settings                                                           */
/* ---------------------------------------------------------------- */
function SettingsScreen({ data, setData, role, onBack, onSignOut, userEmail, installPrompt, onInstalled }) {
  const s = data.settings;
  const patch = (k, v) => setData((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isStandalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const doInstall = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    installPrompt.prompt();
    try {
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") onInstalled && onInstalled();
    } finally {
      setInstalling(false);
    }
  };

  // Debounced sync of settings -> farms table
  useEffect(() => {
    const t = setTimeout(() => {
      supabase.from("farms").update({
        name: s.farmName,
        owner_name: s.ownerName,
        phone: s.phone,
        address: s.address,
        city: s.city,
        country: s.country,
        language: s.language,
        morning_time: s.morningTime,
        evening_time: s.eveningTime,
        default_milk_price: s.defaultMilkPrice,
        app_lock_enabled: s.appLock.enabled,
        app_lock_pin: s.appLock.pin,
        notifications: s.notifications,
      }).eq("id", CURRENT_FARM_ID).then(({ error }) => { if (error) console.error(error); });
    }, 500);
    return () => clearTimeout(t);
  }, [JSON.stringify(s)]);

  const copyInviteCode = async () => {
    try { await navigator.clipboard.writeText(s.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };

  return (
    <Screen>
      <TopBar title="Settings" subtitle={`Signed in as ${role}`} onBack={onBack} />

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>GET THE APP</p>
        {isStandalone ? (
          <div className="flex items-center gap-2">
            <Badge tone="green">Installed</Badge>
            <p className="text-[11px]" style={{ color: C.gray }}>You're using the installed app.</p>
          </div>
        ) : installPrompt ? (
          <>
            <p className="text-[11px] mb-3" style={{ color: C.gray }}>Install Chaudhry Dairy Farm on this device for quick access from your home screen, like a regular app.</p>
            <Btn full onClick={doInstall} disabled={installing}>{installing ? "Installing…" : "Install App"}</Btn>
          </>
        ) : isIOS ? (
          <p className="text-[11px]" style={{ color: C.gray }}>
            To install: tap the <strong>Share</strong> button in Safari, then choose <strong>"Add to Home Screen"</strong>.
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: C.gray }}>
            Open your browser menu and choose <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Logo size={40} />
          <div>
            <p className="text-sm font-semibold" style={{ color: C.text }}>{s.farmName}</p>
            <p className="text-[11px]" style={{ color: C.gray }}>{s.city}, {s.country}</p>
          </div>
        </div>
        <Field label="Farm Name"><input className={inputCls} style={inputStyle} value={s.farmName} onChange={(e) => patch("farmName", e.target.value)} /></Field>
        <Field label="Owner Name"><input className={inputCls} style={inputStyle} value={s.ownerName} onChange={(e) => patch("ownerName", e.target.value)} /></Field>
        <Field label="Phone"><input className={inputCls} style={inputStyle} value={s.phone} onChange={(e) => patch("phone", e.target.value)} /></Field>
        <Field label="Address"><input className={inputCls} style={inputStyle} value={s.address} onChange={(e) => patch("address", e.target.value)} /></Field>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>OPERATIONS</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Morning Milking"><input type="time" className={inputCls} style={inputStyle} value={s.morningTime} onChange={(e) => patch("morningTime", e.target.value)} /></Field>
          <Field label="Evening Milking"><input type="time" className={inputCls} style={inputStyle} value={s.eveningTime} onChange={(e) => patch("eveningTime", e.target.value)} /></Field>
        </div>
        <Field label="Default Milk Price (PKR)"><input type="number" className={inputCls} style={inputStyle} value={s.defaultMilkPrice} onChange={(e) => patch("defaultMilkPrice", parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Currency"><input className={inputCls} style={{ ...inputStyle, background: "#F5F5F0" }} value="PKR (Rs.)" disabled /></Field>
        <Field label="Language">
          <select className={inputCls} style={inputStyle} value={s.language} onChange={(e) => patch("language", e.target.value)}>
            <option>English</option><option>Urdu</option>
          </select>
        </Field>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>ACCOUNT</p>
        <Field label="Login Email">
          <input className={inputCls} style={{ ...inputStyle, background: "#F5F5F0" }} value={userEmail || ""} disabled />
        </Field>
        <p className="text-[11px] mb-3" style={{ color: C.gray }}>
          Your data is saved to this account and kept year over year, accessible from any device.
        </p>
        <Btn variant="outline" full onClick={onSignOut}>Sign Out</Btn>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>TEAM</p>
        <p className="text-[11px] mb-2" style={{ color: C.gray }}>Share this invite code so employees or your accountant can join this farm.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl px-3 py-2.5 text-sm font-mono font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text, background: C.creamDark }}>{s.inviteCode}</div>
          <Btn variant="ghost" onClick={copyInviteCode}>{copied ? "Copied" : "Copy"}</Btn>
        </div>
      </Card>

      <AppLockSection settings={s} patch={patch} />

      <Card className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>NOTIFICATIONS</p>
        {Object.entries(s.notifications).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1.5">
            <span className="text-xs capitalize" style={{ color: C.text }}>{k.replace(/([A-Z])/g, " $1")}</span>
            <button
              onClick={() => patch("notifications", { ...s.notifications, [k]: !v })}
              className="w-10 h-6 rounded-full relative transition-colors"
              style={{ background: v ? C.green : C.line }}
            >
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: v ? 18 : 2 }} />
            </button>
          </div>
        ))}
      </Card>
    </Screen>
  );
}

function AppLockSection({ settings, patch }) {
  const lock = settings.appLock || { enabled: false, pin: "" };
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [editing, setEditing] = useState(!lock.enabled);
  const [err, setErr] = useState("");

  const savePin = () => {
    if (pin1.length < 4) { setErr("PIN must be at least 4 digits."); return; }
    if (pin1 !== pin2) { setErr("PINs do not match."); return; }
    patch("appLock", { enabled: true, pin: pin1 });
    setPin1(""); setPin2(""); setErr(""); setEditing(false);
  };

  const toggleOff = () => {
    patch("appLock", { enabled: false, pin: "" });
    setEditing(true);
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: C.gray }}>APP LOCK</p>
        {lock.enabled && <Badge tone="green">Enabled</Badge>}
      </div>
      {lock.enabled && !editing ? (
        <>
          <p className="text-[11px] mb-3" style={{ color: C.gray }}>A PIN is required every time the app is opened.</p>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setEditing(true)}><Lock size={14} /> Change PIN</Btn>
            <Btn variant="outline" onClick={toggleOff}>Turn Off</Btn>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] mb-3" style={{ color: C.gray }}>Set a 4&ndash;6 digit PIN. You'll need it to open the app.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New PIN">
              <input type="password" inputMode="numeric" maxLength={6} className={inputCls} style={inputStyle} value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
            </Field>
            <Field label="Confirm PIN">
              <input type="password" inputMode="numeric" maxLength={6} className={inputCls} style={inputStyle} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
            </Field>
          </div>
          {err && <p className="text-[11px] mb-2" style={{ color: C.danger }}>{err}</p>}
          <div className="flex gap-2">
            <Btn onClick={savePin}><Lock size={14} /> Save PIN</Btn>
            {lock.enabled && <Btn variant="outline" onClick={() => { setEditing(false); setErr(""); }}>Cancel</Btn>}
          </div>
        </>
      )}
    </Card>
  );
}
