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
  Calendar
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

  // Draw Execution States (Backend)
  const [executingDrawGroup, setExecutingDrawGroup] = useState<PixGroup | null>(null);
  const [drawLoading, setDrawLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<any | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Gestão Integrada do Grupo Pix
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Gerenciamento independente de grupos, participantes, arrecadação real e sorteios auditados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedGroup && (
            <button
              onClick={() => setSelectedGroup(null)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Ver Todos os Grupos
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Grupo Pix
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      {!selectedGroup && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
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
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
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

                <h2 className="text-2xl font-black text-slate-900">
                  {selectedGroup.name || (selectedGroup as any).title}
                </h2>
                <p className="text-xs text-slate-500 font-medium max-w-2xl">
                  {selectedGroup.description || 'Grupo Pix para arrecadação com liberação automática de acesso.'}
                </p>
              </div>

              {/* Botões de Ação do Grupo */}
              <div className="flex flex-wrap items-center gap-3">
                {selectedGroup.status !== 'drawn' && (
                  <button
                    onClick={() => handlePerformBackendDraw(selectedGroup)}
                    disabled={groupStats.participacoesValidas === 0}
                    className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trophy className="w-4 h-4" />
                    Realizar Sorteio Seguro (Backend)
                  </button>
                )}

                <button
                  onClick={() => handleDeleteGroup(selectedGroup.id)}
                  className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-200"
                  title="Excluir Grupo"
                >
                  <Trash2 className="w-4 h-4" />
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

            <div className="overflow-x-auto">
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

              <div className="overflow-x-auto">
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

              <div className="overflow-x-auto">
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
                <div className="overflow-x-auto">
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

              <div className="overflow-x-auto">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
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

      {/* Modal / Feedback do Sorteio Backend */}
      {executingDrawGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-100 text-center space-y-6">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Sorteio Oficial no Backend</h3>
              <p className="text-xs text-slate-500 mt-1">
                {executingDrawGroup.name || (executingDrawGroup as any).title}
              </p>
            </div>

            {drawLoading && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-700">Calculando vencedor aleatório criptográfico...</p>
              </div>
            )}

            {drawError && (
              <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{drawError}</span>
              </div>
            )}

            {drawResult && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                    Vencedor Sorteado
                  </span>
                  <h4 className="text-xl font-black text-purple-950">{drawResult.winnerName}</h4>
                  <p className="text-sm font-mono font-black text-purple-800 bg-white/80 py-1 px-3 rounded-lg inline-block border border-purple-200 select-all">
                    Código: {drawResult.winnerParticipationCode}
                  </p>
                  <p className="text-xs text-purple-700">
                    Telefone: {drawResult.winner_phone_masked || drawResult.winnerPhone}
                  </p>
                </div>

                <p className="text-[11px] text-slate-400">
                  O resultado foi salvo permanentemente e os participantes podem consultar o resultado em tempo real.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setExecutingDrawGroup(null);
                setDrawResult(null);
                setDrawError(null);
              }}
              className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
