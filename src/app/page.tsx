"use client";

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Flame,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/lib/firebase";

type Habit = {
  id: string;
  name: string;
  targetNote: string;
  category: string;
  icon: string;
  color: string;
  goalDays: number;
  completions: Record<string, boolean>;
  createdAt?: number;
};

type HabitForm = Omit<Habit, "id" | "completions" | "createdAt">;

const categories = ["Salud", "Deporte", "Mente", "Productividad", "Finanzas", "Creatividad"];
const categoryIcons: Record<string, string> = {
  Salud: "♥",
  Deporte: "↗",
  Mente: "✳",
  Productividad: "◷",
  Finanzas: "$",
  Creatividad: "✦",
};
const palette = ["#168a70", "#6263d9", "#d45c70", "#d38a22", "#168fa2", "#8b5bc3"];
const iconChoices = ["💧", "🏃", "📚", "🧘", "🥗", "💪", "💤", "💻", "🎯", "💰", "🎨", "🎸", "🍵", "☀️", "🧠", "🚴"];
const emptyForm: HabitForm = {
  name: "",
  targetNote: "",
  category: "Salud",
  icon: "🎯",
  color: palette[1],
  goalDays: 7,
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekDates(offset: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  const mondayShift = today.getDay() === 0 ? -6 : 1 - today.getDay();
  monday.setDate(today.getDate() + mondayShift + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

function streakFor(habit: Habit) {
  const done = Object.keys(habit.completions ?? {}).filter((key) => habit.completions[key]).sort();
  if (!done.length) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let index = 1; index < done.length; index += 1) {
    const before = new Date(`${done[index - 1]}T00:00:00`);
    const after = new Date(`${done[index]}T00:00:00`);
    const gap = Math.round((after.getTime() - before.getTime()) / 86400000);
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);
  if (!habit.completions[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (habit.completions[dateKey(cursor)]) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best: Math.max(best, current) };
}

function friendlyError(error: unknown) {
  if (error instanceof Error && error.message.includes("auth/unauthorized-domain")) {
    return "Agrega este dominio a los dominios autorizados de Firebase Authentication.";
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchText, setSearchText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HabitForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setHabits([]);
      setDataReady(true);
      return;
    }
    setDataReady(false);
    const habitsQuery = query(collection(db, "users", user.uid, "habits"), orderBy("createdAt", "asc"));
    return onSnapshot(
      habitsQuery,
      (snapshot) => {
        setHabits(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as Habit)));
        setDataReady(true);
      },
      (snapshotError) => {
        setError(friendlyError(snapshotError));
        setDataReady(true);
      },
    );
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const dates = useMemo(() => weekDates(weekOffset), [weekOffset]);
  const todayKey = dateKey(new Date());
  const filteredHabits = habits.filter((habit) => {
    const categoryMatch = activeCategory === "Todos" || habit.category === activeCategory;
    const queryMatch = `${habit.name} ${habit.targetNote}`.toLowerCase().includes(searchText.toLowerCase());
    return categoryMatch && queryMatch;
  });
  const weekProgress = habits.reduce((total, habit) => {
    const count = dates.filter((date) => habit.completions?.[dateKey(date)]).length;
    return { done: total.done + count, goal: total.goal + habit.goalDays };
  }, { done: 0, goal: 0 });
  const todayDone = habits.filter((habit) => habit.completions?.[todayKey]).length;
  const todayPercent = habits.length ? Math.round((todayDone / habits.length) * 100) : 0;
  const streakLeaders = habits.map((habit) => ({ habit, ...streakFor(habit) })).sort((a, b) => b.current - a.current);
  const bestStreak = Math.max(0, ...streakLeaders.map((item) => item.best));
  const weekPercent = weekProgress.goal ? Math.min(100, Math.round((weekProgress.done / weekProgress.goal) * 100)) : 0;
  const dateRange = `${dates[0].toLocaleDateString("es", { day: "numeric", month: "short" })} – ${dates[6].toLocaleDateString("es", { day: "numeric", month: "short" })}`;
  const categoryStats = categories.map((category) => {
    const categoryHabits = habits.filter((habit) => habit.category === category);
    const goal = categoryHabits.reduce((total, habit) => total + habit.goalDays, 0);
    const done = categoryHabits.reduce((total, habit) => total + dates.filter((date) => habit.completions?.[dateKey(date)]).length, 0);
    return { category, count: categoryHabits.length, percent: goal ? Math.min(100, Math.round(done / goal * 100)) : 0 };
  }).filter((entry) => entry.count > 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const heatmapDays = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 27 + index);
    const completed = habits.filter((habit) => habit.completions?.[dateKey(date)]).length;
    return { date, completed, percent: habits.length ? Math.round(completed / habits.length * 100) : 0 };
  });
  const activeDays = heatmapDays.filter((day) => day.percent >= 50).length;
  const consistency = Math.round(activeDays / heatmapDays.length * 100);

  async function handleGoogleLogin() {
    if (!auth) return;
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (loginError) {
      setError(friendlyError(loginError));
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, category: activeCategory === "Todos" ? "Salud" : activeCategory });
    setModalOpen(true);
    setError("");
  }

  function startEdit(habit: Habit) {
    setEditingId(habit.id);
    setForm({ name: habit.name, targetNote: habit.targetNote, category: habit.category, icon: habit.icon, color: habit.color, goalDays: habit.goalDays });
    setModalOpen(true);
    setError("");
  }

  async function saveHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !db || !form.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const values = { ...form, name: form.name.trim(), targetNote: form.targetNote.trim(), goalDays: Number(form.goalDays) };
      if (editingId) {
        await updateDoc(doc(db, "users", user.uid, "habits", editingId), values);
        setToast("Hábito actualizado");
      } else {
        await addDoc(collection(db, "users", user.uid, "habits"), { ...values, completions: {}, createdAt: Date.now() });
        setToast("Hábito agregado");
      }
      setModalOpen(false);
    } catch (saveError) {
      setError(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleCompletion(habit: Habit, key: string) {
    if (!user || !db) return;
    const field = `completions.${key}`;
    try {
      await updateDoc(doc(db, "users", user.uid, "habits", habit.id), {
        [field]: habit.completions?.[key] ? deleteField() : true,
      });
    } catch (toggleError) {
      setError(friendlyError(toggleError));
    }
  }

  async function completeToday() {
    if (!user || !db || !habits.length) return;
    const firestore = db;
    setBusy(true);
    try {
      await Promise.all(habits.filter((habit) => !habit.completions?.[todayKey]).map((habit) =>
        updateDoc(doc(firestore, "users", user.uid, "habits", habit.id), { [`completions.${todayKey}`]: true }),
      ));
      setWeekOffset(0);
      setToast("Metas de hoy completadas");
    } catch (completeError) {
      setError(friendlyError(completeError));
    } finally {
      setBusy(false);
    }
  }

  async function removeHabit(habit: Habit) {
    if (!user || !db || !window.confirm(`¿Eliminar “${habit.name}” y todo su historial?`)) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "habits", habit.id));
      setToast("Hábito eliminado");
    } catch (deleteError) {
      setError(friendlyError(deleteError));
    }
  }

  if (!authReady || (user && !dataReady)) {
    return <main className="loading-screen"><span className="loader" /><p>Preparando tu espacio...</p></main>;
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <div className="login-mark"><Flame size={26} fill="currentColor" /></div>
          <p className="eyebrow">TU RITMO, TU HISTORIA</p>
          <h1>Ritmo<span>Pro</span></h1>
          <p className="login-copy">Haz espacio para lo que quieres convertir en parte de ti.</p>
          {!isFirebaseConfigured ? (
            <div className="setup-notice"><CircleHelp size={19} /><span>Falta configurar Firebase. Completa las variables de entorno para activar el acceso.</span></div>
          ) : (
            <button className="google-button" onClick={handleGoogleLogin}><GoogleMark /> Continuar con Google</button>
          )}
          {error && <p className="error-message">{error}</p>}
          <p className="privacy-note">Tus hábitos se guardan de forma privada en tu cuenta.</p>
        </section>
        <div className="login-aside"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="aside-content"><span className="aside-kicker"><Sparkles size={15} /> CONSTANCIA, NO PERFECCIÓN</span><p>Un pequeño paso.<br /><em>Repetido a tu manera.</em></p><div className="aside-stat"><Flame size={18} /> Cada día cuenta como comienzo.</div></div></div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="RitmoPro inicio"><span className="brand-icon"><Flame size={21} fill="currentColor" /></span><span>ritmo<span>pro</span></span></a>
        <div className="topbar-right"><span className="signed-in"><span className="online-dot" /> Guardado en Firebase</span><div className="account"><span className="avatar">{user.photoURL ? <img src={user.photoURL} alt="" /> : user.displayName?.[0] ?? "U"}</span><span className="account-name">{user.displayName?.split(" ")[0] ?? "Mi cuenta"}</span><button className="icon-button logout-button" title="Cerrar sesión" onClick={() => auth && signOut(auth)}><LogOut size={17} /></button></div></div>
      </header>

      <div className="page-content" id="inicio">
        <section className="welcome-row"><div><p className="eyebrow">PANEL DE HÁBITOS · {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</p><h1>Buen ritmo, <span>{user.displayName?.split(" ")[0] ?? "vamos"}.</span></h1><p className="welcome-copy">La consistencia se construye con lo que haces hoy.</p></div><button className="primary-button" onClick={startCreate}><Plus size={18} /> Nuevo hábito</button></section>

        {error && <div className="inline-error">{error}<button aria-label="Cerrar" onClick={() => setError("")}><X size={16} /></button></div>}

        <section className="metrics-grid" aria-label="Resumen de progreso">
          <article className="metric metric-primary"><div className="metric-top"><span>Progreso semanal</span><BarChart3 size={18} /></div><div className="metric-value">{weekPercent}<small>%</small></div><div className="metric-bottom"><span>{weekProgress.done} de {weekProgress.goal} metas</span><div className="mini-track"><i style={{ width: `${weekPercent}%` }} /></div></div></article>
          <article className="metric"><div className="metric-top"><span>Hoy</span><Target size={18} /></div><div className="metric-value">{todayDone}<small> / {habits.length}</small></div><div className="metric-bottom"><span>hábitos completados</span><div className="mini-track green"><i style={{ width: `${todayPercent}%` }} /></div></div></article>
          <article className="metric"><div className="metric-top"><span>Racha más larga</span><Flame size={18} /></div><div className="metric-value">{bestStreak}<small> días</small></div><div className="metric-bottom"><span>{streakLeaders[0]?.current ? `${streakLeaders[0].habit.icon} ${streakLeaders[0].habit.name}` : "Todo empieza con un día"}</span></div></article>
          <article className="metric"><div className="metric-top"><span>En tu lista</span><CheckCheck size={18} /></div><div className="metric-value">{habits.length}<small> hábitos</small></div><div className="metric-bottom"><span>{categories.filter((category) => habits.some((habit) => habit.category === category)).length} áreas en movimiento</span></div></article>
        </section>

        <section className="main-panel">
          <div className="panel-heading"><div><div className="heading-title"><span className="section-mark"><Activity size={18} /></span><h2>Tu semana en práctica</h2></div><p>Marca cada día que cumplas tu intención.</p></div><div className="week-nav"><button className="icon-button" aria-label="Semana anterior" onClick={() => setWeekOffset((offset) => Math.max(-12, offset - 1))}><ArrowLeft size={17} /></button><div><strong>{weekOffset === 0 ? "Esta semana" : weekOffset === -1 ? "Semana pasada" : `${Math.abs(weekOffset)} semanas atrás`}</strong><span>{dateRange}</span></div><button className="icon-button" aria-label="Semana siguiente" disabled={weekOffset >= 0} onClick={() => setWeekOffset((offset) => Math.min(0, offset + 1))}><ArrowRight size={17} /></button></div></div>
          <div className="toolbar"><div className="filters"><button className={`filter-chip ${activeCategory === "Todos" ? "selected" : ""}`} onClick={() => setActiveCategory("Todos")}>Todos <span>{habits.length}</span></button>{categories.map((category) => <button key={category} className={`filter-chip ${activeCategory === category ? "selected" : ""}`} onClick={() => setActiveCategory(category)}><i>{categoryIcons[category]}</i>{category}<span>{habits.filter((habit) => habit.category === category).length}</span></button>)}</div><label className="search-box"><Search size={16} /><input aria-label="Buscar hábito" placeholder="Buscar" value={searchText} onChange={(event) => setSearchText(event.target.value)} /></label></div>

          <div className="table-wrap"><table><thead><tr><th className="habit-heading">Hábito</th>{dates.map((date, index) => <th key={dateKey(date)} className={dateKey(date) === todayKey ? "today-column" : ""}><span>{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][index]}</span><b>{date.getDate()}</b></th>)}<th>Racha</th><th className="progress-heading">Semana</th><th aria-label="Acciones" /></tr></thead><tbody>
            {filteredHabits.map((habit) => {
              const count = dates.filter((date) => habit.completions?.[dateKey(date)]).length;
              const percent = Math.min(100, Math.round((count / habit.goalDays) * 100));
              const streak = streakFor(habit);
              return <tr key={habit.id}><td className="habit-cell"><span className="habit-emoji" style={{ backgroundColor: `${habit.color}18`, color: habit.color }}>{habit.icon}</span><span className="habit-text"><strong>{habit.name}</strong><small>{habit.category} <i /> {habit.targetNote || `${habit.goalDays} días por semana`}</small></span></td>{dates.map((date) => { const key = dateKey(date); const checked = Boolean(habit.completions?.[key]); return <td key={key} className={key === todayKey ? "today-column" : ""}><button className={`day-check ${checked ? "checked" : ""}`} style={checked ? { backgroundColor: habit.color, borderColor: habit.color } : undefined} aria-label={`${checked ? "Desmarcar" : "Marcar"} ${habit.name} ${key}`} onClick={() => toggleCompletion(habit, key)}>{checked && <Check size={15} strokeWidth={3} />}</button></td>; })}<td><span className="streak-cell"><Flame size={14} /> {streak.current}<small>/{streak.best}</small></span></td><td className="progress-cell"><div><span>{count}/{habit.goalDays}</span><b>{percent}%</b></div><div className="progress-track"><i style={{ width: `${percent}%`, backgroundColor: percent >= 100 ? "#168a70" : habit.color }} /></div></td><td><div className="row-actions"><button title="Editar hábito" onClick={() => startEdit(habit)}><ChevronDown size={15} /></button><button title="Eliminar hábito" onClick={() => removeHabit(habit)}><Trash2 size={15} /></button></div></td></tr>;
            })}
          </tbody></table>
          {!filteredHabits.length && <div className="empty-state"><span><Sparkles size={22} /></span><strong>{habits.length ? "No hay hábitos en esta vista" : "Tu lista empieza aquí"}</strong><p>{habits.length ? "Prueba otro filtro o agrega un hábito." : "Elige una intención pequeña para empezar."}</p><button className="secondary-button" onClick={startCreate}><Plus size={16} /> Crear hábito</button></div>}
          </div>
          {habits.length > 0 && <div className="table-footer"><span>{filteredHabits.length} {filteredHabits.length === 1 ? "hábito" : "hábitos"} visibles</span><button className="complete-button" disabled={busy || todayDone === habits.length} onClick={completeToday}><CheckCheck size={16} /> Completar hoy</button></div>}
        </section>

        <section className="insights-grid"><article className="insight-panel rhythm-panel"><div className="insight-title"><div><span className="section-mark green-mark"><BarChart3 size={17} /></span><h2>Ritmo diario</h2></div><span className="muted-label">COMPLETADO POR DÍA</span></div><div className="week-bars">{dates.map((date, index) => { const done = habits.filter((habit) => habit.completions?.[dateKey(date)]).length; const percent = habits.length ? Math.round(done / habits.length * 100) : 0; return <div className="bar-column" key={dateKey(date)}><span>{percent}%</span><div className="bar-track"><i style={{ height: `${Math.max(percent, 3)}%` }} /></div><b>{["L", "M", "X", "J", "V", "S", "D"][index]}</b></div>; })}</div><div className="chart-foot"><span><i /> Meta de hoy</span><span>{todayDone}/{habits.length} completados</span></div></article>
          <article className="insight-panel streak-panel"><div className="insight-title"><div><span className="section-mark amber-mark"><Trophy size={17} /></span><h2>Rachas en marcha</h2></div><span className="muted-label">ACTUAL / RÉCORD</span></div>{streakLeaders.length ? <div className="streak-list">{streakLeaders.slice(0, 4).map(({ habit, current, best }) => <div className="streak-item" key={habit.id}><span>{habit.icon}</span><div><strong>{habit.name}</strong><div className="progress-track"><i style={{ width: `${best ? Math.max(5, current / best * 100) : 0}%`, backgroundColor: habit.color }} /></div></div><b>{current}<small> / {best}d</small></b></div>)}</div> : <p className="no-streaks">Tus rachas aparecerán aquí cuando registres tus días.</p>}</article></section>

        <section className="insights-grid lower-insights"><article className="insight-panel category-panel"><div className="insight-title"><div><span className="section-mark violet-mark"><Activity size={17} /></span><h2>Balance por áreas</h2></div><span className="muted-label">ESTA SEMANA</span></div>{categoryStats.length ? <div className="category-list">{categoryStats.map(({ category, count, percent }) => <div className="category-row" key={category}><div><span><i style={{ backgroundColor: palette[categories.indexOf(category) % palette.length] }} />{category}<small>{count}</small></span><b>{percent}%</b></div><div className="progress-track"><i style={{ width: `${percent}%`, backgroundColor: palette[categories.indexOf(category) % palette.length] }} /></div></div>)}</div> : <p className="no-streaks">Agrega hábitos para ver tu equilibrio por áreas.</p>}</article>
          <article className="insight-panel heatmap-panel"><div className="insight-title"><div><span className="section-mark green-mark"><Target size={17} /></span><h2>Consistencia reciente</h2></div><span className="consistency-badge">{consistency}% activos</span></div><p className="heatmap-caption">Últimos 28 días · días con al menos la mitad de tus hábitos cumplidos</p><div className="heatmap-grid">{heatmapDays.map(({ date, completed, percent }) => <span key={dateKey(date)} title={`${date.toLocaleDateString("es", { day: "numeric", month: "short" })}: ${completed}/${habits.length}`} className={percent >= 85 ? "heat-strong" : percent >= 50 ? "heat-medium" : percent > 0 ? "heat-light" : ""}>{date.getDate()}</span>)}</div><div className="coach-note"><Sparkles size={15} /><span>{consistency >= 75 ? "Tu constancia se está consolidando. Protege el espacio que ya creaste." : consistency >= 45 ? "Vas ganando tracción. Una versión breve del hábito también cuenta." : "Empieza pequeño: elegir un solo hábito hoy ya es avanzar."}</span></div></article></section>
        <footer className="page-footer"><span><span className="online-dot" /> Sincronización privada activa</span><span>RitmoPro <i>·</i> Un día a la vez</span></footer>
      </div>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="habit-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><span className="section-mark"><Plus size={18} /></span><div><h2 id="modal-title">{editingId ? "Editar hábito" : "Nuevo hábito"}</h2><p>Una intención clara hace más fácil volver a ella.</p></div></div><button className="icon-button" aria-label="Cerrar" onClick={() => setModalOpen(false)}><X size={19} /></button></header><form onSubmit={saveHabit}><label className="form-field">Nombre del hábito<input autoFocus maxLength={48} required placeholder="Ej. Leer 20 páginas" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-row"><label className="form-field">Detalle o meta<input maxLength={50} placeholder="Ej. 30 minutos" value={form.targetNote} onChange={(event) => setForm({ ...form, targetNote: event.target.value })} /></label><label className="form-field">Área<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label className="form-field frequency-field">Frecuencia semanal <span>{form.goalDays} {form.goalDays === 1 ? "día" : "días"}</span><input type="range" min="1" max="7" value={form.goalDays} onChange={(event) => setForm({ ...form, goalDays: Number(event.target.value) })} /></label><fieldset className="choice-field"><legend>Ícono</legend><div className="icon-options">{iconChoices.map((icon) => <button type="button" key={icon} className={form.icon === icon ? "choice-selected" : ""} onClick={() => setForm({ ...form, icon })}>{icon}</button>)}</div></fieldset><fieldset className="choice-field"><legend>Color</legend><div className="color-options">{palette.map((color) => <button type="button" key={color} aria-label={`Color ${color}`} className={form.color === color ? "color-selected" : ""} style={{ backgroundColor: color }} onClick={() => setForm({ ...form, color })}>{form.color === color && <Check size={14} />}</button>)}</div></fieldset>{error && <p className="error-message">{error}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancelar</button><button className="primary-button" disabled={busy} type="submit">{busy ? "Guardando..." : editingId ? "Guardar cambios" : "Crear hábito"}</button></div></form></section></div>}
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </main>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" width="19" height="19"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(2 2) scale(.92)"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.62 5.91c4.45-4.1 7.15-10.14 7.15-17.56Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" transform="translate(2 2) scale(.92)"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.62-5.91c-2.12 1.42-4.84 2.27-8.28 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(2 2) scale(.92)"/></svg>;
}