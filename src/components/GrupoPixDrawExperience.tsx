import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Sparkles, 
  X, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Crown,
  Users,
  Flame,
  ArrowRight
} from 'lucide-react';
import { PixGroup } from '../types';

interface GrupoPixDrawExperienceProps {
  group: PixGroup;
  validParticipations: any[];
  isOpen: boolean;
  onClose: () => void;
  onDrawCompleted: (drawResult: any) => void;
}

// Fases da experiência cinematográfica
type DrawPhase = 
  | 'idle'              // Antes de iniciar (preparação)
  | 'fetching'          // Chamando backend server-side com segurança
  | 'countdown'         // Contagem regressiva 3, 2, 1
  | 'accelerating'      // Etapa 2 e 3: rolagem aumentando velocidade
  | 'suspense'          // Etapa 4: desaceleração inicial com mensagem de suspense
  | 'false_stop_1'      // Etapa 5: quase parada com recuo (ilusão visual)
  | 'reaccelerate'      // Etapa 6: segunda aceleração rápida
  | 'false_stop_2'      // Etapa 6: segunda quase parada breve
  | 'final_decel'       // Etapa 7: desaceleração definitiva passo a passo até o oficial
  | 'reveal'            // Etapa 8: revelação gloriosa do vencedor oficial
  | 'error';            // Erro caso o backend retorne falha

// Sintetizador Web Audio API nativo (100% opcional, sem dependências externas)
class SoundFx {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Tick sutil para rolagem
  playTick(pitch: number = 800) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }

  // Efeito de tensão / countdown
  playCountdownBeep(high: boolean = false) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(high ? 880 : 440, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  // Acorde harmônico triunfal para a revelação do vencedor
  playVictory() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.07, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2 + idx * 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + 1.3 + idx * 0.08);
      });
    } catch {}
  }
}

const sfx = new SoundFx();

export const GrupoPixDrawExperience: React.FC<GrupoPixDrawExperienceProps> = ({
  group,
  validParticipations,
  isOpen,
  onClose,
  onDrawCompleted
}) => {
  const [phase, setPhase] = useState<DrawPhase>('idle');
  const [countdownValue, setCountdownValue] = useState<number | string>(3);
  const [soundActive, setSoundActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resultado OFICIAL em memória retornado pelo backend
  const [officialWinner, setOfficialWinner] = useState<{
    code: string;
    name: string;
    phone: string;
    raw: any;
  } | null>(null);

  // Itens em exibição durante a rolagem
  const [displayItems, setDisplayItems] = useState<Array<{ code: string; name: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Flags para controle seguro de loops e timeouts
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllTimers();
    };
  }, []);

  const clearAllTimers = () => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
    intervalsRef.current.forEach(i => clearInterval(i));
    intervalsRef.current = [];
  };

  const addTimeout = (fn: () => void, delayMs: number) => {
    const t = setTimeout(() => {
      if (isMountedRef.current) fn();
    }, delayMs);
    timeoutsRef.current.push(t);
    return t;
  };

  // Alterna o som
  const toggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    sfx.enabled = next;
  };

  // Constrói lista de amostras visuais a partir das participações reais
  useEffect(() => {
    if (!validParticipations || validParticipations.length === 0) return;

    const baseList = validParticipations.map(p => ({
      code: p.participationCode || p.participation_code || p.code || 'GP-000000',
      name: p.buyer_name || p.userName || 'Participante'
    }));

    // Multiplica a lista visual para garantir rolagem contínua cinematográfica
    const extended: Array<{ code: string; name: string }> = [];
    while (extended.length < 150) {
      for (const item of baseList) {
        extended.push(item);
        if (extended.length >= 150) break;
      }
    }
    setDisplayItems(extended);
  }, [validParticipations]);

  // INÍCIO DO SORTEIO OFICIAL (REGRA DE OURO: BACKEND PRIMEIRO)
  const handleStartDraw = async () => {
    if (phase !== 'idle' && phase !== 'error') return;
    setErrorMessage(null);
    setPhase('fetching');

    try {
      // 1. Chamada estrita ao backend server-side existente
      const res = await fetch('/api/grupo-pix/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id })
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = null;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        throw new Error(rawText || `Servidor retornou resposta inesperada (Status ${res.status})`);
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Erro ao realizar sorteio oficial.');
      }

      const drawData = data.draw || data;
      const winner = {
        code: drawData.winnerParticipationCode || drawData.winner_code || 'GP-000000',
        name: drawData.winnerName || 'Vencedor',
        phone: drawData.winner_phone_masked || drawData.winnerPhone || '—',
        raw: drawData
      };

      // GUARDA O RESULTADO OFICIAL EM MEMÓRIA
      setOfficialWinner(winner);

      // Prepara a sequência visual para que o elemento alvo FINAL seja exatamente o vencedor oficial
      setDisplayItems(prev => {
        const copy = [...prev];
        // Insere o vencedor oficial exatamente nas posições estratégicas de parada
        if (copy.length > 5) {
          copy[copy.length - 1] = { code: winner.code, name: winner.name };
        } else {
          copy.push({ code: winner.code, name: winner.name });
        }
        return copy;
      });

      // 2. Inicia a contagem regressiva para a experiência cinematográfica
      startCountdownSequence(winner);
    } catch (err: any) {
      console.error("Erro no sorteio server-side:", err);
      setErrorMessage(err.message || 'Não foi possível concluir o sorteio. Nenhum resultado foi alterado.');
      setPhase('error');
    }
  };

  // Sequência de Contagem Regressiva 3, 2, 1
  const startCountdownSequence = (winner: any) => {
    setPhase('countdown');
    setCountdownValue(3);
    sfx.playCountdownBeep(false);

    addTimeout(() => {
      setCountdownValue(2);
      sfx.playCountdownBeep(false);
    }, 900);

    addTimeout(() => {
      setCountdownValue(1);
      sfx.playCountdownBeep(false);
    }, 1800);

    addTimeout(() => {
      setCountdownValue("SORTEANDO...");
      sfx.playCountdownBeep(true);
    }, 2700);

    addTimeout(() => {
      startCinematicRoll(winner);
    }, 3400);
  };

  // Orquestração Cinematográfica das Etapas 2 a 8
  const startCinematicRoll = (winner: any) => {
    clearAllTimers();
    let currentIdx = 0;
    setCurrentIndex(0);

    // ETAPA 2 & 3: ACELERAÇÃO PROGRESSIVA
    setPhase('accelerating');
    let speedMs = 180; // começa lento

    const rollStep = () => {
      currentIdx = (currentIdx + 1) % Math.max(displayItems.length, 1);
      setCurrentIndex(currentIdx);
      sfx.playTick(currentIdx % 2 === 0 ? 900 : 750);
    };

    // Acelera de 180ms para 35ms em 2.5s
    const accelInterval = setInterval(() => {
      rollStep();
    }, speedMs);
    intervalsRef.current.push(accelInterval);

    // Transição de velocidade: velocidade baixa -> média -> alta
    addTimeout(() => {
      clearInterval(accelInterval);
      const fastInterval = setInterval(() => {
        rollStep();
      }, 55);
      intervalsRef.current.push(fastInterval);

      // ETAPA 4: SUSPENSE
      addTimeout(() => {
        clearInterval(fastInterval);
        setPhase('suspense');

        // Desaceleração 1
        let decelMs = 90;
        const decel1 = setInterval(() => {
          rollStep();
          decelMs += 35;
        }, decelMs);
        intervalsRef.current.push(decel1);

        // ETAPA 5: PRIMEIRA QUASE PARADA (Falsa parada de ~700ms)
        addTimeout(() => {
          clearInterval(decel1);
          setPhase('false_stop_1');
          sfx.playTick(1100);

          // ETAPA 6: REACELERAÇÃO E SEGUNDA QUASE PARADA
          addTimeout(() => {
            setPhase('reaccelerate');
            const burstInterval = setInterval(() => {
              rollStep();
            }, 60);
            intervalsRef.current.push(burstInterval);

            addTimeout(() => {
              clearInterval(burstInterval);
              setPhase('false_stop_2');
              sfx.playTick(1050);

              // ETAPA 7: DESACELERAÇÃO FINAL COM CHEGADA NO VENCEDOR OFICIAL
              addTimeout(() => {
                setPhase('final_decel');
                executeFinalLanding(winner);
              }, 600);
            }, 1000);
          }, 800);
        }, 1500);
      }, 1600);
    }, 1200);
  };

  // Etapa 7 & 8: Parada milimétrica no vencedor oficial e Revelação Gloriosa
  const executeFinalLanding = (winner: any) => {
    clearAllTimers();

    // Passos finais lentos: tick... tick..... tick.......
    const finalSteps = [
      { delay: 120, pitch: 850 },
      { delay: 240, pitch: 800 },
      { delay: 380, pitch: 750 },
      { delay: 560, pitch: 700 },
      { delay: 820, pitch: 650 },
      { delay: 1200, pitch: 1200 } // LOCK FINAL NO OFICIAL
    ];

    let accumulatedTime = 0;
    finalSteps.forEach((step, idx) => {
      accumulatedTime += step.delay;
      addTimeout(() => {
        sfx.playTick(step.pitch);

        if (idx === finalSteps.length - 1) {
          // Fixa visualmente o vencedor oficial
          setDisplayItems(prev => {
            const list = [...prev];
            list[list.length - 1] = { code: winner.code, name: winner.name };
            return list;
          });
          setCurrentIndex(displayItems.length - 1);

          // Pausa de 800ms antes da revelação triunfal (Etapa 8)
          addTimeout(() => {
            setPhase('reveal');
            sfx.playVictory();
            onDrawCompleted(winner.raw);
          }, 800);
        } else {
          setCurrentIndex(prev => (prev + 1) % Math.max(displayItems.length, 1));
        }
      }, accumulatedTime);
    });
  };

  if (!isOpen) return null;

  const currentItem = displayItems[currentIndex] || {
    code: officialWinner?.code || 'GP-000001',
    name: officialWinner?.name || 'Carregando...'
  };

  // Itens adjacentes para criar o efeito de carrossel/slot com profundidade
  const prevItem = displayItems[(currentIndex - 1 + displayItems.length) % Math.max(displayItems.length, 1)] || currentItem;
  const nextItem = displayItems[(currentIndex + 1) % Math.max(displayItems.length, 1)] || currentItem;

  return (
    <div 
      id="modal-sorteio-grupo-pix"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl overflow-y-auto"
    >
      {/* Luzes de fundo atmosféricas */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Principal da Experiência */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/80 text-white overflow-hidden"
      >
        {/* Barra de Controles Superiores */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
              Sorteio Oficial — Grupo Pix
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Controle de Som */}
            <button
              id="btn-toggle-sound"
              onClick={toggleSound}
              className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                soundActive 
                  ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700' 
                  : 'bg-slate-800/30 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title={soundActive ? 'Desativar Efeitos Sonoros' : 'Ativar Efeitos Sonoros'}
            >
              {soundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Fechar (apenas em idle, erro ou reveal) */}
            {(phase === 'idle' || phase === 'reveal' || phase === 'error') && (
              <button
                id="btn-close-draw-experience"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* ETAPA 1 — PREPARAÇÃO / TELA INICIAL                       */}
        {/* ========================================================= */}
        {phase === 'idle' && (
          <div className="space-y-6 text-center py-4">
            <motion.div 
              initial={{ scale: 0.8 }} 
              animate={{ scale: 1 }} 
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 bg-gradient-to-tr from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/30 text-amber-400 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10"
            >
              <Trophy className="w-10 h-10 drop-shadow-md" />
            </motion.div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {group.name || (group as any).title}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Sorteio auditado executado exclusivamente no backend com aleatoriedade criptográfica.
              </p>
            </div>

            {/* Informações Resumidas do Sorteio */}
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
              <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Prêmio a Concorrer</span>
                <p className="text-sm font-black text-amber-400 truncate">
                  {group.prize || (group as any).prizeValue || 'PIX'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Participações Elegíveis</span>
                <p className="text-sm font-black text-emerald-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {validParticipations.length} válidas
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Preparando as participações oficiais para a experiência cinematográfica...
            </p>

            <button
              id="btn-iniciar-sorteio-oficial"
              onClick={handleStartDraw}
              disabled={validParticipations.length === 0}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-600/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 mx-auto"
            >
              <Crown className="w-4 h-4 text-slate-950" />
              INICIAR SORTEIO OFICIAL
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* CARREGANDO BACKEND (CHAMADA SEGURA EM ANDAMENTO)           */}
        {/* ========================================================= */}
        {phase === 'fetching' && (
          <div className="py-16 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Consultando Vencedor Criptográfico</h3>
              <p className="text-xs text-slate-400">
                O backend está calculando a aleatoriedade oficial e registrando a auditoria...
              </p>
            </div>
            <div className="inline-block px-4 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-full text-xs font-bold text-amber-400">
              SORTEIO EM ANDAMENTO
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CONTADOR REGRESSIVO 3, 2, 1                               */}
        {/* ========================================================= */}
        {phase === 'countdown' && (
          <div className="py-12 text-center space-y-6">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
              INICIANDO EM
            </span>
            <motion.div
              key={String(countdownValue)}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-6xl sm:text-8xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-200 to-amber-500 drop-shadow-2xl"
            >
              {countdownValue}
            </motion.div>
            <p className="text-xs text-slate-400 font-medium">
              Conectando urna eletrônica e participações válidas...
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* ETAPAS 2 A 7 — CARROSSEL CINEMATOGRÁFICO                  */}
        {/* ========================================================= */}
        {(phase === 'accelerating' || 
          phase === 'suspense' || 
          phase === 'false_stop_1' || 
          phase === 'reaccelerate' || 
          phase === 'false_stop_2' || 
          phase === 'final_decel') && (
          <div className="space-y-6 py-4">
            {/* Status Dinâmico de Tensão */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 animate-pulse" />
                {phase === 'accelerating' && 'ACELERANDO URNA ELETRÔNICA...'}
                {phase === 'suspense' && 'SELECIONANDO A PARTICIPAÇÃO PREMIADA...'}
                {phase === 'false_stop_1' && 'QUASE LÁ...'}
                {phase === 'reaccelerate' && 'RECALIBRANDO FINALISTAS...'}
                {phase === 'false_stop_2' && 'DEFININDO O BILHETE PREMIADO...'}
                {phase === 'final_decel' && 'PARANDO NO CÓDIGO OFICIAL...'}
              </div>
              <h3 className="text-sm text-slate-400 font-medium">
                {group.name || (group as any).title}
              </h3>
            </div>

            {/* Container Central com Foco Ótico (Slot Machine / Carrossel Vertical) */}
            <div className="relative py-4 px-2 sm:px-6 overflow-hidden rounded-3xl bg-slate-950/70 border border-slate-800/80 shadow-inner">
              {/* Moldura de Foco e Linhas Guia */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-20 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 border-2 border-amber-400/50 shadow-lg shadow-amber-500/10 pointer-events-none z-10" />

              <div className="space-y-2 text-center">
                {/* Item Superior (Desfocado) */}
                <div className="opacity-30 blur-[2px] scale-90 transition-all select-none py-1">
                  <span className="font-mono text-xs text-slate-400">{prevItem.code}</span>
                  <p className="text-xs text-slate-500 truncate max-w-xs mx-auto">{prevItem.name}</p>
                </div>

                {/* ITEM CENTRAL (EM DESTAQUE NÍTIDO) */}
                <motion.div 
                  key={`${currentIndex}-${phase}`}
                  animate={
                    phase === 'false_stop_1' 
                      ? { scale: [1, 1.08, 1], y: [0, -4, 0] } 
                      : phase === 'final_decel'
                      ? { scale: [1.05, 1.1] }
                      : { scale: 1.05 }
                  }
                  transition={{ duration: 0.3 }}
                  className="py-3 px-4 z-20 relative select-none"
                >
                  <span className="font-mono text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-amber-400 tracking-wider drop-shadow-md">
                    {currentItem.code}
                  </span>
                  <p className="text-sm sm:text-base font-black text-slate-200 mt-0.5 truncate max-w-md mx-auto">
                    {currentItem.name}
                  </p>
                </motion.div>

                {/* Item Inferior (Desfocado) */}
                <div className="opacity-30 blur-[2px] scale-90 transition-all select-none py-1">
                  <span className="font-mono text-xs text-slate-400">{nextItem.code}</span>
                  <p className="text-xs text-slate-500 truncate max-w-xs mx-auto">{nextItem.name}</p>
                </div>
              </div>
            </div>

            {/* Rodapé de feedback da experiência */}
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium px-2">
              <span>{validParticipations.length} bilhetes concorrendo</span>
              <span className="text-amber-400 font-mono font-bold animate-pulse">
                {phase === 'final_decel' ? 'TRAVANDO RESULTADO' : 'SORTEANDO...'}
              </span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ETAPA 8 — REVELAÇÃO GLORIOSA DO VENCEDOR OFICIAL          */}
        {/* ========================================================= */}
        {phase === 'reveal' && officialWinner && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-6 text-center py-2"
          >
            {/* Troféu Dourado com Animação de Entrada */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.25, 1] }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 p-5 mx-auto shadow-2xl shadow-amber-500/40 flex items-center justify-center relative"
            >
              <Trophy className="w-14 h-14 drop-shadow-lg" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                className="absolute -inset-1 rounded-3xl border-2 border-dashed border-amber-300/40 pointer-events-none"
              />
            </motion.div>

            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                PARTICIPAÇÃO PREMIADA OFICIAL
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-300">
                {group.name || (group as any).title}
              </h2>
            </div>

            {/* Cartão do Código e Nome do Vencedor */}
            <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-800/80 to-slate-900/90 border-2 border-amber-500/50 rounded-3xl shadow-2xl shadow-amber-500/15 space-y-3 max-w-lg mx-auto relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Código Sorteado
              </span>
              <div className="font-mono text-3xl sm:text-5xl font-black text-amber-300 tracking-wider select-all">
                {officialWinner.code}
              </div>

              <div className="pt-2 border-t border-slate-700/60">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                  Ganhador Oficial
                </span>
                <p className="text-lg sm:text-2xl font-black text-white">
                  {officialWinner.name}
                </p>
                {officialWinner.phone && (
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    Telefone: {officialWinner.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Prêmio Conquistado */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl max-w-sm mx-auto text-xs font-bold text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Prêmio: {group.prize || (group as any).prizeValue || 'PIX'}
            </div>

            {/* Botão de Fechar e Auditoria */}
            <div className="pt-2">
              <button
                id="btn-concluir-sorteio-oficial"
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-100 hover:bg-white text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-white/10 mx-auto block"
              >
                RESULTADO OFICIAL (CONCLUIR)
              </button>
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* ESTADO DE ERRO (CASO O BACKEND RETORNE FALHA)              */}
        {/* ========================================================= */}
        {phase === 'error' && (
          <div className="space-y-6 text-center py-6">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-400 rounded-3xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">Não Foi Possível Concluir o Sorteio</h3>
              <p className="text-xs text-red-300 max-w-md mx-auto">
                {errorMessage || 'Nenhum resultado foi alterado. Verifique a conexão ou a elegibilidade do grupo.'}
              </p>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-xs text-slate-400 max-w-md mx-auto">
              A integridade do sistema foi preservada e nenhuma participação ou sorteio duplicado foi gravado.
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => setPhase('idle')}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
              >
                Tentar Novamente
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-transparent border border-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
