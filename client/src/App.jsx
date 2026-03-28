import { useEffect, useMemo, useState } from "react";
import SoundVisualizer from "./components/SoundVisualizer";
import { useSoundEngine } from "./hooks/useSoundEngine";
import { api, setCsrfToken } from "./lib/api";
import {
  AUDIO_EXPORT_FORMATS,
  downloadAudioBlob,
  exportMixAudio,
  getExportSupportMap
} from "./lib/audioExport";

// Categorias de fallback para manter o app funcional mesmo se a API falhar.
const defaultCategories = ["foco", "relaxamento", "leitura", "criatividade", "sono"];

// Metadados da barra lateral principal; ids aqui dirigem qual painel sera renderizado.
const toolItems = [
  { id: "cenarios", label: "Cenarios", icon: "SCN", helper: "Biblioteca de atmosferas" },
  { id: "mixer", label: "Mixer", icon: "MIX", helper: "Camadas e intensidade" },
  { id: "visual", label: "Visual", icon: "VIS", helper: "Analisador em tempo real" },
  { id: "mixes", label: "Mixes", icon: "LIB", helper: "Sua colecao de criacoes" },
  { id: "exportar", label: "Exportar", icon: "EXP", helper: "Download e redes sociais" },
  { id: "historico", label: "Historico", icon: "HST", helper: "Ultimas reproducoes" },
  { id: "resumo", label: "Resumo", icon: "DAS", helper: "Metricas e categoria" }
];
const ACCOUNT_TOOL_ID = "conta";

const categoryTone = {
  foco: "focus",
  relaxamento: "relax",
  leitura: "read",
  criatividade: "create",
  sono: "sleep"
};

const landingBenefits = [
  {
    title: "Mixagem em tempo real",
    text: "Controle cada camada sonora com resposta imediata e sem sair da tela principal."
  },
  {
    title: "Presets cinematograficos",
    text: "Comece rapido com cenarios curados para foco, leitura, criatividade, relaxamento e sono."
  },
  {
    title: "Exportacao e compartilhamento",
    text: "Baixe audio em varios formatos e gere links publicos para distribuir suas mixes."
  }
];

const landingHowTo = [
  "Escolha um cenario base na biblioteca de presets.",
  "Ajuste volumes por camada no mixer para chegar no clima ideal.",
  "Salve, exporte e compartilhe sua mix com sua equipe ou audiencia."
];

const landingPlans = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 0",
    cycle: "/mes",
    audience: "Para experimentar",
    features: ["Studio em tempo real", "Presets essenciais", "Ate 3 mixes salvas"]
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 39",
    cycle: "/mes",
    audience: "Para criadores e profissionais",
    featured: true,
    features: ["Mixes ilimitadas", "Exportacao completa", "Links de compartilhamento", "Historico detalhado"]
  },
  {
    id: "team",
    name: "Team",
    price: "R$ 129",
    cycle: "/mes",
    audience: "Para equipes de produto e conteudo",
    features: ["Tudo do Pro", "Ate 10 membros", "Padroes de mix compartilhados", "Prioridade no suporte"]
  }
];

const checkoutSteps = [
  "Cadastre-se ou login",
  "Ativacao",
  "Escolher plano",
  "Confirmar plano",
  "Informacoes de cartao",
  "Confirmar compra",
  "Concluido"
];

export default function App() {
  // Bloco de autenticacao e identidade do usuario.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    displayName: "",
    acceptTerms: false
  });
  const [user, setUser] = useState(null);

  // Estado de dados principais carregados do backend.
  const [sounds, setSounds] = useState([]);
  const [presets, setPresets] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [mixes, setMixes] = useState([]);
  const [history, setHistory] = useState([]);
  const [overview, setOverview] = useState(null);

  // Estado operacional da sessao de mixagem.
  const [currentTheme, setCurrentTheme] = useState("cafe");
  const [activePresetKey, setActivePresetKey] = useState("");
  const [mixer, setMixer] = useState({});
  const [trackMuteMap, setTrackMuteMap] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTool, setActiveTool] = useState("cenarios");

  // Estado de UX e fluxos auxiliares (modais, exportacao, compartilhamento).
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [editingMixId, setEditingMixId] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [mixForm, setMixForm] = useState({ name: "", description: "", category: "foco" });
  const [scenarioFilter, setScenarioFilter] = useState("todos");
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [accountMenu, setAccountMenu] = useState("perfil");
  const [exportDuration, setExportDuration] = useState(20);
  const [exportingFormatId, setExportingFormatId] = useState("");
  const [shareMixId, setShareMixId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [publicView, setPublicView] = useState("landing");
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState("pro");
  const [checkoutAccountUser, setCheckoutAccountUser] = useState(null);
  const [activationCode, setActivationCode] = useState("");
  const [activationVerified, setActivationVerified] = useState(false);
  const [billingInfo, setBillingInfo] = useState({
    cardholder: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    document: "",
    installments: "1"
  });
  const [confirmPurchase, setConfirmPurchase] = useState(false);

  // Particulas decorativas geradas uma vez por sessao para evitar "flicker" na UI.
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        id: index,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: `${8 + Math.random() * 18}px`,
        delay: `${Math.random() * 7}s`,
        duration: `${8 + Math.random() * 15}s`
      })),
    []
  );

  const activePreset = useMemo(
    () => presets.find((preset) => preset.key === activePresetKey) || null,
    [activePresetKey, presets]
  );

  const activeToolMeta = useMemo(
    () => toolItems.find((item) => item.id === activeTool) || toolItems[0],
    [activeTool]
  );
  const exportSupportMap = useMemo(() => getExportSupportMap(), []);
  const selectedPlan = useMemo(
    () => landingPlans.find((plan) => plan.id === selectedPlanId) || landingPlans[1],
    [selectedPlanId]
  );
  const filteredPresets = useMemo(() => {
    if (scenarioFilter === "todos") {
      return presets;
    }
    return presets.filter((preset) => preset.category === scenarioFilter);
  }, [presets, scenarioFilter]);
  const hudMeterProgress = useMemo(() => ((playbackSeconds % 300) / 300) * 100, [playbackSeconds]);

  // Normaliza tempo para mm:ss, protegendo contra valores invalidos.
  const formatClock = (seconds) => {
    const total = Math.max(0, Number(seconds || 0));
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  const normalizedMixer = useMemo(() => {
    return sounds.reduce((acc, sound) => {
      acc[sound.id] = Number(mixer[sound.id] || 0);
      return acc;
    }, {});
  }, [mixer, sounds]);

  const effectiveMixer = useMemo(() => {
    // O mix efetivo zera trilhas mutadas sem perder o volume original escolhido pelo usuario.
    return sounds.reduce((acc, sound) => {
      const base = Number(mixer[sound.id] || 0);
      acc[sound.id] = trackMuteMap[sound.id] ? 0 : base;
      return acc;
    }, {});
  }, [mixer, sounds, trackMuteMap]);

  const liveTracksCount = useMemo(() => {
    return sounds.filter((sound) => Number(effectiveMixer[sound.id] || 0) > 0).length;
  }, [sounds, effectiveMixer]);

  const { analyser } = useSoundEngine(sounds, effectiveMixer, isPlaying);

  useEffect(() => {
    // Tema aplicado no root para permitir variacoes visuais via CSS variables.
    document.documentElement.setAttribute("data-theme", currentTheme || "cafe");
  }, [currentTheme]);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const timer = setInterval(() => {
      setPlaybackSeconds((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying]);

  const notify = (message) => setStatus(message);

  const refreshPrivateData = async () => {
    // Carregamento paralelo reduz tempo de espera apos acoes de CRUD.
    const [mixesRes, historyRes, overviewRes] = await Promise.all([
      api.getMixes(),
      api.getHistory(),
      api.getOverview()
    ]);
    setMixes(mixesRes);
    setHistory(historyRes);
    setOverview(overviewRes);
  };

  async function loadStudioData() {
    const [soundsRes, presetsRes, categoriesRes] = await Promise.all([
      api.getSounds(),
      api.getCinematicPresets(),
      api.getCategories()
    ]);

    setSounds(soundsRes);
    setPresets(presetsRes);
    setCategories(categoriesRes);

    const firstPreset = presetsRes[0];
    // Hidrata o estado inicial com o primeiro preset quando ainda nao existe contexto ativo.
    if (firstPreset && !activePresetKey) {
      setActivePresetKey(firstPreset.key);
      setCurrentTheme(firstPreset.theme);
      setMixer(firstPreset.mixer);
      setMixForm((prev) => ({ ...prev, category: firstPreset.category }));
    }
  }

  useEffect(() => {
    setIsLoading(true);

    async function bootstrap() {
      try {
        // Tenta fluxo autenticado primeiro para recuperar contexto pessoal do usuario.
        const meRes = await api.me();
        setUser(meRes.user);
        setIsAuthenticated(true);
        await api.getCsrf();
        await Promise.all([loadStudioData(), refreshPrivateData()]);
      } catch {
        setUser(null);
        setIsAuthenticated(false);
        // Mesmo sem autenticacao, mantemos experiencia de exploracao dos presets.
        await loadStudioData().catch(() => {});
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  const authenticateUser = async ({ commitSession = true } = {}) => {
    if (authMode === "register") {
      if (credentials.password !== credentials.confirmPassword) {
        notify("As senhas nao conferem.");
        throw new Error("As senhas nao conferem.");
      }
      if (!credentials.acceptTerms) {
        notify("Aceite os termos para criar sua conta.");
        throw new Error("Aceite os termos para criar sua conta.");
      }
    }

    const action = authMode === "register" ? api.register : api.login;
    const response = await action({
      username: credentials.username,
      password: credentials.password,
      email: credentials.email
    });
    setCsrfToken(response.csrfToken);

    if (commitSession) {
      setUser(response.user);
      setIsAuthenticated(true);
      await Promise.all([loadStudioData(), refreshPrivateData()]);
    } else {
      // No checkout mantemos o usuario em contexto de compra ate a confirmacao final.
      setCheckoutAccountUser(response.user);
      setActivationVerified(false);
      setActivationCode("");
      setCheckoutStep(2);
    }

    setCredentials({
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      displayName: "",
      acceptTerms: false
    });
    notify(authMode === "register" ? "Conta criada com sucesso." : "Sessao iniciada.");
    return response.user;
  };

  const onAuthSubmit = async (event) => {
    event.preventDefault();

    try {
      await authenticateUser({ commitSession: true });
      setCredentials({
        username: "",
        password: "",
        confirmPassword: "",
        email: "",
        displayName: "",
        acceptTerms: false
      });
    } catch (error) {
      notify(error.message);
    }
  };

  const openAuthPage = (mode = "login") => {
    setAuthMode(mode);
    setPublicView("auth");
  };

  const startCheckout = (planId) => {
    setSelectedPlanId(planId);
    setCheckoutStep(1);
    setCheckoutAccountUser(null);
    setActivationCode("");
    setActivationVerified(false);
    setConfirmPurchase(false);
    setPublicView("checkout");
    setAuthMode("register");
    notify("Siga as etapas para concluir a assinatura.");
  };

  const validateBillingInfo = () => {
    if (!billingInfo.cardholder.trim()) {
      throw new Error("Informe o nome impresso no cartao.");
    }
    if (!/^\d{16}$/.test(billingInfo.cardNumber.replace(/\s+/g, ""))) {
      throw new Error("Numero do cartao invalido. Use 16 digitos.");
    }
    if (!/^\d{2}\/\d{2}$/.test(billingInfo.expiry)) {
      throw new Error("Validade invalida. Use MM/AA.");
    }
    if (!/^\d{3,4}$/.test(billingInfo.cvv)) {
      throw new Error("CVV invalido.");
    }
    if (billingInfo.document.trim().length < 11) {
      throw new Error("Informe um documento valido.");
    }
  };

  const finalizeCheckout = async () => {
    if (!checkoutAccountUser) {
      notify("Conclua a etapa de autenticacao primeiro.");
      return;
    }

    setIsLoading(true);
    try {
      setUser(checkoutAccountUser);
      setIsAuthenticated(true);
      await api.getCsrf();
      await Promise.all([loadStudioData(), refreshPrivateData()]);
      notify("Assinatura confirmada. Bem-vindo ao studio.");
    } catch (error) {
      notify(error.message || "Nao foi possivel concluir o onboarding.");
    } finally {
      setIsLoading(false);
    }
  };

  const nextCheckoutStep = async () => {
    try {
      if (checkoutStep === 1) {
        await authenticateUser({ commitSession: false });
        return;
      }
      if (checkoutStep === 2) {
        if (!/^\d{6}$/.test(activationCode.trim())) {
          throw new Error("Digite o codigo de ativacao com 6 digitos.");
        }
        setActivationVerified(true);
        setCheckoutStep(3);
        return;
      }
      if (checkoutStep === 3) {
        if (!selectedPlan) {
          throw new Error("Selecione um plano para continuar.");
        }
        setCheckoutStep(4);
        return;
      }
      if (checkoutStep === 4) {
        setCheckoutStep(5);
        return;
      }
      if (checkoutStep === 5) {
        validateBillingInfo();
        setCheckoutStep(6);
        return;
      }
      if (checkoutStep === 6) {
        if (!confirmPurchase) {
          throw new Error("Confirme que revisou os dados para finalizar.");
        }
        setCheckoutStep(7);
        return;
      }
      if (checkoutStep === 7) {
        await finalizeCheckout();
      }
    } catch (error) {
      notify(error.message);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // no-op
    }
    setCsrfToken("");
    setIsAuthenticated(false);
    setUser(null);
    setIsPlaying(false);
    notify("Sessao encerrada.");
  };

  const applyPreset = (preset) => {
    // Aplicar preset sempre reinicia mute map para evitar herdar mutacoes antigas.
    setActivePresetKey(preset.key);
    setCurrentTheme(preset.theme);
    setMixer(preset.mixer);
    setTrackMuteMap({});
    setEditingMixId("");
    setMixForm({
      name: `${preset.name} Personal`,
      description: preset.description,
      category: preset.category
    });
    setScenarioFilter(preset.category);
    notify(`Preset ativo: ${preset.name}`);
  };

  const applyMix = async (mix) => {
    setActivePresetKey(mix.scenarioKey);
    setCurrentTheme(mix.theme || "cafe");
    setMixer(mix.mixer);
    setTrackMuteMap({});
    setMixForm({
      name: mix.name,
      description: mix.description,
      category: mix.category
    });
    setEditingMixId(mix.id);
    setIsPlaying(true);
    notify(`Mix carregada: ${mix.name}`);

    try {
      // Play count e historico sao efeitos colaterais de dominio, nao de interface.
      await api.markMixPlayed(mix.id);
      await refreshPrivateData();
    } catch {
      // no-op
    }
  };

  const updateTrackVolume = (soundId, value) => {
    setMixer((prev) => ({ ...prev, [soundId]: Number(value) }));
  };

  const toggleTrack = (soundId) => {
    setTrackMuteMap((prev) => ({ ...prev, [soundId]: !prev[soundId] }));
  };

  const openCreateFromPreset = (preset) => {
    applyPreset(preset);
    setEditingMixId("");
    setMixForm({
      name: `${preset.name} - Minha Versao`,
      description: preset.description,
      category: preset.category
    });
    setSaveModalOpen(true);
  };

  const openEditModal = (mix) => {
    setEditingMixId(mix.id);
    setMixForm({
      name: mix.name,
      description: mix.description,
      category: mix.category
    });
    setMixer(mix.mixer);
    setCurrentTheme(mix.theme || "cafe");
    setTrackMuteMap({});
    setSaveModalOpen(true);
  };

  const saveMix = async () => {
    if (!mixForm.name.trim()) {
      notify("Escolha um nome para salvar a mix.");
      return;
    }

    try {
      // O payload salva sempre o mixer normalizado para padronizar persistencia.
      const payload = {
        name: mixForm.name.trim(),
        description: mixForm.description.trim(),
        category: mixForm.category,
        scenarioKey: activePresetKey || "personalizado",
        theme: currentTheme,
        mixer: normalizedMixer
      };

      if (editingMixId) {
        await api.updateMix(editingMixId, payload);
        notify("Mix atualizada com sucesso.");
      } else {
        await api.createMix(payload);
        notify("Mix salva com sucesso.");
      }

      setSaveModalOpen(false);
      setEditingMixId("");
      await refreshPrivateData();
    } catch (error) {
      notify(error.message);
    }
  };

  const deleteMix = async (mixId) => {
    try {
      await api.deleteMix(mixId);
      if (editingMixId === mixId) {
        setEditingMixId("");
      }
      await refreshPrivateData();
      notify("Mix removida.");
    } catch (error) {
      notify(error.message);
    }
  };

  const toggleFavorite = async (mixId) => {
    try {
      await api.toggleFavoriteMix(mixId);
      await refreshPrivateData();
    } catch (error) {
      notify(error.message);
    }
  };

  const duplicateMix = async (mixId) => {
    try {
      await api.duplicateMix(mixId);
      await refreshPrivateData();
      notify("Mix duplicada.");
    } catch (error) {
      notify(error.message);
    }
  };

  useEffect(() => {
    if (editingMixId && mixes.some((mix) => mix.id === editingMixId)) {
      setShareMixId(editingMixId);
      return;
    }

    if (!shareMixId && mixes.length > 0) {
      setShareMixId(mixes[0].id);
    }
  }, [editingMixId, mixes, shareMixId]);

  const exportCurrentAudio = async (formatId) => {
    if (sounds.length === 0) {
      notify("Nao ha camadas sonoras carregadas para exportar.");
      return;
    }

    setExportingFormatId(formatId);

    try {
      // Usa mixer efetivo para respeitar trilhas mutadas na exportacao.
      const { blob, format } = await exportMixAudio({
        formatId,
        sounds,
        mixer: effectiveMixer,
        durationSeconds: exportDuration
      });

      const baseName = (mixForm.name || activePreset?.name || "aurora-mix")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const filename = `${baseName || "aurora-mix"}-${Date.now()}.${format.extension}`;
      downloadAudioBlob(blob, filename);
      notify(`Download iniciado em ${format.label}.`);
    } catch (error) {
      notify(error.message || "Falha ao exportar audio.");
    } finally {
      setExportingFormatId("");
    }
  };

  const ensureShareLink = async () => {
    if (!shareMixId) {
      throw new Error("Escolha uma mix salva para compartilhar.");
    }

    const response = await api.createShareLink(shareMixId, {
      // 168h = 7 dias; valor fixo para simplificar UX inicial de compartilhamento.
      expiresInHours: 168,
      allowClone: true
    });

    const url = `${window.location.origin}?share=${response.shareId}`;
    setShareUrl(url);
    return url;
  };

  const copyShareLink = async () => {
    try {
      const url = shareUrl || (await ensureShareLink());
      await navigator.clipboard.writeText(url);
      notify("Link copiado para a area de transferencia.");
    } catch (error) {
      notify(error.message || "Nao foi possivel copiar o link.");
    }
  };

  const generateShareLink = async () => {
    try {
      await ensureShareLink();
      notify("Link de compartilhamento gerado.");
    } catch (error) {
      notify(error.message || "Nao foi possivel gerar link.");
    }
  };

  const shareToNetwork = async (network) => {
    try {
      const url = shareUrl || (await ensureShareLink());
      const text = encodeURIComponent("Escute minha mix no Aurora SoundLab");
      const encodedUrl = encodeURIComponent(url);

      const networkUrlMap = {
        whatsapp: `https://wa.me/?text=${text}%20${encodedUrl}`,
        x: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${text}`
      };

      const targetUrl = networkUrlMap[network];
      if (!targetUrl) {
        throw new Error("Rede social invalida.");
      }

      window.open(targetUrl, "_blank", "noopener,noreferrer,width=720,height=640");
    } catch (error) {
      notify(error.message || "Nao foi possivel compartilhar agora.");
    }
  };

  const shareWithSystem = async () => {
    if (!navigator.share) {
      notify("Seu navegador nao suporta compartilhamento nativo.");
      return;
    }

    try {
      const url = shareUrl || (await ensureShareLink());
      await navigator.share({
        title: "Aurora SoundLab",
        text: "Escute minha mix criada no Aurora SoundLab",
        url
      });
      notify("Compartilhamento enviado.");
    } catch {
      // no-op
    }
  };

  const renderToolContent = () => {
    if (activeTool === "cenarios") {
      return (
        <section className="tool-panel">
          <div className="tool-panel-header">
            <h2>Cenarios Sonoros</h2>
            <small>Escolha um ambiente base para iniciar a mix.</small>
          </div>
          <div className="scenario-category-bar" aria-label="Filtros de categoria">
            <button
              className={`scenario-filter ${scenarioFilter === "todos" ? "active" : ""}`}
              onClick={() => setScenarioFilter("todos")}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`scenario-filter ${scenarioFilter === category ? "active" : ""}`}
                onClick={() => setScenarioFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <section className="preset-grid">
            {filteredPresets.map((preset) => (
              <article
                key={preset.key}
                className={`preset-card ${activePresetKey === preset.key ? "active" : ""}`}
                onClick={() => applyPreset(preset)}
              >
                <header>
                  <span>{preset.icon}</span>
                  <small className={`scenario-badge tone-${categoryTone[preset.category] || "default"}`}>
                    {preset.category}
                  </small>
                </header>
                <h3>{preset.name}</h3>
                <p>{preset.description}</p>
                <div className="preset-actions">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      applyPreset(preset);
                    }}
                  >
                    Carregar
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openCreateFromPreset(preset);
                    }}
                  >
                    Duplicar
                  </button>
                </div>
              </article>
            ))}
          </section>
        </section>
      );
    }

    if (activeTool === "mixer") {
      return (
        <section className="tool-panel">
          <div className="tool-panel-header">
            <h2>Mixer em Tempo Real</h2>
            <small>Ajuste volume de cada camada sem trocar de tela.</small>
          </div>
          <div className="track-grid">
            {sounds.map((sound) => {
              const baseVolume = Number(mixer[sound.id] || 0);
              const effectiveVolume = Number(effectiveMixer[sound.id] || 0);
              return (
                <article key={sound.id} className={`track-card ${effectiveVolume > 0 && isPlaying ? "live" : ""}`}>
                  <div className="track-top">
                    <strong>{sound.label}</strong>
                    <button
                      className={`toggle ${trackMuteMap[sound.id] ? "off" : "on"}`}
                      onClick={() => toggleTrack(sound.id)}
                    >
                      {trackMuteMap[sound.id] ? "Off" : "On"}
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={baseVolume}
                    onChange={(event) => updateTrackVolume(sound.id, event.target.value)}
                  />
                  <div className={`track-meter ${isPlaying ? "playing" : ""}`} style={{ "--level": effectiveVolume }} />
                  <small>{Math.round(baseVolume * 100)}%</small>
                </article>
              );
            })}
          </div>
        </section>
      );
    }

    if (activeTool === "visual") {
      return (
        <section className="tool-panel visual-tool">
          <div className="tool-panel-header">
            <h2>Visualizacao Imersiva</h2>
            <small>Waveform responsiva ao audio com leitura ao vivo.</small>
          </div>
          <div className="panel-block">
            <SoundVisualizer analyserRef={analyser} active={isPlaying} />
            <div className="visual-stats">
              <article>
                <span>Estado</span>
                <strong>{isPlaying ? "Transmitindo" : "Pausado"}</strong>
              </article>
              <article>
                <span>Faixas ativas</span>
                <strong>{liveTracksCount}</strong>
              </article>
              <article>
                <span>Preset atual</span>
                <strong>{activePreset?.name || "Personalizado"}</strong>
              </article>
            </div>
          </div>
        </section>
      );
    }

    if (activeTool === "mixes") {
      return (
        <section className="tool-panel">
          <div className="tool-panel-header">
            <h2>Biblioteca de Mixes</h2>
            <small>Gerencie suas composicoes e reaplique em um clique.</small>
          </div>
          {mixes.length === 0 ? (
            <p>Nenhuma mix salva ainda.</p>
          ) : (
            <div className="mix-list">
              {mixes.map((mix) => (
                <article key={mix.id} className="mix-card">
                  <div>
                    <h3>{mix.name}</h3>
                    <p>{mix.description || "Sem descricao"}</p>
                    <small>
                      {mix.category} • {mix.playCount} plays
                    </small>
                  </div>
                  <div className="mix-actions">
                    <button onClick={() => applyMix(mix)}>Aplicar</button>
                    <button onClick={() => openEditModal(mix)}>Editar</button>
                    <button onClick={() => duplicateMix(mix.id)}>Duplicar</button>
                    <button onClick={() => toggleFavorite(mix.id)}>{mix.favorite ? "Desfavoritar" : "Favoritar"}</button>
                    <button onClick={() => deleteMix(mix.id)}>Excluir</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (activeTool === "exportar") {
      return (
        <section className="tool-panel export-tool">
          <div className="tool-panel-header">
            <h2>Exportar e Compartilhar</h2>
            <small>Baixe seu audio em 5 formatos e compartilhe nas redes sociais.</small>
          </div>

          <section className="export-section">
            <header>
              <h3>Download de audio</h3>
              <label className="export-duration">
                Duracao (segundos)
                <input
                  type="number"
                  min="6"
                  max="120"
                  value={exportDuration}
                  onChange={(event) => setExportDuration(Number(event.target.value || 20))}
                />
              </label>
            </header>
            <div className="format-grid">
              {AUDIO_EXPORT_FORMATS.map((format) => {
                const supported = Boolean(exportSupportMap[format.id]);
                const isExporting = exportingFormatId === format.id;

                return (
                  <article key={format.id} className={`format-card ${supported ? "" : "disabled"}`}>
                    <div>
                      <strong>{format.label}</strong>
                      <small>{supported ? "Pronto para exportar" : "Nao suportado no navegador atual"}</small>
                    </div>
                    <button disabled={!supported || Boolean(exportingFormatId)} onClick={() => exportCurrentAudio(format.id)}>
                      {isExporting ? "Gerando..." : "Baixar"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="export-section">
            <header>
              <h3>Compartilhar nas redes</h3>
              <small>Selecione uma mix salva para gerar link publico.</small>
            </header>
            <div className="share-controls">
              <label>
                Mix para compartilhar
                <select value={shareMixId} onChange={(event) => setShareMixId(event.target.value)}>
                  {mixes.length === 0 ? (
                    <option value="">Nenhuma mix salva</option>
                  ) : (
                    mixes.map((mix) => (
                      <option key={mix.id} value={mix.id}>
                        {mix.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div className="share-link-row">
                <input value={shareUrl} readOnly placeholder="Clique em gerar link para compartilhar" />
                <button onClick={generateShareLink} disabled={!shareMixId}>
                  Gerar link
                </button>
                <button className="ghost" onClick={copyShareLink} disabled={!shareMixId}>
                  Copiar
                </button>
              </div>
              <div className="social-grid">
                <button onClick={() => shareToNetwork("whatsapp")} disabled={!shareMixId}>
                  WhatsApp
                </button>
                <button onClick={() => shareToNetwork("x")} disabled={!shareMixId}>
                  X
                </button>
                <button onClick={() => shareToNetwork("facebook")} disabled={!shareMixId}>
                  Facebook
                </button>
                <button onClick={() => shareToNetwork("linkedin")} disabled={!shareMixId}>
                  LinkedIn
                </button>
                <button onClick={() => shareToNetwork("telegram")} disabled={!shareMixId}>
                  Telegram
                </button>
                <button className="play-toggle" onClick={shareWithSystem} disabled={!shareMixId}>
                  Compartilhar no dispositivo
                </button>
              </div>
            </div>
          </section>
        </section>
      );
    }

    if (activeTool === "historico") {
      return (
        <section className="tool-panel">
          <div className="tool-panel-header">
            <h2>Historico de Reproducao</h2>
            <small>Timeline das ultimas atividades da conta.</small>
          </div>
          {history.length === 0 ? (
            <p>Sem historico de reproducao ainda.</p>
          ) : (
            <ul className="history expanded">
              {history.map((item) => (
                <li key={item.id}>
                  <strong>{item.mixName}</strong>
                  <span>{new Date(item.playedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }

    if (activeTool === ACCOUNT_TOOL_ID) {
      return (
        <section className="tool-panel account-tool">
          <div className="tool-panel-header">
            <h2>Conta</h2>
            <small>Gerencie perfil, sessao e preferencias do seu studio.</small>
          </div>

          <div className="account-menu-tabs">
            <button className={accountMenu === "perfil" ? "active" : ""} onClick={() => setAccountMenu("perfil")}>
              Perfil
            </button>
            <button className={accountMenu === "studio" ? "active" : ""} onClick={() => setAccountMenu("studio")}>
              Studio
            </button>
            <button className={accountMenu === "sessao" ? "active" : ""} onClick={() => setAccountMenu("sessao")}>
              Sessao
            </button>
          </div>

          {accountMenu === "perfil" && (
            <section className="account-panel">
              <article className="account-card-item">
                <span>Usuario</span>
                <strong>{user?.username || "usuario"}</strong>
              </article>
              <article className="account-card-item">
                <span>Email</span>
                <strong>{user?.email || "Nao informado"}</strong>
              </article>
              <article className="account-card-item">
                <span>Status da sessao</span>
                <strong>{isPlaying ? "Studio em reproducao" : "Studio pausado"}</strong>
              </article>
            </section>
          )}

          {accountMenu === "studio" && (
            <section className="account-panel">
              <article className="account-card-item">
                <span>Cenario ativo</span>
                <strong>{activePreset?.name || "Personalizado"}</strong>
              </article>
              <article className="account-card-item">
                <span>Total de mixes</span>
                <strong>{overview?.totalMixes || 0}</strong>
              </article>
              <article className="account-card-item">
                <span>Favoritas</span>
                <strong>{overview?.favorites || 0}</strong>
              </article>
              <div className="account-actions">
                <button onClick={() => setSaveModalOpen(true)}>{editingMixId ? "Atualizar mix atual" : "Salvar mix atual"}</button>
                <button className="ghost" onClick={() => setActiveTool("exportar")}>
                  Ir para Exportar
                </button>
              </div>
            </section>
          )}

          {accountMenu === "sessao" && (
            <section className="account-panel">
              <article className="account-card-item">
                <span>Reproducao</span>
                <strong>{isPlaying ? "Ativa" : "Pausada"}</strong>
              </article>
              <article className="account-card-item">
                <span>Seguranca</span>
                <strong>CSRF habilitado e sessao por cookie HttpOnly</strong>
              </article>
              <div className="account-actions">
                <button className="play-toggle" onClick={logout}>
                  Encerrar sessao
                </button>
              </div>
            </section>
          )}
        </section>
      );
    }

    return (
      <section className="tool-panel summary-tool">
        <div className="tool-panel-header">
          <h2>Resumo Geral</h2>
          <small>Visao consolidada do desempenho do seu laboratorio.</small>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <span>Total de mixes</span>
            <strong>{overview?.totalMixes || 0}</strong>
          </article>
          <article className="summary-card">
            <span>Favoritas</span>
            <strong>{overview?.favorites || 0}</strong>
          </article>
          <article className="summary-card">
            <span>Reproducoes</span>
            <strong>{overview?.totalPlays || 0}</strong>
          </article>
          <article className="summary-card">
            <span>Compartilhamentos</span>
            <strong>{overview?.totalShares || 0}</strong>
          </article>
        </div>
        <div className="category-chips">
          {categories.map((category) => (
            <span key={category} className="chip">
              {category}: {overview?.byCategory?.[category] || 0}
            </span>
          ))}
        </div>
      </section>
    );
  };

  if (!isAuthenticated) {
    const renderAuthForm = (
      title,
      subtitle,
      { onSubmitHandler = onAuthSubmit, submitLabel, showModeToggle = true } = {}
    ) => (
      <section className="auth-card">
        <header className="auth-header">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </header>
        {showModeToggle && (
          <div className="auth-mode-toggle" role="tablist" aria-label="Selecionar modo de acesso">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "register"}
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Cadastre-se
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "login"}
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
          </div>
        )}
        <form onSubmit={onSubmitHandler} className="auth-form">
          {authMode === "register" && (
            <>
              <label className="auth-field">
                <span className="auth-label">Nome artistico</span>
                <input
                  autoComplete="nickname"
                  value={credentials.displayName}
                  onChange={(event) =>
                    setCredentials((prev) => ({ ...prev, displayName: event.target.value }))
                  }
                  placeholder="Ex.: Aurora Creator"
                />
              </label>
              <label className="auth-field">
                <span className="auth-label">Email profissional</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={credentials.email}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="voce@studio.com"
                />
              </label>
            </>
          )}
          <label className="auth-field">
            <span className="auth-label">Usuario</span>
            <input
              required
              minLength={3}
              autoComplete="username"
              value={credentials.username}
              onChange={(event) => setCredentials((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="Seu usuario exclusivo"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">Senha</span>
            <input
              required
              minLength={12}
              type="password"
              autoComplete={authMode === "register" ? "new-password" : "current-password"}
              value={credentials.password}
              onChange={(event) => setCredentials((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Minimo de 12 caracteres"
            />
          </label>
          {authMode === "register" && (
            <label className="auth-field">
              <span className="auth-label">Confirmar senha</span>
              <input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={credentials.confirmPassword}
                onChange={(event) =>
                  setCredentials((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                placeholder="Repita sua senha"
              />
            </label>
          )}
          {authMode === "register" && (
            <label className="auth-check">
              <input
                type="checkbox"
                checked={credentials.acceptTerms}
                onChange={(event) =>
                  setCredentials((prev) => ({ ...prev, acceptTerms: event.target.checked }))
                }
              />
              <span>Li e aceito os termos de uso e privacidade.</span>
            </label>
          )}
          <button type="submit" className="auth-submit">
            {submitLabel || (authMode === "register" ? "Criar Conta Premium" : "Entrar no Studio")}
          </button>
        </form>
        <p className="auth-caption">
          {authMode === "login"
            ? "Nao tem conta? Troque para Cadastre-se no seletor acima."
            : "Ja possui conta? Troque para Login no seletor acima."}
        </p>
        <p className="status">{status || "Entre para salvar mixes, favoritos e historico."}</p>
      </section>
    );

    const renderCheckoutContent = () => (
      <section className="checkout-panel">
        <header className="checkout-header">
          <h1>Assinatura Aurora</h1>
          <p>Etapa {checkoutStep} de {checkoutSteps.length}</p>
        </header>

        <nav className="checkout-step-nav" aria-label="Etapas da assinatura">
          {checkoutSteps.map((step, index) => (
            <button
              key={step}
              className={`checkout-step-chip ${checkoutStep === index + 1 ? "active" : ""} ${checkoutStep > index + 1 ? "done" : ""}`}
              onClick={() => {
                if (index + 1 <= checkoutStep) setCheckoutStep(index + 1);
              }}
              disabled={index + 1 > checkoutStep}
            >
              {index + 1}. {step}
            </button>
          ))}
        </nav>

        {checkoutStep === 1 && (
          <section className="checkout-stage">
            <h2>Cadastre-se ou faca login</h2>
            <p>Crie sua conta para vincular assinatura, historico e faturamento.</p>
            {renderAuthForm("Conta de Assinatura", "Use os dados da sua conta para continuar o checkout.", {
              submitLabel: "Validar conta e continuar",
              onSubmitHandler: async (event) => {
                event.preventDefault();
                try {
                  await authenticateUser({ commitSession: false });
                } catch (error) {
                  notify(error.message);
                }
              }
            })}
          </section>
        )}

        {checkoutStep === 2 && (
          <section className="checkout-stage">
            <h2>Ativacao</h2>
            <p>Enviamos um codigo para validar sua identidade. Digite os 6 digitos para continuar.</p>
            <label className="auth-field">
              <span>Codigo de ativacao</span>
              <input
                value={activationCode}
                onChange={(event) => setActivationCode(event.target.value)}
                placeholder="000000"
                maxLength={6}
              />
            </label>
            <small className="status">
              {activationVerified ? "Codigo validado com sucesso." : "Use um codigo de 6 digitos para validar."}
            </small>
          </section>
        )}

        {checkoutStep === 3 && (
          <section className="checkout-stage">
            <h2>Escolher plano</h2>
            <p>Defina o pacote ideal para sua fase atual.</p>
            <div className="plan-grid">
              {landingPlans.map((plan) => (
                <article key={plan.id} className={`plan-card ${selectedPlanId === plan.id ? "featured" : ""}`}>
                  <small>{plan.audience}</small>
                  <h3>{plan.name}</h3>
                  <p className="plan-price">
                    {plan.price}
                    <span>{plan.cycle}</span>
                  </p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <button onClick={() => setSelectedPlanId(plan.id)}>
                    {selectedPlanId === plan.id ? "Plano selecionado" : "Selecionar"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {checkoutStep === 4 && (
          <section className="checkout-stage">
            <h2>Confirmar plano</h2>
            <p>Revise o plano antes de inserir os dados de pagamento.</p>
            <article className="landing-card">
              <h3>{selectedPlan.name}</h3>
              <p className="plan-price">
                {selectedPlan.price}
                <span>{selectedPlan.cycle}</span>
              </p>
              <ul>
                {selectedPlan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {checkoutStep === 5 && (
          <section className="checkout-stage">
            <h2>Informacoes de cartao</h2>
            <p>Seus dados sao usados apenas para finalizar assinatura e faturamento.</p>
            <div className="checkout-billing-grid">
              <label className="auth-field">
                <span>Nome no cartao</span>
                <input
                  value={billingInfo.cardholder}
                  onChange={(event) =>
                    setBillingInfo((prev) => ({ ...prev, cardholder: event.target.value }))
                  }
                />
              </label>
              <label className="auth-field">
                <span>Numero do cartao</span>
                <input
                  value={billingInfo.cardNumber}
                  onChange={(event) =>
                    setBillingInfo((prev) => ({ ...prev, cardNumber: event.target.value.replace(/[^\d]/g, "") }))
                  }
                  placeholder="0000000000000000"
                  maxLength={16}
                />
              </label>
              <label className="auth-field">
                <span>Validade (MM/AA)</span>
                <input
                  value={billingInfo.expiry}
                  onChange={(event) =>
                    setBillingInfo((prev) => ({ ...prev, expiry: event.target.value }))
                  }
                  placeholder="12/30"
                />
              </label>
              <label className="auth-field">
                <span>CVV</span>
                <input
                  value={billingInfo.cvv}
                  onChange={(event) =>
                    setBillingInfo((prev) => ({ ...prev, cvv: event.target.value.replace(/[^\d]/g, "") }))
                  }
                  maxLength={4}
                  placeholder="123"
                />
              </label>
              <label className="auth-field">
                <span>Documento</span>
                <input
                  value={billingInfo.document}
                  onChange={(event) =>
                    setBillingInfo((prev) => ({ ...prev, document: event.target.value }))
                  }
                  placeholder="CPF/CNPJ"
                />
              </label>
              <label className="auth-field">
                <span>Parcelas</span>
                <select
                  value={billingInfo.installments}
                  onChange={(event) =>
                    setBillingInfo((prev) => ({ ...prev, installments: event.target.value }))
                  }
                >
                  <option value="1">1x sem juros</option>
                  <option value="2">2x sem juros</option>
                  <option value="3">3x sem juros</option>
                  <option value="6">6x com juros</option>
                </select>
              </label>
            </div>
          </section>
        )}

        {checkoutStep === 6 && (
          <section className="checkout-stage">
            <h2>Confirmar compra</h2>
            <p>Revise os dados da assinatura antes de concluir.</p>
            <article className="landing-card">
              <p>
                <strong>Conta:</strong> {checkoutAccountUser?.username || "Conta nao validada"}
              </p>
              <p>
                <strong>Plano:</strong> {selectedPlan.name} ({selectedPlan.price}
                {selectedPlan.cycle})
              </p>
              <p>
                <strong>Forma de pagamento:</strong> Cartao final {billingInfo.cardNumber.slice(-4) || "----"}
              </p>
            </article>
            <label className="auth-check">
              <input
                type="checkbox"
                checked={confirmPurchase}
                onChange={(event) => setConfirmPurchase(event.target.checked)}
              />
              <span>Confirmo os dados e autorizo a cobranca da assinatura.</span>
            </label>
          </section>
        )}

        {checkoutStep === 7 && (
          <section className="checkout-stage">
            <h2>Compra confirmada</h2>
            <p>Seu onboarding foi concluido. Clique abaixo para entrar no studio.</p>
            <button onClick={finalizeCheckout} className="auth-submit">
              Entrar no Studio
            </button>
          </section>
        )}

        <footer className="checkout-footer">
          <button className="ghost" onClick={() => (checkoutStep > 1 ? setCheckoutStep((value) => value - 1) : setPublicView("landing"))}>
            {checkoutStep > 1 ? "Voltar etapa" : "Voltar para landing"}
          </button>
          <button onClick={nextCheckoutStep} disabled={checkoutStep === 1}>
            {checkoutStep === 7 ? "Finalizar" : "Continuar"}
          </button>
        </footer>
      </section>
    );

    return (
      <main className="landing-shell">
        <div className="immersive-bg">
          {particles.map((particle) => (
            <span
              key={particle.id}
              className="particle"
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                animationDelay: particle.delay,
                animationDuration: particle.duration
              }}
            />
          ))}
        </div>

        <div className="landing-content">
          <header className="landing-nav">
            <strong>Aurora SoundLab</strong>
            {publicView === "landing" && (
              <>
                <nav aria-label="Navegacao da landing page">
                  <a href="#programa">Programa</a>
                  <a href="#como-usar">Como usar</a>
                  <a href="#planos">Planos</a>
                </nav>
                <div className="landing-nav-actions">
                  <button className="ghost" onClick={() => openAuthPage("register")}>
                    Nao tem conta?
                  </button>
                  <button onClick={() => openAuthPage("login")}>Login</button>
                </div>
              </>
            )}
            {publicView !== "landing" && (
              <button onClick={() => setPublicView("landing")} className="ghost">
                Voltar para landing
              </button>
            )}
          </header>

          {publicView === "landing" && (
            <>
              <section className="landing-hero-panel" id="programa">
              <div>
                <p className="landing-kicker">Laboratorio sonoro para foco e criatividade</p>
              <h1>Crie atmosferas imersivas em minutos com controle total da mix.</h1>
              <p>
                O Aurora SoundLab combina engine de audio em tempo real, presets cinematicos e exportacao profissional
                para voce montar trilhas de trabalho, estudo, leitura e relaxamento em um unico fluxo.
              </p>
              <div className="landing-hero-actions">
                <button onClick={() => document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" })}>
                  Comecar agora
                </button>
                <a href="#planos" className="ghost">
                  Ver planos
                </a>
              </div>
            </div>
            <aside className="landing-metrics">
              <article>
                <strong>40+</strong>
                <span>presets cinematograficos</span>
              </article>
              <article>
                <strong>5</strong>
                <span>formatos de exportacao</span>
              </article>
              <article>
                <strong>Tempo real</strong>
                <span>mixer com feedback imediato</span>
              </article>
            </aside>
              </section>

              <section className="landing-section">
            <header>
              <h2>O que o programa entrega</h2>
              <p>Uma plataforma pratica para desenhar experiencias sonoras com consistencia e velocidade.</p>
            </header>
            <div className="landing-benefits-grid">
              {landingBenefits.map((benefit) => (
                <article key={benefit.title} className="landing-card">
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </article>
              ))}
            </div>
              </section>

              <section className="landing-section" id="como-usar">
            <header>
              <h2>Como usar</h2>
              <p>Fluxo simples para sair da ideia para uma mix compartilhavel.</p>
            </header>
            <div className="landing-how-grid">
              {landingHowTo.map((step, index) => (
                <article key={step} className="landing-card landing-step">
                  <small>Etapa {index + 1}</small>
                  <p>{step}</p>
                </article>
              ))}
            </div>
              </section>

              <section className="landing-section" id="planos">
            <header>
              <h2>Planos</h2>
              <p>Escolha o nivel ideal para seu momento, com upgrade quando precisar.</p>
            </header>
            <div className="plan-grid">
              {landingPlans.map((plan) => (
                <article key={plan.name} className={`plan-card ${plan.featured ? "featured" : ""}`}>
                  <small>{plan.audience}</small>
                  <h3>{plan.name}</h3>
                  <p className="plan-price">
                    {plan.price}
                    <span>{plan.cycle}</span>
                  </p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                    <button onClick={() => startCheckout(plan.id)}>
                      Escolher plano
                    </button>
                  </article>
                ))}
              </div>
              </section>
            </>
          )}

          {publicView === "auth" && (
            <section className="public-auth-layout">
              {renderAuthForm("Acesso ao Aurora", "Entre com sua conta ou crie uma nova assinatura em segundos.")}
            </section>
          )}

          {publicView === "checkout" && <section className="checkout-shell">{renderCheckoutContent()}</section>}

          <footer className="landing-footer">
            <p>Aurora SoundLab • Studio sonoro para criadores, equipes e produtos digitais.</p>
          </footer>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return <main className="loading">Carregando estudio imersivo...</main>;
  }

  return (
    <main className="app-shell">
      <div className="immersive-bg">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              animationDuration: particle.duration
            }}
          />
        ))}
      </div>

      <div className="studio-layout">
        <aside className="studio-sidebar">
          <div className="sidebar-top">
            <section className="sidebar-card brand-card">
              <h1>Aurora SoundLab</h1>
              <p>Selecione a ferramenta e opere o estudio em um unico viewport.</p>
            </section>

            <nav className="sidebar-tools" aria-label="Ferramentas do estudio">
              {toolItems.map((tool) => (
                <button
                  key={tool.id}
                  className={`tool-nav-btn ${activeTool === tool.id ? "active" : ""}`}
                  onClick={() => setActiveTool(tool.id)}
                >
                  <span>{tool.icon}</span>
                  <span>
                    <strong>{tool.label}</strong>
                    <small>{tool.helper}</small>
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <button
            className={`sidebar-card account-nav-btn pinned-account ${activeTool === ACCOUNT_TOOL_ID ? "active" : ""}`}
            onClick={() => setActiveTool(ACCOUNT_TOOL_ID)}
          >
            <span className="account-nav-kicker">Conta</span>
            <strong>{user?.username || "usuario"}</strong>
            <small>Clique para abrir menu da conta</small>
          </button>
        </aside>

        <section className="studio-content">
          <header className="hero compact">
            <div>
              <h2>
                {activeToolMeta.icon} {activeToolMeta.label}
              </h2>
              <p>{activeToolMeta.helper}</p>
            </div>
            <div className="hero-actions">
              <span className={`live-pill ${isPlaying ? "active" : ""}`}>{isPlaying ? "LIVE" : "PAUSED"}</span>
              <small>{liveTracksCount} faixa(s) ativa(s)</small>
            </div>
          </header>

          <div className="tool-viewport">{renderToolContent()}</div>

          <section className="media-hud" aria-label="Controlador de audio">
            <div className="media-main">
              <strong>{activePreset?.name || "Mix personalizada"}</strong>
              <small>{isPlaying ? "Reproducao em andamento" : "Reproducao pausada"}</small>
            </div>
            <div className="media-actions">
              <button className="ghost" onClick={() => setSaveModalOpen(true)}>
                {editingMixId ? "Atualizar mix" : "Salvar mix"}
              </button>
              <span className={`live-pill ${isPlaying ? "active" : ""}`}>{isPlaying ? "LIVE" : "PAUSED"}</span>
            </div>
            <div className="media-time">
              <div className="media-time-meter">
                <span style={{ width: `${hudMeterProgress}%` }} />
                <button className="time-meter-toggle" onClick={() => setIsPlaying((value) => !value)} aria-label="Alternar reproducao">
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <small className="time-meter-clock">{formatClock(playbackSeconds)}</small>
              </div>
            </div>
          </section>
        </section>
      </div>

      {saveModalOpen && (
        <div className="modal-backdrop" onClick={() => setSaveModalOpen(false)}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>{editingMixId ? "Editar Mix" : "Salvar Nova Mix"}</h2>
            <label>
              Nome
              <input
                value={mixForm.name}
                onChange={(event) => setMixForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex.: Estacao de Foco Noturno"
              />
            </label>
            <label>
              Descricao
              <textarea
                value={mixForm.description}
                onChange={(event) => setMixForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Descreva o clima desta mix"
              />
            </label>
            <label>
              Categoria
              <select
                value={mixForm.category}
                onChange={(event) => setMixForm((prev) => ({ ...prev, category: event.target.value }))}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button onClick={saveMix}>{editingMixId ? "Salvar Alteracoes" : "Salvar Mix"}</button>
              <button className="ghost" onClick={() => setSaveModalOpen(false)}>
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      <p className={`status floating ${status ? "show" : ""}`}>{status}</p>
    </main>
  );
}
