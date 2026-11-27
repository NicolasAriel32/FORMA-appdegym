// Alimentos comunes con macros cada 100 g (valores de referencia aproximados, tipo USDA y tablas argentinas).
// Las comidas cocidas figuran ya cocidas, porque es como se pesan en el plato.

export type Macros = { protein: number; carbs: number; fats: number };
export type Portion = { label: string; grams: number };
export type Food = { id: string; name: string; aliases?: string; per100: Macros; portions: Portion[] };

const f = (id: string, name: string, protein: number, carbs: number, fats: number, portions: Portion[], aliases?: string): Food =>
  aliases === undefined ? { id, name, per100: { protein, carbs, fats }, portions } : { id, name, aliases, per100: { protein, carbs, fats }, portions };
const p = (label: string, grams: number): Portion => ({ label, grams });

export const FOODS: readonly Food[] = [
  // Pastas, cereales y harinas
  f("fideos-cocidos", "Fideos cocidos", 5.8, 30.9, 0.9, [p("1 plato", 250), p("1 taza", 140)], "pasta codito tirabuzon spaghetti tallarines mostachol"),
  f("fideos-secos", "Fideos secos (crudos)", 13, 75, 1.5, [p("1 porción", 80), p("1 paquete", 500)], "pasta cruda"),
  f("ravioles", "Ravioles de ricota cocidos", 8, 27, 6, [p("1 plato", 250)], "pasta rellena sorrentinos"),
  f("noquis", "Ñoquis de papa cocidos", 3.5, 28, 1, [p("1 plato", 250)], "noquis gnocchi"),
  f("arroz-blanco", "Arroz blanco cocido", 2.7, 28.2, 0.3, [p("1 plato", 200), p("1 taza", 160)]),
  f("arroz-integral", "Arroz integral cocido", 2.6, 23, 0.9, [p("1 plato", 200), p("1 taza", 160)]),
  f("avena", "Avena en copos", 13.2, 67.7, 6.5, [p("3 cucharadas", 30), p("1 taza", 80)], "porridge"),
  f("pan-frances", "Pan francés", 8.5, 57, 1.5, [p("1 pancito", 60), p("1 mignon", 30)], "pan blanco flauta felipe"),
  f("pan-lactal", "Pan lactal blanco", 8, 49, 3.5, [p("1 rebanada", 25), p("2 rebanadas", 50)], "pan de molde"),
  f("pan-integral", "Pan integral", 10, 43, 3.5, [p("1 rebanada", 30)], "pan salvado"),
  f("galletitas-agua", "Galletitas de agua", 10, 70, 12, [p("3 galletitas", 20)], "crackers criollitas"),
  f("tostadas-arroz", "Tostadas de arroz", 8, 81, 3, [p("1 tostada", 9), p("3 tostadas", 27)]),
  f("copos-maiz", "Copos de maíz", 7, 84, 0.9, [p("1 taza", 30)], "cereal corn flakes"),
  f("granola", "Granola", 10, 64, 15, [p("1/2 taza", 50)]),
  f("barrita-cereal", "Barrita de cereal", 6, 70, 10, [p("1 barrita", 25)]),
  f("polenta", "Polenta cocida", 1.7, 15.5, 0.4, [p("1 plato", 250)], "harina de maiz"),
  f("medialuna", "Medialuna de manteca", 7, 45, 21, [p("1 medialuna", 45)], "factura croissant"),
  f("empanada-carne", "Empanada de carne al horno", 10, 27, 12, [p("1 empanada", 90)], "empanadas"),
  f("pizza-muzza", "Pizza de muzzarella", 11, 33, 10, [p("1 porción", 120), p("2 porciones", 240)], "pizza mozzarella"),
  f("tarta-verdura", "Tarta de verdura", 7, 22, 12, [p("1 porción", 150)], "tarta acelga espinaca"),

  // Papas, legumbres y verduras con almidón
  f("papa-hervida", "Papa hervida", 1.9, 20, 0.1, [p("1 papa mediana", 150)], "papas"),
  f("papas-fritas", "Papas fritas", 3.4, 41, 15, [p("1 porción", 150)], "papa frita"),
  f("pure-papas", "Puré de papas", 2, 15.9, 4.2, [p("1 plato", 200)], "pure"),
  f("batata", "Batata hervida o al horno", 1.4, 17.7, 0.1, [p("1 batata mediana", 150)], "boniato"),
  f("choclo", "Choclo en granos", 3.4, 21, 1.5, [p("1/2 taza", 80)], "maiz"),
  f("lentejas", "Lentejas cocidas", 9, 20.1, 0.4, [p("1 plato", 200), p("1 taza", 200)]),
  f("garbanzos", "Garbanzos cocidos", 8.9, 27.4, 2.6, [p("1 taza", 160)]),
  f("porotos", "Porotos cocidos", 8.7, 22.8, 0.5, [p("1 taza", 170)], "frijoles alubias"),

  // Carnes, pescados y huevos
  f("pollo-pechuga", "Pechuga de pollo cocida", 31, 0, 3.6, [p("1 pechuga", 150), p("1 porción chica", 100)], "pollo a la plancha"),
  f("pollo-muslo", "Pata y muslo de pollo con piel", 24, 0, 15, [p("1 pata y muslo", 150)], "pollo al horno"),
  f("carne-magra", "Carne vacuna magra cocida", 30, 0, 6, [p("1 bife", 200), p("1 porción", 150)], "bife peceto nalga cuadril lomo"),
  f("carne-grasa", "Asado o vacío cocido", 24, 0, 22, [p("1 porción", 200)], "asado tira vacio matambre carne"),
  f("carne-picada", "Carne picada cocida", 26, 0, 17, [p("1 porción", 150)]),
  f("milanesa-carne-frita", "Milanesa de carne frita", 18, 14, 16, [p("1 milanesa mediana", 150), p("1 milanesa grande", 220)], "milanga"),
  f("milanesa-carne-horno", "Milanesa de carne al horno", 22, 14, 8, [p("1 milanesa mediana", 150), p("1 milanesa grande", 220)], "milanga"),
  f("milanesa-pollo-frita", "Milanesa de pollo frita", 19, 14, 15, [p("1 milanesa mediana", 150)]),
  f("milanesa-pollo-horno", "Milanesa de pollo al horno", 23, 13, 6, [p("1 milanesa mediana", 150)]),
  f("hamburguesa", "Hamburguesa de carne cocida", 24, 0, 18, [p("1 medallón", 80), p("1 medallón grande", 120)], "medallon"),
  f("chorizo", "Chorizo asado", 18, 1, 30, [p("1 chorizo", 100)], "choripan"),
  f("salchicha", "Salchicha de Viena", 11, 3, 25, [p("1 salchicha", 40)], "pancho"),
  f("atun", "Atún al natural", 26, 0, 1, [p("1 lata escurrida", 120)]),
  f("merluza", "Merluza cocida", 20, 0, 1.5, [p("1 filet", 150)], "pescado"),
  f("salmon", "Salmón cocido", 25, 0, 12, [p("1 porción", 150)], "pescado"),
  f("huevo", "Huevo", 12.6, 0.7, 9.5, [p("1 huevo", 50), p("2 huevos", 100)], "huevos revuelto duro frito"),
  f("clara", "Clara de huevo", 11, 0.7, 0.2, [p("1 clara", 33)]),
  f("jamon-cocido", "Jamón cocido", 17, 1.5, 6, [p("1 feta", 20), p("3 fetas", 60)], "fiambre"),
  f("tofu", "Tofu", 8, 2, 4.8, [p("1 porción", 100)]),
  f("proteina-polvo", "Proteína en polvo (whey)", 78, 8, 6, [p("1 scoop", 30)], "suplemento batido"),

  // Lácteos y quesos
  f("leche-entera", "Leche entera", 3.2, 4.8, 3, [p("1 vaso", 200), p("1 taza", 250)]),
  f("leche-descremada", "Leche descremada", 3.3, 5, 0.5, [p("1 vaso", 200), p("1 taza", 250)]),
  f("yogur-bebible", "Yogur bebible endulzado", 3, 13, 2.8, [p("1 vaso", 200)]),
  f("yogur-natural", "Yogur natural entero", 3.5, 4.7, 3.3, [p("1 pote", 190)]),
  f("yogur-griego", "Yogur griego natural", 9, 4, 5, [p("1 pote", 160)]),
  f("queso-cremoso", "Queso cremoso", 20, 1, 24, [p("1 porción", 30)], "queso fresco"),
  f("queso-maquina", "Queso de máquina (tipo Tybo)", 25, 1, 27, [p("1 feta", 20), p("3 fetas", 60)], "queso en fetas"),
  f("queso-rallado", "Queso rallado", 33, 3, 28, [p("1 cucharada", 10)], "reggianito parmesano"),
  f("muzzarella", "Muzzarella", 22, 2.2, 22, [p("1 porción", 30)], "mozzarella"),
  f("ricota", "Ricota", 11, 3, 10, [p("2 cucharadas", 50)]),
  f("queso-untable", "Queso untable light", 12, 4, 7, [p("1 cucharada", 20)], "casancrem"),
  f("dulce-leche", "Dulce de leche", 7, 55, 7.5, [p("1 cucharada", 20)]),
  f("manteca", "Manteca", 0.9, 0.1, 81, [p("1 cucharadita", 5), p("1 cucharada", 14)], "mantequilla"),
  f("crema", "Crema de leche", 2.5, 3, 35, [p("1 cucharada", 15)]),

  // Frutas y verduras
  f("banana", "Banana", 1.1, 22.8, 0.3, [p("1 banana mediana", 120)], "platano"),
  f("manzana", "Manzana", 0.3, 13.8, 0.2, [p("1 manzana mediana", 180)]),
  f("naranja", "Naranja", 0.9, 11.8, 0.1, [p("1 naranja mediana", 150)]),
  f("mandarina", "Mandarina", 0.8, 13.3, 0.3, [p("1 mandarina", 90)]),
  f("pera", "Pera", 0.4, 15, 0.1, [p("1 pera mediana", 180)]),
  f("frutillas", "Frutillas", 0.7, 7.7, 0.3, [p("1 taza", 150)], "fresas"),
  f("uvas", "Uvas", 0.7, 18, 0.2, [p("1 taza", 150)]),
  f("palta", "Palta", 2, 8.5, 14.7, [p("1/2 palta", 75)], "aguacate"),
  f("ensalada", "Ensalada de lechuga y tomate (sin aderezo)", 1, 3.5, 0.2, [p("1 plato", 150)], "ensalada mixta"),
  f("tomate", "Tomate", 0.9, 3.9, 0.2, [p("1 tomate mediano", 120)]),
  f("zanahoria", "Zanahoria", 0.9, 9.6, 0.2, [p("1 zanahoria mediana", 80)]),
  f("brocoli", "Brócoli cocido", 2.4, 7.2, 0.4, [p("1 taza", 150)]),
  f("calabaza", "Zapallo o calabaza cocida", 1, 8, 0.1, [p("1 porción", 150)], "zapallo anco"),
  f("verduras-salteadas", "Verduras salteadas", 2, 7, 3, [p("1 plato", 200)], "wok verduras"),

  // Grasas, frutos secos, dulces y bebidas
  f("aceite", "Aceite (girasol u oliva)", 0, 0, 100, [p("1 cucharadita", 5), p("1 cucharada", 13)], "aceite de oliva"),
  f("mayonesa", "Mayonesa", 1, 1.5, 75, [p("1 cucharada", 15)], "aderezo"),
  f("mani", "Maní", 26, 16, 49, [p("1 puñado", 30)], "cacahuate"),
  f("almendras", "Almendras", 21, 22, 50, [p("1 puñado", 30)]),
  f("nueces", "Nueces", 15, 14, 65, [p("1 puñado", 30)]),
  f("pasta-mani", "Mantequilla de maní", 25, 20, 50, [p("1 cucharada", 16)], "pasta de mani"),
  f("azucar", "Azúcar", 0, 100, 0, [p("1 cucharadita", 5)]),
  f("miel", "Miel", 0.3, 82, 0, [p("1 cucharada", 20)]),
  f("mermelada", "Mermelada", 0.4, 60, 0.1, [p("1 cucharada", 20)], "dulce"),
  f("chocolate", "Chocolate con leche", 7.7, 59, 30, [p("1 barrita", 25)]),
  f("alfajor", "Alfajor de chocolate", 5, 62, 22, [p("1 alfajor", 50)]),
  f("gaseosa", "Gaseosa común", 0, 10.6, 0, [p("1 vaso", 250), p("1 lata", 354)], "coca cola"),
  f("jugo-naranja", "Jugo de naranja", 0.7, 10.4, 0.2, [p("1 vaso", 250)], "exprimido"),
];

export function normalizeText(value: string): string {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Busca por nombre o sinónimo; los que empiezan igual van primero. */
export function searchFoods(query: string, limit = 8): Food[] {
  const text = normalizeText(query);
  if (text.length === 0) return [];
  const words = text.split(/\s+/);
  return FOODS
    .map((food) => {
      const haystack = normalizeText(`${food.name} ${food.aliases ?? ""}`);
      if (!words.every((word) => haystack.includes(word))) return null;
      const score = normalizeText(food.name).startsWith(text) ? 0 : haystack.split(/\s+/).some((word) => word.startsWith(words[0]!)) ? 1 : 2;
      return { food, score };
    })
    .filter((item): item is { food: Food; score: number } => item !== null)
    .sort((a, b) => a.score - b.score || a.food.name.localeCompare(b.food.name, "es"))
    .slice(0, limit)
    .map((item) => item.food);
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function macrosFor(food: Pick<Food, "per100">, grams: number): Macros {
  const factor = Math.max(0, grams) / 100;
  return { protein: round1(food.per100.protein * factor), carbs: round1(food.per100.carbs * factor), fats: round1(food.per100.fats * factor) };
}

export function sumMacros(items: ReadonlyArray<Macros>): Macros {
  return items.reduce<Macros>((total, item) => ({
    protein: round1(total.protein + item.protein),
    carbs: round1(total.carbs + item.carbs),
    fats: round1(total.fats + item.fats),
  }), { protein: 0, carbs: 0, fats: 0 });
}

export function caloriesFor(macros: Macros): number {
  return Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fats * 9);
}

export function findFood(id: string): Food | undefined {
  return FOODS.find((food) => food.id === id);
}
