import { useEffect, useRef } from "react";

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function startRandomLoop(minMs, maxMs, run) {
  let timer = null;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    run();
    const wait = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    timer = setTimeout(tick, wait);
  };

  tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

function createLayer(context, soundId, destination) {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(destination);

  const cleanups = [];
  const noiseBuffer = createNoiseBuffer(context);

  const startNoise = ({ lowpass = 1200, highpass = 40, baseGain = 0.2 } = {}) => {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;

    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lowpass;

    const tone = context.createGain();
    tone.gain.value = baseGain;

    source.connect(hp);
    hp.connect(lp);
    lp.connect(tone);
    tone.connect(gain);
    source.start();

    cleanups.push(() => source.stop());
  };

  const pulse = (freq, duration, level = 0.35, type = "sine") => {
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.value = 0;
    osc.connect(env);
    env.connect(gain);

    const now = context.currentTime;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(level, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  };

  if (soundId === "rain") {
    startNoise({ lowpass: 4500, highpass: 120, baseGain: 0.25 });
  }
  if (soundId === "wind") {
    startNoise({ lowpass: 900, highpass: 20, baseGain: 0.22 });
  }
  if (soundId === "cafe") {
    startNoise({ lowpass: 2200, highpass: 100, baseGain: 0.18 });
    cleanups.push(startRandomLoop(1500, 3200, () => pulse(220 + Math.random() * 120, 0.2, 0.14, "triangle")));
  }
  if (soundId === "spaceship") {
    const hum = context.createOscillator();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    hum.type = "sawtooth";
    hum.frequency.value = 75;
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    lfoGain.connect(hum.frequency);
    const humGain = context.createGain();
    humGain.gain.value = 0.2;
    hum.connect(humGain);
    humGain.connect(gain);
    hum.start();
    lfo.start();
    cleanups.push(() => {
      hum.stop();
      lfo.stop();
    });
  }
  if (soundId === "forest") {
    startNoise({ lowpass: 2900, highpass: 250, baseGain: 0.08 });
    cleanups.push(startRandomLoop(900, 2200, () => pulse(900 + Math.random() * 800, 0.12, 0.24, "sine")));
  }
  if (soundId === "keyboard") {
    cleanups.push(startRandomLoop(90, 260, () => pulse(430 + Math.random() * 390, 0.05, 0.16, "square")));
  }
  if (soundId === "library") {
    startNoise({ lowpass: 1800, highpass: 80, baseGain: 0.1 });
    cleanups.push(startRandomLoop(2600, 5200, () => pulse(140 + Math.random() * 80, 0.3, 0.12, "triangle")));
  }
  if (soundId === "chime") {
    cleanups.push(startRandomLoop(1200, 3600, () => pulse(620 + Math.random() * 900, 0.7, 0.2, "sine")));
  }
  if (soundId === "ocean") {
    startNoise({ lowpass: 1200, highpass: 35, baseGain: 0.3 });
    cleanups.push(startRandomLoop(2400, 4800, () => pulse(70 + Math.random() * 25, 0.6, 0.16, "triangle")));
  }
  if (soundId === "fire") {
    startNoise({ lowpass: 2300, highpass: 300, baseGain: 0.22 });
    cleanups.push(startRandomLoop(130, 340, () => pulse(180 + Math.random() * 170, 0.04, 0.09, "square")));
  }
  if (soundId === "neon") {
    cleanups.push(startRandomLoop(300, 700, () => pulse(480 + Math.random() * 500, 0.1, 0.12, "sawtooth")));
  }
  if (soundId === "desert") {
    startNoise({ lowpass: 1100, highpass: 150, baseGain: 0.18 });
    cleanups.push(startRandomLoop(1800, 3600, () => pulse(240 + Math.random() * 80, 0.4, 0.1, "triangle")));
  }
  if (soundId === "zen") {
    cleanups.push(startRandomLoop(2200, 4200, () => pulse(440 + Math.random() * 220, 1, 0.25, "sine")));
  }

  return {
    setVolume(value) {
      gain.gain.setTargetAtTime(value, context.currentTime, 0.08);
    },
    destroy() {
      cleanups.forEach((fn) => fn());
      gain.disconnect();
    }
  };
}

export function useSoundEngine(sounds, mixer, isPlaying) {
  const contextRef = useRef(null);
  const masterRef = useRef(null);
  const analyserRef = useRef(null);
  const layersRef = useRef({});
  const suspendTimerRef = useRef(null);

  const ensureEngine = () => {
    if (contextRef.current) return;
    const context = new window.AudioContext();
    const master = context.createGain();
    master.gain.value = 0;
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    master.connect(analyser);
    analyser.connect(context.destination);
    contextRef.current = context;
    masterRef.current = master;
    analyserRef.current = analyser;
  };

  useEffect(() => {
    if (sounds.length === 0) return;
    ensureEngine();
    const layers = layersRef.current;
    const context = contextRef.current;
    for (const sound of sounds) {
      if (!layers[sound.id]) {
        layers[sound.id] = createLayer(context, sound.id, masterRef.current);
      }
    }
    Object.entries(layers).forEach(([id, layer]) => {
      layer.setVolume(mixer[id] || 0);
    });
  }, [mixer, sounds]);

  useEffect(() => {
    if (!contextRef.current || !masterRef.current) return;
    const context = contextRef.current;
    const master = masterRef.current;

    if (suspendTimerRef.current) {
      clearTimeout(suspendTimerRef.current);
      suspendTimerRef.current = null;
    }

    if (isPlaying) {
      if (context.state === "suspended") {
        context.resume();
      }
      master.gain.setTargetAtTime(0.92, context.currentTime, 0.25);
    } else {
      master.gain.setTargetAtTime(0.0001, context.currentTime, 0.25);
      suspendTimerRef.current = setTimeout(() => {
        if (context.state === "running") {
          context.suspend();
        }
      }, 420);
    }
  }, [isPlaying]);

  useEffect(
    () => () => {
      if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current);
      Object.values(layersRef.current).forEach((layer) => layer.destroy());
      if (contextRef.current) contextRef.current.close();
    },
    []
  );

  return { analyser: analyserRef };
}
