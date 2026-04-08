import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Ticket, 
  Settings, 
  LogOut, 
  Plus, 
  Trophy, 
  Users, 
  TrendingUp, 
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  Instagram,
  Phone,
  User as UserIcon,
  CreditCard,
  Dice5,
  MousePointer2,
  Unlock,
  Trash2,
  Package,
  Hash,
  ArrowRight,
  Search,
  QrCode,
  Copy
} from 'lucide-react';
import { cn, User, Raffle, RaffleNumber, Winner } from './types';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  updateDoc,
  setDoc,
  limit,
  writeBatch,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';

// --- Components ---

const Navbar = ({ user, onLogout, setShowConsult }: { user: User | null, onLogout: () => void, setShowConsult: (show: boolean) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 glass bg-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Ticket className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                Rifa Alice
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-slate-600 hover:text-primary font-medium transition-colors">Início</Link>
            <button 
              onClick={() => setShowConsult(true)}
              className="text-slate-600 hover:text-primary font-medium transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Consultar meus números
            </button>
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-slate-600 hover:text-primary font-medium transition-colors">Painel Admin</Link>
            )}
            {user ? (
              <button 
                onClick={onLogout}
                className="flex items-center space-x-2 text-slate-600 hover:text-red-600 font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            ) : (
              <Link to="/admin/login" className="btn-primary">Admin Login</Link>
            )}
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button 
              onClick={() => setShowConsult(true)}
              className="text-slate-600 hover:text-primary"
            >
              <Users className="w-6 h-6" />
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              <Link to="/" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-slate-600 font-medium">Início</Link>
              <button 
                onClick={() => { setShowConsult(true); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-slate-600 font-medium"
              >
                Consultar meus números
              </button>
              {user?.role === 'admin' && (
                <Link to="/admin" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-slate-600 font-medium">Painel Admin</Link>
              )}
              {user ? (
                <button 
                  onClick={() => { onLogout(); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-red-600 font-medium"
                >
                  Sair
                </button>
              ) : (
                <Link to="/admin/login" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-primary font-medium">Admin Login</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const Home = ({ setShowConsult }: { setShowConsult: (show: boolean) => void }) => {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "raffles"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rafflesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setRaffles(rafflesData);
      setLoading(false);
      setError(null);
    }, (err: any) => {
      console.error("Error fetching raffles:", err.message || err);
      if (err.message?.includes('Quota exceeded') || err.toString().includes('Quota exceeded')) {
        setError("Limite de acesso ao banco de dados atingido. Por favor, tente novamente amanhã.");
      } else if (err.code === 'permission-denied') {
        setError("Erro de permissão no Firestore. Verifique as regras de segurança.");
      } else {
        setError("Erro ao carregar rifas.");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {error && (
        <div className="mb-8 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      <header className="mb-12 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold text-slate-900 mb-4"
        >
          Prêmios Incríveis Esperam por Você
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-slate-600 max-w-2xl mx-auto mb-8"
        >
          Participe das nossas rifas e concorra a prêmios exclusivos. É rápido, fácil e seguro.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <button 
            onClick={() => setShowConsult(true)}
            className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 border border-slate-100 group"
          >
            <Search className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
            <span>Consultar meus números</span>
          </button>
        </motion.div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {raffles.map((raffle, index) => {
          const isPromoActive = raffle.promotion?.active && 
            new Date() >= new Date(raffle.promotion.start_date) && 
            new Date() <= new Date(raffle.promotion.end_date);
          
          const progress = raffle.progress_percent || 0;

          return (
            <motion.div
              key={raffle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card group"
            >
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={raffle.image_url || `https://picsum.photos/seed/${raffle.id}/800/600`} 
                  alt={raffle.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                {isPromoActive && (
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse shadow-lg flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {raffle.promotion?.label || '🔥 MEGA PROMOÇÃO'}
                  </div>
                )}
                {raffle.active === 0 && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="bg-white text-slate-900 px-6 py-2 rounded-full font-black uppercase tracking-widest shadow-2xl transform -rotate-12">
                      Esgotado
                    </span>
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-secondary text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                  {isPromoActive ? (
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-[10px] line-through opacity-70">R$ {raffle.price.toFixed(2)}</span>
                      <span>R$ {raffle.promotion?.package_price.toFixed(2)}</span>
                    </div>
                  ) : (
                    `R$ ${raffle.price.toFixed(2)}`
                  )}
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{raffle.name}</h3>
                <p className="text-slate-600 text-sm mb-6 line-clamp-2">{raffle.description}</p>
                
                <div className="space-y-4">
                  {progress >= 80 ? (
                    <div className="flex items-center gap-2 text-red-600 font-bold text-xs animate-pulse">
                      <AlertCircle className="w-4 h-4" />
                      <span>🚨 Rifa quase encerrando!</span>
                    </div>
                  ) : progress >= 50 ? (
                    <div className="flex items-center gap-2 text-amber-600 font-bold text-xs">
                      <TrendingUp className="w-4 h-4" />
                      <span>🔥 Alta procura agora!</span>
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}

                  <Link 
                    to={`/raffle/${raffle.id}`}
                    className="w-full btn-primary flex items-center justify-center space-x-2"
                  >
                    <span>Participar Agora</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const RaffleDetails = () => {
  const { id: raffleId } = useParams();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [buyerInfo, setBuyerInfo] = useState({ name: '', whatsapp: '', instagram: '', cpf: '' });
  const [pixData, setPixData] = useState<{ qrcode: string, copyPaste: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [step, setStep] = useState(1); // 1: Selection, 2: Info, 3: Payment, 4: Success
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, sold: 0, available: 0 });

  useEffect(() => {
    if (!raffleId) return;
    
    const raffleRef = doc(db, "raffles", raffleId);
    const numbersRef = collection(db, "raffles", raffleId, "numbers");

    const unsubRaffle = onSnapshot(raffleRef, (docSnap) => {
      if (docSnap.exists()) {
        setRaffle({ id: docSnap.id, ...docSnap.data() } as any);
      }
    }, (error) => {
      console.error("Error fetching raffle details:", error.message || error);
      setLoading(false);
    });

    const unsubNumbers = onSnapshot(numbersRef, (snapshot) => {
      const nums = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setNumbers(nums.sort((a, b) => a.number - b.number));
      
      const total = nums.length;
      const paid = nums.filter(n => n.status === 'pago' || n.status === 'confirmed').length;
      console.log(`Rifa ${raffleId}: ${paid} números pagos de ${total}`);
      setStats({ total, sold: paid, available: total - paid });
      setLoading(false);
    }, (error) => {
      console.error("Error fetching numbers:", error.message || error);
      setLoading(false);
    });

    return () => {
      unsubRaffle();
      unsubNumbers();
    };
  }, [raffleId]);

  // Function to save purchase to localStorage
  const saveToLocalStorage = (purchase: any) => {
    try {
      const existing = JSON.parse(localStorage.getItem('minhas_rifas') || '[]');
      const updated = [...existing, purchase];
      // Ensure we only stringify plain data to avoid circular references (e.g. from Firebase objects)
      const safeData = updated.map((item: any) => ({
        raffleId: String(item.raffleId || ''),
        numbers: Array.isArray(item.numbers) ? [...item.numbers] : [],
        buyer: String(item.buyer || ''),
        status: String(item.status || ''),
        date: String(item.date || '')
      }));
      localStorage.setItem('minhas_rifas', JSON.stringify(safeData));
    } catch (e) {
      console.error("Erro ao salvar no localStorage:", e);
    }
  };

  useEffect(() => {
    if (!purchaseId) return;
    const unsub = onSnapshot(doc(db, "compras", purchaseId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().status === 'paid') {
        const data = docSnap.data();
        // Save to local storage when paid
        saveToLocalStorage({
          raffleId: data.rifaId,
          numbers: data.numero,
          buyer: data.nome,
          status: 'pago',
          date: new Date().toISOString()
        });
        setStep(4);
      }
    });
    return () => unsub();
  }, [purchaseId]);

  const toggleNumber = (num: number) => {
    setSelectedPackage(null); // Clear package if manual selection
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      setSelectedNumbers(prev => [...prev, num]);
    }
  };

  const handleSelectPackage = (pkg: any) => {
    setSelectedPackage(pkg);
    // Select random numbers for the package
    const available = numbers
      .filter(n => n.status === 'available')
      .map(n => n.number);
    
    const shuffled = available.sort(() => 0.5 - Math.random());
    const newSelection = shuffled.slice(0, pkg.quantity);
    
    setSelectedNumbers(newSelection);
  };

  const selectRandom = (count: number) => {
    setSelectedPackage(null); // Clear package if random selection
    const available = numbers
      .filter(n => n.status === 'available' && !selectedNumbers.includes(n.number))
      .map(n => n.number);
    
    const shuffled = available.sort(() => 0.5 - Math.random());
    const newSelection = shuffled.slice(0, count);
    
    setSelectedNumbers(prev => [...prev, ...newSelection]);
  };

  const handlePurchase = async () => {
    // 1. Proteção contra múltiplos cliques (Guard Clause)
    if (generatingPix) {
      console.log("handlePurchase ignorado: já existe uma requisição em andamento.");
      return;
    }

    console.log("handlePurchase iniciado", {
      raffleId: String(raffleId),
      numbersCount: selectedNumbers.length,
      buyerName: buyerInfo.name,
      packageId: selectedPackage?.id
    });

    if (!buyerInfo.name || !buyerInfo.whatsapp) {
      alert("Por favor, preencha nome e WhatsApp.");
      return;
    }

    setGeneratingPix(true);
    try {
      // Call the secure API for payment simulation
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raffleId: String(raffleId),
          numbers: [...selectedNumbers],
          buyer: {
            name: String(buyerInfo.name || ''),
            whatsapp: String(buyerInfo.whatsapp || ''),
            instagram: String(buyerInfo.instagram || ''),
            cpf: String(buyerInfo.cpf || '')
          },
          packageId: selectedPackage?.id ? String(selectedPackage.id) : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        const pixCode = data.pix_code;
        const qrImage = data.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

        setPurchaseId(data.identifier);
        setPixData({
          qrcode: qrImage,
          copyPaste: pixCode
        });
        setStep(3);
      } else {
        const error = await res.json();
        if (error.message?.includes('Quota exceeded') || error.details?.includes('Quota exceeded')) {
          alert("Limite de transações atingido para hoje. Por favor, tente novamente mais tarde.");
        } else {
          alert(error.message || error.error || "Erro ao processar compra.");
        }
      }
    } catch (err: any) {
      console.error("Erro ao processar compra:", err.message || err);
      if (err.message?.includes('Quota exceeded') || err.toString().includes('Quota exceeded')) {
        alert("Limite de transações atingido para hoje. Por favor, tente novamente mais tarde.");
      } else {
        alert("Erro ao processar compra.");
      }
    } finally {
      setGeneratingPix(false);
    }
  };

  if (loading || !raffle) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  const isPromoActive = raffle.promotion?.active && 
    new Date() >= new Date(raffle.promotion.start_date) && 
    new Date() <= new Date(raffle.promotion.end_date);
  
  const progress = raffle.progress_percent || 0;
  const isSoldOut = stats.available === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card">
            <img 
              src={raffle.image_url || `https://picsum.photos/seed/${raffle.id}/800/600`} 
              className="w-full h-72 object-cover" 
              referrerPolicy="no-referrer"
            />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h1 className="text-3xl font-bold text-slate-900">{raffle.name}</h1>
                {isPromoActive && (
                  <div className="bg-red-600 text-white px-4 py-1 rounded-full text-xs font-black animate-pulse shadow-lg flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {raffle.promotion?.label || '🔥 MEGA PROMOÇÃO'}
                  </div>
                )}
              </div>
              <p className="text-slate-600 mb-6">{raffle.description}</p>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Valor por número</span>
                    <div className="flex items-center gap-3">
                      {isPromoActive ? (
                        <>
                          <span className="text-lg line-through text-slate-400">R$ {raffle.price.toFixed(2)}</span>
                          <p className="text-3xl font-black text-primary">R$ {raffle.promotion?.package_price.toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="text-3xl font-black text-primary">R$ {raffle.price.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  {isPromoActive && (
                    <div className="text-right">
                      <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold uppercase tracking-tighter">Pacote {raffle.promotion?.package_quantity}x</span>
                    </div>
                  )}
                </div>

                  {raffle.prizes && raffle.prizes.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        Prêmios
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {raffle.prizes.sort((a, b) => a.position - b.position).map((prize, idx) => (
                          <div key={idx} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-sm">
                              {prize.position}º
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{prize.value}</p>
                              {prize.description && <p className="text-xs text-slate-500">{prize.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Datas
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Início</p>
                        <p className="text-sm font-bold text-slate-700">{new Date(raffle.start_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Sorteio</p>
                        <p className="text-sm font-bold text-slate-700">
                          {raffle.indeterminate_date ? 'A definir' : (raffle.end_date ? new Date(raffle.end_date).toLocaleDateString('pt-BR') : 'A definir')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {/* Scarcity Message */}
          {progress >= 50 && (
            <div className={cn(
              "card p-6 flex items-center gap-4 border-2",
              progress >= 80 ? "bg-red-50 border-red-100 animate-pulse" : "bg-amber-50 border-amber-100"
            )}>
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                progress >= 80 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
              )}>
                {progress >= 80 ? <AlertCircle className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
              </div>
              <div>
                <p className={cn(
                  "font-black uppercase tracking-tight",
                  progress >= 80 ? "text-red-900" : "text-amber-900"
                )}>
                  {progress >= 80 ? "🚨 Alta procura, garanta já o seu!" : "🔥 Restam poucos números!"}
                </p>
                <p className={cn(
                  "text-sm font-medium",
                  progress >= 80 ? "text-red-600" : "text-amber-600"
                )}>
                  {progress >= 80 ? "Rifa quase encerrando, não fique de fora." : "Muitas pessoas estão comprando agora."}
                </p>
              </div>
            </div>
          )}

          {/* Packages Section */}
          {raffle.packages && raffle.packages.filter(p => p.active).length > 0 && step === 1 && (
            <div className="space-y-4 mb-8">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="text-primary" />
                Pacotes Promocionais
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {raffle.packages.filter(p => p.active).map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handleSelectPackage(pkg)}
                    className={cn(
                      "relative p-6 rounded-3xl border-2 transition-all text-left group",
                      selectedPackage?.id === pkg.id 
                        ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" 
                        : "border-slate-100 bg-white hover:border-primary/30"
                    )}
                  >
                    {pkg.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                        Mais Escolhido
                      </div>
                    )}
                    <div className="flex flex-col h-full justify-between">
                      <div>
                        <p className="text-3xl font-black text-slate-900 group-hover:text-primary transition-colors">
                          {pkg.quantity}
                        </p>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Números da Sorte</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-lg font-black text-primary">
                          R$ {pkg.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Apenas R$ {(pkg.price / pkg.quantity).toFixed(2)} cada</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Number Selection */}
          {isSoldOut ? (
            <div className="card p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200">
              <X className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Esgotado</h3>
              <p className="text-slate-500">Infelizmente todos os números já foram comprados.</p>
            </div>
          ) : (
            step === 1 && (
              <div className="card p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Dice5 className="text-primary" />
                    Escolha seus números
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => selectRandom(5)} className="px-3 py-1 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">+5 Aleatórios</button>
                    <button onClick={() => selectRandom(10)} className="px-3 py-1 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">+10 Aleatórios</button>
                  </div>
                </div>

                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {numbers.map(n => (
                        <button
                          key={n.id}
                          disabled={n.status === 'pago' || n.status === 'confirmed'}
                          onClick={() => toggleNumber(n.number)}
                          className={cn(
                            "aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all",
                            (n.status === 'pago' || n.status === 'confirmed') ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300" :
                            selectedNumbers.includes(n.number) ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30" :
                            "bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"
                          )}
                        >
                          {n.number.toString().padStart(2, '0')}
                        </button>
                      ))}
                    </div>
              </div>
            )
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Seus Dados</h3>
                  <p className="text-sm text-slate-500">Informe seus dados para a compra</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo *</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={buyerInfo.name}
                      onChange={e => setBuyerInfo({...buyerInfo, name: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all bg-slate-50/50"
                      placeholder="Como você quer ser chamado?"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">WhatsApp *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={buyerInfo.whatsapp}
                      onChange={e => setBuyerInfo({...buyerInfo, whatsapp: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all bg-slate-50/50"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">CPF (Opcional)</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={buyerInfo.cpf}
                      onChange={e => setBuyerInfo({...buyerInfo, cpf: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all bg-slate-50/50"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Instagram (Opcional)</label>
                  <div className="relative">
                    <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={buyerInfo.instagram}
                      onChange={e => setBuyerInfo({...buyerInfo, instagram: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all bg-slate-50/50"
                      placeholder="@seuusuario"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-6 italic text-center">Seus dados estão seguros e serão usados apenas para identificação do ganhador.</p>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="card p-8 text-center">
              <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="relative">
                  <CreditCard className="w-10 h-10" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Finalize seu Pagamento</h3>
              <p className="text-slate-600 mb-8">Escaneie o QR Code ou copie o código PIX. O sistema confirmará automaticamente.</p>
              
              {pixData && (
                <div className="space-y-6 mb-8">
                  <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-xl inline-block mx-auto">
                    <img id="pix-qrcode" src={pixData.qrcode} alt="PIX QR Code" className="w-56 h-56 mx-auto" referrerPolicy="no-referrer" />
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Código Copia e Cola</p>
                    <div className="flex gap-2 max-w-sm mx-auto">
                      <input 
                        readOnly 
                        value={pixData.copyPaste}
                        className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-mono truncate focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(pixData.copyPaste);
                          alert("Código PIX copiado!");
                        }}
                        className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-emerald-800 text-sm mb-8 flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                  <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full" />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-emerald-900 uppercase tracking-wider text-[10px]">Status: Aguardando Pagamento</p>
                  <p className="leading-tight opacity-80">Não feche esta página. Seus números serão confirmados automaticamente em segundos após o pagamento ser detectado.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setStep(2)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                >
                  Alterar forma de pagamento ou dados
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="card p-12 text-center relative overflow-hidden"
            >
              <div className="relative z-10">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-200"
                >
                  <CheckCircle2 className="w-14 h-14" />
                </motion.div>
                
                <h3 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight">Pagamento concluído! 🎉</h3>
                <p className="text-xl text-slate-600 mb-8 font-medium">Seus números foram registrados. Boa sorte! 🍀</p>
                
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 mb-8">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Seus Números Pagos</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {selectedNumbers.map(n => (
                      <span key={n} className="w-12 h-12 bg-white border-2 border-emerald-500 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                        {n.toString().padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Link to="/" className="btn-primary w-full py-4 text-lg shadow-xl shadow-primary/20">
                    Voltar ao Início
                  </Link>
                  <p className="text-sm text-slate-400">Você também pode consultar seus números a qualquer momento usando seu WhatsApp ou CPF.</p>
                </div>
              </div>

              {/* Success Background Effects */}
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            </motion.div>
          )}
        </div>

        {/* Right Column: Checkout Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24 flex flex-col max-h-[calc(100vh-120px)]">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 shrink-0">
              <CreditCard className="text-primary w-5 h-5" />
              Resumo da Compra
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 mb-4 custom-scrollbar min-h-0">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Números selecionados:</span>
                  <span className="font-bold text-slate-900">{selectedNumbers.length}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedNumbers.map(n => (
                    <span key={n} className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded">
                      {n.toString().padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 space-y-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-900 font-bold">Total a pagar:</span>
                <span className="text-2xl font-black text-primary">R$ {(selectedPackage ? selectedPackage.price : selectedNumbers.length * raffle.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  {selectedNumbers.length > 0 && selectedNumbers.length < (raffle.min_purchase_quantity || 1) && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
                      <AlertCircle className="w-4 h-4" />
                      A compra mínima para esta rifa é de {raffle.min_purchase_quantity} números.
                    </div>
                  )}
                  <button 
                    disabled={selectedNumbers.length < (raffle.min_purchase_quantity || 1)}
                    onClick={() => setStep(2)}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2">
                  <button 
                    onClick={handlePurchase}
                    disabled={generatingPix}
                    className="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {generatingPix ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Gerando Pix...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Pagar Agora</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setStep(1)}
                    disabled={generatingPix}
                    className="w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Purchase Button (Mobile) */}
      {selectedNumbers.length > 0 && (step === 1 || step === 2) && (
        <div className="fixed bottom-6 left-4 right-4 z-50 md:hidden">
          <motion.button
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => step === 1 ? setStep(2) : handlePurchase()}
            disabled={
              (step === 1 && selectedNumbers.length < (raffle.min_purchase_quantity || 1)) ||
              (step === 2 && generatingPix)
            }
            className="w-full bg-primary text-white p-4 rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-between font-black disabled:opacity-50"
          >
            <div className="text-left">
              <p className="text-[10px] uppercase opacity-80">Total Selecionado</p>
              <p className="text-xl">R$ {(selectedPackage ? selectedPackage.price : selectedNumbers.length * raffle.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl">
              {generatingPix ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <span>{step === 1 ? 'Continuar' : 'Pagar Agora'}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </div>
          </motion.button>
        </div>
      )}

      {/* Loading Overlay for Pix Generation */}
      <AnimatePresence>
        {generatingPix && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-primary animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Gerando seu QR Code Pix</h3>
                <p className="text-slate-400">Aguarde um momento, estamos processando seu pedido...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminLogin = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // If the username doesn't look like an email, append the default domain
      const loginEmail = username.includes('@') ? username : `${username}@rifaalice.com`;
      
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        const userData: User = { email: userCredential.user.email!, role: 'admin' };
        onLogin(userData);
        navigate('/admin');
      } else {
        await signOut(auth);
        setError('Acesso negado: Você não é um administrador.');
      }
    } catch (err: any) {
      setError('Credenciais inválidas ou erro de conexão.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full card p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Painel Administrativo</h2>
          <p className="text-slate-500">Entre com suas credenciais de acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Usuário</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
              placeholder="Digite seu usuário"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>
          <button type="submit" className="w-full btn-primary py-3">Entrar no Painel</button>
        </form>
      </motion.div>
    </div>
  );
};

const DrawAnimation = ({ 
  raffle, 
  winners, 
  onComplete, 
  onClose 
}: { 
  raffle: Raffle; 
  winners: Winner[]; 
  onComplete: () => void;
  onClose: () => void;
}) => {
  const [currentWinnerIndex, setCurrentWinnerIndex] = useState(-1);
  const [isSuspense, setIsSuspense] = useState(true);
  const [counter, setCounter] = useState(10);

  useEffect(() => {
    if (isSuspense) {
      const timer = setInterval(() => {
        setCounter(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsSuspense(false);
            setCurrentWinnerIndex(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSuspense]);

  const handleNext = () => {
    if (currentWinnerIndex < winners.length - 1) {
      setCurrentWinnerIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-4 overflow-hidden">
      <AnimatePresence mode="wait">
        {isSuspense ? (
          <motion.div 
            key="suspense"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="text-center space-y-8"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-48 h-48 border-4 border-primary/20 border-t-primary rounded-full mx-auto"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl font-black text-white">{counter}</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white uppercase tracking-widest">Sorteando...</h2>
              <p className="text-primary font-bold animate-pulse">Cruzando os dedos! 🤞</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl w-full space-y-8"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-white mb-2">RESULTADO</h2>
              <p className="text-slate-400">{raffle.name}</p>
            </div>

            <div className="space-y-4">
              {winners.slice(0, currentWinnerIndex + 1).map((winner, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20">
                      {winner.prize.position}º
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary uppercase">{winner.prize.value}</p>
                      <p className="text-xl font-bold text-white">{winner.buyer_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Número</p>
                    <p className="text-3xl font-black text-secondary">{winner.number.toString().padStart(2, '0')}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-center pt-8">
              {currentWinnerIndex < winners.length - 1 ? (
                <button 
                  onClick={handleNext}
                  className="btn-primary px-12 py-4 text-lg"
                >
                  Revelar Próximo Ganhador
                </button>
              ) : (
                <button 
                  onClick={onClose}
                  className="bg-white text-slate-900 font-black px-12 py-4 rounded-2xl hover:bg-slate-100 transition-all text-lg"
                >
                  Finalizar e Sair
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRaffle, setNewRaffle] = useState({
    name: '',
    description: '',
    price: 1.00,
    total_numbers: 100,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    indeterminate_date: false,
    image_url: '',
    profit_percent: 30,
    progress_percent: 0,
    min_purchase_quantity: 1,
    min_revenue_goal: 0,
    min_sales_percent: 0,
    prizes: [] as any[],
    packages: [] as any[],
    promotion: {
      active: false,
      package_quantity: 1,
      package_price: 0,
      original_price: 0,
      start_date: '',
      end_date: '',
      label: '🔥 MEGA PROMOÇÃO'
    }
  });
  const [creating, setCreating] = useState(false);
  const [drawState, setDrawState] = useState<{
    active: boolean;
    raffle: Raffle | null;
    winners: Winner[];
    currentPrizeIndex: number;
    isAnimating: boolean;
  }>({
    active: false,
    raffle: null,
    winners: [],
    currentPrizeIndex: 0,
    isAnimating: false
  });

  const [compras, setCompras] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'raffles' | 'customers'>('raffles');
  const [globalStats, setGlobalStats] = useState({
    totalRevenue: 0,
    activeCustomers: 0,
    totalSold: 0
  });

  useEffect(() => {
    // Carrega a lista de rifas para exibição no painel
    const q = query(collection(db, "raffles"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRaffles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => {
      console.error("Erro ao carregar rifas no painel admin:", error.message || error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Buscamos apenas as compras com status "paid" (pagas/confirmadas)
    // Isso garante que as estatísticas reflitam apenas transações reais e finalizadas.
    const q = query(collection(db, "compras"), where("status", "==", "paid"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comprasData = snapshot.docs.map(d => d.data());
      console.log(`Admin: ${comprasData.length} compras pagas carregadas.`);
      setCompras(comprasData);
      
      // 1. Total Arrecadado: Soma do campo 'valor' de todas as compras pagas.
      const totalRevenue = comprasData.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
      
      // 2. Números Vendidos: Soma da quantidade de números em cada compra paga.
      const totalSold = comprasData.reduce((acc, curr) => acc + (Array.isArray(curr.numero) ? curr.numero.length : 0), 0);
      
      // 3. Quantidade de Clientes: Contagem de clientes únicos (por telefone) com pelo menos uma compra paga.
      const uniqueCustomers = new Set(comprasData.map(c => c.telefone).filter(Boolean)).size;
      
      setGlobalStats({
        totalRevenue,
        activeCustomers: uniqueCustomers,
        totalSold
      });
    }, (error) => {
      console.error("Erro ao carregar estatísticas do painel:", error.message || error);
    });
    
    return () => unsubscribe();
  }, []);

  /**
   * Função modular para calcular estatísticas por rifa específica.
   * Filtra os dados de compras já carregados em memória para evitar novas leituras.
   */
  const getRaffleStats = (raffleId: string) => {
    // Filtramos as compras pagas que pertencem a esta rifa
    const raffleCompras = compras.filter(c => c.rifaId === raffleId);
    
    // Arrecadação da rifa (Soma dos valores pagos)
    const revenue = raffleCompras.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    
    // Números vendidos da rifa (Soma da quantidade de números em cada compra)
    const soldNumbers = raffleCompras.reduce((acc, curr) => acc + (Array.isArray(curr.numero) ? curr.numero.length : 0), 0);
    
    // Clientes únicos da rifa (Contagem por telefone)
    const uniqueCustomers = new Set(raffleCompras.map(c => c.telefone).filter(Boolean)).size;
    
    return { revenue, soldNumbers, uniqueCustomers };
  };

  const handleEdit = (raffle: Raffle) => {
    setEditingId(raffle.id);
    setNewRaffle({
      name: raffle.name,
      description: raffle.description,
      price: raffle.price,
      total_numbers: raffle.total_numbers,
      start_date: raffle.start_date || new Date().toISOString().split('T')[0],
      end_date: raffle.end_date || '',
      indeterminate_date: raffle.indeterminate_date || false,
      image_url: raffle.image_url,
      profit_percent: raffle.profit_percent,
      progress_percent: raffle.progress_percent || 0,
      min_purchase_quantity: raffle.min_purchase_quantity || 1,
      min_revenue_goal: raffle.min_revenue_goal || 0,
      min_sales_percent: raffle.min_sales_percent || 0,
      prizes: raffle.prizes || [],
      packages: raffle.packages || [],
      promotion: raffle.promotion || {
        active: false,
        package_quantity: 1,
        package_price: 0,
        original_price: 0,
        start_date: '',
        end_date: '',
        label: '🔥 MEGA PROMOÇÃO'
      }
    });
    setShowCreate(true);
  };

  const handleDelete = async (raffle: Raffle) => {
    const hasSales = (raffle.sold_count || 0) > 0;
    const confirmMsg = hasSales 
      ? "ATENÇÃO: Existem números vendidos. Excluir pode gerar necessidade de reembolso. Essa ação é irreversível. Deseja realmente excluir esta rifa?"
      : "Essa ação é irreversível. Deseja realmente excluir esta rifa?";
    
    if (window.confirm(confirmMsg)) {
      if (hasSales && !window.confirm("CONFIRMAÇÃO DUPLA: Você tem certeza absoluta que deseja excluir uma rifa com vendas ativas?")) {
        return;
      }
      
      try {
        await deleteDoc(doc(db, "raffles", raffle.id));
        // Note: In a real app, you'd also delete the subcollection 'numbers'
        // but Firestore doesn't support recursive delete from client SDK easily.
        // For this demo, deleting the main doc is enough to hide it.
      } catch (err) {
        console.error(err);
        alert("Erro ao excluir rifa.");
      }
    }
  };

  const handleToggleManualRelease = async (raffle: Raffle) => {
    if (window.confirm("Tem certeza que deseja liberar o sorteio antes de atingir a meta?")) {
      try {
        await updateDoc(doc(db, "raffles", raffle.id), {
          draw_manually_released: true,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
        alert("Erro ao liberar sorteio.");
      }
    }
  };

  const isGoalMet = (raffle: Raffle, stats?: { revenue: number, soldNumbers: number }) => {
    if (raffle.draw_manually_released) return true;
    
    const revenue = stats ? stats.revenue : (raffle.revenue || 0);
    const soldCount = stats ? stats.soldNumbers : (raffle.sold_count || 0);
    const totalNumbers = raffle.total_numbers || 1;
    const salesPercent = (soldCount / totalNumbers) * 100;
    
    const revenueGoalMet = raffle.min_revenue_goal ? revenue >= raffle.min_revenue_goal : true;
    const salesGoalMet = raffle.min_sales_percent ? salesPercent >= raffle.min_sales_percent : true;
    
    return revenueGoalMet && salesGoalMet;
  };

  const handleEndRaffle = async (raffle: Raffle) => {
    if (window.confirm(`Deseja realmente encerrar a rifa "${raffle.name}"?`)) {
      try {
        await updateDoc(doc(db, "raffles", raffle.id), {
          active: 0,
          status: 'ended',
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
        alert("Erro ao encerrar rifa.");
      }
    }
  };

  const handleExtendRaffle = async (raffle: Raffle) => {
    const newDate = window.prompt("Digite a nova data de encerramento (YYYY-MM-DD):", raffle.end_date || "");
    if (newDate) {
      try {
        await updateDoc(doc(db, "raffles", raffle.id), {
          end_date: newDate,
          indeterminate_date: false,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
        alert("Erro ao estender rifa.");
      }
    }
  };

  const handleDraw = async (raffle: Raffle) => {
    if (!isGoalMet(raffle, getRaffleStats(raffle.id))) {
      alert("Meta mínima ainda não atingida. Sorteio bloqueado.");
      return;
    }

    if (!window.confirm(`Deseja realmente realizar o sorteio da rifa "${raffle.name}" agora?`)) {
      return;
    }

    try {
      console.log("Iniciando sorteio...");
      const numbersRef = collection(db, "raffles", raffle.id, "numbers");
      const q = query(numbersRef, where("status", "==", "confirmed"));
      const confirmedNumbersSnap = await getDocs(q);

      if (confirmedNumbersSnap.empty) {
        alert("Nenhum número foi confirmado para esta rifa. Sorteio cancelado.");
        return;
      }

      const confirmedNumbers = confirmedNumbersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      const prizes = raffle.prizes || [{ position: 1, value: 'Prêmio Principal', description: '' }];
      const winners: Winner[] = [];
      const usedNumbers = new Set<number>();
      const usedBuyers = new Set<string>();

      // Sort prizes by position
      const sortedPrizes = [...prizes].sort((a, b) => a.position - b.position);

      for (const prize of sortedPrizes) {
        // Filter available numbers for this prize (unique number and unique buyer)
        const availablePool = confirmedNumbers.filter(n => !usedNumbers.has(n.number) && !usedBuyers.has(n.buyer_whatsapp));
        
        if (availablePool.length === 0) break;

        const winnerIndex = Math.floor(Math.random() * availablePool.length);
        const winnerDoc = availablePool[winnerIndex];

        winners.push({
          prize: prize,
          number: winnerDoc.number,
          buyer_name: winnerDoc.buyer_name,
          buyer_whatsapp: winnerDoc.buyer_whatsapp,
          buyer_instagram: winnerDoc.buyer_instagram,
          drawn_at: new Date().toISOString()
        });

        usedNumbers.add(winnerDoc.number);
        usedBuyers.add(winnerDoc.buyer_whatsapp);
      }

      setDrawState({
        active: true,
        raffle,
        winners,
        currentPrizeIndex: 0,
        isAnimating: true
      });

    } catch (err: any) {
      console.error("Erro ao realizar sorteio:", err.message || err);
      alert(`Erro ao realizar sorteio: ${err.message || "Erro desconhecido"}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      console.log("Iniciando salvamento da rifa...");
      if (editingId) {
        await updateDoc(doc(db, "raffles", editingId), {
          ...newRaffle,
          status: newRaffle.status || 'active',
          updated_at: new Date().toISOString()
        });
        console.log("Rifa atualizada com sucesso.");
      } else {
        const raffleData = {
          ...newRaffle,
          active: 1,
          status: 'active',
          sold_count: 0,
          revenue: 0,
          created_at: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, "raffles"), raffleData);
        console.log("Rifa criada. ID:", docRef.id);
        
        // Generate numbers (batching for performance)
        const batchSize = 500;
        const total = newRaffle.total_numbers;
        
        console.log(`Gerando ${total} números em lotes de ${batchSize}...`);
        for (let i = 0; i < total; i += batchSize) {
          const batch = writeBatch(db);
          const end = Math.min(i + batchSize, total);
          for (let j = i; j < end; j++) {
            const numRef = doc(collection(db, "raffles", docRef.id, "numbers"));
            batch.set(numRef, {
              number: j,
              status: 'available',
              updated_at: new Date().toISOString()
            });
          }
          await batch.commit();
          console.log(`Lote de ${i} a ${end} comitado.`);
        }
      }

      setShowCreate(false);
      setEditingId(null);
      setNewRaffle({
        name: '',
        description: '',
        price: 1.00,
        total_numbers: 100,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        indeterminate_date: false,
        image_url: '',
        profit_percent: 30,
        progress_percent: 0,
        min_purchase_quantity: 1,
        min_revenue_goal: 0,
        min_sales_percent: 0,
        prizes: [],
        packages: [],
        promotion: {
          active: false,
          package_quantity: 1,
          package_price: 0,
          original_price: 0,
          start_date: '',
          end_date: '',
          label: '🔥 MEGA PROMOÇÃO'
        }
      });
      alert("Rifa salva com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar rifa:", err.message || err);
      alert(`Erro ao salvar rifa: ${err.message || "Erro desconhecido"}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gerenciar Sistema</h1>
          <p className="text-slate-500">Acompanhe suas campanhas e clientes</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button 
              onClick={() => setActiveTab('raffles')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'raffles' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Rifas
            </button>
            <button 
              onClick={() => setActiveTab('customers')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'customers' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Clientes
            </button>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nova Rifa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase">Total de Rifas</p>
            <p className="text-2xl font-black text-slate-900">{raffles.length}</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase">Arrecadação Total</p>
            <p className="text-2xl font-black text-slate-900">R$ {globalStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase">Clientes Únicos</p>
            <p className="text-2xl font-black text-slate-900">{globalStats.activeCustomers}</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Hash className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase">Números Vendidos</p>
            <p className="text-2xl font-black text-slate-900">{globalStats.totalSold}</p>
          </div>
        </div>
      </div>

      {activeTab === 'raffles' ? (
        <div className="card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rifa</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vendas</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Arrecadação</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Clientes</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {raffles.map(raffle => {
              const raffleStats = getRaffleStats(raffle.id);
              return (
                <tr key={raffle.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={raffle.image_url || `https://picsum.photos/seed/${raffle.id}/50/50`} 
                        className="w-10 h-10 rounded-lg object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="font-bold text-slate-900">{raffle.name}</p>
                        <p className="text-xs text-slate-500">{raffle.total_numbers} números</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{raffleStats.soldNumbers}</span>
                      <span className="text-[10px] text-slate-400 uppercase">Números vendidos</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">R$ {raffleStats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-slate-400 uppercase">Total arrecadado</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700">{raffleStats.uniqueCustomers}</span>
                      <span className="text-[10px] text-slate-400 uppercase">Clientes únicos</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-bold",
                      raffle.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {raffle.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(raffle)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Editar"><Settings className="w-4 h-4" /></button>
                      <button 
                        onClick={() => handleDraw(raffle)} 
                        className={cn(
                          "p-2 transition-colors",
                          isGoalMet(raffle, raffleStats) ? "text-secondary hover:text-emerald-600" : "text-slate-300 cursor-not-allowed"
                        )}
                        title={isGoalMet(raffle, raffleStats) ? "Sortear" : "Meta não atingida"}
                      >
                        <Trophy className="w-4 h-4" />
                      </button>
                      {raffle.status === 'active' && (
                        <button onClick={() => handleEndRaffle(raffle)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Encerrar"><X className="w-4 h-4" /></button>
                      )}
                      {raffle.status === 'ended' && (
                        <button onClick={() => handleExtendRaffle(raffle)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Estender"><Clock className="w-4 h-4" /></button>
                      )}
                      {!isGoalMet(raffle, raffleStats) && (
                        <button onClick={() => handleToggleManualRelease(raffle)} className="p-2 text-amber-400 hover:text-amber-600 transition-colors" title="Liberar Manualmente"><Unlock className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => handleDelete(raffle)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">WhatsApp</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">CPF</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Total Gasto</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Números</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Array.from(new Set(compras.map(c => c.telefone))).map(tel => {
                  const clientPurchases = compras.filter(c => c.telefone === tel);
                  const name = clientPurchases[0]?.nome || "Sem nome";
                  const cpf = clientPurchases[0]?.cpf || "Sem CPF";
                  const totalSpent = clientPurchases.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
                  const totalNumbers = clientPurchases.reduce((acc, curr) => acc + (Array.isArray(curr.numero) ? curr.numero.length : 0), 0);

                  return (
                    <tr key={tel} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold">
                            {name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-900">{name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{tel}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{cpf}</td>
                      <td className="px-6 py-4">
                        <span className="font-black text-emerald-600">
                          R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-black">
                          {totalNumbers} números
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawState.active && drawState.raffle && (
        <DrawAnimation 
          raffle={drawState.raffle}
          winners={drawState.winners}
          onComplete={() => {
            const saveWinners = async () => {
              try {
                const raffleRef = doc(db, "raffles", drawState.raffle!.id);
                await updateDoc(raffleRef, {
                  status: 'drawn',
                  active: 0,
                  winners: drawState.winners,
                  finished_at: new Date().toISOString()
                });
                
                for (const winner of drawState.winners) {
                  await addDoc(collection(db, "draws"), {
                    raffleId: drawState.raffle!.id,
                    raffleName: drawState.raffle!.name,
                    ...winner
                  });
                }
              } catch (err) {
                console.error("Error saving winners:", err.message || err);
              }
            };
            saveWinners();
          }}
          onClose={() => setDrawState({ ...drawState, active: false })}
        />
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Editar Rifa' : 'Criar Nova Rifa'}</h2>
                <button onClick={() => { setShowCreate(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600"><X /></button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Rifa</label>
                    <input 
                      type="text" 
                      required
                      value={newRaffle.name}
                      onChange={e => setNewRaffle({...newRaffle, name: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Ex: Rifa Alice - iPhone 15 Pro"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label>
                    <textarea 
                      required
                      value={newRaffle.description}
                      onChange={e => setNewRaffle({...newRaffle, description: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor por Número (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={newRaffle.price}
                      onChange={e => setNewRaffle({...newRaffle, price: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Quantidade de Números</label>
                    <input 
                      type="number" 
                      required
                      disabled={!!editingId}
                      value={newRaffle.total_numbers}
                      onChange={e => setNewRaffle({...newRaffle, total_numbers: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Data de Início</label>
                      <input 
                        type="date" 
                        required
                        value={newRaffle.start_date}
                        onChange={e => setNewRaffle({...newRaffle, start_date: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Data de Encerramento</label>
                      <input 
                        type="date" 
                        required={!newRaffle.indeterminate_date}
                        disabled={newRaffle.indeterminate_date}
                        value={newRaffle.end_date}
                        onChange={e => setNewRaffle({...newRaffle, end_date: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={newRaffle.indeterminate_date}
                          onChange={e => setNewRaffle({...newRaffle, indeterminate_date: e.target.checked, end_date: e.target.checked ? '' : newRaffle.end_date})}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-bold text-slate-700 uppercase">Data Indeterminada</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">URL da Imagem</label>
                    <input 
                      type="url" 
                      value={newRaffle.image_url}
                      onChange={e => setNewRaffle({...newRaffle, image_url: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Compra Mínima (Números)</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={newRaffle.min_purchase_quantity}
                      onChange={e => setNewRaffle({...newRaffle, min_purchase_quantity: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Meta de Arrecadação (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newRaffle.min_revenue_goal}
                      onChange={e => setNewRaffle({...newRaffle, min_revenue_goal: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Meta de Vendas (%)</label>
                    <input 
                      type="number" 
                      min="0" max="100"
                      value={newRaffle.min_sales_percent}
                      onChange={e => setNewRaffle({...newRaffle, min_sales_percent: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="0"
                    />
                  </div>

                  <div className="md:col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        Pacotes de Compra (Opcional)
                      </h3>
                      <button 
                        type="button"
                        onClick={() => setNewRaffle({
                          ...newRaffle, 
                          packages: [...newRaffle.packages, { id: Math.random().toString(36).substr(2, 9), quantity: 1, price: 0, highlight: false, active: true }]
                        })}
                        className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Pacote
                      </button>
                    </div>

                    <div className="space-y-4">
                      {newRaffle.packages.map((pkg, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white rounded-2xl border border-slate-200 relative group">
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qtd Números</label>
                            <input 
                              type="number"
                              min="1"
                              value={pkg.quantity}
                              onChange={e => {
                                const newPackages = [...newRaffle.packages];
                                newPackages[idx].quantity = parseInt(e.target.value);
                                setNewRaffle({...newRaffle, packages: newPackages});
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Preço (R$)</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={pkg.price}
                              onChange={e => {
                                const newPackages = [...newRaffle.packages];
                                newPackages[idx].price = parseFloat(e.target.value);
                                setNewRaffle({...newRaffle, packages: newPackages});
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="md:col-span-3 flex items-center gap-4 pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={pkg.highlight}
                                onChange={e => {
                                  const newPackages = [...newRaffle.packages];
                                  // Only one highlight allowed
                                  if (e.target.checked) {
                                    newPackages.forEach(p => p.highlight = false);
                                  }
                                  newPackages[idx].highlight = e.target.checked;
                                  setNewRaffle({...newRaffle, packages: newPackages});
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Destaque</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={pkg.active}
                                onChange={e => {
                                  const newPackages = [...newRaffle.packages];
                                  newPackages[idx].active = e.target.checked;
                                  setNewRaffle({...newRaffle, packages: newPackages});
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Ativo</span>
                            </label>
                          </div>
                          <div className="md:col-span-3 flex items-end justify-end pb-2">
                            <button 
                              type="button"
                              onClick={() => {
                                const newPackages = newRaffle.packages.filter((_, i) => i !== idx);
                                setNewRaffle({...newRaffle, packages: newPackages});
                              }}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {newRaffle.packages.length === 0 && (
                        <p className="text-sm text-slate-400 italic text-center py-4">Nenhum pacote adicionado ainda.</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        Premiação
                      </h3>
                      <button 
                        type="button"
                        onClick={() => setNewRaffle({
                          ...newRaffle, 
                          prizes: [...newRaffle.prizes, { position: newRaffle.prizes.length + 1, value: '', description: '' }]
                        })}
                        className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Prêmio
                      </button>
                    </div>

                    <div className="space-y-4">
                      {newRaffle.prizes.map((prize, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white rounded-2xl border border-slate-200 relative group">
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Posição</label>
                            <input 
                              type="number"
                              value={prize.position}
                              onChange={e => {
                                const newPrizes = [...newRaffle.prizes];
                                newPrizes[idx].position = parseInt(e.target.value);
                                setNewRaffle({...newRaffle, prizes: newPrizes});
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Prêmio/Valor</label>
                            <input 
                              type="text"
                              value={prize.value}
                              onChange={e => {
                                const newPrizes = [...newRaffle.prizes];
                                newPrizes[idx].value = e.target.value;
                                setNewRaffle({...newRaffle, prizes: newPrizes});
                              }}
                              placeholder="Ex: iPhone 15 Pro"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="md:col-span-5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descrição (Opcional)</label>
                            <input 
                              type="text"
                              value={prize.description}
                              onChange={e => {
                                const newPrizes = [...newRaffle.prizes];
                                newPrizes[idx].description = e.target.value;
                                setNewRaffle({...newRaffle, prizes: newPrizes});
                              }}
                              placeholder="Ex: Cor Titânio Natural"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="md:col-span-1 flex items-end justify-center pb-2">
                            <button 
                              type="button"
                              onClick={() => {
                                const newPrizes = newRaffle.prizes.filter((_, i) => i !== idx);
                                setNewRaffle({...newRaffle, prizes: newPrizes});
                              }}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {newRaffle.prizes.length === 0 && (
                        <p className="text-sm text-slate-400 italic text-center py-4">Nenhum prêmio adicionado ainda.</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Configurações Visuais (Fake)
                    </h3>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Porcentagem de Progresso (%)</label>
                      <input 
                        type="range" min="0" max="100"
                        value={newRaffle.progress_percent}
                        onChange={e => setNewRaffle({...newRaffle, progress_percent: parseInt(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="text-right text-xs font-bold text-primary mt-1">{newRaffle.progress_percent}%</div>
                    </div>
                  </div>

                  <div className="md:col-span-2 p-4 bg-red-50 rounded-2xl border border-red-100 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-red-900 flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        Promoção Mega Gatilho
                      </h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={newRaffle.promotion.active}
                          onChange={e => setNewRaffle({...newRaffle, promotion: {...newRaffle.promotion, active: e.target.checked}})}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>
                    
                    {newRaffle.promotion.active && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-red-700 uppercase mb-1">Label da Promoção</label>
                          <input 
                            type="text"
                            value={newRaffle.promotion.label}
                            onChange={e => setNewRaffle({...newRaffle, promotion: {...newRaffle.promotion, label: e.target.value}})}
                            className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none focus:ring-2 focus:ring-red-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-red-700 uppercase mb-1">Qtd. Números no Pacote</label>
                          <input 
                            type="number"
                            value={newRaffle.promotion.package_quantity}
                            onChange={e => setNewRaffle({...newRaffle, promotion: {...newRaffle.promotion, package_quantity: parseInt(e.target.value)}})}
                            className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none focus:ring-2 focus:ring-red-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-red-700 uppercase mb-1">Preço Promocional (R$)</label>
                          <input 
                            type="number" step="0.01"
                            value={newRaffle.promotion.package_price}
                            onChange={e => setNewRaffle({...newRaffle, promotion: {...newRaffle.promotion, package_price: parseFloat(e.target.value)}})}
                            className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none focus:ring-2 focus:ring-red-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-red-700 uppercase mb-1">Data Início</label>
                          <input 
                            type="date"
                            value={newRaffle.promotion.start_date}
                            onChange={e => setNewRaffle({...newRaffle, promotion: {...newRaffle.promotion, start_date: e.target.value}})}
                            className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none focus:ring-2 focus:ring-red-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-red-700 uppercase mb-1">Data Fim</label>
                          <input 
                            type="date"
                            value={newRaffle.promotion.end_date}
                            onChange={e => setNewRaffle({...newRaffle, promotion: {...newRaffle.promotion, end_date: e.target.value}})}
                            className="w-full px-3 py-2 rounded-lg border border-red-200 outline-none focus:ring-2 focus:ring-red-500/20"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 flex gap-4">
                  <button type="button" onClick={() => { setShowCreate(false); setEditingId(null); }} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" disabled={creating} className="flex-1 btn-primary py-3 disabled:opacity-50">
                    {creating ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Criar Rifa')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Setup = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const navigate = useNavigate();

  const handleSetup = async () => {
    setStatus('loading');
    try {
      const email = "admin@rifaalice.com";
      const password = "RifaAlice@2026#Secure";
      
      let uid = "";
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          uid = userCredential.user.uid;
        } else {
          throw authErr;
        }
      }
      
      await setDoc(doc(db, "users", uid), {
        email,
        role: 'admin',
        created_at: new Date().toISOString()
      }, { merge: true });

      setStatus('success');
      setTimeout(() => navigate('/admin/login'), 2000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full card p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Configuração Inicial</h1>
        <p className="text-slate-600 mb-8">Clique no botão abaixo para criar a conta de administrador padrão.</p>
        
        {status === 'idle' && <button onClick={handleSetup} className="btn-primary w-full">Criar Conta Admin</button>}
        {status === 'loading' && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>}
        {status === 'success' && <div className="text-secondary font-bold">Admin criado! Redirecionando...</div>}
        {status === 'error' && <div className="text-red-600 font-bold">Erro: Admin já existe ou falha no servidor.</div>}

        <div className="mt-8 p-4 bg-slate-100 rounded-xl text-left text-sm space-y-2">
          <p><strong>Usuário:</strong> admin</p>
          <p><strong>Senha:</strong> RifaAlice@2026#Secure</p>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Consultation States
  const [showConsult, setShowConsult] = useState(false);
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [consultResult, setConsultResult] = useState<any>(null);
  const [consulting, setConsulting] = useState(false);

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsulting(true);
    setConsultResult(null);
    try {
      const normalizedPhone = phone.replace(/\D/g, '');
      const normalizedCpf = cpf.replace(/\D/g, '');
      
      const res = await fetch('/api/consultar-numeros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          whatsapp: normalizedPhone ? String(normalizedPhone) : undefined,
          cpf: normalizedCpf ? String(normalizedCpf) : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setConsultResult(data);
      } else {
        alert(data.message || "Nenhuma compra encontrada");
      }
    } catch (err: any) {
      console.error("Erro de conexão:", err.message || err);
      if (err.message?.includes('Quota exceeded') || err.toString().includes('Quota exceeded')) {
        alert("Limite de consultas atingido para hoje. Por favor, tente novamente mais tarde.");
      } else {
        alert("Erro de conexão.");
      }
    } finally {
      setConsulting(false);
    }
  };

  const copyPix = (code: string) => {
    navigator.clipboard.writeText(code);
    alert("Código PIX copiado!");
  };

  useEffect(() => {
    console.log("App mounted, checking auth state...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ email: firebaseUser.email!, role: userDoc.data().role });
          } else {
            console.warn("User document not found for UID:", firebaseUser.uid);
            setUser({ email: firebaseUser.email!, role: 'client' }); // Default to client if doc missing
          }
        } catch (err: any) {
          console.error("Error fetching user document:", err.message || err);
          if (err.code === 'permission-denied') {
            console.error("Firestore permission denied. Please check your security rules.");
          }
          setUser({ email: firebaseUser.email!, role: 'client' });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (loading) return null;

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar user={user} onLogout={handleLogout} setShowConsult={setShowConsult} />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home setShowConsult={setShowConsult} />} />
            <Route path="/raffle/:id" element={<RaffleDetails />} />
            <Route path="/setup" element={<Setup />} />
            <Route 
              path="/admin/login" 
              element={user?.role === 'admin' ? <Navigate to="/admin" /> : <AdminLogin onLogin={handleLogin} />} 
            />
            <Route 
              path="/admin" 
              element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/admin/login" />} 
            />
          </Routes>
        </main>

        <footer className="bg-white border-t border-slate-100 py-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex justify-center space-x-6 mb-8">
              <a href="#" className="text-slate-400 hover:text-primary transition-colors"><Instagram /></a>
              <a href="#" className="text-slate-400 hover:text-primary transition-colors"><Phone /></a>
            </div>
            <p className="text-slate-500 text-sm">© 2026 Rifa Alice. Todos os direitos reservados.</p>
            <p className="text-slate-400 text-xs mt-2">Sistema profissional de rifas online.</p>
          </div>
        </footer>
      </div>

      {/* Consult Modal */}
      <AnimatePresence>
        {showConsult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConsult(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-8 sm:p-10 text-center">
                {!consultResult ? (
                  <div className="space-y-8">
                    <div>
                      <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8" />
                      </div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Consultar meus números</h2>
                      <p className="text-slate-500 font-medium mt-2">Informe seus dados para localizar suas compras</p>
                    </div>

                    <form onSubmit={handleConsult} className="space-y-6 text-left">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">WhatsApp</label>
                          <div className="relative group">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                            <input 
                              type="tel" 
                              value={phone}
                              onChange={e => setPhone(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold text-lg"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>

                        <div className="relative flex items-center py-2">
                          <div className="flex-grow border-t border-slate-100"></div>
                          <span className="flex-shrink mx-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">ou</span>
                          <div className="flex-grow border-t border-slate-100"></div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">CPF</label>
                          <div className="relative group">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                            <input 
                              type="text" 
                              value={cpf}
                              onChange={e => setCpf(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold text-lg"
                              placeholder="000.000.000-00"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 pt-4">
                        <button 
                          type="submit" 
                          disabled={consulting || (!phone && !cpf)} 
                          className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 hover:shadow-primary/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
                        >
                          {consulting ? (
                            <>
                              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Buscando...</span>
                            </>
                          ) : (
                            <>
                              <Search className="w-6 h-6" />
                              <span>Consultar Agora</span>
                            </>
                          )}
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => setShowConsult(false)}
                          className="w-full py-4 text-base font-black text-slate-400 hover:text-slate-900 transition-all flex items-center justify-center gap-2"
                        >
                          <X className="w-5 h-5" />
                          Voltar para a rifa
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div>
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Ticket className="w-8 h-8" />
                      </div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Resultado da Busca</h2>
                      <p className="text-slate-500 font-medium mt-2">Encontramos os seguintes números para você</p>
                    </div>

                    <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar text-left">
                      <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                          <UserIcon className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente Localizado</p>
                          <p className="text-lg font-black text-slate-900">{consultResult.name}</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-1">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Meus Números Pagos</p>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-lg">
                              {consultResult.confirmed.length}
                            </span>
                          </div>
                          {consultResult.confirmed.length === 0 ? (
                            <div className="p-8 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                              <p className="text-sm text-slate-400 font-bold">Nenhum número pago encontrado.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                              {consultResult.confirmed.map((n: number) => (
                                <div key={n} className="aspect-square flex items-center justify-center bg-emerald-50 text-emerald-600 text-base font-black rounded-2xl border-2 border-emerald-100 shadow-sm">
                                  {n.toString().padStart(2, '0')}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 pt-6 border-t border-slate-100">
                      <button 
                        onClick={() => setShowConsult(false)} 
                        className="w-full bg-primary text-white py-5 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 hover:shadow-primary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                      >
                        <Ticket className="w-6 h-6" />
                        Voltar para a rifa
                      </button>
                      <button 
                        onClick={() => { setConsultResult(null); setPhone(''); setCpf(''); }} 
                        className="w-full py-2 text-sm font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-widest"
                      >
                        Consultar outro número
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Router>
  );
}
