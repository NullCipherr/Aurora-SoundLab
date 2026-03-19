export const soundLibrary = [
  { id: "rain", label: "Chuva", group: "nature" },
  { id: "cafe", label: "Murmurio de Cafeteria", group: "urban" },
  { id: "forest", label: "Floresta Viva", group: "nature" },
  { id: "wind", label: "Vento Etareo", group: "nature" },
  { id: "spaceship", label: "Hum de Nave", group: "sci-fi" },
  { id: "keyboard", label: "Terminais Neon", group: "tech" },
  { id: "library", label: "Biblioteca Antiga", group: "historic" },
  { id: "chime", label: "Sinos Misticos", group: "ambient" },
  { id: "ocean", label: "Ondas do Mar", group: "nature" },
  { id: "fire", label: "Lareira", group: "cozy" },
  { id: "neon", label: "Sinal Neon", group: "urban" },
  { id: "desert", label: "Areia e Rajadas", group: "nature" },
  { id: "zen", label: "Tigela Tibetana", group: "zen" }
];

export const cinematicPresets = [
  {
    key: "cafeteria-chuvosa",
    name: "Cafeteria Chuvosa",
    description: "Xicaras, conversa baixa e chuva no vidro para foco confortavel.",
    category: "foco",
    theme: "cafe",
    icon: "CAFE",
    mixer: { rain: 0.72, cafe: 0.78, library: 0.2, wind: 0.18 }
  },
  {
    key: "floresta-mistica",
    name: "Floresta Mistica",
    description: "Passaros distantes, vento organicamente vivo e sinos sutis.",
    category: "criatividade",
    theme: "forest",
    icon: "FOREST",
    mixer: { forest: 0.84, wind: 0.44, chime: 0.46, rain: 0.18 }
  },
  {
    key: "estacao-espacial",
    name: "Estacao Espacial",
    description: "Grave constante, texturas sinteticas e atmosfera de HUD futurista.",
    category: "foco",
    theme: "space",
    icon: "SPACE",
    mixer: { spaceship: 0.84, keyboard: 0.34, neon: 0.22, wind: 0.14 }
  },
  {
    key: "biblioteca-antiga",
    name: "Biblioteca Antiga",
    description: "Paginas virando, madeira envelhecida e silencio de estudo profundo.",
    category: "leitura",
    theme: "library",
    icon: "BOOK",
    mixer: { library: 0.88, rain: 0.24, wind: 0.14, chime: 0.16 }
  },
  {
    key: "cidade-cyberpunk",
    name: "Cidade Cyberpunk Noturna",
    description: "Neon pulsante, chuva urbana e maquinas trabalhando ao fundo.",
    category: "criatividade",
    theme: "cyber",
    icon: "CYBER",
    mixer: { neon: 0.65, rain: 0.5, keyboard: 0.58, cafe: 0.18 }
  },
  {
    key: "quarto-aconchegante",
    name: "Quarto Aconchegante com Chuva",
    description: "Lareira baixa, chuva calma e ar quente de fim de noite.",
    category: "sono",
    theme: "cozy",
    icon: "COZY",
    mixer: { rain: 0.62, fire: 0.72, wind: 0.2, library: 0.16 }
  },
  {
    key: "templo-zen",
    name: "Templo Zen",
    description: "Respiracao guiada por vento leve e tigelas harmonicas.",
    category: "relaxamento",
    theme: "zen",
    icon: "ZEN",
    mixer: { zen: 0.64, wind: 0.3, chime: 0.28, forest: 0.22 }
  },
  {
    key: "navio-alto-mar",
    name: "Navio em Alto-Mar",
    description: "Ondas profundas, vento frio e rangido distante do casco.",
    category: "leitura",
    theme: "ocean",
    icon: "SEA",
    mixer: { ocean: 0.78, wind: 0.46, rain: 0.2, library: 0.12 }
  },
  {
    key: "deserto-vento",
    name: "Deserto com Vento",
    description: "Paisagem aberta, rajadas secas e sensacao contemplativa.",
    category: "foco",
    theme: "desert",
    icon: "DUNE",
    mixer: { desert: 0.74, wind: 0.58, chime: 0.2, rain: 0.08 }
  },
  {
    key: "madrugada-neon",
    name: "Madrugada Urbana Neon",
    description: "Noite eletrica, ritmo lento e energia de cidade acordada.",
    category: "criatividade",
    theme: "neon",
    icon: "NEON",
    mixer: { neon: 0.62, cafe: 0.24, keyboard: 0.52, rain: 0.34 }
  }
];

export const categories = ["foco", "relaxamento", "leitura", "criatividade", "sono"];
