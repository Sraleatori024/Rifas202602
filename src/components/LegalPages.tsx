import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  FileText, 
  CreditCard, 
  HelpCircle, 
  Mail, 
  Cookie, 
  Info, 
  ChevronLeft,
  CheckCircle,
  MessageSquare,
  MapPin,
  Calendar,
  DollarSign,
  UserCheck
} from 'lucide-react';

const CardHeader = ({ title, subtitle, icon: Icon, date }: { title: string, subtitle: string, icon: any, date: string }) => (
  <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-8 md:p-12 rounded-t-[2.5rem] relative overflow-hidden">
    <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 opacity-10 pointer-events-none">
      <Icon className="w-96 h-96" />
    </div>
    <div className="relative z-10 space-y-4">
      <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl">
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-3xl md:text-5xl font-black tracking-tight">{title}</h1>
      <p className="text-white/80 font-medium text-lg max-w-2xl">{subtitle}</p>
      <div className="pt-2 text-xs text-white/60 font-mono">Última atualização: {date}</div>
    </div>
  </div>
);

const NavLayout = ({ children, activeId }: { children: React.ReactNode, activeId: string }) => {
  const menuItems = [
    { id: 'termos', label: 'Termos de Uso', path: '/termos', icon: FileText },
    { id: 'privacidade', label: 'Política de Privacidade', path: '/privacidade', icon: ShieldCheck },
    { id: 'pagamentos', label: 'Política de Pagamentos', path: '/pagamentos', icon: CreditCard },
    { id: 'regras', label: 'Regras da Campanha', path: '/regras', icon: Info },
    { id: 'cookies', label: 'Política de Cookies', path: '/cookies', icon: Cookie },
    { id: 'faq', label: 'Perguntas Frequentes', path: '/faq', icon: HelpCircle },
    { id: 'contato', label: 'Contato', path: '/contato', icon: Mail },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all group">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Voltar para o Início</span>
          </Link>
          <span className="text-xs font-black text-primary uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-full">
            Chance Club
          </span>
        </div>

        {/* Desktop Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm sticky top-24 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 px-3">Central Legal & Ajuda</p>
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeId === item.id;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                        isActive 
                          ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Document Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TermosDeUso = () => {
  return (
    <NavLayout activeId="termos">
      <CardHeader 
        title="Termos de Uso" 
        subtitle="Entenda as regras de utilização da plataforma Chance Club e os termos que regem nossa parceria."
        icon={FileText}
        date="05 de Julho de 2026"
      />
      <div className="p-8 md:p-12 prose prose-slate max-w-none space-y-8 text-slate-600">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">1. Apresentação da Plataforma</h2>
          <p>
            Bem-vindo ao <strong>Chance Club</strong>! A nossa plataforma é uma ferramenta profissional de marketing, publicidade e entretenimento que viabiliza a realização de campanhas promocionais, sorteios autorizados e distribuição de prêmios especiais aos seus membros.
          </p>
          <p>
            Ao acessar o nosso site e participar das campanhas oferecidas, você declara estar ciente e concordar integralmente com as regras estabelecidas nestes Termos de Uso, bem como nas nossas demais políticas.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">2. Regras para Utilização do Site</h2>
          <p>
            O acesso ao site é livre para pessoas físicas maiores de 18 anos ou plenamente capazes conforme a legislação civil em vigor. Ao se cadastrar ou adquirir participações, você declara solenemente preencher os requisitos de idade e capacidade civil.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Você se compromete a utilizar a plataforma de boa-fé, respeitando as normas de ética e civilidade.</li>
            <li>É expressamente proibido o uso de qualquer sistema automatizado (robôs, scripts, crawlers) para manipular o fluxo de compras ou obter vantagens indevidas.</li>
            <li>Qualquer tentativa de sobrecarregar a infraestrutura técnica do Chance Club será tratada como violação grave de segurança.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">3. Responsabilidade pelas Informações Cadastradas</h2>
          <p>
            O usuário é o único e exclusivo responsável pela veracidade, exatidão e atualização de todos os dados cadastrados na plataforma.
          </p>
          <div className="p-5 bg-amber-50 border-l-4 border-amber-500 rounded-r-2xl">
            <p className="text-sm text-slate-700 font-medium">
              <strong>Importante:</strong> Informações de contato (como número de WhatsApp) e identificação (como CPF) são fundamentais para a apuração de ganhadores e entrega de prêmios. O preenchimento incorreto ou falso pode resultar na impossibilidade de recebimento da premiação.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">4. Proibição de Fraudes e Uso Ilícito</h2>
          <p>
            A segurança e a integridade de nossas campanhas são prioridades absolutas. São consideradas fraudes e motivos para banimento imediato do sistema:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>A utilização de dados de terceiros (como nomes, telefones ou CPFs de outras pessoas) sem prévia e expressa autorização legal.</li>
            <li>O uso de meios de pagamento robóticos, cartões clonados ou transações PIX simuladas ou falsificadas.</li>
            <li>Qualquer tentativa de engenharia reversa do código, invasão do banco de dados ou manipulação direta dos resultados.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">5. Cancelamento de Participações</h2>
          <p>
            O Chance Club reserva-se o direito de cancelar, anular ou desqualificar participações e transações nas seguintes situações:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Identificação de dados cadastrais inconsistentes, incompletos ou comprovadamente falsificados.</li>
            <li>Atraso ou falha na compensação do pagamento associado aos números selecionados.</li>
            <li>Indícios claros de conluio entre participantes para tentar burlar as mecânicas das campanhas promocionais.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">6. Contato e Atualizações</h2>
          <p>
            Para quaisquer esclarecimentos, críticas ou sugestões relacionadas a estes Termos, utilize nosso canal oficial de atendimento disponível na página de <Link to="/contato" className="text-primary hover:underline font-bold">Contato</Link>.
          </p>
          <p>
            Estes termos poderão ser revisados periodicamente para se adequarem a novas práticas comerciais ou exigências legais. As alterações entram em vigor imediatamente após sua publicação neste endereço.
          </p>
        </section>
      </div>
    </NavLayout>
  );
};

export const PoliticaPrivacidade = () => {
  return (
    <NavLayout activeId="privacidade">
      <CardHeader 
        title="Política de Privacidade" 
        subtitle="Sua privacidade é valiosa. Conheça detalhadamente as nossas diretrizes de coleta, uso e proteção de dados."
        icon={ShieldCheck}
        date="05 de Julho de 2026"
      />
      <div className="p-8 md:p-12 prose prose-slate max-w-none space-y-8 text-slate-600">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">1. Princípios de Proteção de Dados</h2>
          <p>
            No <strong>Chance Club</strong>, a proteção das suas informações pessoais é levada extremamente a sério. Nossas práticas de tratamento de dados são baseadas em transparência, segurança técnica e respeito aos direitos do cidadão.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">2. Quais dados são coletados?</h2>
          <p>
            Para possibilitar a participação em nossas campanhas e a realização segura de transações, coletamos as seguintes informações:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Nome Completo:</strong> Para identificação civil do participante e do eventual ganhador.</li>
            <li><strong>Número de WhatsApp:</strong> Principal meio de comunicação, envio de notificações de compras e contato em caso de premiação.</li>
            <li><strong>CPF:</strong> Para fins fiscais, prevenção a fraudes de identidade e garantia de que cada prêmio seja entregue ao portador correto da identificação.</li>
            <li><strong>Instagram (opcional):</strong> Para divulgação transparente de ganhadores nas redes sociais, quando autorizado pelo participante.</li>
            <li><strong>Dados de Conexão:</strong> Endereço IP, tipo de navegador e tempo de acesso, exclusivamente para fins de auditoria de segurança técnica.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">3. Finalidade do Tratamento dos Dados</h2>
          <p>
            Os dados coletados são utilizados estritamente para as seguintes finalidades:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Processamento das transações de pagamento via PIX através de nossos parceiros integrados.</li>
            <li>Atribuição de números de participação nas campanhas de sorteio vigentes.</li>
            <li>Entrada em contato direta e ágil com participantes sorteados.</li>
            <li>Auditoria de conformidade para evitar cadastros repetidos com CPFs inválidos ou falsificados.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">4. Compartilhamento de Informações</h2>
          <p>
            O Chance Club não vende, aluga ou cede seus dados pessoais a terceiros sob nenhuma hipótese comercial. Seus dados são compartilhados exclusivamente com:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Intermediadores de Pagamento (SyncPayments):</strong> Para a emissão e validação do PIX de cobrança.</li>
            <li><strong>Autoridades Governamentais:</strong> Quando houver determinação judicial ou obrigação de cumprimento legal de prestação de contas.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">5. Medidas de Segurança Adotadas</h2>
          <p>
            Nossa plataforma adota padrões de segurança física, eletrônica e gerencial de nível elevado:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Criptografia SSL/TLS em todas as comunicações de dados.</li>
            <li>Armazenamento de banco de dados em servidores em nuvem de alta segurança e disponibilidade (Firebase / Google Cloud).</li>
            <li>Mecanismos de controle interno para que apenas equipe autorizada acesse as informações cadastrais para processamento de prêmios.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">6. Direitos do Usuário</h2>
          <p>
            Você possui direitos plenos em relação aos seus dados, podendo solicitar a qualquer momento:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Confirmação da existência do tratamento e acesso detalhado aos dados que mantemos.</li>
            <li>Correção de informações incompletas ou desatualizadas.</li>
            <li>Exclusão permanente dos seus dados de nosso banco de dados histórico (observadas as exigências de guarda legal para conformidade de sorteios anteriores).</li>
          </ul>
          <p>
            Para exercer seus direitos, envie um e-mail com a sua solicitação para a nossa central através do formulário na página de <Link to="/contato" className="text-primary hover:underline font-bold">Contato</Link>.
          </p>
        </section>
      </div>
    </NavLayout>
  );
};

export const PoliticaPagamentos = () => {
  return (
    <NavLayout activeId="pagamentos">
      <CardHeader 
        title="Política de Pagamentos" 
        subtitle="Entenda as regras de faturamento, confirmação de PIX, estornos e segurança financeira."
        icon={CreditCard}
        date="05 de Julho de 2026"
      />
      <div className="p-8 md:p-12 prose prose-slate max-w-none space-y-8 text-slate-600">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">1. Métodos de Pagamento Aceitos</h2>
          <p>
            Para proporcionar a maior comodidade, agilidade e segurança jurídica aos nossos clientes, o <strong>Chance Club</strong> utiliza exclusivamente o sistema de pagamento instantâneo <strong>PIX</strong> (Banco Central do Brasil).
          </p>
          <p>
            As cobranças são geradas em tempo real com QR Codes ou códigos Copie e Cole dinâmicos, garantindo a liquidação imediata da transação.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">2. Confirmação da Participação</h2>
          <p>
            Uma participação em qualquer campanha promocional promovida pela plataforma é considerada <strong>oficialmente confirmada</strong> somente após o recebimento da notificação automática de liquidação bancária enviada pela nossa instituição parceira parceira de pagamentos (SyncPayments).
          </p>
          <div className="p-5 bg-blue-50 border-l-4 border-blue-500 rounded-r-2xl">
            <p className="text-sm text-slate-700 font-medium">
              <strong>Tempo de Compensação:</strong> O processamento do PIX é instantâneo. Assim que concluído em seu banco, o sistema Chance Club recebe a notificação e reserva os seus números permanentemente.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">3. Expiração de Transações Pendentes</h2>
          <p>
            Os códigos de PIX gerados possuem um tempo de validade específico (geralmente de 15 a 30 minutos). Caso o pagamento não seja concluído e confirmado dentro desse intervalo:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>A transação pendente será automaticamente cancelada por expiração de tempo.</li>
            <li>Os números temporariamente reservados para você serão imediatamente liberados no sistema para que outros participantes possam adquiri-los.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">4. Pagamentos Duplicados ou Não Identificados</h2>
          <p>
            Se houver qualquer inconsistência de rede bancária que resulte em cobrança duplicada ou em pagamentos efetuados após a expiração do tempo de validade da cobrança:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Nossa equipe financeira efetuará o estorno (reembolso) integral do valor excedente diretamente para a conta bancária de origem que realizou o PIX.</li>
            <li>O estorno é feito em um prazo médio de 24 a 48 horas úteis após a validação do caso pelo nosso suporte ao cliente.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">5. Suporte de Faturamento e Meios de Contato</h2>
          <p>
            Caso você tenha efetuado um pagamento e sua compra não tenha sido atualizada para "Confirmada" ou "Paga" em nosso sistema dentro de alguns minutos, pedimos que entre em contato imediatamente enviando o comprovante de PIX completo (contendo o ID da Transação do Banco Central) para o nosso canal de suporte em nossa página de <Link to="/contato" className="text-primary hover:underline font-bold">Contato</Link>.
          </p>
        </section>
      </div>
    </NavLayout>
  );
};

export const RegrasCampanha = () => {
  // Configurable template for campaign parameters
  const campaignData = {
    name: "Mega Sorteio de Boas-Vindas Chance Club",
    prize: "iPhone 15 Pro Max 256GB Lacrado + R$ 2.000,00 via PIX direto na conta do ganhador",
    totalNumbers: 100000,
    pricePerNumber: "R$ 0,50",
    drawCriteria: "Realizado eletronicamente de forma segura através do sistema próprio da nossa plataforma, garantindo aleatoriedade e integridade.",
    contactDeadline: "72 horas úteis",
    deliveryProcedure: "Entrega física realizada via transportadora de confiança com seguro de valor declarado ou opção de receber o valor equivalente em dinheiro via transferência eletrônica PIX.",
  };

  return (
    <NavLayout activeId="regras">
      <CardHeader 
        title="Regras da Campanha" 
        subtitle="Regulamento oficial, critérios de premiação e mecânica técnica dos nossos sorteios promocionais."
        icon={Info}
        date="05 de Julho de 2026"
      />
      <div className="p-8 md:p-12 prose prose-slate max-w-none space-y-8 text-slate-600">
        
        {/* Highlighted Campaign Card */}
        <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 rounded-[2rem] border border-slate-200/60 space-y-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 bg-primary rounded-full"></span>
            Campanha Ativa Atualmente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nome do Sorteio</p>
              <p className="text-lg font-black text-slate-900 mt-1">{campaignData.name}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Premiação Principal</p>
              <p className="text-lg font-black text-emerald-600 mt-1">{campaignData.prize}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Quantidade de Números</p>
              <p className="text-lg font-black text-slate-900 mt-1">{campaignData.totalNumbers.toLocaleString('pt-BR')} números disponíveis</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Valor Unitário do Número</p>
              <p className="text-lg font-black text-primary mt-1">{campaignData.pricePerNumber}</p>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">1. Mecânica de Participação</h2>
          <p>
            A participação em nossas campanhas é realizada exclusivamente pela aquisição eletrônica das cotas de números disponíveis em nosso site oficial.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Modo Manual:</strong> O participante visualiza as dezenas disponíveis e escolhe individualmente os números que deseja adquirir.</li>
            <li><strong>Modo Automático:</strong> O participante seleciona um pacote de cotas e o algoritmo gera números aleatórios exclusivos em nosso sistema para compor sua participação de forma instantânea.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">2. Critérios de Realização do Sorteio</h2>
          <p>
            A transparência é a nossa prioridade. Todos os sorteios promovidos no Chance Club são realizados eletronicamente pela própria plataforma:
          </p>
          <p className="font-medium text-slate-800">
            Mecânica de Apuração: {campaignData.drawCriteria}
          </p>
          <p>
            Utilizamos um algoritmo de geração aleatória seguro e auditado que seleciona eletronicamente os números vencedores entre todos as participações confirmadas, assegurando que todos tenham as mesmas chances de ganhar com auditoria interna do sistema.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">3. Divulgação do Resultado</h2>
          <p>
            Os números vencedores e a identificação do participante ganhador (omitindo dígitos centrais de telefone e CPF para garantir privacidade de dados) são amplamente publicados em nossa página inicial oficial e divulgados através das redes sociais da plataforma logo após a validação oficial do sorteio.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">4. Prazo de Contato e Entrega</h2>
          <p>
            Nossa equipe entrará em contato com o felizardo ganhador em um prazo máximo de <strong>{campaignData.contactDeadline}</strong> através do número de WhatsApp fornecido no momento do cadastro.
          </p>
          <p>
            <strong>Procedimento de Entrega:</strong> {campaignData.deliveryProcedure}
          </p>
          <div className="p-5 bg-red-50 border-l-4 border-red-500 rounded-r-2xl">
            <p className="text-sm text-slate-700 font-medium">
              <strong>Aviso de Validade:</strong> Se no momento da conferência dos dados do ganhador for identificado que as regras básicas da plataforma foram infringidas (como CPF falso ou participação irregular), o prêmio será repassado para o participante portador do segundo número sorteado na sequência regulamentar de apuração.
            </p>
          </div>
        </section>
      </div>
    </NavLayout>
  );
};

export const PoliticaCookies = () => {
  return (
    <NavLayout activeId="cookies">
      <CardHeader 
        title="Política de Cookies" 
        subtitle="Entenda como os cookies de navegação nos ajudam a otimizar sua experiência e manter suas preferências salvas."
        icon={Cookie}
        date="05 de Julho de 2026"
      />
      <div className="p-8 md:p-12 prose prose-slate max-w-none space-y-8 text-slate-600">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">1. O que são Cookies?</h2>
          <p>
            Cookies são pequenos arquivos de texto armazenados no seu computador ou dispositivo móvel quando você visita determinados sites. Eles são amplamente utilizados para fazer os sites funcionarem de forma mais eficiente, salvar preferências do usuário e fornecer informações estatísticas aos proprietários da plataforma.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">2. Cookies que Utilizados</h2>
          <p>
            No <strong>Chance Club</strong>, classificamos os cookies de acordo com sua funcionalidade:
          </p>
          <div className="space-y-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-900 text-sm">Cookies Necessários (Essenciais)</p>
              <p className="text-xs text-slate-500 mt-1">Esses cookies são fundamentais para navegar pela plataforma e utilizar recursos básicos, como manter sua sessão ativa ou salvar a aceitação de termos em nosso site para que o modal de privacidade não apareça repetidamente.</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-900 text-sm">Cookies de Desempenho e Análise</p>
              <p className="text-xs text-slate-500 mt-1">Coletam dados estatísticos de navegação de forma anônima, permitindo-nos identificar quais páginas possuem mais acessos e como podemos aprimorar a usabilidade e a velocidade de carregamento do sistema.</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-900 text-sm">Cookies de Preferência do Usuário</p>
              <p className="text-xs text-slate-500 mt-1">Lembram escolhas feitas pelo usuário (como idioma ou preferências de exibição de campanhas) para personalizar suas visitas subsequentes.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">3. Gerenciamento de Preferências</h2>
          <p>
            A maioria dos navegadores permite que você configure se deseja aceitar, recusar ou apagar cookies a qualquer momento. Caso decida desativar os cookies essenciais para o funcionamento do site, observe que algumas funcionalidades avançadas (como salvamento automático de histórico de compras localmente) podem não operar corretamente.
          </p>
        </section>
      </div>
    </NavLayout>
  );
};

export const PerguntasFrequentes = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "O que é o Chance Club e como faço para participar das campanhas?",
      a: "O Chance Club é uma plataforma profissional de campanhas promocionais e sorteios. Para participar, basta navegar pelas campanhas ativas na nossa página inicial, preencher seu nome e WhatsApp, escolher seus números (manualmente ou por meio dos pacotes automáticos) e realizar o pagamento seguro via PIX."
    },
    {
      q: "Como o vencedor é definido?",
      a: "Para garantir total transparência e integridade, o sorteio é realizado diretamente pelo sistema seguro da nossa plataforma, que escolhe eletronicamente e de forma 100% aleatória o número vencedor dentre todas as participações adquiridas e confirmadas."
    },
    {
      q: "Como posso conferir meus números comprados?",
      a: "Basta clicar no botão 'Consultar meus números' no menu de navegação, digitar o número de WhatsApp ou CPF cadastrado no momento da compra e o sistema exibirá na hora todo o seu histórico de cotas com status confirmado."
    },
    {
      q: "O que acontece se eu esquecer de pagar o PIX gerado?",
      a: "As reservas temporárias via PIX duram de 15 a 30 minutos. Caso o pagamento não seja concluído nesse prazo, os números expiram no sistema e são automaticamente liberados para que outros membros do clube os adquiram."
    },
    {
      q: "Como recebo o prêmio se eu for sorteado?",
      a: "Entramos em contato direto pelo WhatsApp ou telefone registrado na compra no prazo de até 72 horas úteis. O prêmio é enviado via transportadora com seguro de valor ou transferido via PIX para sua conta de preferência."
    }
  ];

  return (
    <NavLayout activeId="faq">
      <CardHeader 
        title="Perguntas Frequentes" 
        subtitle="Encontre respostas rápidas para as principais dúvidas sobre participação, sorteios e faturamento."
        icon={HelpCircle}
        date="05 de Julho de 2026"
      />
      <div className="p-8 md:p-12 space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Dúvidas Frequentes (FAQ)</h2>
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div 
                key={idx} 
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50/50 transition-colors"
                >
                  <span className="text-base font-bold text-slate-900 pr-4">{faq.q}</span>
                  <ChevronLeft className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : '-rotate-90'}`} />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </NavLayout>
  );
};

export const Contato = () => {
  const [enviado, setEnviado] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnviado(true);
    setFormData({ name: '', email: '', message: '' });
    setTimeout(() => {
      setEnviado(false);
    }, 5000);
  };

  return (
    <NavLayout activeId="contato">
      <CardHeader 
        title="Contato & Suporte" 
        subtitle="Dúvidas, reclamações, sugestões ou suporte técnico? Preencha o formulário para falar conosco."
        icon={Mail}
        date="05 de Julho de 2026"
      />
      <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Como podemos ajudar?</h2>
            <p className="text-slate-500 mt-2 leading-relaxed">
              Nosso time de suporte especializado está disponível para lhe atender prontamente de segunda a sexta-feira, das 09h às 18h (horário de Brasília).
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">E-mail de Contato</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">suporte@chanceclub.com</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">WhatsApp de Atendimento</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">+55 (11) 99999-9999</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sede da Plataforma</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">Avenida Paulista, 1000 - São Paulo, SP</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-slate-50/50 p-6 sm:p-8 rounded-[2rem] border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 mb-6">Envie uma Mensagem</h3>
          
          {enviado ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-lg">Mensagem Enviada!</h4>
              <p className="text-sm text-emerald-700/80">Obrigado por entrar em contato. Responderemos no seu e-mail cadastrado em breve.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Seu Nome</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Seu E-mail</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="nome@exemplo.com"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Mensagem</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Como podemos lhe ajudar hoje?"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium resize-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all"
              >
                Enviar Mensagem
              </button>
            </form>
          )}
        </div>
      </div>
    </NavLayout>
  );
};
