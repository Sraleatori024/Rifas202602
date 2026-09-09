import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Users, 
  MessageCircle, 
  Send, 
  Trophy, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  Copy,
  ExternalLink,
  QrCode,
  Sparkles,
  ArrowRight,
  Calendar,
  Award,
  Search,
  Check,
  X,
  Eye,
  Hash
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PixGroup, PixParticipation, PixDraw } from '../types';

interface GrupoPixPublicProps {
  onSelectGroup?: (group: PixGroup) => void;
}

export const GrupoPixPublic: React.FC<GrupoPixPublicProps> = () => {
  const [groups, setGroups] = useState<PixGroup[]>([]);
  const [draws, setDraws] = useState<PixDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<PixGroup | null>(null);
  const [selectedDrawnGroup, setSelectedDrawnGroup] = useState<PixGroup | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [copiedWinnerCode, setCopiedWinnerCode] = useState(false);
  
  // Checkout states
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCpf, setBuyerCpf] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<any | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Status check after payment
  const [confirmedParticipation, setConfirmedParticipation] = useState<any | null>(null);

  // Consultation of my participations & Tab navigation
  const [activeTab, setActiveTab] = useState<'active_groups' | 'drawn_groups' | 'my_participations'>('active_groups');
  const [myPhone, setMyPhone] = useState('');
  const [myParticipations, setMyParticipations] = useState<any[]>([]);
  const [searchingParticipations, setSearchingParticipations] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load groups in real time
  useEffect(() => {
    const q = query(collection(db, 'pix_groups'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: PixGroup[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as PixGroup);
      });
      setGroups(items);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao carregar Grupos Pix:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load official draws in real time for audit and history enrichment
  useEffect(() => {
    const qDraws = query(collection(db, 'pix_draws'));
    const unsubscribe = onSnapshot(qDraws, (snapshot) => {
      const items: PixDraw[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as PixDraw);
      });
      setDraws(items);
    }, (err) => {
      console.warn("Aviso ao carregar sorteios auditados:", err);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for the created payment
  useEffect(() => {
    if (!paymentData?.identifier && !paymentData?.external_id) return;
    const paymentId = paymentData.identifier || paymentData.external_id;

    const purchaseRef = doc(db, 'compras', paymentId);
    const unsubscribe = onSnapshot(purchaseRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'paid') {
          setConfirmedParticipation({
            purchaseId: paymentId,
            participationCode: data.participationCode,
            status: 'paid',
            groupId: data.groupId,
            groupTitle: data.groupTitle
          });
        }
      }
    });

    return () => unsubscribe();
  }, [paymentData]);

  // Handle PIX creation for Grupo Pix
  const handleParticipate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;

    setProcessingPayment(true);
    setPaymentError(null);

    try {
      const cleanPhone = buyerPhone.replace(/\D/g, '');
      const cleanCpf = buyerCpf.replace(/\D/g, '');

      if (!buyerName.trim()) throw new Error('Por favor, informe seu nome completo.');
      if (cleanPhone.length < 10) throw new Error('Por favor, informe um telefone válido com DDD.');
      if (cleanCpf.length !== 11) throw new Error('Por favor, informe um CPF válido (11 dígitos).');

      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: 'grupo_pix',
          groupId: selectedGroup.id,
          buyer: {
            name: buyerName.trim(),
            phone: cleanPhone,
            cpf: cleanCpf
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Erro ao gerar cobrança PIX.');
      }

      // Resolução segura do QR Code visual
      let qrImage = data.qr_code || data.pix_qrcode || data.qrcode || '';
      if (qrImage && typeof qrImage === 'string') {
        if (!qrImage.startsWith('data:image/') && !qrImage.startsWith('http://') && !qrImage.startsWith('https://')) {
          if (qrImage.length > 100 && !qrImage.startsWith('000201')) {
            qrImage = `data:image/png;base64,${qrImage}`;
          }
        }
      }

      // Se ainda não tiver imagem do QR Code e houver código copia e cola (EMV), gera no cliente
      if ((!qrImage || qrImage.startsWith('000201')) && data.pix_code) {
        try {
          qrImage = await QRCode.toDataURL(data.pix_code, {
            width: 320,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
          });
        } catch (qrGenErr: any) {
          console.error("Erro ao gerar QR Code:", qrGenErr);
        }
      }

      data.resolvedQr = qrImage;
      setPaymentData(data);
    } catch (err: any) {
      console.error("Erro ao criar participação:", err);
      setPaymentError(err.message || 'Erro ao processar participação.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const copyPixCode = () => {
    if (!paymentData?.pix_code) return;
    navigator.clipboard.writeText(paymentData.pix_code);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  // Search my participations by phone
  const handleSearchMyParticipations = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = myPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert("Informe um número de WhatsApp válido.");
      return;
    }

    setSearchingParticipations(true);
    setSearched(true);
    try {
      const normalized = cleanPhone.startsWith('55') ? cleanPhone.substring(2) : cleanPhone;
      
      // Busca participações confirmadas
      const q = query(
        collection(db, 'pix_participations'),
        where('userPhone', 'in', [cleanPhone, normalized, `55${normalized}`])
      );

      const snap = await onSnapshot(q, (snapshot) => {
        const parts: any[] = [];
        snapshot.forEach((doc) => {
          parts.push({ id: doc.id, ...doc.data() });
        });
        setMyParticipations(parts);
        setSearchingParticipations(false);
      });
    } catch (err: any) {
      console.error("Erro ao buscar participações:", err);
      setSearchingParticipations(false);
    }
  };

  // Helper date formatter
  const formatDate = (val: any) => {
    if (!val) return '—';
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '—';
    }
  };

  // Logic to separate drawn and active groups accurately
  const isGroupDrawn = (g: PixGroup) => {
    const st = String(g.status || '').toLowerCase();
    return (
      st === 'drawn' ||
      st === 'completed' ||
      Boolean(
        (g as any).winnerName ||
        (g as any).winner_name ||
        (g as any).winnerParticipationCode ||
        (g as any).winner_code ||
        (g as any).draw_date ||
        (g as any).drawnAt
      )
    );
  };

  const isGroupActive = (g: PixGroup) => {
    if (isGroupDrawn(g)) return false;
    const st = String(g.status || '').toLowerCase();
    return st === 'active' || (!st && !isGroupDrawn(g));
  };

  const activeGroups = groups.filter(isGroupActive);
  const drawnGroups = groups.filter(isGroupDrawn);

  // Helper to get audit draw record if available
  const getGroupDraw = (groupId: string) => {
    return draws.find(d => d.group_id === groupId || (d as any).groupId === groupId);
  };

  return (
    <div className="w-full py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 rounded-3xl p-6 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider text-emerald-100">
            <Sparkles className="w-3.5 h-3.5" />
            Módulo Oficial Grupo Pix
          </div>
          <h1 className="text-2xl sm:text-5xl font-black tracking-tight leading-tight">
            Participe dos Grupos VIP e Concorra a Prêmios no PIX
          </h1>
          <p className="text-emerald-100 text-xs sm:text-base font-medium leading-relaxed">
            Acesso exclusivo aos grupos no WhatsApp e Telegram com confirmação 100% automática via PIX.
            Seu código de participação é gerado instantaneamente no backend e o sorteio é 100% auditável.
          </p>

          {/* Quick Stats Banner Badges */}
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-sm rounded-xl text-xs font-bold text-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeGroups.length} {activeGroups.length === 1 ? 'grupo ativo' : 'grupos ativos'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-sm rounded-xl text-xs font-bold text-amber-200">
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>{drawnGroups.length} {drawnGroups.length === 1 ? 'sorteio realizado' : 'sorteios realizados'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <button
          id="tab-grupos-ativos"
          onClick={() => setActiveTab('active_groups')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'active_groups'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${activeTab === 'active_groups' ? 'bg-emerald-300 animate-pulse' : 'bg-emerald-500'}`} />
          <span>Grupos Ativos</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === 'active_groups' ? 'bg-emerald-700/80 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {activeGroups.length}
          </span>
        </button>

        <button
          id="tab-grupos-sorteados"
          onClick={() => setActiveTab('drawn_groups')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'drawn_groups'
              ? 'bg-purple-700 text-white shadow-md shadow-purple-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Trophy className={`w-4 h-4 ${activeTab === 'drawn_groups' ? 'text-amber-300' : 'text-amber-500'}`} />
          <span>Grupos Sorteados</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === 'drawn_groups' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {drawnGroups.length}
          </span>
        </button>

        <button
          id="tab-minhas-participacoes"
          onClick={() => setActiveTab('my_participations')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ml-auto ${
            activeTab === 'my_participations'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Minhas Participações</span>
        </button>
      </div>

      {/* View: Grupos Ativos */}
      {activeTab === 'active_groups' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Grupos Ativos
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Grupos VIP com vagas abertas para participação imediata e sorteio no PIX.
              </p>
            </div>
            <span className="self-start sm:self-auto text-xs font-black px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              {activeGroups.length} {activeGroups.length === 1 ? 'Grupo Disponível' : 'Grupos Disponíveis'}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
                  <div className="h-48 bg-slate-100 rounded-2xl" />
                  <div className="h-6 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : activeGroups.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4 max-w-xl mx-auto">
              <div className="w-16 h-16 mx-auto bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-800">Não há grupos ativos no momento.</h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Novos grupos VIP com prêmios no PIX estão sendo preparados e serão disponibilizados em breve. Você também pode consultar o histórico de sorteios já realizados na aba "Grupos Sorteados".
              </p>
              {drawnGroups.length > 0 && (
                <button
                  onClick={() => setActiveTab('drawn_groups')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs rounded-xl border border-purple-200 transition-all cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-purple-600" />
                  <span>Ver Grupos Sorteados ({drawnGroups.length})</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeGroups.map((group) => {
                const groupTitle = group.name || (group as any).title || "Grupo Pix VIP";
                const price = group.participation_price ?? (group as any).entryFee ?? 0;
                const prize = group.prize || (group as any).prizeValue || "Prêmio no PIX";
                const currentParticipants = (group as any).currentParticipants ?? group.valid_participations_count ?? 0;
                const maxParticipants = (group as any).maxParticipants ?? group.max_participations ?? 0;
                const isTelegram = group.type === 'telegram';
                const hasValidImage = Boolean(group.image_url && !imgErrors[group.id]);

                return (
                  <div 
                    key={group.id} 
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cover Image / Banner */}
                      <div className="relative w-full h-48 sm:h-52 bg-slate-900 overflow-hidden">
                        {hasValidImage ? (
                          <img 
                            src={group.image_url} 
                            alt={groupTitle} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            onError={() => setImgErrors(prev => ({ ...prev, [group.id]: true }))}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`w-full h-full flex flex-col items-center justify-center p-6 text-white ${
                            isTelegram ? 'bg-gradient-to-br from-sky-600 via-sky-700 to-blue-900' : 'bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900'
                          }`}>
                            {isTelegram ? <Send className="w-14 h-14 opacity-80" /> : <MessageCircle className="w-14 h-14 opacity-80" />}
                            <span className="text-xs font-bold tracking-wider uppercase mt-2 opacity-80">
                              {isTelegram ? 'Canal / Grupo Telegram' : 'Grupo Oficial WhatsApp'}
                            </span>
                          </div>
                        )}

                        {/* Subtle gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5 shadow-md ${
                            isTelegram ? 'bg-sky-600/95 backdrop-blur-sm' : 'bg-emerald-600/95 backdrop-blur-sm'
                          }`}>
                            {isTelegram ? <Send className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                            {isTelegram ? 'Telegram' : 'WhatsApp'}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3">
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/95 text-emerald-800 backdrop-blur-sm border border-emerald-100 shadow-md flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Vagas Abertas
                          </span>
                        </div>

                        {/* Bottom Tag inside cover */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white/90 text-xs">
                          <span className="font-mono text-[11px] font-bold bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-white/10">
                            #{group.id.slice(-6).toUpperCase()}
                          </span>
                          {maxParticipants > 0 && (
                            <span className="text-[11px] font-bold bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-white/10">
                              {currentParticipants} / {maxParticipants} vagas
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 space-y-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-900 leading-snug line-clamp-1">{groupTitle}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {group.description || "Grupo VIP exclusivo com confirmação automática no PIX e sorteio transparente."}
                          </p>
                        </div>

                        {/* Prize Box */}
                        <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100/80 space-y-1">
                          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                            Prêmio do Sorteio
                          </p>
                          <p className="text-base font-black text-emerald-950">
                            {typeof prize === 'number' ? `R$ ${prize.toFixed(2)} no PIX` : prize}
                          </p>
                        </div>

                        {/* Progress / Capacity */}
                        {maxParticipants > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>Ocupação do Grupo</span>
                              <span>{Math.round((currentParticipants / maxParticipants) * 100)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (currentParticipants / maxParticipants) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer / CTA */}
                    <div className="p-6 pt-0 border-t border-slate-100 mt-4">
                      <div className="flex items-center justify-between mb-3 pt-3">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor de Entrada</p>
                          <p className="text-xl font-black text-slate-900">R$ {Number(price).toFixed(2)}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedGroup(group);
                          setPaymentData(null);
                          setConfirmedParticipation(null);
                          setPaymentError(null);
                        }}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Participar e Entrar no Grupo</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View: Grupos Sorteados (Área Separada de Histórico) */}
      {activeTab === 'drawn_groups' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" />
                Grupos Sorteados
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Histórico oficial de grupos cujos sorteios já foram realizados com ganhadores e cotas registradas.
              </p>
            </div>
            <span className="self-start sm:self-auto text-xs font-black px-3.5 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
              {drawnGroups.length} {drawnGroups.length === 1 ? 'Sorteio Realizado' : 'Sorteios Realizados'}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
                  <div className="h-48 bg-slate-100 rounded-2xl" />
                  <div className="h-6 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : drawnGroups.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-4 max-w-xl mx-auto">
              <div className="w-16 h-16 mx-auto bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-800">Ainda não existem grupos sorteados.</h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Assim que um grupo atingir as condições ou for sorteado pela moderação, o ganhador e a cota premiada serão listados publicamente aqui com auditoria completa.
              </p>
              {activeGroups.length > 0 && (
                <button
                  onClick={() => setActiveTab('active_groups')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl border border-emerald-200 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Ver Grupos Ativos Disponíveis ({activeGroups.length})</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drawnGroups.map((group) => {
                const groupTitle = group.name || (group as any).title || "Grupo Pix VIP";
                const prize = group.prize || (group as any).prizeValue || "Prêmio no PIX";
                const drawRecord = getGroupDraw(group.id);
                const winnerName = (group as any).winnerName || (group as any).winner_name || drawRecord?.winner_name || (drawRecord as any)?.winnerName || "Participante Premiado";
                const winnerCode = (group as any).winnerParticipationCode || (group as any).winner_code || drawRecord?.winner_code || (drawRecord as any)?.winnerParticipationCode || "—";
                const drawDate = (group as any).drawnAt || (group as any).draw_date || drawRecord?.drawn_at || (drawRecord as any)?.drawnAt || (group as any).updated_at;
                const isTelegram = group.type === 'telegram';
                const hasValidImage = Boolean(group.image_url && !imgErrors[group.id]);

                return (
                  <div 
                    key={group.id} 
                    className="bg-white rounded-3xl border border-purple-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cover Image / Banner */}
                      <div className="relative w-full h-48 sm:h-52 bg-slate-950 overflow-hidden">
                        {hasValidImage ? (
                          <img 
                            src={group.image_url} 
                            alt={groupTitle} 
                            className="w-full h-full object-cover opacity-85 transition-transform duration-500 group-hover:scale-105" 
                            onError={() => setImgErrors(prev => ({ ...prev, [group.id]: true }))}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white">
                            <Trophy className="w-14 h-14 text-amber-400/80" />
                            <span className="text-xs font-bold tracking-wider uppercase mt-2 text-amber-200/80">
                              Sorteio Finalizado
                            </span>
                          </div>
                        )}

                        {/* Dark gradient overlay for drawn look */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-black/30 pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center gap-1 shadow-md">
                            #{group.id.slice(-6).toUpperCase()}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3">
                          <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white shadow-md flex items-center gap-1.5">
                            <Trophy className="w-3 h-3 text-amber-300" />
                            Sorteado
                          </span>
                        </div>

                        {/* Bottom Date Tag inside cover */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white/90 text-xs">
                          <span className="flex items-center gap-1 text-[11px] font-bold bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10">
                            <Calendar className="w-3 h-3 text-amber-300" />
                            {formatDate(drawDate)}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
                            Auditado
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                              Grupo #{group.id.slice(-6).toUpperCase()}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {isTelegram ? 'Telegram' : 'WhatsApp'}
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-slate-900 leading-snug line-clamp-1 mt-1">{groupTitle}</h3>
                        </div>

                        {/* Prize */}
                        <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/60 flex items-center justify-between text-xs">
                          <span className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5 text-amber-600" />
                            Prêmio Entregue
                          </span>
                          <span className="font-black text-amber-950 text-sm">
                            {typeof prize === 'number' ? `R$ ${prize.toFixed(2)} no PIX` : prize}
                          </span>
                        </div>

                        {/* Highlighted Winner Box */}
                        <div className="p-4 bg-gradient-to-br from-purple-50 via-purple-50/50 to-indigo-50/60 rounded-2xl border border-purple-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-purple-600" />
                              Ganhador Oficial
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Confirmado
                            </span>
                          </div>

                          <div className="space-y-1">
                            <p className="text-base font-black text-purple-950 truncate">
                              {winnerName}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-purple-100/60">
                              <span className="text-[11px] font-bold text-purple-800">Cota / Código Premiado:</span>
                              <span className="px-2.5 py-1 bg-white text-purple-900 font-mono font-black text-xs rounded-lg border border-purple-200 shadow-xs">
                                {winnerCode}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer / Results CTA */}
                    <div className="p-6 pt-0 border-t border-slate-100 mt-2">
                      <div className="flex items-center justify-between py-2 text-xs text-slate-500">
                        <span>Status:</span>
                        <span className="font-bold text-purple-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Sorteio Finalizado
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedDrawnGroup(group)}
                        className="w-full py-3 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-sm rounded-2xl border border-purple-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-purple-600" />
                        <span>Ver Detalhes do Sorteio</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View: Consultar Minhas Participações */}
      {activeTab === 'my_participations' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-10 max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Minhas Participações</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Informe seu WhatsApp para consultar seus códigos de participação e acessar o link dos grupos confirmados.
            </p>
          </div>

          <form onSubmit={handleSearchMyParticipations} className="flex flex-col sm:flex-row gap-3">
            <input
              type="tel"
              placeholder="DDD + Seu WhatsApp (ex: 11999999999)"
              value={myPhone}
              onChange={(e) => setMyPhone(e.target.value)}
              className="flex-grow px-4 py-3.5 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <button
              type="submit"
              disabled={searchingParticipations}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {searchingParticipations ? 'Buscando...' : 'Consultar'}
            </button>
          </form>

          {searched && (
            <div className="pt-4 space-y-4">
              {myParticipations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Nenhuma participação confirmada encontrada.</p>
                  <p className="text-xs text-slate-500">
                    Certifique-se de que o pagamento via PIX foi concluído e que digitou o mesmo número de WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                    {myParticipations.length} {myParticipations.length === 1 ? 'Participação Confirmada' : 'Participações Confirmadas'}
                  </p>
                  {myParticipations.map((part) => {
                    const group = groups.find(g => g.id === (part.groupId || part.group_id));
                    const accessLink = group?.access_link || (group as any)?.whatsappGroupUrl || (group as any)?.telegramGroupUrl;
                    const code = part.participationCode || part.participation_code;
                    const groupName = part.group_name || (group?.name) || (group as any)?.title || "Grupo Pix VIP";

                    return (
                      <div key={part.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              CONFIRMADO
                            </span>
                            <h4 className="text-sm font-black text-slate-900 mt-1">{groupName}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código Único</p>
                            <p className="text-sm font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block mt-0.5 select-all">
                              {code}
                            </p>
                          </div>
                        </div>

                        {accessLink ? (
                          <a
                            href={accessLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Acessar Grupo VIP Agora
                          </a>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Link do grupo disponível com a organização.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Checkout / Pagamento PIX */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Participação Segura via PIX
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  {selectedGroup.name || (selectedGroup as any).title || "Grupo Pix"}
                </h3>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Preencher Dados */}
            {!paymentData && !confirmedParticipation && (
              <form onSubmit={handleParticipate} className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Taxa de Participação</span>
                    <span className="text-emerald-700 font-black text-sm">
                      R$ {Number(selectedGroup.participation_price ?? (selectedGroup as any).entryFee ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    O link de entrada do grupo e seu código oficial de sorteio serão liberados após a confirmação do PIX.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">WhatsApp (com DDD)</label>
                    <input
                      type="tel"
                      required
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="11999999999"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CPF (apenas números)</label>
                    <input
                      type="text"
                      required
                      value={buyerCpf}
                      onChange={(e) => setBuyerCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {paymentError && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={processingPayment}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {processingPayment ? 'Gerando cobrança PIX...' : 'Gerar Pagamento PIX'}
                </button>
              </form>
            )}

            {/* Step 2: PIX Gerado e Aguardando Confirmação */}
            {paymentData && !confirmedParticipation && (
              <div className="space-y-5 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  Aguardando Confirmação do PIX
                </div>

                {/* Visual do QR Code */}
                {paymentData.resolvedQr || paymentData.qr_code || paymentData.pix_qrcode ? (
                  <div className="flex justify-center p-3 bg-white border border-slate-100 rounded-2xl shadow-inner max-w-[220px] mx-auto">
                    <img 
                      src={(() => {
                        const qr = paymentData.resolvedQr || paymentData.qr_code || paymentData.pix_qrcode;
                        if (qr.startsWith('data:image/') || qr.startsWith('http://') || qr.startsWith('https://')) {
                          return qr;
                        }
                        return `data:image/png;base64,${qr}`;
                      })()} 
                      alt="QR Code PIX" 
                      className="w-full h-auto"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <QrCode className="w-16 h-16 opacity-50" />
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Copie o código abaixo e pague no app do seu banco:</p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 break-all select-all max-h-24 overflow-y-auto">
                    {paymentData.pix_code}
                  </div>
                  <button
                    onClick={copyPixCode}
                    className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedPix ? 'Código PIX Copiado!' : 'Copiar Código PIX (Copia e Cola)'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Assim que você pagar, esta tela atualizará automaticamente liberando seu link de acesso do WhatsApp/Telegram e seu código oficial de sorteio.
                </p>
              </div>
            )}

            {/* Step 3: Pagamento Confirmado com Sucesso */}
            {confirmedParticipation && (
              <div className="space-y-5 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <h4 className="text-xl font-black text-slate-900">Pagamento Confirmado!</h4>
                  <p className="text-xs text-slate-500 mt-1">Sua vaga está garantida e você já está concorrendo.</p>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 text-center">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Seu Código de Participação</p>
                  <p className="text-2xl font-mono font-black text-emerald-900 select-all">
                    {confirmedParticipation.participationCode}
                  </p>
                  <p className="text-[10px] text-emerald-700 font-medium">Guarde este código para o sorteio.</p>
                </div>

                {/* Link do Grupo Liberado */}
                {selectedGroup.access_link ? (
                  <a
                    href={selectedGroup.access_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Entrar no Grupo VIP Agora
                  </a>
                ) : (
                  <p className="text-xs text-slate-500 font-medium">
                    O link para o grupo foi enviado para seu WhatsApp cadastrado.
                  </p>
                )}

                <button
                  onClick={() => {
                    setSelectedGroup(null);
                    setConfirmedParticipation(null);
                    setPaymentData(null);
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Fechar Janela
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Resultado Detalhado do Sorteio (selectedDrawnGroup) */}
      {selectedDrawnGroup && (() => {
        const groupTitle = selectedDrawnGroup.name || (selectedDrawnGroup as any).title || "Grupo Pix VIP";
        const prize = selectedDrawnGroup.prize || (selectedDrawnGroup as any).prizeValue || "Prêmio no PIX";
        const drawRecord = getGroupDraw(selectedDrawnGroup.id);
        const winnerName = (selectedDrawnGroup as any).winnerName || (selectedDrawnGroup as any).winner_name || drawRecord?.winner_name || (drawRecord as any)?.winnerName || "Participante Premiado";
        const winnerCode = (selectedDrawnGroup as any).winnerParticipationCode || (selectedDrawnGroup as any).winner_code || drawRecord?.winner_code || (drawRecord as any)?.winnerParticipationCode || "—";
        const drawDate = (selectedDrawnGroup as any).drawnAt || (selectedDrawnGroup as any).draw_date || drawRecord?.drawn_at || (drawRecord as any)?.drawnAt || (selectedDrawnGroup as any).updated_at;
        const totalCompetitors = drawRecord?.totalValidParticipations || (drawRecord as any)?.total_eligible_participations || selectedDrawnGroup.valid_participations_count || (selectedDrawnGroup as any).currentParticipants || 0;
        const isTelegram = selectedDrawnGroup.type === 'telegram';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto border border-purple-100">
              {/* Close Button */}
              <button
                onClick={() => setSelectedDrawnGroup(null)}
                className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
                title="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md">
                    Resultado Oficial Auditado
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-0.5">
                    {groupTitle}
                  </h3>
                </div>
              </div>

              {/* Cover Banner if available */}
              {selectedDrawnGroup.image_url && !imgErrors[selectedDrawnGroup.id] && (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-slate-900 shadow-inner">
                  <img
                    src={selectedDrawnGroup.image_url}
                    alt={groupTitle}
                    className="w-full h-full object-cover opacity-90"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                      ID: #{selectedDrawnGroup.id.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {/* Highlighted Winner Box */}
              <div className="p-5 bg-gradient-to-br from-amber-50 via-purple-50 to-indigo-50 rounded-2xl border border-amber-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    Ganhador Oficial
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Auditado
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-900">
                    {winnerName}
                  </p>
                  <p className="text-xs text-slate-600 font-medium">
                    Parabéns ao ganhador do sorteio oficial do grupo!
                  </p>
                </div>

                {/* Winning Ticket / Code */}
                <div className="p-3.5 bg-white rounded-xl border border-purple-200/80 shadow-xs flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider block">
                      Cota / Código Premiado
                    </span>
                    <span className="font-mono text-base font-black text-purple-950">
                      {winnerCode}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (winnerCode && winnerCode !== '—') {
                        navigator.clipboard.writeText(winnerCode);
                        setCopiedWinnerCode(true);
                        setTimeout(() => setCopiedWinnerCode(false), 2500);
                      }
                    }}
                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-lg border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedWinnerCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Prêmio Entregue</span>
                  <p className="text-sm font-black text-slate-900">
                    {typeof prize === 'number' ? `R$ ${prize.toFixed(2)} no PIX` : prize}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Data do Sorteio</span>
                  <p className="text-sm font-black text-slate-900">
                    {formatDate(drawDate)}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Plataforma</span>
                  <p className="text-sm font-black text-slate-900">
                    {isTelegram ? 'Telegram' : 'WhatsApp'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total Concorrentes</span>
                  <p className="text-sm font-black text-slate-900">
                    {totalCompetitors} participantes
                  </p>
                </div>
              </div>

              {/* Audit Transparency Badge */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">Transparência & Auditoria Criptográfica</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sorteio executado com geração aleatória no backend e verificação imutável no banco de dados. Qualquer participante pode verificar a autenticidade do código premiado.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedDrawnGroup(null)}
                className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Fechar Janela
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
