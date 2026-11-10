import { useMemo, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import "./nutrition.css";

type Goals = { calories: number; protein: number; carbs: number; fats: number };
type FoodEntry = { id: string; name: string; meal: string; protein: number; carbs: number; fats: number; date: string };
type NutritionData = { goals: Goals; entries: FoodEntry[]; goalsConfigured: boolean };

const defaultGoals: Goals = { calories: 2230, protein: 160, carbs: 240, fats: 70 };
const meals = ["Desayuno", "Almuerzo", "Merienda", "Cena", "Colación"];

function todayKey(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function readNutritionData(key: string): NutritionData {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (typeof parsed === "object" && parsed !== null) {
      const value = parsed as Partial<NutritionData>;
      if (typeof value.goals === "object" && value.goals !== null && Array.isArray(value.entries)) {
        const goals = value.goals as Partial<Goals>;
        if ([goals.calories, goals.protein, goals.carbs, goals.fats].every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0)) {
          const entries = value.entries.filter((entry): entry is FoodEntry =>
            typeof entry === "object" && entry !== null && typeof entry.id === "string" &&
            typeof entry.name === "string" && typeof entry.meal === "string" &&
            typeof entry.date === "string" && Number.isFinite(entry.protein) &&
            Number.isFinite(entry.carbs) && Number.isFinite(entry.fats));
          return { goals: goals as Goals, entries, goalsConfigured: value.goalsConfigured === true };
        }
      }
    }
  } catch { /* Storage can be unavailable or contain an old version. */ }
  return { goals: defaultGoals, entries: [], goalsConfigured: false };
}

function numberFrom(form: FormData, key: string): number {
  const value = Number(form.get(key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function NutritionView({ ownerId, onBack }: { ownerId: string | null; onBack: () => void }): ReactElement {
  const storageKey = "forma.nutrition.v1." + (ownerId ?? "demo");
  const [data, setData] = useState<NutritionData>(() => readNutritionData(storageKey));
  const [editor, setEditor] = useState<"food" | "goals" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const day = todayKey();
  const todaysEntries = useMemo(() => data.entries.filter((entry) => entry.date === day), [data.entries, day]);
  const totals = useMemo(() => todaysEntries.reduce((result, entry) => ({
    protein: result.protein + entry.protein,
    carbs: result.carbs + entry.carbs,
    fats: result.fats + entry.fats,
  }), { protein: 0, carbs: 0, fats: 0 }), [todaysEntries]);
  const calories = Math.round(totals.protein * 4 + totals.carbs * 4 + totals.fats * 9);
  const caloriePercent = data.goals.calories > 0 ? Math.min(100, Math.round(calories / data.goals.calories * 100)) : 0;
  const dateLabel = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const grouped = meals.map((meal) => ({ meal, entries: todaysEntries.filter((entry) => entry.meal === meal) }));

  function save(next: NutritionData): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next);
      setMessage(null);
    } catch {
      setMessage("No se pudo guardar en este dispositivo. Liberá espacio e intentá de nuevo.");
    }
  }

  function saveFood(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      name,
      meal: String(form.get("meal") ?? meals[0]),
      protein: numberFrom(form, "protein"),
      carbs: numberFrom(form, "carbs"),
      fats: numberFrom(form, "fats"),
      date: day,
    };
    save({ ...data, entries: [entry, ...data.entries].slice(0, 500) });
    if (localStorage.getItem(storageKey) !== null) setEditor(null);
  }

  function saveGoals(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const goals = {
      calories: numberFrom(form, "calories"),
      protein: numberFrom(form, "protein"),
      carbs: numberFrom(form, "carbs"),
      fats: numberFrom(form, "fats"),
    };
    save({ ...data, goals, goalsConfigured: true });
    if (localStorage.getItem(storageKey) !== null) setEditor(null);
  }

  return <div className="screen-stack nutrition-screen">
    <header className="nutrition-heading">
      <div><p className="eyebrow">NUTRICIÓN · REGISTRO PERSONAL</p><h1>Tu día, a tu medida.</h1><p className="screen-subtitle">{dateLabel}</p></div>
      <button className="nutrition-back" type="button" onClick={onBack} aria-label="Volver al inicio">←</button>
    </header>

    <section className="nutrition-hero">
      <div className="nutrition-hero-copy"><p className="nutrition-kicker">ENERGÍA DE HOY</p><strong>{calories.toLocaleString("es-AR")}</strong><span>kcal estimadas</span><small>calculadas desde los macros registrados</small></div>
      <div className="nutrition-ring" style={{ background: "conic-gradient(#c2b5ff " + caloriePercent + "%, rgba(255,255,255,.09) 0)" }} role="img" aria-label={calories + " de " + data.goals.calories + " kilocalorías registradas"}>
        <div><strong>{Math.max(0, data.goals.calories - calories).toLocaleString("es-AR")}</strong><span>kcal restantes</span></div>
      </div>
      <div className="nutrition-hero-footer"><span>Meta diaria</span><strong>{data.goals.calories.toLocaleString("es-AR")} kcal</strong></div>
    </section>

    <section className="nutrition-macros" aria-label="Progreso de macronutrientes">
      <MacroCard label="Proteína" short="P" value={totals.protein} target={data.goals.protein} tone="violet" />
      <MacroCard label="Carbohidratos" short="C" value={totals.carbs} target={data.goals.carbs} tone="blue" />
      <MacroCard label="Grasas" short="G" value={totals.fats} target={data.goals.fats} tone="orange" />
    </section>

    <section className="nutrition-target-row">
      <div><span className="nutrition-kicker">TUS OBJETIVOS</span><strong>{data.goalsConfigured ? "Configurados por vos" : "Metas de ejemplo"}</strong><small>{data.goalsConfigured ? "Tus objetivos son editables cuando cambie tu plan." : "Personalizá los valores de muestra según tu objetivo."} No reemplaza asesoramiento profesional.</small></div>
      <button className="nutrition-edit-goals" type="button" onClick={() => setEditor("goals")}>Editar</button>
    </section>

    <section className="nutrition-food-section">
      <div className="section-heading"><div><p className="eyebrow">REGISTRO DIARIO</p><h2>Comidas y alimentos</h2></div><button className="nutrition-add" type="button" onClick={() => setEditor("food")}><span>＋</span> Agregar</button></div>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <div className="nutrition-meal-list">{grouped.map(({ meal, entries }) => <section className="nutrition-meal" key={meal}>
        <div className="nutrition-meal-heading"><h3>{meal}</h3><span>{entries.length === 0 ? "Sin registros" : entries.length + (entries.length === 1 ? " alimento" : " alimentos")}</span></div>
        {entries.map((entry) => <article className="nutrition-food-entry" key={entry.id}>
          <div><strong>{entry.name}</strong><small>P {entry.protein} g · C {entry.carbs} g · G {entry.fats} g</small></div>
          <span>{Math.round(entry.protein * 4 + entry.carbs * 4 + entry.fats * 9)} kcal</span>
        </article>)}
      </section>)}</div>
    </section>

    <p className="nutrition-footnote">Los datos se guardan en este navegador. Las calorías son una estimación calculada con 4 kcal/g para proteína y carbohidratos, y 9 kcal/g para grasas.</p>

    {editor !== null ? <div className="nutrition-modal-layer" role="presentation" onClick={() => setEditor(null)}>
      <section className="nutrition-editor" role="dialog" aria-modal="true" aria-labelledby="nutrition-editor-title" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header"><div><p className="eyebrow">{editor === "food" ? "REGISTRO DEL DÍA" : "CONFIGURACIÓN PERSONAL"}</p><h2 id="nutrition-editor-title">{editor === "food" ? "Agregar alimento" : "Tus metas diarias"}</h2></div><button className="close-button" type="button" onClick={() => setEditor(null)} aria-label="Cerrar">×</button></div>
        {editor === "food" ? <form className="nutrition-form" onSubmit={saveFood}>
          <label>Alimento o comida<input name="name" required maxLength={100} placeholder="Ej. Yogur con avena" /></label>
          <label>Momento del día<select name="meal" defaultValue={meals[0]}>{meals.map((meal) => <option key={meal}>{meal}</option>)}</select></label>
          <p className="nutrition-form-label">Macronutrientes por porción</p>
          <div className="nutrition-form-grid"><label>Proteína (g)<input name="protein" type="number" min="0" step="0.1" defaultValue="0" /></label><label>Carbohidratos (g)<input name="carbs" type="number" min="0" step="0.1" defaultValue="0" /></label><label>Grasas (g)<input name="fats" type="number" min="0" step="0.1" defaultValue="0" /></label></div>
          <p className="nutrition-form-hint">Ingresá los valores de la etiqueta o de tu fuente de información.</p>
          <button className="primary-button full-button" type="submit">Guardar alimento</button>
        </form> : <form className="nutrition-form" onSubmit={saveGoals}>
          <p className="nutrition-form-hint">Cargá los objetivos que definiste para vos. No se calculan automáticamente.</p>
          <div className="nutrition-form-grid"><label>Calorías (kcal)<input name="calories" type="number" min="0" step="1" defaultValue={data.goals.calories} /></label><label>Proteína (g)<input name="protein" type="number" min="0" step="1" defaultValue={data.goals.protein} /></label><label>Carbohidratos (g)<input name="carbs" type="number" min="0" step="1" defaultValue={data.goals.carbs} /></label><label>Grasas (g)<input name="fats" type="number" min="0" step="1" defaultValue={data.goals.fats} /></label></div>
          <button className="primary-button full-button" type="submit">Guardar objetivos</button>
        </form>}
      </section>
    </div> : null}
  </div>;
}

function MacroCard({ label, short, value, target, tone }: { label: string; short: string; value: number; target: number; tone: "violet" | "blue" | "orange" }): ReactElement {
  const percent = target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0;
  return <article className={"macro-card macro-" + tone}>
    <div className="macro-topline"><span>{short}</span><small>{percent}%</small></div>
    <strong>{Math.round(value)}<small> / {target} g</small></strong>
    <span className="macro-label">{label}</span>
    <div className="macro-track"><i style={{ width: percent + "%" }} /></div>
  </article>;
}
