// Catalogo base de camadas sonoras disponiveis para mixer e validacoes de payload.
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
  { id: "zen", label: "Tigela Tibetana", group: "zen" },
  { id: "thunder", label: "Trovoes Distantes", group: "nature" },
  { id: "vinyl", label: "Chiado de Vinil", group: "vintage" },
  { id: "river", label: "Rio Corrente", group: "nature" },
  { id: "subway", label: "Metro Subterraneo", group: "urban" },
  { id: "dronepad", label: "Pad Cinematico", group: "ambient" },
  { id: "market", label: "Mercado Vivo", group: "urban" }
];

// Presets curados usados como ponto de partida para composicao rapida.
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
  },

  {
    key: "atelier-em-chuva",
    name: "Atelier em Chuva",
    description: "Ambiente artistico com chuva suave e pad atmosferico.",
    category: "criatividade",
    theme: "cozy",
    icon: "ART",
    mixer: { rain: 0.48, dronepad: 0.52, vinyl: 0.28, chime: 0.2 }
  },
  {
    key: "laboratorio-orbital",
    name: "Laboratorio Orbital",
    description: "Camadas digitais para sessoes profundas de concentracao.",
    category: "foco",
    theme: "space",
    icon: "ORB",
    mixer: { spaceship: 0.62, dronepad: 0.58, keyboard: 0.44, neon: 0.24 }
  },
  {
    key: "bosque-ao-amanhecer",
    name: "Bosque ao Amanhecer",
    description: "Rio corrente e floresta viva para estudo de longa duracao.",
    category: "leitura",
    theme: "forest",
    icon: "DAWN",
    mixer: { forest: 0.56, river: 0.72, wind: 0.22, chime: 0.15 }
  },
  {
    key: "cabine-trovoes",
    name: "Cabine e Trovoes",
    description: "Trovoes distantes com lareira para foco em tarefas pesadas.",
    category: "foco",
    theme: "cozy",
    icon: "THDR",
    mixer: { thunder: 0.48, fire: 0.66, rain: 0.52, vinyl: 0.18 }
  },
  {
    key: "metro-digital",
    name: "Metro Digital",
    description: "Clima metropolitano com pulso sintetico para produtividade.",
    category: "foco",
    theme: "cyber",
    icon: "SUB",
    mixer: { subway: 0.62, keyboard: 0.46, neon: 0.36, dronepad: 0.2 }
  },
  {
    key: "livraria-vintage",
    name: "Livraria Vintage",
    description: "Silencio elegante com chiado de vinil e madeira antiga.",
    category: "leitura",
    theme: "library",
    icon: "VIN",
    mixer: { library: 0.66, vinyl: 0.48, rain: 0.22, fire: 0.14 }
  },
  {
    key: "camping-noturno",
    name: "Camping Noturno",
    description: "Fogueira, vento e rio para desacelerar depois de um dia intenso.",
    category: "relaxamento",
    theme: "forest",
    icon: "CAMP",
    mixer: { fire: 0.58, wind: 0.24, river: 0.5, forest: 0.35 }
  },
  {
    key: "templo-marinho",
    name: "Templo Marinho",
    description: "Ondas tranquilas e harmonicos para respiracao consciente.",
    category: "relaxamento",
    theme: "ocean",
    icon: "TIDE",
    mixer: { ocean: 0.64, zen: 0.48, chime: 0.24, dronepad: 0.16 }
  },
  {
    key: "fabrica-neon",
    name: "Fabrica Neon",
    description: "Ritmo industrial leve e atmosfera eletrica criativa.",
    category: "criatividade",
    theme: "neon",
    icon: "FAB",
    mixer: { neon: 0.58, subway: 0.34, keyboard: 0.46, rain: 0.18 }
  },
  {
    key: "varanda-chuvosa",
    name: "Varanda Chuvosa",
    description: "Noite serena com chuva, trovoes leves e vinil ao fundo.",
    category: "sono",
    theme: "cozy",
    icon: "VERA",
    mixer: { rain: 0.68, thunder: 0.22, vinyl: 0.31, wind: 0.18 }
  },

  {
    key: "escritorio-minimal",
    name: "Escritorio Minimal",
    description: "Sons controlados para fluxo de trabalho limpo e consistente.",
    category: "foco",
    theme: "cafe",
    icon: "MIN",
    mixer: { cafe: 0.44, keyboard: 0.42, vinyl: 0.12, wind: 0.1 }
  },
  {
    key: "refugio-do-rio",
    name: "Refugio do Rio",
    description: "Correnteza constante com textura zen para leitura profunda.",
    category: "leitura",
    theme: "zen",
    icon: "RIV",
    mixer: { river: 0.8, zen: 0.26, forest: 0.3, chime: 0.14 }
  },
  {
    key: "hangar-cosmico",
    name: "Hangar Cosmico",
    description: "Graves longos e pad espacial para imaginar e projetar.",
    category: "criatividade",
    theme: "space",
    icon: "HGR",
    mixer: { spaceship: 0.6, dronepad: 0.62, neon: 0.28, keyboard: 0.32 }
  },
  {
    key: "mercado-antigo",
    name: "Mercado Antigo",
    description: "Movimento humano suave com assinatura vintage.",
    category: "criatividade",
    theme: "library",
    icon: "MKT",
    mixer: { market: 0.62, vinyl: 0.33, library: 0.22, wind: 0.12 }
  },
  {
    key: "cabana-inverno",
    name: "Cabana de Inverno",
    description: "Conforto termico e silencio para adormecer naturalmente.",
    category: "sono",
    theme: "cozy",
    icon: "SNW",
    mixer: { fire: 0.72, wind: 0.18, rain: 0.35, vinyl: 0.2 }
  },
  {
    key: "deserto-estelar",
    name: "Deserto Estelar",
    description: "Horizonte amplo com vento seco e cama sonora espacial.",
    category: "relaxamento",
    theme: "desert",
    icon: "DST",
    mixer: { desert: 0.64, dronepad: 0.42, wind: 0.48, chime: 0.2 }
  },
  {
    key: "estudio-vinil",
    name: "Estudio de Vinil",
    description: "Textura analogica para escrita, leitura e revisao.",
    category: "leitura",
    theme: "cafe",
    icon: "VIN2",
    mixer: { vinyl: 0.62, cafe: 0.36, library: 0.18, rain: 0.2 }
  },
  {
    key: "chuva-no-metro",
    name: "Chuva no Metro",
    description: "Ritmo subterraneo e chuva urbana para foco em sprint.",
    category: "foco",
    theme: "cyber",
    icon: "URB",
    mixer: { subway: 0.58, rain: 0.56, neon: 0.38, keyboard: 0.26 }
  },
  {
    key: "ilha-calma",
    name: "Ilha Calma",
    description: "Combina mar e rio para relaxar sem perder clareza mental.",
    category: "relaxamento",
    theme: "ocean",
    icon: "ISL",
    mixer: { ocean: 0.56, river: 0.52, wind: 0.22, zen: 0.22 }
  },
  {
    key: "jardim-da-meia-noite",
    name: "Jardim da Meia-Noite",
    description: "Noite contemplativa com pad, sinos e natureza respirando.",
    category: "sono",
    theme: "zen",
    icon: "MID",
    mixer: { dronepad: 0.38, chime: 0.3, forest: 0.24, wind: 0.16 }
  }
];

// Taxonomia oficial usada por filtros, formularios e regras de negocio.
export const categories = ["foco", "relaxamento", "leitura", "criatividade", "sono"];
