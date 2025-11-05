import React, { useEffect, useState } from 'react';

type PerfMetrics = {
  fps?: number;
  frame_time_us?: number;
  render_avg_us?: number;
  quantize_avg_us?: number;
  rmt_wait_avg_us?: number;
  rmt_tx_avg_us?: number;
  cpu_percent?: number;
  memory_percent?: number;
  memory_free_kb?: number;
};

export const PerfOverlay: React.FC = () => {
  const [perf, setPerf] = useState<PerfMetrics>({});
  const [source, setSource] = useState<'ws' | 'rest' | 'none'>('none');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let restTimer: any = null;

    const applyPerf = (data: any) => {
      if (!data) return;
      if (data.performance) {
        setPerf(data.performance);
      } else {
        setPerf(data);
      }
    };

    try {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => setSource('ws');
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg && msg.type === 'realtime') {
            applyPerf(msg);
          }
        } catch {}
      };
      ws.onerror = () => startRest();
      ws.onclose = () => startRest();
    } catch {
      startRest();
    }

    function startRest() {
      if (restTimer) return;
      setSource('rest');
      restTimer = setInterval(async () => {
        try {
          const res = await fetch('/api/device/performance');
          const json = await res.json();
          applyPerf(json);
        } catch {}
      }, 1000);
    }

    return () => {
      if (ws) ws.close();
      if (restTimer) clearInterval(restTimer);
    };
  }, []);

  const Box = ({ label, value, suffix = '' }: { label: string; value: any; suffix?: string }) => (
    <div style={{ marginRight: 16 }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{
        value === undefined || value === null || Number.isNaN(value) ? '—' : `${Number(value).toFixed(1)}${suffix}`
      }</div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      right: 12,
      bottom: 12,
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      borderRadius: 8,
      padding: 12,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center'
    }}>
      <Box label="FPS" value={perf.fps} />
      <Box label="Frame (µs)" value={perf.frame_time_us} />
      <Box label="Render (µs)" value={perf.render_avg_us} />
      <Box label="Quantize (µs)" value={perf.quantize_avg_us} />
      <Box label="RMT Wait (µs)" value={perf.rmt_wait_avg_us} />
      <Box label="RMT TX (µs)" value={perf.rmt_tx_avg_us} />
      <Box label="CPU (%)" value={perf.cpu_percent} />
      <Box label="Mem (%)" value={perf.memory_percent} />
      <div style={{ marginLeft: 8, fontSize: 10, opacity: 0.6 }}>src: {source}</div>
    </div>
  );
};

export default PerfOverlay;

