// Fotos representativas de rutinas. `hero` es horizontal 3:2 con el atleta a la derecha;
// `thumb` es un recorte cuadrado del atleta para círculos y miniaturas.
export type RoutineImage = { hero: string; thumb: string };

const folder = "/media/routines";
const image = (name: string): RoutineImage => ({ hero: `${folder}/${name}.webp`, thumb: `${folder}/${name}-thumb.webp` });

export const routineImages = {
  legs: image("piernas"),
  torso: image("torso"),
  fullBody: image("full-body"),
} as const;

/** Elige la foto por el grupo muscular o el nombre de la rutina. Sin coincidencia, no hay foto. */
export function routineImageFor(routine: { name: string; muscleGroup: string }): RoutineImage | undefined {
  const text = `${routine.muscleGroup} ${routine.name}`.toLocaleLowerCase("es");
  if (/full ?body|cuerpo completo/.test(text)) return routineImages.fullBody;
  if (/pierna|legs?\b|cu[aá]driceps|gl[uú]teo|isquio/.test(text)) return routineImages.legs;
  if (/torso|pecho|espalda|hombro|brazo|upper/.test(text)) return routineImages.torso;
  return undefined;
}
