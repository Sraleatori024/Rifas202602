import React, { useState, useEffect } from 'react';
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
  Lock,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  getDocs, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { PixGroup, PixParticipation, PixDraw } from '../types';

export const GrupoPixAdmin: React.FC = () => {
  const [groups, setGroups] = useState<PixGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [accessLink, setAccessLink] = useState('');
  const [participationPrice, setParticipationPrice] = useState('10.00');
  const [prize, setPrize] = useState('');
  const [maxParticipations, setMaxParticipations] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Draw states
  const [executingDrawGroup, setExecutingDrawGroup] = useState<PixGroup | null>(null);
  const [drawLoading, setDrawLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<any | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

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
      console.error("Erro ao carregar grupos no admin:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      // Reset form
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

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm("Deseja realmente remover este grupo? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteDoc(doc(db, 'pix_groups', groupId));
      alert("Grupo removido com sucesso!");
    } catch (err: any) {
      console.error("Erro ao remover grupo:", err);
      alert("Erro ao remover grupo.");
    }
  };

  // Sorteio exclusivamente pelo backend
  const handlePerformBackendDraw = async (group: PixGroup) => {
    if (!window.confirm(`Deseja iniciar o sorteio do grupo "${group.name || (group as any).title}"? O sorteio será executado no backend de forma aleatória e criptograficamente segura.`)) {
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

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Erro ao realizar sorteio.');
      }

      setDrawResult(data.draw);
    } catch (err: any) {
      console.error("Erro no sorteio backend:", err);
      setDrawError(err.message || "Erro ao executar sorteio.");
    } finally {
      setDrawLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Gestão de Grupos Pix (WhatsApp / Telegram)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Módulo oficial para criação de grupos com cobrança automática via PIX e sorteio transparente.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Novo Grupo Pix
        </button>
      </div>

      {/* Grid of Groups */}
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
            const currentParticipants = (group as any).currentParticipants ?? group.valid_participations_count ?? 0;
            const maxParticipants = (group as any).maxParticipants ?? group.max_participations ?? 0;
            const isTelegram = group.type === 'telegram';
            const isDrawn = group.status === 'drawn';

            return (
              <div key={group.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 flex flex-col justify-between">
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
                  {!isDrawn && (
                    <button
                      onClick={() => handlePerformBackendDraw(group)}
                      disabled={currentParticipants === 0}
                      className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Realizar Sorteio
                    </button>
                  )}

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

      {/* Modal / Animação do Sorteio Backend */}
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
