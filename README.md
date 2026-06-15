# MedSense AI — Copiloto de Triagem Pré-Consulta

> Agente conversacional de triagem clínica com IA generativa, desenvolvido para otimizar o tempo médico e reduzir a assimetria de informação na consulta.

**🔗 Demo ao vivo:** [medsense-ai-1nwi.vercel.app](https://medsense-ai-1nwi.vercel.app)

---

## Sobre o Projeto

O **MedSense AI** é um copiloto de triagem pré-consulta desenvolvido como projeto do **AI Startup Lab — UCB 2025**, no contexto da disciplina de Construção de Startups com IA Generativa e Agentes Autônomos.

O produto resolve um gargalo estrutural do sistema de saúde brasileiro: médicos gastam entre 30% e 50% do tempo de consulta coletando dados básicos de anamnese — informações que poderiam ser levantadas com antecedência por um agente de IA conversacional.

### O que o MedSense AI faz

- Conduz uma **entrevista clínica adaptativa** com o paciente antes da consulta, via interface conversacional
- Gera um **Relatório SOAP estruturado** (Subjetivo, Objetivo, Avaliação, Plano) automaticamente
- Entrega o relatório ao médico com **Red Flags destacados** antes do paciente entrar no consultório
- Detecta **sintomas de emergência** e redireciona o paciente ao SAMU imediatamente
- Permite ao médico **confirmar e arquivar** o relatório simulando injeção no prontuário (PEP)

---

## Problema Central

| Dor | Impacto |
|---|---|
| 10–15 min por consulta gastos em anamnese básica | CRÍTICO |
| Pacientes omitem sintomas por ansiedade ou esquecimento | CRÍTICO |
| Risco de falha de conduta por informação incompleta | CRÍTICO |
| Fadiga cognitiva e burnout médico (46% dos médicos brasileiros — CFM, 2023) | ALTO |
| Atrasos crônicos na agenda da clínica | ALTO |

---

## Funcionalidades

### Fluxo do Paciente
- Entrada por nome e idade
- Chat conversacional com agente clínico (uma pergunta por vez)
- Linguagem natural — aceita coloquialismos e regionalismos brasileiros
- Barra de progresso por etapa da triagem (queixa, duração, intensidade, histórico, família, medicamentos, alergias, hábitos)
- Tela de emergência com link direto para o SAMU em caso de sintoma crítico
- Confirmação de conclusão com resumo humanizado

### Fluxo do Médico
- Dashboard com fila de triagens pendentes
- Estatísticas em tempo real (total de triagens, red flags, emergências)
- Visualização do Relatório SOAP completo por paciente
- Red Flags destacados visualmente
- Cópia do relatório em texto estruturado
- Simulação de envio ao prontuário eletrônico (PEP) com exclusão dos dados temporários (conformidade LGPD)

### Protocolo de Emergência
O agente interrompe imediatamente a entrevista ao detectar sintomas como:
- Dor torácica opressiva
- Dispneia súbita grave
- Parestesia ou perda de força unilateral
- Convulsão ou perda de consciência
- Sangramento intenso
- Ideação suicida ativa

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite |
| Estilização | CSS-in-JS (injetado via `useEffect`) |
| Ícones | Lucide React |
| IA Generativa | Groq API — modelo `llama-3.3-70b-versatile` |
| Persistência (MVP) | localStorage (compartilhado entre abas do mesmo browser) |
| Hospedagem | Vercel |
| Prompt Engineering | Chain-of-Thought com barreira ética explícita contra diagnósticos |

---

## Arquitetura do Prompt Clínico

O agente opera sob um **System Prompt** com regras absolutas:

1. **Nunca emite diagnósticos**, hipóteses diagnósticas ou sugestões de conduta
2. **Uma pergunta por turno** — sem sobrecarga cognitiva no paciente
3. **Validação empática** antes de avançar cada etapa
4. **Protocolo de emergência** com prioridade máxima — interrompe tudo ao detectar risco iminente
5. **Output estruturado em JSON** no padrão SOAP ao concluir a coleta
6. **Linguagem acessível** — aceita qualquer nível educacional

---

## Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Conta no [Groq Console](https://console.groq.com) (gratuito)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/medsense-app.git
cd medsense-app

# Instale as dependências
npm install
```

### Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_GEMINI_API_KEY=gsk_sua_chave_groq_aqui
```

> A variável mantém o nome `VITE_GEMINI_API_KEY` por compatibilidade interna com o código. O provider ativo é o **Groq**.

### Execução

```bash
npm run dev
```

Acesse em `http://localhost:5173`

### Build para produção

```bash
npm run build
```

---

## Deploy

O projeto está configurado para deploy automático na **Vercel**.

1. Importe o repositório em [vercel.com](https://vercel.com)
2. Adicione a variável de ambiente `VITE_GEMINI_API_KEY` com sua chave Groq
3. A Vercel detecta o Vite automaticamente — nenhuma configuração adicional necessária

---

## Limitação do MVP

A comunicação entre o painel do médico e o chat do paciente utiliza `localStorage`, o que significa que **ambos os fluxos precisam ser acessados no mesmo dispositivo e navegador** para a demonstração funcionar.

Em produção real, essa camada seria substituída por um backend com banco de dados (ex: Supabase + PostgreSQL), permitindo comunicação entre dispositivos distintos — conforme descrito na arquitetura técnica completa do projeto.

---

## Conformidade e Ética

- **LGPD:** dados da triagem são tratados como temporários e removidos após confirmação pelo médico
- **CFM Resolução 2.299/2021:** o agente atua estritamente como auxiliar — nunca substitui o julgamento clínico
- **Sem diagnósticos:** barreira ética implementada diretamente no prompt de sistema
- **Protocolo de emergência:** redirecionamento imediato ao SAMU em casos de risco iminente
- **Minimização de dados:** apenas informações necessárias para a triagem são coletadas

---

## Equipe

| Nome | Curso |
|---|---|
| George Lucas do Prado Andrade | Ciência da Computação — UCB |
| Dayarlison Muniz da Nóbrega | Ciência da Computação — UCB |
| Cauã Prado de Menezes | Ciência da Computação — UCB |
| Augusto Xavier de Matos Costa | Ciência da Computação — UCB |
| Matthaus de Sena Barros | Ciência da Computação — UCB |

**Programa:** AI Startup Lab — UCB 2025
**Entrega:** 1 — Problema + Investigação + Oportunidade

---

## Licença

Este projeto foi desenvolvido para fins acadêmicos no contexto do AI Startup Lab da Universidade Católica de Brasília.
