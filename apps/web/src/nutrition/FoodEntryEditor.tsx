import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Icon } from "../Icon.js";
import { caloriesFor, findFood, macrosFor, searchFoods, sumMacros, type Macros } from "./food-database.js";

export type EntryItem = { foodId: string; name: string; grams: number } & Macros;
export type FoodEntryDraft = { name: string; meal: string; items?: EntryItem[] } & Macros;

type Props = {
  meals: readonly string[];
  initial: FoodEntryDraft | null;
  defaultMeal: string;
  onSave: (draft: FoodEntryDraft) => void;
  onDelete: (() => void) | null;
};

type Row = { key: string; foodId: string; grams: string };

const parseNumber = (value: string): number => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const show = (value: number): string => (Math.round(value * 10) / 10).toLocaleString("es-AR");

export function FoodEntryEditor({ meals, initial, defaultMeal, onSave, onDelete }: Props): ReactElement {
  const [meal, setMeal] = useState(initial?.meal ?? defaultMeal);
  const [mode, setMode] = useState<"foods" | "manual">(initial && !initial.items?.length ? "manual" : "foods");
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<Row[]>(() => (initial?.items ?? []).map((item) => ({ key: crypto.randomUUID(), foodId: item.foodId, grams: String(item.grams) })));
  const [manual, setManual] = useState({ protein: initial ? String(initial.protein) : "", carbs: initial ? String(initial.carbs) : "", fats: initial ? String(initial.fats) : "" });
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => searchFoods(query), [query]);
  const items: EntryItem[] = rows.flatMap((row) => {
    const food = findFood(row.foodId);
    if (food === undefined) return [];
    const grams = parseNumber(row.grams);
    return [{ foodId: food.id, name: food.name, grams, ...macrosFor(food, grams) }];
  });
  const totals: Macros = mode === "foods" ? sumMacros(items) : { protein: parseNumber(manual.protein), carbs: parseNumber(manual.carbs), fats: parseNumber(manual.fats) };
  const autoName = items.map((item) => item.name.replace(/ \(.*\)$/, "")).join(" + ");

  function addFood(foodId: string): void {
    const food = findFood(foodId);
    if (food === undefined) return;
    setRows((current) => [...current, { key: crypto.randomUUID(), foodId, grams: String(food.portions[0]?.grams ?? 100) }]);
    setQuery("");
    setError(null);
  }

  function updateGrams(key: string, grams: string): void {
    setRows((current) => current.map((row) => row.key === key ? { ...row, grams } : row));
  }

  function save(): void {
    if (mode === "foods") {
      if (items.length === 0) { setError("Buscá y agregá al menos un alimento."); return; }
      if (items.some((item) => item.grams <= 0)) { setError("Poné cuántos gramos comiste de cada alimento."); return; }
      onSave({ name: name.trim() || autoName.slice(0, 100), meal, items, ...totals });
    } else {
      if (name.trim().length === 0) { setError("Poné el nombre de la comida."); return; }
      onSave({ name: name.trim(), meal, ...totals });
    }
  }

  return <div className="food-editor">
    <div className="food-meals" role="group" aria-label="Momento del día">
      {meals.map((item) => <button key={item} type="button" className={meal === item ? "is-on" : undefined} aria-pressed={meal === item} onClick={() => setMeal(item)}>{item}</button>)}
    </div>

    <div className="segmented-control food-mode" role="group" aria-label="Cómo cargar">
      <button type="button" className={mode === "foods" ? "is-selected" : undefined} aria-pressed={mode === "foods"} onClick={() => { setMode("foods"); setError(null); }}>Por cantidad</button>
      <button type="button" className={mode === "manual" ? "is-selected" : undefined} aria-pressed={mode === "manual"} onClick={() => { setMode("manual"); setError(null); }}>Macros a mano</button>
    </div>

    {mode === "foods" ? <>
      {rows.length > 0 && <ul className="food-items" aria-label="Alimentos de esta comida">
        {rows.map((row) => {
          const food = findFood(row.foodId);
          if (food === undefined) return null;
          const grams = parseNumber(row.grams);
          const macros = macrosFor(food, grams);
          return <li key={row.key}>
            <div className="food-item-head">
              <strong>{food.name}</strong>
              <button type="button" className="food-icon-button" onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))} aria-label={`Quitar ${food.name}`}><Icon name="close" size={15} /></button>
            </div>
            <div className="food-item-amount">
              <label className="food-grams"><span className="sr-only">Gramos de {food.name}</span><input value={row.grams} onChange={(event) => updateGrams(row.key, event.target.value)} inputMode="decimal" autoComplete="off" /><span aria-hidden="true">g</span></label>
              <div className="food-portions">{food.portions.map((portion) => <button key={portion.label} type="button" className={grams === portion.grams ? "is-on" : undefined} onClick={() => updateGrams(row.key, String(portion.grams))}>{portion.label}</button>)}</div>
            </div>
            <small className="food-item-macros">{caloriesFor(macros)} kcal · P {show(macros.protein)} g · C {show(macros.carbs)} g · G {show(macros.fats)} g</small>
          </li>;
        })}
      </ul>}
      <label className="food-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={rows.length === 0 ? "Buscá un alimento: fideos, milanesa…" : "Agregar otro alimento"} aria-label="Buscar alimento" autoComplete="off" /></label>
      {query.trim().length > 0 && (results.length > 0
        ? <ul className="food-results" aria-label="Resultados">{results.map((food) => <li key={food.id}><button type="button" onClick={() => addFood(food.id)}>
          <span><strong>{food.name}</strong><small>Cada 100 g: {caloriesFor(food.per100)} kcal · P {show(food.per100.protein)} · C {show(food.per100.carbs)} · G {show(food.per100.fats)}</small></span>
          <Icon name="plus" size={17} />
        </button></li>)}</ul>
        : <div className="food-no-results"><p>No encontramos “{query.trim()}”.</p><button type="button" className="secondary-button" onClick={() => { setName(query.trim()); setMode("manual"); setQuery(""); }}>Cargarlo con macros a mano</button></div>)}
      <label className="food-name">Nombre de la comida (opcional)<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder={autoName || "Se arma con los alimentos"} autoComplete="off" /></label>
    </> : <>
      <label className="food-name">Alimento o comida<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Ej. Yogur con avena" autoComplete="off" /></label>
      <p className="nutrition-form-label">Macronutrientes de la porción</p>
      <div className="nutrition-form-grid">
        {([["protein", "Proteína (g)"], ["carbs", "Carbohidratos (g)"], ["fats", "Grasas (g)"]] as const).map(([key, label]) => <label key={key}>{label}<input value={manual[key]} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} inputMode="decimal" placeholder="0" autoComplete="off" /></label>)}
      </div>
      <p className="nutrition-form-hint">Usá los valores de la etiqueta. Si no los sabés, pasá a "Por cantidad".</p>
    </>}

    <div className="food-total" aria-live="polite">
      <strong>{caloriesFor(totals).toLocaleString("es-AR")} kcal</strong>
      <span>P {show(totals.protein)} g · C {show(totals.carbs)} g · G {show(totals.fats)} g</span>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="primary-button full-button" onClick={save}>{initial ? "Guardar cambios" : "Agregar a " + meal.toLocaleLowerCase("es")}</button>
    {onDelete && (confirmDelete
      ? <div className="food-confirm" role="alertdialog" aria-label="Eliminar comida"><p>¿Eliminar esta comida del registro?</p><div><button type="button" className="is-danger" onClick={onDelete}>Eliminar</button><button type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button></div></div>
      : <button type="button" className="food-delete" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Eliminar comida</button>)}
    <p className="nutrition-form-hint">Los valores de la lista son aproximados (referencias tipo USDA y tablas argentinas). Las marcas pueden variar: si tenés la etiqueta, usala.</p>
  </div>;
}
