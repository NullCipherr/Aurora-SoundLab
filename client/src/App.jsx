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

  const onAuthSubmit = async (event) => {
    event.preventDefault();

    if (authMode === "register") {
      if (credentials.password !== credentials.confirmPassword) {
        notify("As senhas nao conferem.");
        return;
      }
      if (!credentials.acceptTerms) {
        notify("Aceite os termos para criar sua conta.");
        return;
      }
    }

    try {
      const action = authMode === "register" ? api.register : api.login;
      const response = await action({
        username: credentials.username,
        password: credentials.password,
        email: credentials.email
      });
      setCsrfToken(response.csrfToken);
      setUser(response.user);
      setIsAuthenticated(true);
      await Promise.all([loadStudioData(), refreshPrivateData()]);
      setCredentials({
        username: "",
        password: "",
        confirmPassword: "",
        email: "",
        displayName: "",
        acceptTerms: false
      });
      notify(authMode === "register" ? "Conta criada com sucesso." : "Sessao iniciada.");
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
    return (
      <main className="auth-shell">
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
        <section className="auth-card">
          <header className="auth-header">
            <h1>Aurora SoundLab</h1>
            <p>Estudio premium de ambientes sonoros cinematograficos.</p>
          </header>
          <form onSubmit={onAuthSubmit} className="auth-form">
            {authMode === "register" && (
              <>
                <label className="auth-field">
                  <span>Nome artistico</span>
                  <input
                    value={credentials.displayName}
                    onChange={(event) =>
                      setCredentials((prev) => ({ ...prev, displayName: event.target.value }))
                    }
                    placeholder="Ex.: Aurora Creator"
                  />
                </label>
                <label className="auth-field">
                  <span>Email profissional</span>
                  <input
                    type="email"
                    value={credentials.email}
                    onChange={(event) =>
                      setCredentials((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="voce@studio.com"
                  />
                </label>
              </>
            )}
            <label className="auth-field">
              <span>Usuario</span>
              <input
                required
                minLength={3}
                value={credentials.username}
                onChange={(event) =>
                  setCredentials((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="Seu usuario exclusivo"
              />
            </label>
            <label className="auth-field">
              <span>Senha</span>
              <input
                required
                minLength={12}
                type="password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Minimo de 12 caracteres"
              />
            </label>
            {authMode === "register" && (
              <label className="auth-field">
                <span>Confirmar senha</span>
                <input
                  required
                  minLength={12}
                  type="password"
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
              {authMode === "register" ? "Criar Conta Premium" : "Entrar no Studio"}
            </button>
          </form>
          <button
            className="ghost auth-switch"
            onClick={() => setAuthMode((mode) => (mode === "login" ? "register" : "login"))}
          >
            {authMode === "login" ? "Quero criar uma conta premium" : "Ja tenho conta"}
          </button>
          <p className="status">{status || "Entre para salvar mixes, favoritos e historico."}</p>
        </section>
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
