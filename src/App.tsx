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
  MousePointer2
} from 'lucide-react';
import { cn, User, Raffle, RaffleNumber, DrawResult } from './types';
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
  onSnapshot
} from 'firebase/firestore';

// --- Components ---

const Navbar = ({ user, onLogout }: { user: User | null, onLogout: () => void }) => {
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

          <div className="md:hidden flex items-center">
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

const Home = () => {
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
    }, (err) => {
      console.error("Error fetching raffles:", err);
      if (err.code === 'permission-denied') {
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
          className="text-lg text-slate-600 max-w-2xl mx-auto"
        >
          Participe das nossas rifas e concorra a prêmios exclusivos. É rápido, fácil e seguro.
        </motion.p>
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
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-500">Progresso</span>
                    <span className="text-primary font-bold">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="bg-gradient-to-r from-primary to-blue-400 h-full rounded-full"
                    />
                  </div>
                  
                  {isPromoActive && (
                    <p className="text-[10px] text-red-600 font-bold animate-bounce text-center uppercase tracking-wider">
                      Aproveite antes que acabe!
                    </p>
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
  const [buyerInfo, setBuyerInfo] = useState({ name: '', whatsapp: '', instagram: '' });
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Selection, 2: Info, 3: Payment
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
      console.error("Error fetching raffle details:", error);
      setLoading(false);
    });

    const unsubNumbers = onSnapshot(numbersRef, (snapshot) => {
      const nums = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setNumbers(nums.sort((a, b) => a.number - b.number));
      
      const total = nums.length;
      const sold = nums.filter(n => n.status === 'sold').length;
      setStats({ total, sold, available: total - sold });
      setLoading(false);
    }, (error) => {
      console.error("Error fetching numbers:", error);
      setLoading(false);
    });

    return () => {
      unsubRaffle();
      unsubNumbers();
    };
  }, [raffleId]);

  const toggleNumber = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      setSelectedNumbers(prev => [...prev, num]);
    }
  };

  const selectRandom = (count: number) => {
    const available = numbers
      .filter(n => n.status === 'available' && !selectedNumbers.includes(n.number))
      .map(n => n.number);
    
    const shuffled = available.sort(() => 0.5 - Math.random());
    const newSelection = shuffled.slice(0, count);
    
    setSelectedNumbers(prev => [...prev, ...newSelection]);
  };

  const handlePurchase = async () => {
    if (!buyerInfo.name || !buyerInfo.whatsapp) {
      alert("Por favor, preencha nome e WhatsApp.");
      return;
    }

    // Call the secure API for payment simulation
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raffleId,
        numbers: selectedNumbers,
        buyer: buyerInfo
      })
    });

    if (res.ok) {
      setStep(3);
    } else {
      const error = await res.json();
      alert(error.error || "Erro ao processar compra.");
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
            <img src={raffle.image_url || `https://picsum.photos/seed/${raffle.id}/800/600`} className="w-full h-72 object-cover" />
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
              </div>
            </div>
          </div>

          {/* Progress Bar (Fake) */}
          <div className="card p-6 bg-gradient-to-br from-white to-slate-50">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Status da Rifa</h3>
                <p className="text-sm text-slate-500 italic">Aproveite antes que acabe!</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-primary">{progress}%</span>
              </div>
            </div>
            <div className="w-full bg-slate-200 h-6 rounded-full overflow-hidden mb-2 shadow-inner p-1">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="bg-gradient-to-r from-primary via-blue-500 to-primary bg-[length:200%_100%] animate-shimmer h-full rounded-full shadow-lg"
              />
            </div>
          </div>

          {/* Number Selection */}
          {isSoldOut ? (
            <div className="card p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200">
              <X className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-slate-400 uppercase tracking-widest">Esgotado</h3>
              <p className="text-slate-500">Infelizmente todos os números já foram reservados.</p>
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
                      disabled={n.status !== 'available'}
                      onClick={() => toggleNumber(n.number)}
                      className={cn(
                        "aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all",
                        n.status === 'sold' ? "bg-slate-100 text-slate-300 cursor-not-allowed" :
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
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="card p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <UserIcon className="text-primary" />
                Seus Dados
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo *</label>
                  <input 
                    type="text" 
                    value={buyerInfo.name}
                    onChange={e => setBuyerInfo({...buyerInfo, name: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="Como você quer ser chamado?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">WhatsApp *</label>
                  <input 
                    type="text" 
                    value={buyerInfo.whatsapp}
                    onChange={e => setBuyerInfo({...buyerInfo, whatsapp: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Instagram (Opcional)</label>
                  <input 
                    type="text" 
                    value={buyerInfo.instagram}
                    onChange={e => setBuyerInfo({...buyerInfo, instagram: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="@seuusuario"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="card p-8 text-center">
              <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Compra Realizada!</h3>
              <p className="text-slate-600 mb-8">Seus números foram reservados com sucesso. Boa sorte no sorteio!</p>
              <Link to="/" className="btn-primary inline-block">Voltar ao Início</Link>
            </motion.div>
          )}
        </div>

        {/* Right Column: Checkout Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-24">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CreditCard className="text-primary w-5 h-5" />
              Resumo da Compra
            </h3>
            
            <div className="space-y-4 mb-6">
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
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-slate-900 font-bold">Total a pagar:</span>
                <span className="text-2xl font-black text-primary">R$ {(selectedNumbers.length * raffle.price).toFixed(2)}</span>
              </div>
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
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Pagar Agora
                </button>
                <button 
                  onClick={() => setStep(1)}
                  className="w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  Voltar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminLogin = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
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

const AdminDashboard = () => {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRaffle, setNewRaffle] = useState({
    name: '',
    description: '',
    price: 1.00,
    total_numbers: 100,
    end_date: '',
    image_url: '',
    profit_percent: 30,
    progress_percent: 0,
    min_purchase_quantity: 1,
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

  useEffect(() => {
    const q = query(collection(db, "raffles"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRaffles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => {
      console.error("Admin dashboard raffles error:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (raffle: Raffle) => {
    setEditingId(raffle.id);
    setNewRaffle({
      name: raffle.name,
      description: raffle.description,
      price: raffle.price,
      total_numbers: raffle.total_numbers,
      end_date: raffle.end_date,
      image_url: raffle.image_url,
      profit_percent: raffle.profit_percent,
      progress_percent: raffle.progress_percent || 0,
      min_purchase_quantity: raffle.min_purchase_quantity || 1,
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "raffles", editingId), {
          ...newRaffle,
          updated_at: new Date().toISOString()
        });
      } else {
        const raffleData = {
          ...newRaffle,
          active: 1,
          created_at: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, "raffles"), raffleData);
        
        // Generate numbers (batching for performance)
        const batchSize = 500;
        const total = newRaffle.total_numbers;
        
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
        }
      }

      setShowCreate(false);
      setEditingId(null);
      setNewRaffle({
        name: '',
        description: '',
        price: 1.00,
        total_numbers: 100,
        end_date: '',
        image_url: '',
        profit_percent: 30,
        progress_percent: 0,
        min_purchase_quantity: 1,
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
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar rifa.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gerenciar Rifas</h1>
          <p className="text-slate-500">Crie e acompanhe suas campanhas</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nova Rifa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
            <p className="text-2xl font-black text-slate-900">R$ 0,00</p>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold uppercase">Clientes Ativos</p>
            <p className="text-2xl font-black text-slate-900">0</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rifa</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {raffles.map(raffle => (
              <tr key={raffle.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={raffle.image_url || `https://picsum.photos/seed/${raffle.id}/50/50`} className="w-10 h-10 rounded-lg object-cover" />
                    <div>
                      <p className="font-bold text-slate-900">{raffle.name}</p>
                      <p className="text-xs text-slate-500">{raffle.total_numbers} números</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">R$ {raffle.price.toFixed(2)}</td>
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
                    <button onClick={() => handleEdit(raffle)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Settings className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-secondary transition-colors"><Trophy className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Data de Encerramento</label>
                    <input 
                      type="date" 
                      required
                      value={newRaffle.end_date}
                      onChange={e => setNewRaffle({...newRaffle, end_date: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
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
          <p><strong>Email:</strong> admin@rifaalice.com</p>
          <p><strong>Senha:</strong> RifaAlice@2026#Secure</p>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
          console.error("Error fetching user document:", err);
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
        <Navbar user={user} onLogout={handleLogout} />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
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
    </Router>
  );
}
