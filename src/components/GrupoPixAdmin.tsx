import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Play, 
  Trophy, 
  ExternalLink, 
  Send, 
  MessageCircle, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  X, 
  AlertCircle,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  CreditCard,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Filter,
  Calendar,
  Clapperboard,
  FlaskConical
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { PixGroup, PixParticipation, PixDraw } from '../types';
import { GrupoPixDrawExperience } from './GrupoPixDrawExperience';

export const GrupoPixAdmin: React.FC = () => {
  // Navigation & Sub-Tabs: 'grupos' | 'participantes' | 'pagamentos' | 'arrecadacao' | 'sorteios'
  const [subTab, setSubTab] = useState<'grupos' | 'participantes' | 'pagamentos' | 'arrecadacao' | 'sorteios'>('grupos');
  const [selectedGroup, setSelectedGroup] = useState<PixGroup | null>(null);

  // Firestore Real-Time Collections
  const [groups, setGroups] = useState<PixGroup[]>([]);
  const [participations, setParticipations] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [draws, setDraws] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [accessLink, setAccessLink] = useState('');
  const [participationPrice, setParticipationPrice] = useState('10.00');
  const [prize, setPrize] = useState('');
  const [maxParticipations, setMaxParticipations] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'pending' | 'cancelled'>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  // Draw Execution States (Backend & Visual Experience)
  const [executingDrawGroup, setExecutingDrawGroup] = useState<PixGroup | null>(null);
  const [isTestDrawMode, setIsTestDrawMode] = useState<boolean>(false);
  const [showOfficialConfirmModal, setShowOfficialConfirmModal] = useState<PixGroup | null>(null);
  const [drawLoading, setDrawLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<any | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

  // Iniciar Modo de Teste Administrativo (100% em memória, zero gravação, zero Firebase, zero backend draw)
  const handleOpenTestDraw = (groupToTest: PixGroup) => {
    setIsTestDrawMode(true);
    setExecutingDrawGroup(groupToTest);
  };

  // Abrir Modal de Confirmação para o Sorteio Oficial (Etapa 2 do Requisito 13)
  const handleOpenOfficialConfirm = (groupToDraw: PixGroup) => {
    setShowOfficialConfirmModal(groupToDraw);
  };

  // 1. Subscribe to pix_groups
  useEffect(() => {
    const qGroups = query(collection(db, 'pix_groups'));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      const items: PixGroup[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as PixGroup);
      });
      setGroups(items);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao carregar grupos no admin:", err);
      setLoading(false);
    });

    return () => unsubGroups();
  }, []);

  // 2. Subscribe to pix_participations (real confirmed participations)
  useEffect(() => {
    const qPart = query(collection(db, 'pix_participations'));
    const unsubPart = onSnapshot(qPart, (snapshot) => {
      const parts: any[] = [];
      snapshot.forEach((doc) => {
        parts.push({ id: doc.id, ...doc.data() });
      });
      // Ordena por data decrescente
      parts.sort((a, b) => {
        const tA = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at || 0).getTime();
        const tB = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at || 0).getTime();
        return tB - tA;
      });
      setParticipations(parts);
    }, (err) => {
      console.error("Erro ao carregar participações:", err);
    });

    return () => unsubPart();
  }, []);

  // 3. Subscribe to compras (where paymentType == 'grupo_pix' or type == 'grupo_pix')
  useEffect(() => {
    const qCompras = query(collection(db, 'compras'));
    const unsubCompras = onSnapshot(qCompras, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        if (d.paymentType === 'grupo_pix' || d.type === 'grupo_pix' || d.groupId || d.group_id) {
          items.push({ id: doc.id, ...d });
        }
      });
      items.sort((a, b) => {
        const tA = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at || 0).getTime();
        const tB = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at || 0).getTime();
        return tB - tA;
      });
      setCompras(items);
    }, (err) => {
      console.error("Erro ao carregar compras grupo pix:", err);
    });

    return () => unsubCompras();
  }, []);

  // 4. Subscribe to pix_draws
  useEffect(() => {
    const qDraws = query(collection(db, 'pix_draws'));
    const unsubDraws = onSnapshot(qDraws, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      items.sort((a, b) => {
        const tA = a.drawn_at?.toDate ? a.drawn_at.toDate().getTime() : new Date(a.drawn_at || 0).getTime();
        const tB = b.drawn_at?.toDate ? b.drawn_at.toDate().getTime() : new Date(b.drawn_at || 0).getTime();
        return tB - tA;
      });
      setDraws(items);
    }, (err) => {
      console.error("Erro ao carregar sorteios grupo pix:", err);
    });

    return () => unsubDraws();
  }, []);

  // Sync selectedGroup if groups update
  useEffect(() => {
    if (selectedGroup) {
      const updated = groups.find(g => g.id === selectedGroup.id);
      if (updated) setSelectedGroup(updated);
    }
  }, [groups]);

  // Calculations for selectedGroup (Real Firestore data)
  const groupStats = useMemo(() => {
    if (!selectedGroup) return null;
    const gId = selectedGroup.id;

    // Participações do grupo
    const groupParts = participations.filter(p => p.groupId === gId || p.group_id === gId);
    const validParts = groupParts.filter(p => p.status === 'valid' || p.status === 'active');
    
    // Compras / Pagamentos do grupo
    const groupCompras = compras.filter(c => c.groupId === gId || c.group_id === gId || (c.identifier && c.identifier.includes(gId)));
    const confirmedPayments = groupCompras.filter(c => c.status === 'paid' || c.status === 'pago' || c.status === 'approved');
    const pendingPayments = groupCompras.filter(c => c.status === 'pending' || c.status === 'pendente' || !c.status);
    const cancelledPayments = groupCompras.filter(c => c.status === 'cancelled' || c.status === 'cancelado' || c.status === 'expired' || c.status === 'payment_creation_failed');
    
    // Arrecadação confirmada
    const revenueFromCompras = confirmedPayments.reduce((acc, c) => acc + Number(c.valor || 0), 0);
    const revenueFromParts = validParts.reduce((acc, p) => acc + Number(p.amount || selectedGroup.participation_price || 0), 0);
    const totalRevenue = revenueFromCompras > 0 ? revenueFromCompras : revenueFromParts;

    // Participantes únicos vs participações totais
    const uniqueParticipants = new Set(
      validParts.map(p => (p.buyer_phone || p.userPhone || p.buyer_cpf || p.userCpf || p.userId))
    ).size;

    // Sorteio do grupo
    const groupDraw = draws.find(d => d.groupId === gId || d.group_id === gId);

    return {
      totalTentativas: groupCompras.length,
      participacoesValidas: validParts.length,
      pagamentosConfirmados: Math.max(confirmedPayments.length, validParts.length),
      pagamentosPendentes: pendingPayments.length,
      pagamentosCancelados: cancelledPayments.length,
      arrecadacaoConfirmada: totalRevenue,
      participantesUnicos: uniqueParticipants,
      totalParticipacoes: validParts.length,
      groupParts,
      validParts,
      groupCompras,
      groupDraw
    };
  }, [selectedGroup, participations, compras, draws]);

  // Overall metrics across all groups
  const overallStats = useMemo(() => {
    const validParts = participations.filter(p => p.status === 'valid' || p.status === 'active');
    const confirmedCompras = compras.filter(c => c.status === 'paid' || c.status === 'pago' || c.status === 'approved');
    const pendingCompras = compras.filter(c => c.status === 'pending' || c.status === 'pendente' || !c.status);

    const totalRev = confirmedCompras.reduce((acc, c) => acc + Number(c.valor || 0), 0) || 
      validParts.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    const uniqueClients = new Set(
      validParts.map(p => (p.buyer_phone || p.userPhone || p.buyer_cpf || p.userCpf || p.userId))
    ).size;

    return {
      totalGroups: groups.length,
      totalValidParts: validParts.length,
      totalConfirmedPayments: Math.max(confirmedCompras.length, validParts.length),
      totalPendingPayments: pendingCompras.length,
      totalRevenue: totalRev,
      totalUniqueParticipants: uniqueClients,
      totalDraws: draws.length
    };
  }, [groups, participations, compras, draws]);

  // Create Group Handler
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const priceNum = parseFloat(participationPrice.replace(',', '.'));
      if (isNaN(priceNum) || priceNum <= 0) {
        alert("Informe um preço de participação válido.");
        setSubmitting(false);
        return;
      }

      if (!name.trim()) {
        alert("Informe o nome do grupo.");
        setSubmitting(false);
        return;
      }

      if (!accessLink.trim() || !accessLink.startsWith('http')) {
        alert("Informe um link de acesso válido (WhatsApp ou Telegram).");
        setSubmitting(false);
        return;
      }

      const groupId = `pix_${Date.now()}`;
      const groupRef = doc(db, 'pix_groups', groupId);

      await setDoc(groupRef, {
        id: groupId,
        name: name.trim(),
        title: name.trim(),
        description: description.trim(),
        type: type,
        access_link: accessLink.trim(),
        whatsappGroupUrl: type === 'whatsapp' ? accessLink.trim() : '',
        telegramGroupUrl: type === 'telegram' ? accessLink.trim() : '',
        participation_price: priceNum,
        entryFee: priceNum,
        prize: prize.trim() || 'Prêmio no PIX',
        prizeValue: prize.trim() || 'Prêmio no PIX',
        max_participations: maxParticipations ? parseInt(maxParticipations) : 0,
        maxParticipants: maxParticipations ? parseInt(maxParticipations) : 0,
        currentParticipants: 0,
        valid_participations_count: 0,
        total_participations_count: 0,
        total_revenue: 0,
        status: 'active',
        image_url: imageUrl.trim() || '',
        created_at: new Date().toISOString()
      });

      alert("Grupo Pix criado com sucesso!");
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setAccessLink('');
      setParticipationPrice('10.00');
      setPrize('');
      setMaxParticipations('');
      setImageUrl('');
    } catch (err: any) {
      console.error("Erro ao criar Grupo Pix:", err);
      alert(`Erro ao criar Grupo Pix: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Group Handler
  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm("Deseja realmente remover este grupo? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteDoc(doc(db, 'pix_groups', groupId));
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
      }
      alert("Grupo removido com sucesso!");
    } catch (err: any) {
      console.error("Erro ao remover grupo:", err);
      alert("Erro ao remover grupo.");
    }
  };

  // Safe Server-Side Draw Execution
  const handlePerformBackendDraw = async (group: PixGroup) => {
    if (!window.confirm(`Deseja iniciar o sorteio oficial do grupo "${group.name || (group as any).title}"?\n\nO sorteio será executado exclusivamente no backend de forma aleatória e criptograficamente auditável.`)) {
      return;
    }

    setExecutingDrawGroup(group);
    setDrawLoading(true);
    setDrawError(null);
    setDrawResult(null);

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
        throw new Error(data?.message || 'Erro ao realizar sorteio.');
      }

      setDrawResult(data.draw || data);
    } catch (err: any) {
      console.error("Erro no sorteio backend:", err);
      setDrawError(err.message || "Erro ao executar sorteio.");
    } finally {
      setDrawLoading(false);
    }
  };

  const copyGroupLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatDate = (val: any) => {
    if (!val) return '—';
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Módulo Exclusivo — Grupo Pix
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
            <span>Gestão Integrada do Grupo Pix</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Gerenciamento independente de grupos, participantes, arrecadação real e sorteios auditados.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {selectedGroup && (
            <button
              onClick={() => setSelectedGroup(null)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Ver Todos os Grupos
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Grupo Pix
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      {!selectedGroup && (
        <div className="w-full max-w-full flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 sm:gap-2 border-b border-slate-200 pb-3">
          {[
            { id: 'grupos', label: 'Grupos', icon: Users, badge: groups.length },
            { id: 'participantes', label: 'Participantes', icon: ShieldCheck, badge: overallStats.totalValidParts },
            { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard, badge: compras.length },
            { id: 'arrecadacao', label: 'Arrecadação', icon: DollarSign },
            { id: 'sorteios', label: 'Sorteios', icon: Trophy, badge: draws.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* DETALHES DE UM GRUPO SELECIONADO ("AO ABRIR UM GRUPO")         */}
      {/* ============================================================ */}
      {selectedGroup && groupStats && (
        <div className="space-y-6">
          {/* Header do Grupo */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5 ${
                    selectedGroup.type === 'telegram' ? 'bg-sky-500' : 'bg-emerald-600'
                  }`}>
                    {selectedGroup.type === 'telegram' ? <Send className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    {selectedGroup.type === 'telegram' ? 'Telegram VIP' : 'WhatsApp VIP'}
                  </span>

                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                    selectedGroup.status === 'drawn' 
                      ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedGroup.status === 'drawn' ? 'Sorteio Concluído' : 'Aguardando Sorteio'}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-slate-900 break-words">
                  {selectedGroup.name || (selectedGroup as any).title}
                </h2>
                <p className="text-xs text-slate-500 font-medium max-w-2xl break-words">
                  {selectedGroup.description || 'Grupo Pix para arrecadação com liberação automática de acesso.'}
                </p>
              </div>

              {/* Botões de Ação do Grupo */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
                {/* BOTÃO TESTAR SORTEIO */}
                <button
                  id="btn-testar-sorteio-header"
                  onClick={() => handleOpenTestDraw(selectedGroup)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="Testar experiência visual com participantes fictícios"
                >
                  <Clapperboard className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>🎬 TESTAR SORTEIO</span>
                </button>

                {/* BOTÃO SORTEIO OFICIAL */}
                {selectedGroup.status !== 'drawn' && (
                  <button
                    id="btn-iniciar-sorteio-grupo"
                    onClick={() => handleOpenOfficialConfirm(selectedGroup)}
                    disabled={groupStats.participacoesValidas === 0}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-slate-950 shrink-0" />
                    <span>🏆 SORTEIO OFICIAL</span>
                  </button>
                )}

                <button
                  onClick={() => handleDeleteGroup(selectedGroup.id)}
                  className="w-full sm:w-auto p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-200 flex items-center justify-center"
                  title="Excluir Grupo"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span className="sm:hidden font-bold text-xs ml-1.5 text-red-500">Excluir Grupo</span>
                </button>
              </div>
            </div>

            {/* Informações Estruturais & Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Prêmio Concorrido</span>
                <p className="text-sm font-black text-emerald-700">{selectedGroup.prize || (selectedGroup as any).prizeValue || 'PIX'}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Valor da Participação</span>
                <p className="text-sm font-black text-slate-900">R$ {Number(selectedGroup.participation_price || (selectedGroup as any).entryFee || 0).toFixed(2)}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Data de Criação</span>
                <p className="text-xs font-bold text-slate-700">{formatDate(selectedGroup.created_at)}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Link do Grupo (Privado)</span>
                <div className="flex items-center gap-2">
                  <a
                    href={selectedGroup.access_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono font-bold text-emerald-700 hover:underline truncate max-w-[120px]"
                  >
                    {selectedGroup.access_link}
                  </a>
                  <button
                    onClick={() => copyGroupLink(selectedGroup.access_link)}
                    className="p-1 text-slate-400 hover:text-slate-700"
                    title="Copiar Link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* PAINEL DE SORTEIO (SEÇÃO 19: TESTAR SORTEIO vs SORTEIO OFICIAL)          */}
            {/* ========================================================================= */}
            <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl text-white shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Módulo de Sorteio
                    </span>
                    <h3 className="text-base font-black text-white">
                      SORTEIO DO GRUPO PIX
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    selectedGroup.status === 'drawn'
                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {selectedGroup.status === 'drawn' ? 'STATUS: SORTEADO' : 'STATUS: ATIVO'}
                  </span>
                </div>
              </div>

              {/* Informações Estruturadas do Painel de Sorteio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-1">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Participantes Válidos
                  </span>
                  <p className="text-base font-black text-emerald-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {groupStats.participacoesValidas}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-1">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Prêmio
                  </span>
                  <p className="text-base font-black text-amber-400 truncate">
                    {selectedGroup.prize || (selectedGroup as any).prizeValue || 'PIX'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-1">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    Status
                  </span>
                  <p className="text-base font-black text-white">
                    {selectedGroup.status === 'drawn' ? 'CONCLUÍDO' : 'ATIVO'}
                  </p>
                </div>
              </div>

              {/* Ações de Sorteio com Dois Botões Distintos */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                {/* [ 🎬 TESTAR SORTEIO ] */}
                <button
                  id="btn-testar-sorteio-painel"
                  onClick={() => handleOpenTestDraw(selectedGroup)}
                  className="w-full sm:flex-1 px-5 sm:px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Clapperboard className="w-4 h-4 text-cyan-400" />
                  <span>🎬 TESTAR SORTEIO</span>
                </button>

                {/* [ 🏆 SORTEIO OFICIAL ] */}
                {selectedGroup.status !== 'drawn' ? (
                  <button
                    id="btn-sorteio-oficial-painel"
                    onClick={() => handleOpenOfficialConfirm(selectedGroup)}
                    disabled={groupStats.participacoesValidas === 0}
                    className="w-full sm:flex-1 px-5 sm:px-6 py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-slate-950" />
                    <span>🏆 SORTEIO OFICIAL</span>
                  </button>
                ) : (
                  <div className="w-full sm:flex-1 px-5 sm:px-6 py-3.5 bg-slate-800/50 border border-slate-700/60 text-slate-400 font-bold text-xs rounded-2xl text-center flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400" />
                    <span>Sorteio Oficial Já Realizado</span>
                  </div>
                )}
              </div>

              {/* Aviso Explícito do Modo de Teste */}
              <div className="p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-2xl text-xs text-cyan-300 flex items-center gap-2.5">
                <FlaskConical className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong>🧪 MODO DE TESTE:</strong> Nenhuma informação real será modificada.
                </span>
              </div>
            </div>

            {/* Resultado do Sorteio se já foi realizado */}
            {selectedGroup.status === 'drawn' && (
              <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-purple-700" />
                    <span className="text-xs font-black uppercase text-purple-900">Sorteio Concluído com Sucesso</span>
                  </div>
                  <p className="text-sm font-bold text-purple-950">
                    Vencedor: {(selectedGroup as any).winnerName || groupStats.groupDraw?.winnerName || 'Registrado'}
                  </p>
                  <p className="text-xs font-mono font-bold text-purple-800">
                    Código Oficial Sorteado: {(selectedGroup as any).winnerParticipationCode || groupStats.groupDraw?.winnerParticipationCode || '—'}
                  </p>
                </div>

                <div className="text-xs text-purple-700 font-medium">
                  {formatDate(groupStats.groupDraw?.drawn_at || (selectedGroup as any).drawn_at)}
                </div>
              </div>
            )}
          </div>

          {/* Grid de Métricas REAIS Calculadas no Firestore */}
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3">
              Métricas Consolidadas (Dados Reais do Firestore)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Participações válidas */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Participações Válidas</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-slate-900">{groupStats.participacoesValidas}</p>
                <p className="text-[10px] text-slate-400">Documentos ativos com status válido</p>
              </div>

              {/* 2. Pagamentos confirmados */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Pagamentos Confirmados</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-700">{groupStats.pagamentosConfirmados}</p>
                <p className="text-[10px] text-slate-400">Cobranças PIX pagas no gateway</p>
              </div>

              {/* 3. Pagamentos pendentes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Pagamentos Pendentes</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-black text-amber-600">{groupStats.pagamentosPendentes}</p>
                <p className="text-[10px] text-slate-400">Tentativas aguardando PIX</p>
              </div>

              {/* 4. Arrecadação confirmada */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Arrecadação Confirmada</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-800">
                  R$ {groupStats.arrecadacaoConfirmada.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-400">Total líquido de pagamentos aprovados</p>
              </div>

              {/* 5. Pagamentos cancelados */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Pagamentos Cancelados</span>
                  <X className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-2xl font-black text-slate-700">{groupStats.pagamentosCancelados}</p>
                <p className="text-[10px] text-slate-400">Expirados ou não concluídos</p>
              </div>

              {/* 6. Total de Tentativas de Pagamento */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Tentativas Totais</span>
                  <CreditCard className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-2xl font-black text-slate-900">{groupStats.totalTentativas}</p>
                <p className="text-[10px] text-slate-400">Cobranças PIX geradas</p>
              </div>

              {/* 7. Quantidade de participantes únicos */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Participantes Únicos</span>
                  <Users className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-2xl font-black text-teal-700">{groupStats.participantesUnicos}</p>
                <p className="text-[10px] text-slate-400">Pessoas distintas confirmadas</p>
              </div>

              {/* 8. Quantidade de participações totais */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total de Participações</span>
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-2xl font-black text-purple-700">{groupStats.totalParticipacoes}</p>
                <p className="text-[10px] text-slate-400">Códigos oficiais no sorteio</p>
              </div>
            </div>
          </div>

          {/* Tabela de Participantes do Grupo (Acesso Restrito ao Admin) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Lista Oficial de Participações ({groupStats.validParts.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Exclusivo para administradores. Dados completos com CPF e WhatsApp para auditoria.
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por código, nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none w-full sm:w-64"
                />
              </div>
            </div>

            {/* Visualização Mobile: Cards */}
            <div className="divide-y divide-slate-100 lg:hidden font-medium text-slate-700">
              {groupStats.validParts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhuma participação confirmada neste grupo ainda.
                </div>
              ) : (
                groupStats.validParts
                  .filter((p: any) => {
                    if (!searchTerm.trim()) return true;
                    const s = searchTerm.toLowerCase();
                    const code = (p.participationCode || p.code || '').toLowerCase();
                    const name = (p.buyer_name || p.userName || '').toLowerCase();
                    const cpf = (p.buyer_cpf || p.userCpf || '').toLowerCase();
                    const phone = (p.buyer_phone || p.userPhone || '').toLowerCase();
                    return code.includes(s) || name.includes(s) || cpf.includes(s) || phone.includes(s);
                  })
                  .map((p: any) => {
                    const code = p.participationCode || p.participation_code || p.code || 'GP-????';
                    const name = p.buyer_name || p.userName || '—';
                    const phone = p.buyer_phone || p.userPhone || '—';
                    const cpf = p.buyer_cpf || p.userCpf || '—';
                    const isValid = p.status === 'valid' || p.status === 'active';

                    return (
                      <div key={p.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-black text-emerald-700 text-sm select-all bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                            {code}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {isValid ? 'Válida' : p.status}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 border border-emerald-200 text-emerald-700">
                              Pago
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="font-bold text-slate-900 text-sm">{name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono mt-0.5">
                            <span>Tel: {phone}</span>
                            <span>CPF: {cpf}</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                          <span>Data:</span>
                          <span>{formatDate(p.paidAt || p.confirmed_at || p.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Visualização Desktop: Tabela */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <th className="p-3.5">Código</th>
                    <th className="p-3.5">Nome</th>
                    <th className="p-3.5">WhatsApp</th>
                    <th className="p-3.5">CPF</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Pagamento</th>
                    <th className="p-3.5">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {groupStats.validParts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Nenhuma participação confirmada neste grupo ainda.
                      </td>
                    </tr>
                  ) : (
                    groupStats.validParts
                      .filter((p: any) => {
                        if (!searchTerm.trim()) return true;
                        const s = searchTerm.toLowerCase();
                        const code = (p.participationCode || p.code || '').toLowerCase();
                        const name = (p.buyer_name || p.userName || '').toLowerCase();
                        const cpf = (p.buyer_cpf || p.userCpf || '').toLowerCase();
                        const phone = (p.buyer_phone || p.userPhone || '').toLowerCase();
                        return code.includes(s) || name.includes(s) || cpf.includes(s) || phone.includes(s);
                      })
                      .map((p: any) => {
                        const code = p.participationCode || p.participation_code || p.code || 'GP-????';
                        const name = p.buyer_name || p.userName || '—';
                        const phone = p.buyer_phone || p.userPhone || '—';
                        const cpf = p.buyer_cpf || p.userCpf || '—';
                        const isValid = p.status === 'valid' || p.status === 'active';

                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-mono font-black text-emerald-700 select-all">
                              {code}
                            </td>
                            <td className="p-3.5 font-bold text-slate-900">{name}</td>
                            <td className="p-3.5 font-mono text-slate-600">{phone}</td>
                            <td className="p-3.5 font-mono text-slate-600">{cpf}</td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isValid ? 'Válida' : p.status}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 border border-emerald-200 text-emerald-700">
                                Pago
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                              {formatDate(p.paidAt || p.confirmed_at || p.created_at)}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VISÃO GERAL DAS ABAS (QUANDO NENHUM GRUPO ESPECÍFICO ESTÁ ABERTO)*/}
      {/* ============================================================ */}
      {!selectedGroup && (
        <>
          {/* TAB 1: GRUPOS */}
          {subTab === 'grupos' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total de Grupos</span>
                  <p className="text-xl font-black text-slate-900">{groups.length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Participações Válidas</span>
                  <p className="text-xl font-black text-emerald-700">{overallStats.totalValidParts}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Arrecadação Confirmada</span>
                  <p className="text-xl font-black text-emerald-800">R$ {overallStats.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sorteios Realizados</span>
                  <p className="text-xl font-black text-purple-700">{overallStats.totalDraws}</p>
                </div>
              </div>

              {/* Grid of Group Cards */}
              {loading ? (
                <div className="p-12 text-center text-slate-400 font-medium">Carregando grupos...</div>
              ) : groups.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <Users className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-700">Nenhum Grupo Pix cadastrado</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Clique em "Novo Grupo Pix" para cadastrar seu primeiro grupo com taxa de entrada automática.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groups.map((group) => {
                    const groupName = group.name || (group as any).title || "Grupo Pix";
                    const price = group.participation_price ?? (group as any).entryFee ?? 0;
                    const groupParts = participations.filter(p => (p.groupId === group.id || p.group_id === group.id) && (p.status === 'valid' || p.status === 'active'));
                    const currentParticipants = groupParts.length;
                    const maxParticipants = (group as any).maxParticipants ?? group.max_participations ?? 0;
                    const isTelegram = group.type === 'telegram';
                    const isDrawn = group.status === 'drawn';

                    return (
                      <div key={group.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col justify-between hover:border-emerald-300 transition-all">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1 ${
                              isTelegram ? 'bg-sky-500' : 'bg-emerald-600'
                            }`}>
                              {isTelegram ? <Send className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                              {isTelegram ? 'Telegram' : 'WhatsApp'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              isDrawn ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isDrawn ? 'Sorteado' : 'Ativo'}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-black text-slate-900 leading-snug">{groupName}</h3>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-1">{group.description || "Sem descrição."}</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <div className="flex justify-between font-medium">
                              <span className="text-slate-500">Valor de Entrada:</span>
                              <span className="font-bold text-slate-900">R$ {Number(price).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-slate-500">Prêmio:</span>
                              <span className="font-bold text-emerald-700">{group.prize || (group as any).prizeValue || 'PIX'}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-slate-500">Participantes Confirmados:</span>
                              <span className="font-bold text-slate-900">{currentParticipants} {maxParticipants > 0 ? `/ ${maxParticipants}` : ''}</span>
                            </div>
                          </div>

                          {isDrawn && (group as any).winnerName && (
                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-900 space-y-0.5">
                              <p className="font-black flex items-center gap-1">
                                <Trophy className="w-3.5 h-3.5 text-purple-600" />
                                Ganhador: {(group as any).winnerName}
                              </p>
                              <p className="font-mono text-[11px] text-purple-700">
                                Código: {(group as any).winnerParticipationCode || (group as any).winner_code}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                          <button
                            onClick={() => setSelectedGroup(group)}
                            className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-all text-center"
                          >
                            Abrir Dashboard & Participantes
                          </button>

                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Excluir Grupo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PARTICIPANTES (GLOBAL) */}
          {subTab === 'participantes' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Todos os Participantes do Grupo Pix ({participations.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auditoria completa com CPF, telefone e códigos gerados após confirmação do PIX.
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar código, nome, telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Visualização Mobile: Cards de Participantes */}
              <div className="divide-y divide-slate-100 lg:hidden font-medium text-slate-700">
                {participations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nenhum participante confirmado encontrado.
                  </div>
                ) : (
                  participations
                    .filter((p: any) => {
                      if (!searchTerm.trim()) return true;
                      const s = searchTerm.toLowerCase();
                      const code = (p.participationCode || p.code || '').toLowerCase();
                      const name = (p.buyer_name || p.userName || '').toLowerCase();
                      const cpf = (p.buyer_cpf || p.userCpf || '').toLowerCase();
                      const phone = (p.buyer_phone || p.userPhone || '').toLowerCase();
                      const group = (p.group_name || '').toLowerCase();
                      return code.includes(s) || name.includes(s) || cpf.includes(s) || phone.includes(s) || group.includes(s);
                    })
                    .map((p: any) => {
                      const code = p.participationCode || p.participation_code || p.code || 'GP-????';
                      const name = p.buyer_name || p.userName || '—';
                      const phone = p.buyer_phone || p.userPhone || '—';
                      const cpf = p.buyer_cpf || p.userCpf || '—';
                      const groupName = p.group_name || groups.find(g => g.id === (p.groupId || p.group_id))?.name || 'Grupo Pix';
                      const isValid = p.status === 'valid' || p.status === 'active';

                      return (
                        <div key={p.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-black text-emerald-700 text-sm select-all bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                              {code}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {isValid ? 'Válida' : p.status}
                            </span>
                          </div>

                          <div>
                            <p className="font-bold text-slate-900 text-sm">{name}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono mt-0.5">
                              <span>Tel: {phone}</span>
                              <span>CPF: {cpf}</span>
                            </div>
                            <p className="text-xs text-slate-600 font-semibold mt-1">
                              Grupo: <span className="text-slate-900">{groupName}</span>
                            </p>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                            <span>Data de confirmação:</span>
                            <span>{formatDate(p.paidAt || p.confirmed_at || p.created_at)}</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Visualização Desktop: Tabela de Participantes */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                      <th className="p-3.5">Código</th>
                      <th className="p-3.5">Nome</th>
                      <th className="p-3.5">WhatsApp</th>
                      <th className="p-3.5">CPF</th>
                      <th className="p-3.5">Grupo</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {participations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          Nenhum participante confirmado encontrado.
                        </td>
                      </tr>
                    ) : (
                      participations
                        .filter((p: any) => {
                          if (!searchTerm.trim()) return true;
                          const s = searchTerm.toLowerCase();
                          const code = (p.participationCode || p.code || '').toLowerCase();
                          const name = (p.buyer_name || p.userName || '').toLowerCase();
                          const cpf = (p.buyer_cpf || p.userCpf || '').toLowerCase();
                          const phone = (p.buyer_phone || p.userPhone || '').toLowerCase();
                          const group = (p.group_name || '').toLowerCase();
                          return code.includes(s) || name.includes(s) || cpf.includes(s) || phone.includes(s) || group.includes(s);
                        })
                        .map((p: any) => {
                          const code = p.participationCode || p.participation_code || p.code || 'GP-????';
                          const name = p.buyer_name || p.userName || '—';
                          const phone = p.buyer_phone || p.userPhone || '—';
                          const cpf = p.buyer_cpf || p.userCpf || '—';
                          const groupName = p.group_name || groups.find(g => g.id === (p.groupId || p.group_id))?.name || 'Grupo Pix';
                          const isValid = p.status === 'valid' || p.status === 'active';

                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3.5 font-mono font-black text-emerald-700 select-all">
                                {code}
                              </td>
                              <td className="p-3.5 font-bold text-slate-900">{name}</td>
                              <td className="p-3.5 font-mono text-slate-600">{phone}</td>
                              <td className="p-3.5 font-mono text-slate-600">{cpf}</td>
                              <td className="p-3.5 text-slate-700">{groupName}</td>
                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isValid ? 'Válida' : p.status}
                                </span>
                              </td>
                              <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                                {formatDate(p.paidAt || p.confirmed_at || p.created_at)}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PAGAMENTOS */}
          {subTab === 'pagamentos' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Histórico de Cobranças PIX ({compras.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cobranças PIX geradas via SyncPayments com status em tempo real.
                  </p>
                </div>
              </div>

              {/* Visualização Mobile: Cards de Pagamentos */}
              <div className="divide-y divide-slate-100 lg:hidden font-medium text-slate-700">
                {compras.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nenhum pagamento registrado ainda.
                  </div>
                ) : (
                  compras.map((c: any) => {
                    const isPaid = c.status === 'paid' || c.status === 'pago' || c.status === 'approved';
                    const isCancelled = c.status === 'cancelled' || c.status === 'cancelado' || c.status === 'expired' || c.status === 'payment_creation_failed';
                    const groupName = groups.find(g => g.id === (c.groupId || c.group_id))?.name || 'Grupo Pix';

                    return (
                      <div key={c.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-slate-400 truncate max-w-[140px]">
                            {c.id}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            isPaid ? 'bg-emerald-100 text-emerald-800' : isCancelled ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isPaid ? 'Confirmado' : isCancelled ? 'Cancelado' : 'Pendente'}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{c.nome || c.client?.name || '—'}</p>
                            <p className="font-mono text-xs text-slate-500">{c.telefone || c.client?.phone || '—'}</p>
                            <p className="text-xs text-slate-600 font-semibold mt-1">
                              Grupo: <span className="text-slate-900">{groupName}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs text-slate-400 block font-normal">Valor</span>
                            <span className="font-black text-slate-900 text-sm">
                              R$ {Number(c.valor || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                          <span>Criado em:</span>
                          <span>{formatDate(c.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Visualização Desktop: Tabela de Pagamentos */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                      <th className="p-3.5">Identificador</th>
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5">Telefone</th>
                      <th className="p-3.5">Grupo</th>
                      <th className="p-3.5">Valor</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {compras.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          Nenhum pagamento registrado ainda.
                        </td>
                      </tr>
                    ) : (
                      compras.map((c: any) => {
                        const isPaid = c.status === 'paid' || c.status === 'pago' || c.status === 'approved';
                        const isCancelled = c.status === 'cancelled' || c.status === 'cancelado' || c.status === 'expired' || c.status === 'payment_creation_failed';
                        const groupName = groups.find(g => g.id === (c.groupId || c.group_id))?.name || 'Grupo Pix';

                        return (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-mono text-[11px] text-slate-500">{c.id}</td>
                            <td className="p-3.5 font-bold text-slate-900">{c.nome || c.client?.name || '—'}</td>
                            <td className="p-3.5 font-mono text-slate-600">{c.telefone || c.client?.phone || '—'}</td>
                            <td className="p-3.5 text-slate-700">{groupName}</td>
                            <td className="p-3.5 font-bold text-slate-900">R$ {Number(c.valor || 0).toFixed(2)}</td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                isPaid ? 'bg-emerald-100 text-emerald-800' : isCancelled ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isPaid ? 'Confirmado' : isCancelled ? 'Cancelado' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                              {formatDate(c.created_at)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ARRECADAÇÃO */}
          {subTab === 'arrecadacao' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Arrecadação Confirmada</span>
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-3xl font-black text-emerald-700">R$ {overallStats.totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">Total somado de participações e pagamentos confirmados</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Pagamentos Aprovados</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-3xl font-black text-slate-900">{overallStats.totalConfirmedPayments}</p>
                  <p className="text-xs text-slate-400">Total de transações convertidas</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-3xl font-black text-purple-700">
                    R$ {overallStats.totalConfirmedPayments > 0 
                      ? (overallStats.totalRevenue / overallStats.totalConfirmedPayments).toFixed(2) 
                      : '0.00'}
                  </p>
                  <p className="text-xs text-slate-400">Valor médio gasto por participação</p>
                </div>
              </div>

              {/* Tabela de Arrecadação por Grupo */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">Arrecadação Detalhada por Grupo</h3>
                </div>

                {/* Visualização Mobile: Cards de Arrecadação */}
                <div className="divide-y divide-slate-100 lg:hidden font-medium text-slate-700">
                  {groups.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nenhum grupo encontrado.
                    </div>
                  ) : (
                    groups.map((g) => {
                      const parts = participations.filter(p => (p.groupId === g.id || p.group_id === g.id) && (p.status === 'valid' || p.status === 'active'));
                      const paid = compras.filter(c => (c.groupId === g.id || c.group_id === g.id) && (c.status === 'paid' || c.status === 'pago' || c.status === 'approved'));
                      const rev = paid.reduce((acc, c) => acc + Number(c.valor || 0), 0) || parts.reduce((acc, p) => acc + Number(p.amount || g.participation_price || 0), 0);

                      return (
                        <div key={g.id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{g.name || (g as any).title}</h4>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Entrada: <span className="font-bold text-slate-900">R$ {Number(g.participation_price || (g as any).entryFee || 0).toFixed(2)}</span>
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedGroup(g)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shrink-0 transition-all"
                            >
                              Ver Grupo
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold uppercase">Bilhetes</span>
                              <span className="font-black text-emerald-700 text-sm">{parts.length}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold uppercase">Pagos</span>
                              <span className="font-bold text-slate-900 text-sm">{Math.max(paid.length, parts.length)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold uppercase">Total</span>
                              <span className="font-black text-slate-900 text-sm">R$ {rev.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Visualização Desktop: Tabela de Arrecadação */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                        <th className="p-3.5">Grupo</th>
                        <th className="p-3.5">Preço Entrada</th>
                        <th className="p-3.5">Participações</th>
                        <th className="p-3.5">Pagamentos Confirmados</th>
                        <th className="p-3.5">Total Arrecadado</th>
                        <th className="p-3.5">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {groups.map((g) => {
                        const parts = participations.filter(p => (p.groupId === g.id || p.group_id === g.id) && (p.status === 'valid' || p.status === 'active'));
                        const paid = compras.filter(c => (c.groupId === g.id || c.group_id === g.id) && (c.status === 'paid' || c.status === 'pago' || c.status === 'approved'));
                        const rev = paid.reduce((acc, c) => acc + Number(c.valor || 0), 0) || parts.reduce((acc, p) => acc + Number(p.amount || g.participation_price || 0), 0);

                        return (
                          <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900">{g.name || (g as any).title}</td>
                            <td className="p-3.5">R$ {Number(g.participation_price || (g as any).entryFee || 0).toFixed(2)}</td>
                            <td className="p-3.5 font-bold text-emerald-700">{parts.length}</td>
                            <td className="p-3.5">{Math.max(paid.length, parts.length)}</td>
                            <td className="p-3.5 font-black text-slate-900">R$ {rev.toFixed(2)}</td>
                            <td className="p-3.5">
                              <button
                                onClick={() => setSelectedGroup(g)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold"
                              >
                                Ver Grupo
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SORTEIOS */}
          {subTab === 'sorteios' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900">
                  Auditoria Oficial de Sorteios Realizados ({draws.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Registros imutáveis de sorteios executados via backend criptográfico.
                </p>
              </div>

              {/* Visualização Mobile: Cards de Sorteios */}
              <div className="divide-y divide-slate-100 lg:hidden font-medium text-slate-700">
                {draws.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nenhum sorteio foi realizado ainda.
                  </div>
                ) : (
                  draws.map((d: any) => (
                    <div key={d.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {d.groupName || d.group_name || 'Grupo Pix'}
                        </span>
                        <span className="text-purple-700 font-mono font-black text-xs bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200/60 select-all">
                          {d.winnerParticipationCode}
                        </span>
                      </div>

                      <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100/70 space-y-1">
                        <p className="font-black text-purple-900 text-sm flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-purple-600 shrink-0" />
                          <span>Ganhador: {d.winnerName}</span>
                        </p>
                        <p className="text-xs font-mono text-slate-600 pl-5">
                          Telefone: {d.winner_phone_masked || d.winnerPhone || '—'}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Concorrentes: {d.total_eligible_participations || d.totalEligible || '—'}</span>
                        <span>{formatDate(d.drawn_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Visualização Desktop: Tabela de Sorteios */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                      <th className="p-3.5">Grupo</th>
                      <th className="p-3.5">Vencedor</th>
                      <th className="p-3.5">Código Sorteado</th>
                      <th className="p-3.5">Telefone</th>
                      <th className="p-3.5">Total Concorrentes</th>
                      <th className="p-3.5">Data do Sorteio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {draws.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Nenhum sorteio foi realizado ainda.
                        </td>
                      </tr>
                    ) : (
                      draws.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">{d.groupName || d.group_name || 'Grupo Pix'}</td>
                          <td className="p-3.5 font-black text-purple-900 flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-purple-600" />
                            {d.winnerName}
                          </td>
                          <td className="p-3.5 font-mono font-black text-purple-700 select-all">
                            {d.winnerParticipationCode}
                          </td>
                          <td className="p-3.5 font-mono text-slate-600">
                            {d.winner_phone_masked || d.winnerPhone || '—'}
                          </td>
                          <td className="p-3.5 text-slate-700 font-bold">
                            {d.total_eligible_participations || d.totalEligible || '—'}
                          </td>
                          <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                            {formatDate(d.drawn_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Criar Grupo Pix */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">Novo Grupo Pix VIP</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome do Grupo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Grupo VIP Pix R$ 1.000"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de Grupo</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('whatsapp')}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                      type === 'whatsapp'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('telegram')}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                      type === 'telegram'
                        ? 'bg-sky-50 border-sky-500 text-sky-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Send className="w-4 h-4 text-sky-500" />
                    Telegram
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Link de Acesso (Privado - Liberado apenas após pagamento)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://chat.whatsapp.com/... ou https://t.me/..."
                  value={accessLink}
                  onChange={(e) => setAccessLink(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Valor da Entrada (R$)</label>
                  <input
                    type="text"
                    required
                    placeholder="10.00"
                    value={participationPrice}
                    onChange={(e) => setParticipationPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Prêmio a Concorrer</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: R$ 500,00 no PIX"
                    value={prize}
                    onChange={(e) => setPrize(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Limite de Vagas (0 = Ilimitado)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={maxParticipations}
                    onChange={(e) => setMaxParticipations(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">URL da Imagem de Capa (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais para os participantes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Criar Grupo Pix'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação do Sorteio Oficial (Etapa 2 do Requisito 13) */}
      {showOfficialConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 text-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  Confirmação de Segurança
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Realizar Sorteio Oficial
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 font-medium">
                Você está prestes a realizar o sorteio oficial deste Grupo Pix.
              </p>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">Grupo:</span>
                  <span className="font-black text-slate-900 text-sm">{showOfficialConfirmModal.name || (showOfficialConfirmModal as any).title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">Participantes Válidos:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {participations.filter(p => (p.groupId === showOfficialConfirmModal.id || p.group_id === showOfficialConfirmModal.id) && (p.status === 'valid' || p.status === 'active')).length} bilhetes elegíveis
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">Prêmio:</span>
                  <span className="font-black text-amber-600 text-sm">{showOfficialConfirmModal.prize || (showOfficialConfirmModal as any).prizeValue || 'PIX'}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Aviso:</strong> O resultado será gerado no servidor por aleatoriedade criptográfica e registrado permanentemente no Firestore (em <code>pix_draws</code> e no status do grupo). Esta ação é definitiva e irreversível.
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-2">
              <button
                id="btn-cancelar-sorteio-oficial"
                type="button"
                onClick={() => setShowOfficialConfirmModal(null)}
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer text-center"
              >
                CANCELAR
              </button>

              <button
                id="btn-confirmar-sorteio-oficial"
                type="button"
                onClick={() => {
                  const targetGroup = showOfficialConfirmModal;
                  setShowOfficialConfirmModal(null);
                  setIsTestDrawMode(false);
                  setExecutingDrawGroup(targetGroup);
                }}
                className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-slate-950" />
                REALIZAR SORTEIO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Experiência Visual Premium e Cinematográfica de Sorteio */}
      {executingDrawGroup && (
        <GrupoPixDrawExperience
          group={executingDrawGroup}
          validParticipations={participations.filter(
            p => (p.groupId === executingDrawGroup.id || p.group_id === executingDrawGroup.id) && 
                 (p.status === 'valid' || p.status === 'active')
          )}
          isOpen={!!executingDrawGroup}
          isTestMode={isTestDrawMode}
          onClose={() => {
            setExecutingDrawGroup(null);
            setIsTestDrawMode(false);
            setDrawResult(null);
            setDrawError(null);
          }}
          onDrawCompleted={(result) => {
            setDrawResult(result);
            if (selectedGroup && selectedGroup.id === executingDrawGroup.id) {
              setSelectedGroup(prev => prev ? { ...prev, status: 'drawn' } : null);
            }
          }}
        />
      )}
    </div>
  );
};
