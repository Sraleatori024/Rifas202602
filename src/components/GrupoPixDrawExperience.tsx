import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Sparkles, 
  X, 
  Volume2, 
  VolumeX, 
  AlertCircle, 
  CheckCircle2,
  Crown,
  Users,
  Flame,
  Clapperboard,
  RotateCcw,
  FlaskConical,
  ShieldCheck
} from 'lucide-react';
import { PixGroup } from '../types';

export interface GrupoPixDrawExperienceProps {
  group: PixGroup;
  validParticipations: any[];
  isOpen: boolean;
  isTestMode?: boolean; // Define se é modo de teste ou oficial
  onClose: () => void;
  onDrawCompleted?: (drawResult: any) => void;
}

// Lista de participantes fictícios para o Modo Teste Administrativo
export const MOCK_TEST_PARTICIPANTS = [
  { code: "GP-TEST-0001", name: "Carlos Almeida" },
  { code: "GP-TEST-0002", name: "Mariana Souza" },
  { code: "GP-TEST-0003", name: "João Pedro" },
  { code: "GP-TEST-0004", name: "Fernanda Lima" },
  { code: "GP-TEST-0005", name: "Lucas Martins" },
  { code: "GP-TEST-0006", name: "Camila Oliveira" },
  { code: "GP-TEST-0007", name: "Rafael Santos" },
  { code: "GP-TEST-0008", name: "Beatriz Costa" },
  { code: "GP-TEST-0009", name: "Gabriel Rocha" },
  { code: "GP-TEST-0010", name: "Juliana Mendes" },
  { code: "GP-TEST-0011", name: "André Carvalho" },
  { code: "GP-TEST-0012", name: "Larissa Ferreira" },
  { code: "GP-TEST-0013", name: "Bruno Henrique" },
  { code: "GP-TEST-0014", name: "Patrícia Alves" },
  { code: "GP-TEST-0015", name: "Diego Martins" },
  { code: "GP-TEST-0016", name: "Amanda Rodrigues" },
  { code: "GP-TEST-0017", name: "Felipe Gomes" },
  { code: "GP-TEST-0018", name: "Isabela Santos" },
  { code: "GP-TEST-0019", name: "Thiago Oliveira" },
  { code: "GP-TEST-0020", name: "Renata Costa" }
];

// Fases da experiência cinematográfica
type DrawPhase = 
  | 'idle'              // Antes de iniciar (preparação)
  | 'fetching'          // Chamando backend server-side com segurança (apenas modo oficial)
  | 'countdown'         // Contagem regressiva 3, 2, 1
  | 'cycle_1_accel'     // Ciclo 1: Aceleração rápida
  | 'cycle_2_almost_1'  // Ciclo 2: Primeira quase parada (Mariana Souza)
  | 'cycle_2_recoil'    // Ciclo 2: Efeito de volta / recuo elástico
  | 'cycle_3_reaccel'   // Ciclo 3: Reaceleração
  | 'cycle_3_almost_2'  // Ciclo 3: Segunda quase parada (Lucas Martins)
  | 'cycle_4_flow'      // Ciclo 4: Transição fluida
  | 'cycle_5_slowdown'  // Ciclo 5: Desaceleração extrema passo a passo
  | 'suspense_pause'    // Pausa final de suspense com 3, 2, 1
  | 'reveal'            // Revelação gloriosa do vencedor
  | 'error';            // Erro caso o backend oficial falhe

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
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  // Efeito de quase parada / tensão
  playTensionChime() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
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
  isTestMode = false,
  onClose,
  onDrawCompleted
}) => {
  const [phase, setPhase] = useState<DrawPhase>('idle');
  const [countdownValue, setCountdownValue] = useState<number | string>(3);
  const [soundActive, setSoundActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Vencedor em memória (oficial do backend OU fictício no modo teste)
  const [winnerData, setWinnerData] = useState<{
    code: string;
    name: string;
    phone?: string;
    raw?: any;
  } | null>(null);

  // Itens em exibição durante a rolagem
  const [displayItems, setDisplayItems] = useState<Array<{ code: string; name: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Efeito de recuo visual
  const [recoilOffset, setRecoilOffset] = useState<number>(0);

  // Destaque de participante quase vencedor
  const [almostWinnerName, setAlmostWinnerName] = useState<string | null>(null);

  // Timers e Intervals
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

  // Alterna o áudio
  const toggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    sfx.enabled = next;
  };

  // Monta a lista de amostras visuais
  useEffect(() => {
    if (isTestMode) {
      // No modo teste, usa estritamente os participantes fictícios
      const list: Array<{ code: string; name: string }> = [];
      while (list.length < 150) {
        for (const item of MOCK_TEST_PARTICIPANTS) {
          list.push(item);
          if (list.length >= 150) break;
        }
      }
      setDisplayItems(list);
    } else {
      // No modo oficial, usa as participações válidas reais do grupo
      if (!validParticipations || validParticipations.length === 0) return;
      const baseList = validParticipations.map(p => ({
        code: p.participationCode || p.participation_code || p.code || 'GP-000000',
        name: p.buyer_name || p.userName || 'Participante'
      }));

      const list: Array<{ code: string; name: string }> = [];
      while (list.length < 150) {
        for (const item of baseList) {
          list.push(item);
          if (list.length >= 150) break;
        }
      }
      setDisplayItems(list);
    }
  }, [validParticipations, isTestMode]);

  // INÍCIO DO SORTEIO (SEPARAÇÃO ESTRITA: TESTE vs OFICIAL)
  const handleStartDraw = async () => {
    if (phase !== 'idle' && phase !== 'error') return;
    setErrorMessage(null);

    // ========================================================================
    // MODO TESTE: 100% LOCAL, SEM BACKEND, SEM FIREBASE, SEM PERSISTÊNCIA
    // ========================================================================
    if (isTestMode) {
      // Sorteia um vencedor fictício apenas em memória
      const randomIndex = Math.floor(Math.random() * MOCK_TEST_PARTICIPANTS.length);
      const mockWinner = MOCK_TEST_PARTICIPANTS[randomIndex];

      const winner = {
        code: mockWinner.code,
        name: mockWinner.name,
        phone: '— (Ambiente de Teste)',
        raw: { isTest: true, ...mockWinner }
      };

      setWinnerData(winner);

      // Prepara a sequência visual para que o item final seja o mockWinner
      setDisplayItems(prev => {
        const copy = [...prev];
        if (copy.length > 5) {
          copy[copy.length - 1] = { code: winner.code, name: winner.name };
        } else {
          copy.push({ code: winner.code, name: winner.name });
        }
        return copy;
      });

      // Inicia a contagem regressiva diretamente
      startCountdownSequence(winner);
      return;
    }

    // ========================================================================
    // MODO OFICIAL: BACKEND REAL SERVER-SIDE (/api/grupo-pix/draw)
    // ========================================================================
    setPhase('fetching');

    try {
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
      setWinnerData(winner);

      // Prepara a sequência visual para que o elemento alvo FINAL seja exatamente o vencedor oficial
      setDisplayItems(prev => {
        const copy = [...prev];
        if (copy.length > 5) {
          copy[copy.length - 1] = { code: winner.code, name: winner.name };
        } else {
          copy.push({ code: winner.code, name: winner.name });
        }
        return copy;
      });

      // Inicia a contagem regressiva
      startCountdownSequence(winner);
    } catch (err: any) {
      console.error("Erro no sorteio oficial server-side:", err);
      setErrorMessage(err.message || 'Não foi possível concluir o sorteio oficial. Nenhum resultado foi alterado.');
      setPhase('error');
    }
  };

  // Contagem Regressiva: 3, 2, 1
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
      startCinematicChoreography(winner);
    }, 3400);
  };

  // ==========================================================================
  // COREOGRAFIA CINEMATOGRÁFICA COM 5 CICLOS (ACELERAÇÕES, QUASE-PARADAS E VOLTA)
  // ==========================================================================
  const startCinematicChoreography = (winner: any) => {
    clearAllTimers();
    let currentIdx = 0;
    setCurrentIndex(0);
    setRecoilOffset(0);
    setAlmostWinnerName(null);

    const stepForward = (count: number = 1) => {
      currentIdx = (currentIdx + count) % Math.max(displayItems.length, 1);
      setCurrentIndex(currentIdx);
      sfx.playTick(currentIdx % 2 === 0 ? 850 : 720);
    };

    const stepBackward = (count: number = 2) => {
      currentIdx = (currentIdx - count + displayItems.length) % Math.max(displayItems.length, 1);
      setCurrentIndex(currentIdx);
      sfx.playTick(600);
    };

    // ------------------------------------------------------------------------
    // CICLO 1: ACELERAÇÃO INICIAL RÁPIDA
    // ------------------------------------------------------------------------
    setPhase('cycle_1_accel');
    const cycle1Interval = setInterval(() => {
      stepForward(1);
    }, 60);
    intervalsRef.current.push(cycle1Interval);

    // ------------------------------------------------------------------------
    // CICLO 2: PRIMEIRA QUASE PARADA (EFEITO DE "QUASE VENCEDOR 1") + VOLTA
    // ------------------------------------------------------------------------
    addTimeout(() => {
      clearInterval(cycle1Interval);
      setPhase('cycle_2_almost_1');

      // Desacelera até focar no quase vencedor 1
      let decelMs = 80;
      const decelTimer = setInterval(() => {
        stepForward(1);
        decelMs += 40;
        if (decelMs > 320) {
          clearInterval(decelTimer);
          sfx.playTensionChime();
          const candidate = displayItems[currentIdx];
          setAlmostWinnerName(candidate?.name || 'Mariana Souza');

          // Pausa dramática de ~750ms em que parece que ganhou
          addTimeout(() => {
            // EFEITO DE VOLTA / RECUO ELÁSTICO
            setPhase('cycle_2_recoil');
            setRecoilOffset(-15);
            stepBackward(2);

            addTimeout(() => {
              setRecoilOffset(0);
              setAlmostWinnerName(null);

              // --------------------------------------------------------------
              // CICLO 3: REACELERAÇÃO E SEGUNDA QUASE PARADA (QUASE VENCEDOR 2)
              // --------------------------------------------------------------
              setPhase('cycle_3_reaccel');
              const burstInterval = setInterval(() => {
                stepForward(1);
              }, 50);
              intervalsRef.current.push(burstInterval);

              addTimeout(() => {
                clearInterval(burstInterval);
                setPhase('cycle_3_almost_2');

                // Segunda desaceleração com outro quase vencedor
                let decel2Ms = 90;
                const decel2Timer = setInterval(() => {
                  stepForward(1);
                  decel2Ms += 45;
                  if (decel2Ms > 300) {
                    clearInterval(decel2Timer);
                    sfx.playTensionChime();
                    const candidate2 = displayItems[currentIdx];
                    setAlmostWinnerName(candidate2?.name || 'Lucas Martins');

                    // Pausa de ~650ms no segundo quase vencedor
                    addTimeout(() => {
                      setAlmostWinnerName(null);

                      // ------------------------------------------------------
                      // CICLO 4: TRANSIÇÃO FLUIDA PARA PREPARAÇÃO FINAL
                      // ------------------------------------------------------
                      setPhase('cycle_4_flow');
                      const flowInterval = setInterval(() => {
                        stepForward(1);
                      }, 75);
                      intervalsRef.current.push(flowInterval);

                      addTimeout(() => {
                        clearInterval(flowInterval);

                        // ----------------------------------------------------
                        // CICLO 5: DESACELERAÇÃO EXTREMA E POUSO NO VENCEDOR
                        // ----------------------------------------------------
                        setPhase('cycle_5_slowdown');
                        executeFinalLanding(winner);
                      }, 1100);
                    }, 650);
                  }
                }, decel2Ms);
                intervalsRef.current.push(decel2Timer);
              }, 1200);
            }, 300);
          }, 750);
        }
      }, decelMs);
      intervalsRef.current.push(decelTimer);
    }, 1500);
  };

  // Desaceleração extrema final com pouso milimétrico no vencedor e revelação
  const executeFinalLanding = (winner: any) => {
    clearAllTimers();

    // Passos lentos e solenes: cada participante passa com tempo para leitura
    const landingSteps = [
      { delay: 140, pitch: 850 },
      { delay: 220, pitch: 800 },
      { delay: 340, pitch: 750 },
      { delay: 500, pitch: 700 },
      { delay: 720, pitch: 650 },
      { delay: 1000, pitch: 600 },
      { delay: 1350, pitch: 1200 } // TRAVA NO VENCEDOR
    ];

    let accumulatedTime = 0;
    landingSteps.forEach((step, idx) => {
      accumulatedTime += step.delay;
      addTimeout(() => {
        sfx.playTick(step.pitch);

        if (idx === landingSteps.length - 1) {
          // Fixa visualmente o vencedor alvo
          setDisplayItems(prev => {
            const list = [...prev];
            list[list.length - 1] = { code: winner.code, name: winner.name };
            return list;
          });
          setCurrentIndex(displayItems.length - 1);

          // Pausa de suspense visual antes da revelação triunfal
          setPhase('suspense_pause');

          addTimeout(() => {
            setPhase('reveal');
            sfx.playVictory();

            // SÓ chama onDrawCompleted se for MODO OFICIAL
            if (!isTestMode && onDrawCompleted) {
              onDrawCompleted(winner.raw);
            }
          }, 900);
        } else {
          setCurrentIndex(prev => (prev + 1) % Math.max(displayItems.length, 1));
        }
      }, accumulatedTime);
    });
  };

  // Repete o teste (exclusivo para Modo Teste)
  const handleRepeatTest = () => {
    clearAllTimers();
    setPhase('idle');
    setWinnerData(null);
    setCurrentIndex(0);
    setRecoilOffset(0);
    setAlmostWinnerName(null);
  };

  if (!isOpen) return null;

  const currentItem = displayItems[currentIndex] || {
    code: winnerData?.code || (isTestMode ? 'GP-TEST-0001' : 'GP-000001'),
    name: winnerData?.name || 'Carregando...'
  };

  const prevItem = displayItems[(currentIndex - 1 + displayItems.length) % Math.max(displayItems.length, 1)] || currentItem;
  const nextItem = displayItems[(currentIndex + 1) % Math.max(displayItems.length, 1)] || currentItem;

  const totalEligibleCount = isTestMode ? MOCK_TEST_PARTICIPANTS.length : validParticipations.length;

  return (
    <div 
      id="modal-sorteio-grupo-pix"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-2xl overflow-y-auto"
    >
      {/* Luzes atmosféricas de fundo */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        isTestMode ? 'bg-cyan-500/10' : 'bg-amber-500/10'
      }`} />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Principal da Experiência */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800/90 rounded-3xl p-4 sm:p-8 md:p-10 shadow-2xl shadow-black/90 text-white overflow-hidden my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* Banner Superior Distintivo: TESTE vs OFICIAL */}
        {isTestMode ? (
          <div className="mb-6 px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-950 via-cyan-900/60 to-slate-900 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <FlaskConical className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <span className="text-[11px] sm:text-xs">SIMULAÇÃO DE SORTEIO — TESTE</span>
            </div>
            <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-cyan-400/80 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800 w-fit">
              NENHUM RESULTADO REAL REGISTRADO
            </span>
          </div>
        ) : (
          <div className="mb-6 px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[11px] sm:text-xs">SORTEIO OFICIAL AUDITADO</span>
            </div>
            <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-amber-400/80 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800 w-fit">
              RESULTADO SERVER-SIDE DEFINITIVO
            </span>
          </div>
        )}

        {/* Barra de Controles Superiores */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isTestMode ? 'bg-cyan-400' : 'bg-emerald-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isTestMode ? 'bg-cyan-500' : 'bg-emerald-500'
              }`} />
            </span>
            <span className={`text-xs font-black uppercase tracking-widest ${
              isTestMode ? 'text-cyan-400' : 'text-emerald-400'
            }`}>
              {isTestMode ? 'Demonstração Visual' : 'Sorteio Oficial — Grupo Pix'}
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

            {/* Fechar (no modo teste sempre disponível; no oficial em idle, reveal ou error) */}
            {(isTestMode || phase === 'idle' || phase === 'reveal' || phase === 'error') && (
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
        {/* FASE 1 — PREPARAÇÃO / TELA INICIAL                       */}
        {/* ========================================================= */}
        {phase === 'idle' && (
          <div className="space-y-6 text-center py-4">
            <motion.div 
              initial={{ scale: 0.8 }} 
              animate={{ scale: 1 }} 
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-xl ${
                isTestMode 
                  ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-cyan-500/10'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-amber-500/10'
              }`}
            >
              {isTestMode ? (
                <Clapperboard className="w-10 h-10 drop-shadow-md" />
              ) : (
                <Trophy className="w-10 h-10 drop-shadow-md" />
              )}
            </motion.div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {group.name || (group as any).title}
              </h2>
              <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
                {isTestMode 
                  ? 'Ambiente de demonstração para pré-visualizar a experiência visual do sorteio sem qualquer impacto nos dados reais.'
                  : 'Sorteio auditado executado exclusivamente no backend com aleatoriedade criptográfica.'}
              </p>
            </div>

            {/* Informações Resumidas do Sorteio */}
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
              <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Prêmio</span>
                <p className="text-sm font-black text-amber-400 truncate">
                  {group.prize || (group as any).prizeValue || 'PIX'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Participantes</span>
                <p className={`text-sm font-black flex items-center gap-1.5 ${
                  isTestMode ? 'text-cyan-400' : 'text-emerald-400'
                }`}>
                  <Users className="w-3.5 h-3.5" />
                  {totalEligibleCount} {isTestMode ? 'fictícios' : 'elegíveis'}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Preparando participantes...
            </p>

            <button
              id="btn-iniciar-sorteio"
              onClick={handleStartDraw}
              disabled={!isTestMode && validParticipations.length === 0}
              className={`w-full sm:w-auto px-8 py-4 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 mx-auto cursor-pointer ${
                isTestMode
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
                  : 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 shadow-amber-600/25'
              }`}
            >
              {isTestMode ? <Clapperboard className="w-4 h-4 text-slate-950" /> : <Crown className="w-4 h-4 text-slate-950" />}
              {isTestMode ? 'INICIAR SIMULAÇÃO DE TESTE' : 'INICIAR SORTEIO OFICIAL'}
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* CARREGANDO BACKEND (CHAMADA SEGURA EM ANDAMENTO - OFICIAL) */}
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
              className={`text-6xl sm:text-8xl font-mono font-black text-transparent bg-clip-text drop-shadow-2xl ${
                isTestMode
                  ? 'bg-gradient-to-b from-white via-cyan-200 to-cyan-500'
                  : 'bg-gradient-to-b from-white via-amber-200 to-amber-500'
              }`}
            >
              {countdownValue}
            </motion.div>
            <p className="text-xs text-slate-400 font-medium">
              Conectando urna eletrônica e participantes...
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* CARROSSEL CINEMATOGRÁFICO COM 5 CICLOS E RECUO            */}
        {/* ========================================================= */}
        {(phase === 'cycle_1_accel' || 
          phase === 'cycle_2_almost_1' || 
          phase === 'cycle_2_recoil' || 
          phase === 'cycle_3_reaccel' || 
          phase === 'cycle_3_almost_2' || 
          phase === 'cycle_4_flow' || 
          phase === 'cycle_5_slowdown' || 
          phase === 'suspense_pause') && (
          <div className="space-y-6 py-4">
            {/* Status Dinâmico de Tensão */}
            <div className="text-center space-y-1">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isTestMode 
                  ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}>
                <Flame className="w-3.5 h-3.5 animate-pulse" />
                {phase === 'cycle_1_accel' && 'ACELERANDO URNA ELETRÔNICA...'}
                {phase === 'cycle_2_almost_1' && `QUASE! ${almostWinnerName || ''}...`}
                {phase === 'cycle_2_recoil' && 'RECUANDO E RECALIBRANDO...'}
                {phase === 'cycle_3_reaccel' && 'SEGUNDA ACELERAÇÃO...'}
                {phase === 'cycle_3_almost_2' && `ATENÇÃO! ${almostWinnerName || ''}...`}
                {phase === 'cycle_4_flow' && 'DEFININDO O FINALISTA...'}
                {phase === 'cycle_5_slowdown' && 'DESACELERANDO NO BILHETE PREMIADO...'}
                {phase === 'suspense_pause' && 'PAROU! REVELANDO VENCEDOR...'}
              </div>
              <h3 className="text-sm text-slate-400 font-medium">
                {group.name || (group as any).title}
              </h3>
            </div>

            {/* Container Central com Foco Ótico e Efeito de Recuo */}
            <div className="relative py-4 px-2 sm:px-6 overflow-hidden rounded-3xl bg-slate-950/70 border border-slate-800/80 shadow-inner">
              {/* Moldura de Foco e Linhas Guia */}
              <div className={`absolute inset-x-4 top-1/2 -translate-y-1/2 h-20 rounded-2xl border-2 pointer-events-none z-10 ${
                isTestMode 
                  ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10'
                  : 'bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 border-amber-400/50 shadow-lg shadow-amber-500/10'
              }`} />

              <motion.div 
                animate={{ y: recoilOffset }}
                transition={{ type: "spring", stiffness: 350, damping: 15 }}
                className="space-y-2 text-center"
              >
                {/* Item Superior (Desfocado) */}
                <div className="opacity-30 blur-[2px] scale-90 transition-all select-none py-1">
                  <span className="font-mono text-xs text-slate-400">{prevItem.code}</span>
                  <p className="text-xs text-slate-500 truncate max-w-xs mx-auto">{prevItem.name}</p>
                </div>

                {/* ITEM CENTRAL (EM DESTAQUE NÍTIDO) */}
                <motion.div 
                  key={`${currentIndex}-${phase}`}
                  animate={
                    phase === 'cycle_2_almost_1' || phase === 'cycle_3_almost_2'
                      ? { scale: [1, 1.12, 1.05], y: [0, -3, 0] } 
                      : phase === 'cycle_5_slowdown'
                      ? { scale: [1.02, 1.08] }
                      : phase === 'suspense_pause'
                      ? { scale: 1.15 }
                      : { scale: 1.05 }
                  }
                  transition={{ duration: 0.3 }}
                  className="py-3 px-4 z-20 relative select-none"
                >
                  <span className={`font-mono text-2xl sm:text-4xl font-black text-transparent bg-clip-text tracking-wider drop-shadow-md ${
                    isTestMode
                      ? 'bg-gradient-to-r from-cyan-300 via-white to-cyan-400'
                      : 'bg-gradient-to-r from-amber-300 via-white to-amber-400'
                  }`}>
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
              </motion.div>
            </div>

            {/* Rodapé da animação */}
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium px-2">
              <span>{totalEligibleCount} bilhetes concorrendo</span>
              <span className={`font-mono font-bold animate-pulse ${
                isTestMode ? 'text-cyan-400' : 'text-amber-400'
              }`}>
                {phase === 'suspense_pause' ? 'RESULTADO DEFINIDO' : 'SORTEANDO...'}
              </span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* REVELAÇÃO GLORIOSA DO VENCEDOR (TESTE OU OFICIAL)         */}
        {/* ========================================================= */}
        {phase === 'reveal' && winnerData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-6 text-center py-2"
          >
            {/* Confetes discretos de celebração */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    top: "-10%", 
                    left: `${Math.random() * 100}%`,
                    opacity: 1,
                    scale: Math.random() * 0.8 + 0.4
                  }}
                  animate={{ 
                    top: "110%", 
                    rotate: 360,
                    opacity: [1, 1, 0]
                  }}
                  transition={{ 
                    duration: 3 + Math.random() * 2,
                    ease: "easeOut",
                    delay: Math.random() * 0.6
                  }}
                  className={`absolute w-2.5 h-2.5 rounded-full ${
                    i % 3 === 0 
                      ? 'bg-amber-400' 
                      : i % 3 === 1 
                      ? (isTestMode ? 'bg-cyan-400' : 'bg-emerald-400') 
                      : 'bg-yellow-200'
                  }`}
                />
              ))}
            </div>

            {/* Troféu com Animação de Entrada */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.25, 1] }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className={`w-24 h-24 rounded-3xl p-5 mx-auto shadow-2xl flex items-center justify-center relative ${
                isTestMode 
                  ? 'bg-gradient-to-tr from-cyan-500 via-blue-400 to-cyan-600 text-slate-950 shadow-cyan-500/40'
                  : 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 shadow-amber-500/40'
              }`}
            >
              {isTestMode ? (
                <Clapperboard className="w-14 h-14 drop-shadow-lg" />
              ) : (
                <Trophy className="w-14 h-14 drop-shadow-lg" />
              )}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                className={`absolute -inset-1 rounded-3xl border-2 border-dashed pointer-events-none ${
                  isTestMode ? 'border-cyan-300/40' : 'border-amber-300/40'
                }`}
              />
            </motion.div>

            <div className="space-y-1">
              <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                isTestMode 
                  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}>
                {isTestMode ? 'SIMULAÇÃO CONCLUÍDA — VENCEDOR FICTÍCIO' : 'PARTICIPAÇÃO PREMIADA OFICIAL'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-300">
                {group.name || (group as any).title}
              </h2>
            </div>

            {/* Cartão do Código e Nome do Vencedor */}
            <div className={`p-6 sm:p-8 bg-gradient-to-b from-slate-800/80 to-slate-900/90 border-2 rounded-3xl shadow-2xl space-y-3 max-w-lg mx-auto relative overflow-hidden ${
              isTestMode 
                ? 'border-cyan-500/50 shadow-cyan-500/15'
                : 'border-amber-500/50 shadow-amber-500/15'
            }`}>
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {isTestMode ? 'Código de Demonstração' : 'Código Sorteado'}
              </span>
              <div className={`font-mono text-3xl sm:text-5xl font-black tracking-wider select-all ${
                isTestMode ? 'text-cyan-300' : 'text-amber-300'
              }`}>
                {winnerData.code}
              </div>

              <div className="pt-2 border-t border-slate-700/60">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                  {isTestMode ? 'Participante Fictício' : 'Ganhador Oficial'}
                </span>
                <p className="text-lg sm:text-2xl font-black text-white">
                  {winnerData.name}
                </p>
                {winnerData.phone && (
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    {winnerData.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Prêmio */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl max-w-sm mx-auto text-xs font-bold text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Prêmio: {group.prize || (group as any).prizeValue || 'PIX'}
            </div>

            {/* Ações de Fechamento ou Repetição */}
            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2.5 sm:gap-3 w-full max-w-md mx-auto">
              {isTestMode && (
                <button
                  id="btn-repetir-teste"
                  onClick={handleRepeatTest}
                  className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
                >
                  <RotateCcw className="w-4 h-4" />
                  REPETIR TESTE
                </button>
              )}

              <button
                id="btn-concluir-sorteio"
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-100 hover:bg-white text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-white/10 cursor-pointer text-center"
              >
                {isTestMode ? 'FECHAR SIMULAÇÃO' : 'RESULTADO OFICIAL (CONCLUIR)'}
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
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Tentar Novamente
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-transparent border border-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
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
