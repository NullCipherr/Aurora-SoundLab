import { useEffect, useRef } from "react";

export default function SoundVisualizer({ analyserRef, active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    let frame = null;

    // Estado ocioso evita tela vazia quando o engine ainda nao esta tocando.
    const drawIdle = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      for (let i = 0; i < 56; i += 1) {
        const h = 4 + Math.sin(i * 0.55) * 2;
        ctx.fillRect(i * 9, canvas.height - h - 6, 6, h);
      }
      frame = requestAnimationFrame(drawIdle);
    };

    const drawLive = () => {
      const analyser = analyserRef.current;
      if (!analyser) {
        frame = requestAnimationFrame(drawLive);
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = 56;
      const step = Math.floor(data.length / bars);
      const grd = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grd.addColorStop(0, "rgba(122, 219, 255, 0.9)");
      grd.addColorStop(1, "rgba(255, 150, 180, 0.9)");
      ctx.fillStyle = grd;

      for (let i = 0; i < bars; i += 1) {
        const value = data[i * step] / 255;
        const barHeight = value * (canvas.height - 16) + 4;
        ctx.fillRect(i * 9, canvas.height - barHeight - 6, 6, barHeight);
      }

      frame = requestAnimationFrame(drawLive);
    };

    // Alterna loop de render conforme estado de reproducao atual.
    frame = requestAnimationFrame(active ? drawLive : drawIdle);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, analyserRef]);

  return <canvas ref={canvasRef} width={540} height={140} className="visualizer" />;
}
