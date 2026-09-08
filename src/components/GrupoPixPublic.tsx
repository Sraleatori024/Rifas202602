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
  ArrowRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PixGroup, PixParticipation, PixDraw } from '../types';

interface GrupoPixPublicProps {
  onSelectGroup?: (group: PixGroup) => void;
}

export const GrupoPixPublic: React.FC<GrupoPixPublicProps> = () => {
  const [groups, setGroups] = useState<PixGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<PixGroup | null>(null);
  
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

  // Consultation of my participations
  const [activeTab, setActiveTab] = useState<'groups' | 'my_participations'>('groups');
  const [myPhone, setMyPhone] = useState('');
  const [myParticipations, setMyParticipations] = useState<any[]>([]);
  const [searchingParticipations, setSearchingParticipations] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load active groups in real time
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

  return (
    <div className="w-full py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider text-emerald-100">
            <Sparkles className="w-3.5 h-3.5" />
            Módulo Oficial Grupo Pix
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Participe dos Grupos VIP e Concorra a Prêmios no PIX
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base font-medium leading-relaxed">
            Acesso exclusivo aos grupos no WhatsApp e Telegram com confirmação 100% automática via PIX.
            Seu código de participação é gerado instantaneamente no backend e o sorteio é 100% auditável.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'groups'
                  ? 'bg-white text-emerald-800 shadow-lg shadow-black/10'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              Ver Grupos Disponíveis
            </button>
            <button
              onClick={() => setActiveTab('my_participations')}
              className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'my_participations'
                  ? 'bg-white text-emerald-800 shadow-lg shadow-black/10'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              Consultar Minhas Participações
            </button>
          </div>
        </div>
      </div>

      {/* View: Grupos Disponíveis */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Grupos Ativos</h2>
              <p className="text-xs text-slate-500 font-medium">Selecione um grupo para garantir sua vaga e código de sorteio.</p>
            </div>
            <span className="text-xs font-black px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              {groups.filter(g => g.status === 'active').length} Grupos Disponíveis
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
                  <div className="h-44 bg-slate-100 rounded-2xl" />
                  <div className="h-6 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Nenhum Grupo Pix Ativo no Momento</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Novos grupos de WhatsApp e Telegram com prêmios no PIX serão cadastrados em breve pelos administradores.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => {
                const groupTitle = group.name || (group as any).title || "Grupo Pix VIP";
                const price = group.participation_price ?? (group as any).entryFee ?? 0;
                const prize = group.prize || (group as any).prizeValue || "Prêmio no PIX";
                const currentParticipants = (group as any).currentParticipants ?? group.valid_participations_count ?? 0;
                const maxParticipants = (group as any).maxParticipants ?? group.max_participations ?? 0;
                const isTelegram = group.type === 'telegram';
                const isDrawn = group.status === 'drawn';
                const isClosed = group.status === 'closed';

                return (
                  <div 
                    key={group.id} 
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Image / Banner */}
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        {group.image_url ? (
                          <img 
                            src={group.image_url} 
                            alt={groupTitle} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${
                            isTelegram ? 'bg-gradient-to-br from-sky-500 to-blue-600' : 'bg-gradient-to-br from-emerald-500 to-teal-700'
                          } text-white`}>
                            {isTelegram ? <Send className="w-14 h-14 opacity-80" /> : <MessageCircle className="w-14 h-14 opacity-80" />}
                          </div>
                        )}

                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1 shadow-sm ${
                            isTelegram ? 'bg-sky-600' : 'bg-emerald-600'
                          }`}>
                            {isTelegram ? <Send className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                            {isTelegram ? 'Telegram' : 'WhatsApp'}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                            isDrawn ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            isClosed ? 'bg-slate-100 text-slate-800 border border-slate-200' :
                            'bg-white/95 text-emerald-800 backdrop-blur-sm border border-emerald-100 shadow-sm'
                          }`}>
                            {isDrawn ? 'Sorteado' : isClosed ? 'Encerrado' : 'Vagas Abertas'}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 space-y-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-900 leading-snug line-clamp-1">{groupTitle}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{group.description || "Grupo VIP exclusivo com sorteio transparente."}</p>
                        </div>

                        <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 space-y-1">
                          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                            Prêmio do Sorteio
                          </p>
                          <p className="text-base font-black text-emerald-900">
                            {typeof prize === 'number' ? `R$ ${prize.toFixed(2)} no PIX` : prize}
                          </p>
                        </div>

                        {/* Progress / Capacity */}
                        {maxParticipants > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                              <span>Participantes</span>
                              <span>{currentParticipants} / {maxParticipants}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (currentParticipants / maxParticipants) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Winner info if drawn */}
                        {isDrawn && (group as any).winnerName && (
                          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs text-purple-900 space-y-1">
                            <p className="font-bold flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5 text-purple-600" />
                              Ganhador: {(group as any).winnerName}
                            </p>
                            <p className="text-[11px] font-mono text-purple-700">
                              Código: {(group as any).winnerParticipationCode || (group as any).winner_code}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer / CTA */}
                    <div className="p-6 pt-0 border-t border-slate-50 mt-4">
                      <div className="flex items-center justify-between mb-3 pt-3">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor de Entrada</p>
                          <p className="text-xl font-black text-slate-900">R$ {Number(price).toFixed(2)}</p>
                        </div>
                      </div>

                      {isDrawn || isClosed ? (
                        <button
                          disabled
                          className="w-full py-3.5 bg-slate-100 text-slate-400 font-bold text-sm rounded-2xl cursor-not-allowed"
                        >
                          {isDrawn ? "Sorteio Já Realizado" : "Inscrições Encerradas"}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedGroup(group);
                            setPaymentData(null);
                            setConfirmedParticipation(null);
                            setPaymentError(null);
                          }}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                        >
                          <span>Participar e Entrar no Grupo</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
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
    </div>
  );
};
