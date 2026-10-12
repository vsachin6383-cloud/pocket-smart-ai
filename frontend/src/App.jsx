import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, Bot, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CreditCard, DollarSign,
  Download, Edit2, Eye, EyeOff, FileText, Filter, Home, Lightbulb, LogOut, Menu, MessageCircle,
  MoreHorizontal, Plus, Search, Send, Settings, ShieldCheck, ShoppingBag, Sparkles, Target,
  Trash2, TrendingDown, TrendingUp, Wallet, X, Utensils, CarFront, GraduationCap, HeartPulse, Zap,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { request } from "./api.js";

const CATEGORIES = ["Food", "Transport", "Education", "Shopping", "Bills", "Entertainment", "Healthcare", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Investments", "Gift", "Other"];
const NAV = [
  { label: "OVERVIEW", items: [["Dashboard", Home], ["Transactions", ArrowLeftRight], ["Analytics", Activity]] },
  { label: "MANAGE", items: [["Income", ArrowDownLeft], ["Expenses", ArrowUpRight], ["Budget", Target]] },
  { label: "YOUR ASSISTANT", items: [["AI Insights", Sparkles], ["AI Assistant", MessageCircle]] },
];
const COLORS = ["#5b70ed", "#f2a65a", "#41ad8c", "#e87575", "#9a72d8", "#49a6bf", "#d67bab", "#8992a3"];
const money = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
const monthLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short" });
const categoryIcon = (name) => ({ Food: Utensils, Transport: CarFront, Education: GraduationCap, Healthcare: HeartPulse, Bills: Zap, Shopping: ShoppingBag })[name] || CreditCard;

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("pocketsmart_token"));
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [authMode, setAuthMode] = useState("landing");
  const [authLoading, setAuthLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState({});

  const loadData = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    setLoading(true);
    setError("");
    try {
      const [me, overview, transactions, budget, analytics, recommendations] = await Promise.all([
        request("/api/auth/me", {}, activeToken),
        request("/api/dashboard", {}, activeToken),
        request("/api/transactions", {}, activeToken),
        request("/api/budget", {}, activeToken),
        request("/api/analytics", {}, activeToken),
        request("/api/recommendations", {}, activeToken),
      ]);
      setUser(me);
      setData({ ...overview, transactions, budget, analytics, recommendations });
      setBudgetDraft(String(budget.monthly_limit));
      setCategoryDraft(budget.category_limits || {});
    } catch (err) {
      if (err.message.includes("token") || err.message.includes("credentials")) {
        logout();
      } else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) loadData(token); }, [token, loadData]);
  useEffect(() => {
    if (toast) { const timer = setTimeout(() => setToast(""), 3200); return () => clearTimeout(timer); }
  }, [toast]);

  const logout = () => {
    localStorage.removeItem("pocketsmart_token");
    setToken(null); setUser(null); setData(null); setPage("Dashboard");
  };

  const authenticate = async (event) => {
    event.preventDefault();
    setAuthLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const result = await request(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST", body: JSON.stringify(payload),
      });
      localStorage.setItem("pocketsmart_token", result.access_token);
      setToken(result.access_token);
    } catch (err) { setError(err.message); }
    finally { setAuthLoading(false); }
  };

  const saveTransaction = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.amount = Number(payload.amount);
    try {
      if (editing) await request(`/api/transactions/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await request("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
      setModal(null); setEditing(null); await loadData(); setToast(editing ? "Transaction updated." : "Transaction added.");
    } catch (err) { setError(err.message); }
  };

  const deleteTransaction = async (id) => {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    try { await request(`/api/transactions/${id}`, { method: "DELETE" }); await loadData(); setToast("Transaction deleted."); }
    catch (err) { setError(err.message); }
  };

  const saveBudget = async (event) => {
    event.preventDefault();
    try {
      await request("/api/budget", {
        method: "PUT",
        body: JSON.stringify({ monthly_limit: Number(budgetDraft), category_limits: Object.fromEntries(Object.entries(categoryDraft).map(([key, value]) => [key, Number(value || 0)])) }),
      });
      await loadData(); setToast("Your budget is saved.");
    } catch (err) { setError(err.message); }
  };

  const sendChat = async (text = chatInput) => {
    if (!text.trim() || chatLoading) return;
    const next = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next); setChatInput(""); setChatLoading(true);
    try {
      const result = await request("/api/chat", { method: "POST", body: JSON.stringify({ message: text, history: next.slice(-8) }) }, token);
      setChatMessages([...next, { role: "assistant", content: result.answer }]);
    } catch (err) { setChatMessages([...next, { role: "assistant", content: `I couldn't answer that just now: ${err.message}` }]); }
    finally { setChatLoading(false); }
  };

  if (!token && authMode === "landing") return <LandingPage onSignUp={() => { setAuthMode("register"); setError(""); }} onLogin={() => { setAuthMode("login"); setError(""); }} />;
  if (!token) return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={authenticate} loading={authLoading} error={error} setError={setError} />;
  if (loading && !data) return <div className="loading-screen"><div className="loader" /><span>Getting your money picture ready…</span></div>;
  if (!data) return <div className="loading-screen"><p className="error-text">{error || "We couldn't load your account."}</p><button className="button primary" onClick={() => loadData()}>Try again</button><button className="button quiet" onClick={logout}>Log out</button></div>;

  const changePage = (next) => { setPage(next); setMobileOpen(false); setError(""); setFilter("All"); setQuery(""); };
  const currentTransactions = data.transactions.filter((item) => page === "Income" ? item.type === "income" : page === "Expenses" ? item.type === "expense" : true);
  const title = page === "Dashboard" ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user?.name?.split(" ")[0] || "there"}` : page;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Brand />
        <div className="workspace-label">PERSONAL WORKSPACE <ChevronDown size={14} /></div>
        <nav>{NAV.map((group) => <div className="nav-group" key={group.label}><div className="nav-heading">{group.label}</div>{group.items.map(([label, Icon]) => <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => changePage(label)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "AI Insights" && <span className="nav-dot" />}</button>)}</div>)}</nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16} /></div><strong>Your money, in focus</strong><p>Small steps today add up to a brighter tomorrow.</p><button onClick={() => changePage("AI Insights")}>Explore insights <ArrowRight size={14} /></button></div>
          <button className={`nav-item ${page === "Settings" ? "active" : ""}`} onClick={() => changePage("Settings")}><Settings size={18} /><span>Settings</span></button>
          <button className="profile-row" onClick={() => changePage("Settings")}><div className="avatar">{user?.name?.[0]?.toUpperCase() || "P"}</div><div className="profile-copy"><strong>{user?.name}</strong><span>Personal account</span></div><MoreHorizontal size={18} /></button>
        </div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{page}</strong></div><div className="topbar-actions"><span className="today-date"><CalendarDays size={15} />{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span><button className="icon-button notification-button" title="Notifications" onClick={() => changePage("AI Insights")}><Bell size={18} />{data.alerts.length > 0 && <i />}</button><div className="top-avatar">{user?.name?.[0]?.toUpperCase()}</div></div></header>
        <div className="page-content">
          {error && <div className="error-banner"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button></div>}
          <div className="page-heading"><div><div className="eyebrow">{page === "Dashboard" ? "YOUR FINANCIAL OVERVIEW" : "POCKETSMART AI  /  " + page.toUpperCase()}</div><h1>{title}</h1><p>{page === "Dashboard" ? "Here's what's happening with your money this month." : pageCopy(page)}</p></div><div className="heading-actions">{["Dashboard", "Transactions", "Income", "Expenses"].includes(page) && <button className="button primary" onClick={() => { setEditing(null); setModal("transaction"); }}><Plus size={17} />Add transaction</button>}</div></div>
          {page === "Dashboard" && <Dashboard data={data} setPage={changePage} />}
          {["Transactions", "Income", "Expenses"].includes(page) && <TransactionsPage transactions={currentTransactions} page={page} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} setEditing={(item) => { setEditing(item); setModal("transaction"); }} onDelete={deleteTransaction} onAdd={() => { setEditing(null); setModal("transaction"); }} />}
          {page === "Budget" && <BudgetPage data={data} budgetDraft={budgetDraft} setBudgetDraft={setBudgetDraft} categoryDraft={categoryDraft} setCategoryDraft={setCategoryDraft} onSubmit={saveBudget} />}
          {page === "Analytics" && <AnalyticsPage analytics={data.analytics} />}
          {page === "AI Insights" && <InsightsPage data={data} setPage={changePage} />}
          {page === "AI Assistant" && <ChatPage messages={chatMessages} input={chatInput} setInput={setChatInput} send={sendChat} loading={chatLoading} />}
          {page === "Settings" && <SettingsPage user={user} logout={logout} />}
        </div>
        <footer className="footer">Your financial data is private and securely stored. <ShieldCheck size={14} /> <span>Made for a little more peace of mind.</span></footer>
      </main>
      {modal === "transaction" && <TransactionModal editing={editing} onClose={() => { setModal(null); setEditing(null); }} onSubmit={saveTransaction} />}
      {toast && <div className="toast"><span className="toast-check"><Check size={14} /></span>{toast}</div>}
    </div>
  );
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><Wallet size={20} strokeWidth={2.1} /></div><span>PocketSmart <em>AI</em></span></div>;
}

function LandingPage({ onSignUp, onLogin }) {
  return <div className="landing-page">
    <header className="landing-nav"><Brand /><div><button className="landing-login" onClick={onLogin}>Sign in</button><button className="button primary" onClick={onSignUp}>Get started <ArrowRight size={15} /></button></div></header>
    <main>
      <section className="landing-hero">
        <div className="landing-copy"><span className="landing-pill"><Sparkles size={13} /> YOUR FRIENDLY MONEY SIDEKICK</span><h1>Your money.<br /><span>A little more clear.</span></h1><p>Understand your spending, make a budget that feels right, and find your next small step — all in one calm, simple place.</p><div className="landing-ctas"><button className="button primary" onClick={onSignUp}>Get started for free <ArrowRight size={16} /></button><button className="landing-demo" onClick={onLogin}>Explore the demo</button></div><div className="landing-trust"><ShieldCheck size={15} /> Your financial data stays private to you.</div></div>
        <div className="landing-preview"><div className="preview-window"><div className="preview-header"><span className="preview-brand"><span><Wallet size={13} /></span>PocketSmart <i>AI</i></span><span className="preview-avatar">A</span></div><div className="preview-content"><span className="preview-label">YOUR FINANCIAL OVERVIEW</span><h3>Good morning, Alex</h3><div className="preview-stats"><div><span>Income</span><strong>$4,600</strong></div><div><span>Expenses</span><strong>$1,327</strong></div><div><span>Balance</span><strong>$3,273</strong></div></div><div className="preview-chart"><span>Monthly overview</span><div className="preview-bars">{[42,65,48,80,59,92,70,84,60,100,76,89].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><div className="preview-tip"><Sparkles size={14} /><span><strong>A little insight</strong><br />Food is your biggest category this month.</span></div></div></div><div className="landing-float landing-float-one"><span><TrendingUp size={15} /></span><div><strong>You're making progress</strong><small>One step at a time</small></div></div><div className="landing-float landing-float-two"><span><Target size={15} /></span><div><strong>Budget on track</strong><small>A little room to breathe</small></div></div></div>
      </section>
      <section className="landing-features"><div><span className="feature-icon feature-blue"><Activity size={18} /></span><h3>See the whole picture</h3><p>Simple charts and summaries make your money patterns easier to understand.</p></div><div><span className="feature-icon feature-green"><Target size={18} /></span><h3>Budget without the stress</h3><p>Set flexible monthly and category guides that work for your real life.</p></div><div><span className="feature-icon feature-purple"><Bot size={18} /></span><h3>Ask a friendly assistant</h3><p>Get helpful answers grounded in your own spending and income history.</p></div><div><span className="feature-icon feature-orange"><ShieldCheck size={18} /></span><h3>Your data stays yours</h3><p>Your account data is private, with AI chat kept optional.</p></div></section>
      <section className="landing-bottom"><div><span>START WITH A CLEARER PICTURE</span><h2>Good money habits start small.</h2><p>Take a look at your spending and choose one easy next step.</p></div><button className="button primary" onClick={onSignUp}>Create your free account <ArrowRight size={15} /></button></section>
    </main>
    <footer className="landing-footer">© 2026 PocketSmart AI <span>Helpful money habits, one step at a time.</span><span>General budgeting guidance, not investment advice.</span></footer>
  </div>;
}

function AuthScreen({ mode, setMode, onSubmit, loading, error, setError }) {
  const [showPassword, setShowPassword] = useState(false);
  return <div className="auth-layout"><section className="auth-visual"><Brand /><div className="auth-visual-copy"><span className="auth-kicker"><Sparkles size={14} /> MONEY, MADE CLEARER</span><h1>A little more clarity.<br /><span>A lot more confidence.</span></h1><p>A friendly place to understand your money, build better habits, and feel good about your next step.</p><div className="auth-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><Wallet size={31} /></div><div className="art-float float-a"><TrendingUp size={17} /><span>You're building momentum</span></div><div className="art-float float-b"><span className="art-dot" /><span>Your goals, in view</span></div></div></div><div className="auth-footnote"><ShieldCheck size={15} /> Your financial data stays yours.</div></section><section className="auth-panel"><div className="auth-panel-top"><span>Already tracking smarter?</span><button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></div><form className="auth-form" onSubmit={onSubmit}><div className="eyebrow">{mode === "login" ? "WELCOME BACK" : "LET'S GET YOU STARTED"}</div><h2>{mode === "login" ? "Sign in to PocketSmart" : "Create your account"}</h2><p>{mode === "login" ? "Your clearer money picture is just a sign-in away." : "A few details and you're on your way."}</p>{mode === "register" && <label>Your name<input name="name" placeholder="e.g. Alex Morgan" minLength="2" maxLength="80" required autoComplete="name" /></label>}<label>Email address<input name="email" placeholder="you@example.com" type="email" maxLength="254" required autoComplete="email" /></label><label>Password<div className="password-field"><input name="password" type={showPassword ? "text" : "password"} placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} minLength="8" required autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{error && <div className="auth-error">{error}</div>}<button className="button primary auth-submit" disabled={loading}>{loading ? <span className="loader light-loader" /> : mode === "login" ? "Sign in" : "Create account"} {!loading && <ArrowRight size={17} />}</button><div className="demo-login"><div className="demo-title"><span>JUST TAKING A LOOK?</span><div /></div><p>Try the demo account to explore everything.</p><button type="button" onClick={(event) => { const form = event.currentTarget.closest("form"); form.elements.email.value = "demo@pocketsmart.ai"; form.elements.password.value = "demo12345"; }}>Fill demo sign-in details <ArrowRight size={14} /></button></div><div className="auth-legal">By continuing, you agree to our <span>Terms</span> and <span>Privacy Policy</span>.</div></form><div className="auth-bottom">© 2026 PocketSmart AI <span>Built for everyday money moments.</span></div></section></div>;
}

function Dashboard({ data, setPage }) {
  const { summary, analytics, budget, alerts, transactions } = data;
  const topCategory = analytics.categories?.[0];
  const recent = transactions.slice(0, 5);
  const budgetPercent = budget.monthly_limit ? Math.min(100, summary.monthly_expenses / budget.monthly_limit * 100) : 0;
  return <div className="dashboard-grid">
    <div className="stat-grid">
      <StatCard title="Total income" amount={summary.monthly_income} icon={ArrowDownLeft} tone="green" note="This month" />
      <StatCard title="Total expenses" amount={summary.monthly_expenses} icon={ArrowUpRight} tone="coral" note="This month" />
      <StatCard title="Remaining balance" amount={summary.balance} icon={Wallet} tone="blue" note="Income minus expenses" />
      <StatCard title="Saved this month" amount={Math.max(0, summary.monthly_income - summary.monthly_expenses)} icon={Sparkles} tone="purple" note="A little progress counts" />
    </div>
    <section className="card chart-card"><div className="card-head"><div><h3>Your money over time</h3><p>A look at the last six months</p></div><button className="subtle-link" onClick={() => setPage("Analytics")}>Full analytics <ArrowRight size={14} /></button></div><div className="chart-legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Expenses</span></div><div className="area-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.monthly} margin={{ top: 15, right: 7, left: -14, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7185f2" stopOpacity={0.19} /><stop offset="100%" stopColor="#7185f2" stopOpacity={0} /></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f1a35b" stopOpacity={0.15} /><stop offset="100%" stopColor="#f1a35b" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#edf0f4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#9aa1ae", fontSize: 11 }} dy={10} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#9aa1ae", fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `$${v / 1000}k` : `$${v}`} /><Tooltip formatter={(value) => money(value)} contentStyle={{ borderRadius: 12, border: "1px solid #eef0f4", boxShadow: "0 5px 20px #26335112", fontSize: 12 }} /><Area type="monotone" dataKey="income" stroke="#7185f2" strokeWidth={2.4} fill="url(#incomeFill)" /><Area type="monotone" dataKey="expenses" stroke="#f1a35b" strokeWidth={2.4} fill="url(#expenseFill)" /></AreaChart></ResponsiveContainer></div><div className="chart-foot"><span><TrendingUp size={14} /> Your overview updates as you add transactions</span><span>Updated just now</span></div></section>
    <section className="card budget-card"><div className="card-head"><div><h3>Monthly budget</h3><p>A little guide for this month</p></div><button className="more-button" onClick={() => setPage("Budget")} aria-label="Manage budget"><MoreHorizontal size={20} /></button></div><div className="budget-amount"><strong>{money(summary.monthly_expenses)}</strong><span>of {money(budget.monthly_limit)}</span></div><div className="progress-track"><div className={`progress-fill ${budgetPercent >= 90 ? "progress-warn" : ""}`} style={{ width: `${budgetPercent}%` }} /></div><div className="budget-progress-label"><span>{Math.round(budgetPercent)}% used</span><strong>{money(Math.max(0, budget.monthly_limit - summary.monthly_expenses))} left</strong></div><div className="budget-divider" /><div className="budget-tip"><span className="tip-icon"><Lightbulb size={17} /></span><span>{budget.monthly_limit ? `You have ${money(Math.max(0, budget.monthly_limit - summary.monthly_expenses))} left to spend this month.` : "Set a monthly budget to give your spending a helpful guide."}</span></div><button className="budget-link" onClick={() => setPage("Budget")}>Manage budget <ArrowRight size={14} /></button></section>
    <section className="card transactions-card"><div className="card-head"><div><h3>Recent transactions</h3><p>Your latest money moments</p></div><button className="subtle-link" onClick={() => setPage("Transactions")}>See all <ArrowRight size={14} /></button></div>{recent.length ? <div className="recent-list">{recent.map((item) => <TransactionRow key={item.id} item={item} compact />)}</div> : <EmptyState icon={ArrowLeftRight} title="A fresh start" text="Add your first transaction to see it here." action="Add transaction" onClick={() => setPage("Transactions")} />}</section>
    <section className="card spending-card"><div className="card-head"><div><h3>Where it goes</h3><p>Spending by category</p></div><button className="more-button" onClick={() => setPage("Analytics")} aria-label="View analytics"><MoreHorizontal size={20} /></button></div>{analytics.categories?.length ? <><div className="spending-visual"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.categories} dataKey="amount" nameKey="category" innerRadius="70%" outerRadius="93%" paddingAngle={3} stroke="none">{analytics.categories.map((entry, i) => <Cell key={entry.category} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => money(value)} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{money(summary.monthly_expenses)}</strong><span>spent</span></div></div><div className="category-legend">{analytics.categories.slice(0, 4).map((item, i) => <div key={item.category}><span><i style={{ background: COLORS[i % COLORS.length] }} />{item.category}</span><strong>{money(item.amount)}</strong></div>)}</div></div>{topCategory && <div className="insight-mini"><Sparkles size={15} /><span><strong>{topCategory.category}</strong> is your biggest category this month.</span></div>}</> : <EmptyState icon={ShoppingBag} title="Nothing to break down yet" text="Your spending insights will show up here." />}</section>
    {alerts.length > 0 && <section className="alert-strip"><div className="alert-icon"><Bell size={17} /></div><div><strong>A little heads-up</strong><span>{alerts[0].message}</span></div><button onClick={() => setPage("AI Insights")}>See insights <ArrowRight size={14} /></button></section>}
  </div>;
}

function StatCard({ title, amount, icon: Icon, tone, note }) {
  return <section className="card stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}><Icon size={17} /></span></div><strong>{money(amount)}</strong><div className="stat-note"><span className={`stat-dot ${tone}`} />{note}</div></section>;
}

function TransactionRow({ item, compact, onEdit, onDelete }) {
  const Icon = item.type === "income" ? BriefcaseBusiness : categoryIcon(item.category);
  return <div className="transaction-row"><div className={`transaction-icon ${item.type === "income" ? "income-icon" : ""}`}><Icon size={17} /></div><div className="transaction-main"><strong>{item.description || item.category}</strong><span>{item.category} <i>·</i> {new Date(`${item.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div><strong className={`transaction-amount ${item.type === "income" ? "income-text" : ""}`}>{item.type === "income" ? "+" : "−"}{money(item.amount)}</strong>{!compact && <div className="row-actions"><button onClick={() => onEdit(item)} title="Edit"><Edit2 size={15} /></button><button onClick={() => onDelete(item.id)} title="Delete"><Trash2 size={15} /></button></div>}</div>;
}

function TransactionsPage({ transactions, page, query, setQuery, filter, setFilter, setEditing, onDelete, onAdd }) {
  const [sortOrder, setSortOrder] = useState("newest");
  const rows = useMemo(() => transactions.filter((item) => (filter === "All" || item.type === filter.toLowerCase()) && `${item.description} ${item.category}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sortOrder === "newest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)), [transactions, filter, query, sortOrder]);
  const isIncome = page === "Income";
  const isExpense = page === "Expenses";
  return <section className="card table-card"><div className="table-toolbar"><div className="table-tabs">{(isIncome ? ["All", "Income"] : isExpense ? ["All", "Expense"] : ["All", "Income", "Expense"]).map((tab) => <button key={tab} className={filter === tab ? "selected" : ""} onClick={() => setFilter(tab)}>{tab === "Expense" ? "Expenses" : tab}</button>)}</div><div className="table-tools"><label className="search-box"><Search size={16} /><input placeholder="Search transactions…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label><button className="tool-button" onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}><Filter size={15} />{sortOrder === "newest" ? "Newest" : "Oldest"}</button><button className="tool-button export-button" onClick={() => exportTransactions(rows)}><Download size={15} />Export</button></div></div><div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>TYPE</th><th>DATE</th><th>AMOUNT</th><th>ACTIONS</th></tr></thead><tbody>{rows.map((item) => { const Icon = item.type === "income" ? BriefcaseBusiness : categoryIcon(item.category); return <tr key={item.id}><td><div className="table-transaction"><span className={`transaction-icon ${item.type === "income" ? "income-icon" : ""}`}><Icon size={17} /></span><span><strong>{item.description || item.category}</strong><small>{item.category}</small></span></div></td><td><span className={`type-pill ${item.type}`}>{item.type}</span></td><td className="date-cell">{new Date(`${item.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td className={`amount-cell ${item.type === "income" ? "income-text" : ""}`}>{item.type === "income" ? "+" : "−"}{money(item.amount)}</td><td><div className="row-actions"><button onClick={() => setEditing(item)} title="Edit"><Edit2 size={15} /></button><button onClick={() => onDelete(item.id)} title="Delete"><Trash2 size={15} /></button></div></td></tr>; })}</tbody></table></div>{rows.length === 0 && <EmptyState icon={Search} title="No transactions found" text={query ? "Try a different search or filter." : "Nothing here yet — add your first transaction."} action={!query ? "Add transaction" : undefined} onClick={onAdd} />}{rows.length > 0 && <div className="table-footer">Showing <strong>{rows.length}</strong> transaction{rows.length !== 1 ? "s" : ""}<span>Sorted by {sortOrder} first</span></div>}</section>;
}

function exportTransactions(rows) {
  const lines = [["Date", "Type", "Category", "Amount", "Description"], ...rows.map((row) => [row.date, row.type, row.category, row.amount, row.description])].map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","));
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); link.download = "pocketsmart-transactions.csv"; link.click(); URL.revokeObjectURL(link.href);
}

function BudgetPage({ data, budgetDraft, setBudgetDraft, categoryDraft, setCategoryDraft, onSubmit }) {
  const expenses = data.analytics.categories || [];
  const total = data.summary.monthly_expenses;
  const percent = Number(budgetDraft) ? Math.min(100, total / Number(budgetDraft) * 100) : 0;
  return <div className="budget-layout"><form className="card budget-editor" onSubmit={onSubmit}><div className="card-head"><div><h3>Your monthly guide</h3><p>A budget is a guide, not a grade.</p></div><span className="large-card-icon"><Target size={19} /></span></div><label className="field-label">Total monthly budget</label><div className="currency-input"><span>$</span><input type="number" min="0" step="0.01" required value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} /></div><div className="budget-overview-box"><div><span>Spent so far</span><strong>{money(total)}</strong></div><div><span>Remaining</span><strong className={Number(budgetDraft) - total < 0 ? "negative-text" : ""}>{money(Number(budgetDraft) - total)}</strong></div><div className="progress-track"><div className={`progress-fill ${percent >= 90 ? "progress-warn" : ""}`} style={{ width: `${percent}%` }} /></div><span className="small-muted">{Math.round(percent)}% of your budget used this month</span></div><button className="button primary budget-save"><Check size={16} />Save budget</button></form><section className="card category-budget-card"><div className="card-head"><div><h3>Category budgets</h3><p>Optional spending guides for each category</p></div><span className="large-card-icon lilac"><SlidersIcon /></span></div><div className="category-budget-list">{CATEGORIES.map((category, index) => { const actual = expenses.find((entry) => entry.category === category)?.amount || 0; const limit = Number(categoryDraft[category] || 0); return <div className="category-budget-row" key={category}><span className="category-color" style={{ background: COLORS[index] }} /><div className="category-budget-name"><strong>{category}</strong><small>{money(actual)} spent{limit ? ` of ${money(limit)}` : ""}</small></div><div className="category-limit-input"><span>$</span><input aria-label={`${category} budget`} min="0" type="number" step="0.01" placeholder="No limit" value={categoryDraft[category] ?? ""} onChange={(event) => setCategoryDraft({ ...categoryDraft, [category]: event.target.value })} /></div><div className="category-mini-progress"><i className={limit && actual / limit >= 0.9 ? "warn" : ""} style={{ width: limit ? `${Math.min(100, actual / limit * 100)}%` : "0%" }} /></div></div>; })}</div></section><section className="budget-note"><Lightbulb size={18} /><div><strong>Make your budget yours</strong><p>Try starting with what feels realistic. You can adjust your monthly and category budgets whenever life changes.</p></div></section></div>;
}

function SlidersIcon() { return <Filter size={18} />; }

function AnalyticsPage({ analytics }) {
  const categories = analytics.categories || [];
  const maxCategory = Math.max(...categories.map((item) => item.amount), 1);
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
  return <div className="analytics-page"><section className="analytics-summary stat-grid"><StatCard title="Income this month" amount={analytics.summary.monthly_income} icon={ArrowDownLeft} tone="green" note="This month" /><StatCard title="Expenses this month" amount={analytics.summary.monthly_expenses} icon={ArrowUpRight} tone="coral" note="This month" /><StatCard title="Net savings" amount={Math.max(0, analytics.summary.monthly_income - analytics.summary.monthly_expenses)} icon={TrendingUp} tone="blue" note="Income less expenses" /></section><section className="card analytics-chart-card"><div className="card-head"><div><h3>Income, expenses & savings</h3><p>Monthly cash flow and net savings over the last six months</p></div><span className="chart-badge">6 MONTHS</span></div><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.monthly} margin={{ top: 14, right: 14, left: -4, bottom: 0 }}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#edf0f4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#969ead", fontSize: 12 }} dy={10} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#969ead", fontSize: 11 }} tickFormatter={(v) => `$${v}`} /><Tooltip formatter={(value) => money(value)} contentStyle={{ borderRadius: 12, border: "1px solid #eef0f4" }} /><Area type="monotone" dataKey="income" name="Income" stroke="#7185f2" strokeWidth={2.6} fill="#7185f21c" /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f1a35b" strokeWidth={2.6} fill="#f1a35b1a" /><Area type="monotone" dataKey="savings" name="Net savings" stroke="#42a381" strokeWidth={2.2} fill="#42a38112" /></AreaChart></ResponsiveContainer></div><div className="chart-legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Expenses</span><span><i className="legend-savings" /> Net savings</span></div></section><section className="card category-chart-card"><div className="card-head"><div><h3>Spending by category</h3><p>What you spent money on this month</p></div></div>{categories.length ? <div className="category-bars">{categories.map((item, index) => <div className="category-bar-row" key={item.category}><div className="category-bar-label"><span><i style={{ background: COLORS[index % COLORS.length] }} />{item.category}</span><strong>{money(item.amount)} <small>{total ? Math.round(item.amount / total * 100) : 0}%</small></strong></div><div className="category-bar-track"><i style={{ width: `${item.amount / maxCategory * 100}%`, background: COLORS[index % COLORS.length] }} /></div></div>)}</div> : <EmptyState icon={Activity} title="Your analytics are taking shape" text="Add a few transactions to see your spending breakdown." />}<div className="analytics-takeaway"><Sparkles size={16} /><span>Every transaction helps paint a clearer picture of your money habits.</span></div></section><div className="budget-vs-actual card"><div><span className="eyebrow">BUDGET VS. ACTUAL</span><h3>A quick reality check</h3><p>You've used {analytics.budget?.monthly_limit ? `${Math.round(analytics.summary.monthly_expenses / analytics.budget.monthly_limit * 100)}%` : "—"} of your monthly budget.</p></div><div className="budget-gauge"><div className="budget-gauge-track"><div style={{ width: `${analytics.budget?.monthly_limit ? Math.min(100, analytics.summary.monthly_expenses / analytics.budget.monthly_limit * 100) : 0}%` }} /></div><span>{money(analytics.summary.monthly_expenses)} spent</span><strong>{money(analytics.budget?.monthly_limit || 0)} budget</strong></div></div></div>;
}

function InsightsPage({ data, setPage }) {
  const recommendations = data.recommendations || [];
  return <div className="insights-page"><section className="insights-hero"><div className="insights-spark"><Sparkles size={19} /></div><div><span>YOUR PERSONAL MONEY BRIEFING</span><h2>Small observations. Helpful next steps.</h2><p>Thoughtful ideas based on your own income, spending, and budget. This is guidance for everyday habits—not financial or investment advice.</p></div><div className="insight-date">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}</div></section><div className="insight-grid">{recommendations.length ? recommendations.map((item, index) => <section className="card insight-card" key={`${item.title}-${index}`}><div className={`insight-card-icon tone-${index % 4}`}>{index === 0 ? <TrendingUp size={18} /> : index === 1 ? <Target size={18} /> : index === 2 ? <Lightbulb size={18} /> : <Activity size={18} />}</div><span className="insight-tag">{item.kind || "YOUR MONEY"}</span><h3>{item.title}</h3><p>{item.message}</p>{item.action && <div className="insight-action"><ArrowRight size={14} />{item.action}</div>}</section>) : <EmptyState icon={Sparkles} title="Your personalized insights are on their way" text="Add a few transactions to give your assistant something to work with." action="Add a transaction" onClick={() => setPage("Transactions")} />}</div><div className="ask-card"><div className="ask-icon"><MessageCircle size={19} /></div><div><strong>Want to dig a little deeper?</strong><p>Ask your assistant a question about your money.</p></div><button className="button primary" onClick={() => setPage("AI Assistant")}>Chat with PocketSmart <ArrowRight size={15} /></button></div><p className="disclaimer"><ShieldCheck size={14} /> Insights are based on the data in your account and are for informational purposes only.</p></div>;
}

function ChatPage({ messages, input, setInput, send, loading }) {
  const suggestions = ["Where did I spend the most this month?", "How much did I spend on food?", "Give me a budget plan."];
  return <div className="chat-layout"><div className="chat-main card"><div className="chat-header"><div className="chat-bot-icon"><Bot size={21} /></div><div><strong>PocketSmart AI Assistant</strong><span><i /> Here to help make things clearer</span></div><span className="private-tag"><ShieldCheck size={13} /> Private</span></div><div className="chat-messages">{messages.length === 0 ? <div className="chat-welcome"><div className="chat-welcome-icon"><Sparkles size={23} /></div><h2>Hey {messages.length === 0 ? "there" : ""} 👋</h2><p>Ask me about your spending, savings, or budget. I'll use your PocketSmart data to help you find a clearer next step.</p><div className="suggestion-label">HERE ARE A FEW THINGS YOU CAN ASK</div><div className="suggestion-list">{suggestions.map((text) => <button key={text} onClick={() => send(text)}>{text}<ArrowRight size={14} /></button>)}</div></div> : messages.map((item, index) => <div className={`chat-message ${item.role}`} key={index}>{item.role === "assistant" && <span className="chat-mini-icon"><Sparkles size={13} /></span>}<div>{item.content}</div></div>)}{loading && <div className="chat-message assistant"><span className="chat-mini-icon"><Sparkles size={13} /></span><div className="typing"><i /><i /><i /></div></div>}</div><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your money…" maxLength="1000" /><button disabled={loading || !input.trim()} aria-label="Send message"><Send size={17} /></button></form><div className="chat-disclaimer">PocketSmart shares general money-management guidance, not investment advice.</div></div><aside className="chat-side"><section className="card chat-side-card"><span className="eyebrow">A FEW IDEAS</span><h3>Your money, one question at a time.</h3><p>Your assistant can help you make sense of the data you've added. Try one of these.</p>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)}><MessageCircle size={14} />{suggestion}<ArrowRight size={14} /></button>)}</section><section className="privacy-note"><ShieldCheck size={17} /><div><strong>Your data stays private</strong><p>Your financial information is only used to answer your question.</p></div></section></aside></div>;
}

function SettingsPage({ user, logout }) {
  return <div className="settings-layout"><section className="card settings-card"><div className="settings-section-head"><span className="settings-icon"><BriefcaseBusiness size={18} /></span><div><h3>Account details</h3><p>Your PocketSmart account information.</p></div></div><div className="settings-detail"><span>Full name</span><strong>{user.name}</strong></div><div className="settings-detail"><span>Email address</span><strong>{user.email}</strong></div><div className="settings-detail"><span>Account created</span><strong>{new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong></div></section><section className="card settings-card"><div className="settings-section-head"><span className="settings-icon lilac"><ShieldCheck size={18} /></span><div><h3>Privacy & security</h3><p>Your personal finance data is scoped to your account.</p></div></div><div className="privacy-row"><ShieldCheck size={17} /><span>Your password is securely hashed. Your account data is private.</span></div><div className="privacy-row"><ShieldCheck size={17} /><span>AI features use your account data to answer your questions.</span></div></section><section className="card settings-card signout-card"><div><h3>Ready to take a break?</h3><p>You'll need to sign back in to see your finances.</p></div><button className="button danger-outline" onClick={logout}><LogOut size={16} />Sign out</button></section></div>;
}

function TransactionModal({ editing, onClose, onSubmit }) {
  const [type, setType] = useState(editing?.type || "expense");
  const categories = type === "income" ? INCOME_CATEGORIES : CATEGORIES;
  return <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="transaction-modal" onSubmit={onSubmit}><div className="modal-head"><div><span className="eyebrow">{editing ? "MAKE AN UPDATE" : "A NEW MONEY MOMENT"}</span><h2>{editing ? "Edit transaction" : "Add a transaction"}</h2><p>Keep track of the little things and the big ones.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="transaction-type-tabs"><button type="button" className={type === "expense" ? "selected expense-selected" : ""} onClick={() => setType("expense")}><ArrowUpRight size={15} />Expense</button><button type="button" className={type === "income" ? "selected income-selected" : ""} onClick={() => setType("income")}><ArrowDownLeft size={15} />Income</button></div><input type="hidden" name="type" value={type} /><label>Amount<div className="amount-input"><span>$</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" defaultValue={editing?.amount ?? ""} required autoFocus /></div></label><div className="form-two"><label>Category<select name="category" defaultValue={editing?.category || categories[0]} key={type}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Date<input type="date" name="date" defaultValue={editing?.date || new Date().toISOString().slice(0, 10)} required /></label></div><label>Description <span className="optional">(optional)</span><input name="description" maxLength="200" placeholder="e.g. Weekly groceries" defaultValue={editing?.description || ""} /></label><div className="modal-actions"><button type="button" className="button quiet" onClick={onClose}>Cancel</button><button className="button primary"><Check size={16} />{editing ? "Save changes" : "Add transaction"}</button></div></form></div>;
}

function EmptyState({ icon: Icon, title, text, action, onClick }) {
  return <div className="empty-state"><span><Icon size={19} /></span><strong>{title}</strong><p>{text}</p>{action && <button onClick={onClick}>{action} <ArrowRight size={14} /></button>}</div>;
}

function pageCopy(page) {
  return ({
    Transactions: "All the ins and outs, in one simple view.",
    Income: "Keep your incoming money in one place.",
    Expenses: "A clearer look at what you're spending.",
    Budget: "Give your spending some gentle guardrails.",
    Analytics: "Patterns and progress, without the guesswork.",
    "AI Insights": "A few personal observations to help you feel more in control.",
    "AI Assistant": "Ask a question. Get an answer grounded in your own data.",
    Settings: "Your account, your information, your choices.",
  })[page] || "";
}

export default App;
