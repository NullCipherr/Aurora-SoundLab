const BASE_SAMPLE_RATE = 44100;

// Catalogo de formatos exibidos na UI e roteados para o encoder correspondente.
export const AUDIO_EXPORT_FORMATS = [
  {
    id: "wav",
    label: "WAV",
    extension: "wav",
    mimeType: "audio/wav",
    encoder: "wav"
  },
  {
    id: "webm",
    label: "WEBM",
    extension: "webm",
    mimeType: "audio/webm;codecs=opus",
    encoder: "media-recorder"
  },
  {
    id: "ogg",
    label: "OGG",
    extension: "ogg",
    mimeType: "audio/ogg;codecs=opus",
    encoder: "media-recorder"
  },
  {
    id: "mp4",
    label: "MP4",
    extension: "mp4",
    mimeType: "audio/mp4;codecs=mp4a.40.2",
    encoder: "media-recorder"
  },
  {
    id: "aac",
    label: "AAC",
    extension: "aac",
    mimeType: "audio/aac",
    encoder: "media-recorder"
  }
];

const soundToneMap = {
  rain: { freq: 180, noise: true, drone: false },
  wind: { freq: 125, noise: true, drone: true },
  cafe: { freq: 260, noise: true, drone: false },
  spaceship: { freq: 88, noise: false, drone: true },
  forest: { freq: 340, noise: true, drone: false },
  keyboard: { freq: 640, noise: false, drone: false },
  library: { freq: 220, noise: true, drone: false },
  chime: { freq: 880, noise: false, drone: false },
  ocean: { freq: 96, noise: true, drone: true },
  fire: { freq: 420, noise: true, drone: false },
  neon: { freq: 520, noise: false, drone: true },
  desert: { freq: 180, noise: true, drone: false },
  zen: { freq: 432, noise: false, drone: true }
};

// PRNG deterministico para estabilizar variacao timbrica entre exports semelhantes.
function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function createNoiseBuffer(context, durationSeconds = 2) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * durationSeconds), context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Camada de drone para bases continuas (ambientes imersivos).
function addDrone(context, targetGain, frequency, volume, duration, random) {
  const carrier = context.createOscillator();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  const envelope = context.createGain();

  carrier.type = "sawtooth";
  carrier.frequency.value = frequency;

  lfo.type = "sine";
  lfo.frequency.value = 0.08 + random() * 0.28;

  lfoGain.gain.value = 4 + random() * 7;

  envelope.gain.value = 0;
  envelope.gain.setValueAtTime(0.0001, 0);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.02, volume * 0.4), 0.7);
  envelope.gain.setValueAtTime(Math.max(0.02, volume * 0.4), Math.max(0, duration - 0.8));
  envelope.gain.exponentialRampToValueAtTime(0.0001, duration);

  lfo.connect(lfoGain);
  lfoGain.connect(carrier.frequency);
  carrier.connect(envelope);
  envelope.connect(targetGain);

  carrier.start(0);
  lfo.start(0);
  carrier.stop(duration);
  lfo.stop(duration);
}

// Banda de ruido filtrado para simular texturas atmosfericas.
function addNoiseBand(context, targetGain, baseFrequency, volume, duration) {
  const noiseSource = context.createBufferSource();
  const noiseBuffer = createNoiseBuffer(context, Math.max(2, duration));
  const lowpass = context.createBiquadFilter();
  const highpass = context.createBiquadFilter();
  const envelope = context.createGain();

  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  lowpass.type = "lowpass";
  lowpass.frequency.value = Math.max(600, baseFrequency * 8);
  highpass.type = "highpass";
  highpass.frequency.value = Math.max(20, baseFrequency * 0.2);

  envelope.gain.value = Math.max(0.02, volume * 0.25);

  noiseSource.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(envelope);
  envelope.connect(targetGain);

  noiseSource.start(0);
  noiseSource.stop(duration);
}

// Pulsos curtos distribuidos no tempo para manter dinamica perceptivel.
function addPulses(context, targetGain, frequency, volume, duration, random) {
  const amount = Math.max(6, Math.floor(duration * 2.8));

  for (let pulseIndex = 0; pulseIndex < amount; pulseIndex += 1) {
    const startAt = random() * Math.max(0.1, duration - 0.35);
    const pulseDuration = 0.09 + random() * 0.23;
    const osc = context.createOscillator();
    const env = context.createGain();

    osc.type = pulseIndex % 2 === 0 ? "triangle" : "sine";
    osc.frequency.value = frequency + random() * frequency * 0.7;

    env.gain.setValueAtTime(0.0001, startAt);
    env.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.55), startAt + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + pulseDuration);

    osc.connect(env);
    env.connect(targetGain);

    osc.start(startAt);
    osc.stop(Math.min(duration, startAt + pulseDuration + 0.05));
  }
}

async function renderMixAudioBuffer({ sounds, mixer, durationSeconds }) {
  const duration = Math.max(6, Number(durationSeconds || 20));
  const frameCount = Math.floor(duration * BASE_SAMPLE_RATE);
  const context = new OfflineAudioContext(2, frameCount, BASE_SAMPLE_RATE);
  const master = context.createGain();

  master.gain.value = 0.92;
  master.connect(context.destination);

  sounds.forEach((sound, index) => {
    const trackVolume = Number(mixer[sound.id] || 0);
    if (!Number.isFinite(trackVolume) || trackVolume <= 0) return;

    const profile = soundToneMap[sound.id] || {
      freq: 220 + index * 30,
      noise: true,
      drone: false
    };

    const layerGain = context.createGain();
    const random = seededRandom(Math.floor((index + 1) * 9187 + trackVolume * 1000));

    layerGain.gain.value = Math.min(1, Math.max(0, trackVolume));
    layerGain.connect(master);

    if (profile.noise) {
      addNoiseBand(context, layerGain, profile.freq, trackVolume, duration);
    }

    if (profile.drone) {
      addDrone(context, layerGain, profile.freq, trackVolume, duration, random);
    }

    addPulses(context, layerGain, profile.freq, trackVolume, duration, random);
  });

  return context.startRendering();
}

// Encoder WAV manual para garantir suporte universal sem dependencia externa.
function encodeWav(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = 16;
  const channelData = [];

  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

  const length = audioBuffer.length * channels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
  view.setUint16(32, channels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, length, true);

  let offset = 44;
  for (let sample = 0; sample < audioBuffer.length; sample += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const value = Math.max(-1, Math.min(1, channelData[channel][sample]));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function encodeWithMediaRecorder(audioBuffer, mimeType) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder indisponivel neste navegador.");
  }

  if (!MediaRecorder.isTypeSupported(mimeType)) {
    throw new Error(`Formato nao suportado: ${mimeType}`);
  }

  const context = new AudioContext({ sampleRate: BASE_SAMPLE_RATE });
  const destination = context.createMediaStreamDestination();
  const source = context.createBufferSource();

  source.buffer = audioBuffer;
  source.connect(destination);

  const chunks = [];
  const recorder = new MediaRecorder(destination.stream, { mimeType });

  const blob = await new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      reject(new Error("Falha ao codificar audio nesse formato."));
    };

    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.start();
    source.start();
    source.onended = () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  });

  await context.close();
  return blob;
}

export function getExportSupportMap() {
  return AUDIO_EXPORT_FORMATS.reduce((acc, format) => {
    if (format.encoder === "wav") {
      acc[format.id] = true;
      return acc;
    }

    acc[format.id] =
      typeof MediaRecorder !== "undefined" &&
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported(format.mimeType);

    return acc;
  }, {});
}

export async function exportMixAudio({ formatId, sounds, mixer, durationSeconds = 20 }) {
  const format = AUDIO_EXPORT_FORMATS.find((item) => item.id === formatId);
  if (!format) {
    throw new Error("Formato de exportacao invalido.");
  }

  const audioBuffer = await renderMixAudioBuffer({ sounds, mixer, durationSeconds });

  if (format.encoder === "wav") {
    return {
      blob: encodeWav(audioBuffer),
      format
    };
  }

  const blob = await encodeWithMediaRecorder(audioBuffer, format.mimeType);
  return { blob, format };
}

export function downloadAudioBlob(blob, filename) {
  // Fluxo de download via URL temporaria para evitar navegacao fora da pagina.
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
