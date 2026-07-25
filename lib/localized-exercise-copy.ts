import type { AppLanguage } from "@/lib/workout-domain-labels"

type ExerciseCopySource = {
  name: string
  description?: string | null
  instructions?: string[] | null
}

type LocalizedExerciseCopy = {
  name: string
  description: string
  instructions: string[]
}

const NAME_ES: Record<string, string> = {
  "ab wheel rollouts": "Rueda abdominal",
  "alternating banded dead bug press": "Press de dead bug alterno con banda",
  "alternating banded glute bridge march": "Marcha alterna en puente de glúteos con banda",
  "bicycle crunches": "Crunches bicicleta",
  "crunches": "Crunches",
  "dead bug": "Dead bug",
  "leg raises": "Elevaciones de piernas",
  "long push-up": "Flexión larga",
  "mountain climbers": "Escaladores",
  "russian twists": "Giros rusos",
  "side plank": "Plancha lateral",
}

const DESCRIPTION_EN: Record<string, string> = {
  "ab wheel rollouts": "Advanced abdominal wheel exercise.",
  "alternating banded dead bug press": "Dead bug with isometric band press to train anti-extension and coordination.",
  "alternating banded glute bridge march": "Banded glute bridge march for glute strength with low joint stress.",
  "bicycle crunches": "Crunch variation with a bicycle motion for abs and obliques.",
  "crunches": "Classic exercise for the rectus abdominis.",
  "dead bug": "Anti-extension core exercise.",
  "leg raises": "Leg raises for the lower abs.",
  "mountain climbers": "Dynamic exercise combining core and cardio.",
  "russian twists": "Rotational exercise for obliques.",
  "side plank": "Side plank for obliques.",
}

const INSTRUCTIONS_EN: Record<string, string[]> = {
  "leg raises": [
    "Lie on your back with your legs extended",
    "Place your hands under your glutes or at your sides",
    "Raise your legs while keeping your knees straight",
    "Lift until your legs are perpendicular to the floor",
    "Lower with control without touching the floor",
  ],
  "mountain climbers": [
    "Start in a high plank position",
    "Drive one knee toward your chest",
    "Quickly switch legs",
    "Alternate legs in a running motion",
    "Keep your hips low",
  ],
  "russian twists": [
    "Sit on the floor with your knees bent",
    "Lean back slightly",
    "Lift your feet off the floor if appropriate",
    "Rotate your torso side to side",
    "Touch the floor on each side",
  ],
  "side plank": [
    "Lie on your side supported by one forearm",
    "Keep your elbow directly under your shoulder",
    "Lift your hips off the floor",
    "Keep your body in a straight line",
    "Hold the position",
  ],
}

const NAME_TERMS_ES: Array<[RegExp, string]> = [
  [/\balternating\b/gi, "alterno"],
  [/\bbanded\b/gi, "con banda"],
  [/\btempo\b/gi, "tempo"],
  [/\bpaused\b/gi, "con pausa"],
  [/\bmodified\b/gi, "modificada"],
  [/\bsupported\b/gi, "asistida"],
  [/\bdumbbell\b/gi, "con mancuerna"],
  [/\bgoblet\b/gi, "goblet"],
  [/\bglute bridge\b/gi, "puente de glúteos"],
  [/\bdead bug\b/gi, "dead bug"],
  [/\bside plank\b/gi, "plancha lateral"],
  [/\bmountain climbers\b/gi, "escaladores"],
  [/\brussian twists\b/gi, "giros rusos"],
  [/\bleg raises\b/gi, "elevaciones de piernas"],
  [/\bpush-ups\b/gi, "flexiones"],
  [/\bpush-up\b/gi, "flexión"],
  [/\bsquat\b/gi, "sentadilla"],
  [/\blunge\b/gi, "zancada"],
  [/\brow\b/gi, "remo"],
  [/\bpress\b/gi, "press"],
  [/\bcurl\b/gi, "curl"],
  [/\bplank\b/gi, "plancha"],
  [/\bbridge\b/gi, "puente"],
  [/\bmarch\b/gi, "marcha"],
  [/\breach\b/gi, "alcance"],
  [/\braise\b/gi, "elevación"],
  [/\braises\b/gi, "elevaciones"],
  [/\brollouts\b/gi, "rueda abdominal"],
]

const DESCRIPTION_PHRASES_EN: Array<[RegExp, string]> = [
  [/Elevaciones de piernas para el abdomen bajo\./gi, "Leg raises for the lower abs."],
  [/Ejercicio dinámico que combina core y cardio\./gi, "Dynamic exercise combining core and cardio."],
  [/Plancha lateral para oblicuos\./gi, "Side plank for obliques."],
  [/Ejercicio rotacional para oblicuos\./gi, "Rotational exercise for obliques."],
]

function keyFor(name: string) {
  return name.trim().toLowerCase()
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function localizeName(name: string, language: AppLanguage) {
  if (language === "en") {
    return name
  }

  const key = keyFor(name)
  if (NAME_ES[key]) {
    return NAME_ES[key]
  }

  const translated = NAME_TERMS_ES.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), name)
  return translated === name ? name : titleCase(translated).replace(/\bDe\b/g, "de").replace(/\bCon\b/g, "con")
}

function localizeDescription(exercise: ExerciseCopySource, language: AppLanguage) {
  const description = exercise.description ?? ""
  if (language === "es") {
    return description
  }

  const key = keyFor(exercise.name)
  if (DESCRIPTION_EN[key]) {
    return DESCRIPTION_EN[key]
  }

  return DESCRIPTION_PHRASES_EN.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), description)
}

function localizeInstructions(exercise: ExerciseCopySource, language: AppLanguage) {
  const instructions = exercise.instructions ?? []
  if (language === "es") {
    return instructions
  }

  return INSTRUCTIONS_EN[keyFor(exercise.name)] ?? instructions
}

export function getLocalizedExerciseCopy(exercise: ExerciseCopySource, language: AppLanguage): LocalizedExerciseCopy {
  return {
    name: localizeName(exercise.name, language),
    description: localizeDescription(exercise, language),
    instructions: localizeInstructions(exercise, language),
  }
}
