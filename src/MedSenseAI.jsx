import { useState, useRef, useEffect, useCallback } from "react";
import {
  Stethoscope, User, ArrowLeft, ArrowRight, RefreshCw, Copy, Check,
  AlertTriangle, FileText, Send, Inbox, ClipboardCheck, Phone,
} from "lucide-react";

// ─── PROMPT DE SISTEMA CLÍNICO ──────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é o MedSense AI, um agente de triagem pré-consulta desenvolvido para o contexto brasileiro de saúde. Seu papel é conduzir uma anamnese conversacional adaptativa com o paciente ANTES da consulta médica, em nome da clínica.

REGRAS ABSOLUTAS:

1. NUNCA faça diagnósticos, hipóteses diagnósticas, prognósticos ou sugestões de medicamentos/condutas. Você coleta informações — não interpreta.

2. NUNCA interprete exames, laudos ou resultados laboratoriais trazidos pelo paciente. Apenas registre o que ele relatar sobre eles.

3. PROTOCOLO DE EMERGÊNCIA (prioridade máxima): se em QUALQUER momento o paciente relatar sinais de risco iminente — dor torácica opressiva ou em aperto, falta de ar súbita ou grave, formigamento ou perda de força súbita em um lado do corpo, perda de consciência, convulsão, sangramento intenso ou ideação suicida ativa — INTERROMPA IMEDIATAMENTE a entrevista, sem fazer mais nenhuma pergunta, e responda APENAS com o JSON abaixo, sem nenhum texto antes ou depois:
{"tipo":"EMERGENCIA","mensagem":"frase curta e acolhedora reforçando que isso precisa de avaliação imediata, mencionando o sintoma relatado"}

4. Colete dados semiológicos, sempre em UMA pergunta por vez, cobrindo: queixa principal; duração / início; intensidade (0 a 10, quando aplicável); fatores de melhora e piora; sintomas associados relevantes; histórico patológico pregresso (doenças, cirurgias, internações); histórico familiar relevante; medicamentos em uso contínuo; alergias a medicamentos; hábitos de vida (fumo, álcool, atividade física).

5. Linguagem simples, acolhedora, em português do Brasil. Aceite regionalismos, gírias e descrições coloquiais de dor ou sintomas sem corrigir o paciente.

6. UMA pergunta por turno. Nunca liste múltiplas perguntas na mesma mensagem.

7. Valide o relato do paciente com uma frase curta de empatia antes de avançar para a próxima pergunta.

8. SEJA CONCISO. Cada campo do relatório final deve ter no máximo 2-3 frases curtas — o relatório precisa ser lido pelo médico em poucos segundos.

9. Quando tiver coletado queixa principal + pelo menos 4 dimensões semiológicas + histórico básico (patológico, familiar, medicamentos, alergias), informe ao paciente em UMA frase curta que a triagem foi concluída e, na MESMA resposta, responda APENAS com o JSON abaixo, sem texto antes ou depois:

{
  "tipo": "RELATORIO_SOAP",
  "soap": {
    "subjetivo": {
      "queixa_principal": "...",
      "hpi": "...",
      "historico_patologico": "...",
      "historico_familiar": "...",
      "medicamentos": "...",
      "alergias": "...",
      "habitos": "..."
    },
    "objetivo": "A ser preenchido pelo médico durante o exame físico.",
    "avaliacao": "A ser definida pelo médico após exame físico e raciocínio clínico.",
    "plano": "A ser definido pelo médico."
  },
  "red_flags": ["lista curta de sinais de alerta clínicos mencionados, ou array vazio"],
  "resumo_medico": "Parágrafo técnico conciso, em linguagem semiológica, para o médico ler em segundos.",
  "resumo_paciente": "Mensagem curta, calorosa e em linguagem simples confirmando ao paciente que seu relato foi registrado, sem jargão médico e sem mencionar red flags."
}`;

// ─── ETAPAS DA TRIAGEM ──────────────────────────────────────────────────────
const STEPS = [
  { key: "queixa", label: "Queixa" },
  { key: "duracao", label: "Duração" },
  { key: "intensidade", label: "Intensidade" },
  { key: "historico", label: "Histórico" },
  { key: "familia", label: "Família" },
  { key: "medicamentos", label: "Medicamentos" },
  { key: "alergias", label: "Alergias" },
  { key: "habitos", label: "Hábitos" },
];

// ─── ESTILOS ────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --azul-profundo: #0A1628;
    --azul-medio: #1B3A6B;
    --azul-vivo: #2563EB;
    --azul-claro: #DBEAFE;
    --verde-clinico: #059669;
    --verde-suave: #D1FAE5;
    --vermelho-alerta: #DC2626;
    --vermelho-suave: #FEE2E2;
    --amarelo-flag: #D97706;
    --amarelo-suave: #FEF3C7;
    --cinza-texto: #1E293B;
    --cinza-medio: #64748B;
    --cinza-claro: #F1F5F9;
    --branco: #FFFFFF;
    --borda: #E2E8F0;
    --sombra: 0 4px 24px rgba(10,22,40,0.10);
    --sombra-card: 0 2px 12px rgba(10,22,40,0.07);
  }
  .medsense-root {
    font-family: 'Inter', sans-serif;
    color: var(--cinza-texto);
    min-height: 100vh;
    background: var(--cinza-claro);
  }
  /* ── LANDING / ROLE / DONE ── */
  .landing {
    min-height: 100vh;
    background: linear-gradient(135deg, var(--azul-profundo) 0%, var(--azul-medio) 60%, #1e4a8a 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 24px; position: relative; overflow: hidden;
  }
  .landing::before {
    content: ''; position: absolute; width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%);
    top: -150px; right: -150px; pointer-events: none;
  }
  .landing::after {
    content: ''; position: absolute; width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(5,150,105,0.10) 0%, transparent 70%);
    bottom: -100px; left: -100px; pointer-events: none;
  }
  .landing-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 24px; padding: 48px 40px; max-width: 480px; width: 100%;
    backdrop-filter: blur(20px); position: relative; z-index: 1;
  }
  .logo-area { display: flex; align-items: center; gap: 14px; margin-bottom: 32px; }
  .logo-icon {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, var(--azul-vivo), var(--verde-clinico));
    border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .logo-text h1 { font-family: 'Instrument Serif', serif; font-size: 26px; color: var(--branco); line-height: 1.1; }
  .logo-text span { font-size: 11px; color: rgba(255,255,255,0.50); letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500; }
  .landing-headline { font-family: 'Instrument Serif', serif; font-size: 28px; color: var(--branco); line-height: 1.3; margin-bottom: 12px; }
  .landing-sub { color: rgba(255,255,255,0.60); font-size: 14px; line-height: 1.6; margin-bottom: 32px; }
  .landing-form { display: flex; flex-direction: column; gap: 14px; }
  .form-label {
    font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.60);
    letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; display: block;
  }
  .form-input {
    width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; color: var(--branco);
    font-size: 15px; font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .form-input::placeholder { color: rgba(255,255,255,0.30); }
  .form-input:focus { border-color: var(--azul-vivo); background: rgba(255,255,255,0.10); }
  .btn-primary {
    width: 100%; padding: 16px; background: var(--azul-vivo); color: var(--branco);
    border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s; margin-top: 4px; letter-spacing: 0.01em;
  }
  .btn-primary:hover { background: #1d4ed8; box-shadow: 0 4px 16px rgba(37,99,235,0.35); }
  .btn-primary:active { transform: scale(0.99); }
  .btn-primary:disabled { background: rgba(37,99,235,0.40); cursor: not-allowed; }
  .btn-ghost {
    background: transparent; border: 1px solid rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.75); padding: 14px; border-radius: 12px;
    font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s;
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.06); }
  .trust-badges { display: flex; gap: 16px; margin-top: 24px; flex-wrap: wrap; justify-content: center; }
  .badge { display: flex; align-items: center; gap: 6px; font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 500; }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--verde-clinico); }
  .back-link {
    display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.5);
    font-size: 12px; background: none; border: none; cursor: pointer; margin-bottom: 24px;
    padding: 0; font-family: 'Inter', sans-serif; transition: color 0.2s;
  }
  .back-link:hover { color: rgba(255,255,255,0.85); }
  /* ── ROLE SELECT ── */
  .role-options { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
  .role-option {
    display: flex; align-items: center; gap: 14px; width: 100%;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px; padding: 16px; cursor: pointer; text-align: left;
    transition: background 0.2s, border-color 0.2s, transform 0.1s; color: var(--branco);
    font-family: 'Inter', sans-serif;
  }
  .role-option:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.24); }
  .role-option:active { transform: scale(0.99); }
  .role-option-icon {
    width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
  }
  .role-icon-patient { background: rgba(37,99,235,0.18); color: #60a5fa; }
  .role-icon-doctor { background: rgba(5,150,105,0.18); color: #34d399; }
  .role-option-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .role-option-text strong { font-size: 15px; font-weight: 600; }
  .role-option-text span { font-size: 12px; color: rgba(255,255,255,0.5); }
  .role-option-arrow { color: rgba(255,255,255,0.3); flex-shrink: 0; }
  /* ── DONE ── */
  .done-card { text-align: center; }
  .done-icon {
    width: 60px; height: 60px; border-radius: 50%; background: rgba(5,150,105,0.18);
    color: #34d399; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
  }
  .done-text { color: rgba(255,255,255,0.88); font-size: 14px; line-height: 1.7; margin-bottom: 10px; }
  .done-sub { color: rgba(255,255,255,0.5); font-size: 12px; margin-bottom: 28px; }
  .done-actions { display: flex; flex-direction: column; gap: 10px; }
  /* ── EMERGÊNCIA ── */
  .emergency-screen {
    min-height: 100vh; background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 60%, #b91c1c 100%);
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .emergency-card {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
    border-radius: 24px; padding: 40px 32px; max-width: 460px; width: 100%;
    text-align: center; color: var(--branco); backdrop-filter: blur(20px);
  }
  .emergency-icon {
    width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.10);
    display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #fecaca;
  }
  .emergency-card h2 { font-family: 'Instrument Serif', serif; font-size: 26px; margin-bottom: 14px; }
  .emergency-msg { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.92); margin-bottom: 20px; }
  .emergency-instructions p { font-size: 13px; color: rgba(255,255,255,0.75); margin-bottom: 6px; line-height: 1.5; }
  .emergency-samu {
    display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--branco);
    color: #991b1b; padding: 16px; border-radius: 12px; font-weight: 700; font-size: 16px;
    text-decoration: none; margin: 20px 0 14px;
  }
  .emergency-note { font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5; margin-bottom: 24px; }
  .emergency-close {
    background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.22); color: var(--branco);
    padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600;
  }
  .emergency-close:hover { background: rgba(255,255,255,0.18); }
  /* ── CHAT LAYOUT ── */
  .chat-app { display: flex; flex-direction: column; height: 100vh; background: var(--cinza-claro); }
  .chat-header {
    background: var(--azul-profundo); padding: 14px 20px; display: flex; align-items: center;
    gap: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.20); position: relative; z-index: 10;
  }
  .header-logo { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .header-icon {
    width: 36px; height: 36px; background: linear-gradient(135deg, var(--azul-vivo), var(--verde-clinico));
    border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--branco); flex-shrink: 0;
  }
  .header-title { font-family: 'Instrument Serif', serif; font-size: 18px; color: var(--branco); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header-sub { font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 400; }
  .header-badge {
    display: flex; align-items: center; gap: 6px; background: rgba(5,150,105,0.15);
    border: 1px solid rgba(5,150,105,0.30); padding: 5px 12px; border-radius: 20px;
    font-size: 11px; color: #34d399; font-weight: 500; flex-shrink: 0;
  }
  .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; animation: pulse-anim 2s ease-in-out infinite; }
  @keyframes pulse-anim { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.06);
    border: none; color: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0; transition: background 0.2s;
  }
  .icon-btn:hover { background: rgba(255,255,255,0.14); }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .progress-bar-wrap { background: rgba(255,255,255,0.08); height: 3px; }
  .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--azul-vivo), var(--verde-clinico)); transition: width 0.5s ease; }
  /* ── MENSAGENS ── */
  .chat-messages { flex: 1; overflow-y: auto; padding: 20px 16px 8px; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
  .chat-messages::-webkit-scrollbar { width: 4px; }
  .chat-messages::-webkit-scrollbar-track { background: transparent; }
  .chat-messages::-webkit-scrollbar-thumb { background: var(--borda); border-radius: 4px; }
  .msg-row { display: flex; gap: 10px; max-width: 720px; margin: 0 auto; width: 100%; animation: fadeSlide 0.3s ease; }
  @keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .msg-row.user { flex-direction: row-reverse; }
  .msg-avatar { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; margin-top: 2px; }
  .avatar-ai { background: linear-gradient(135deg, var(--azul-vivo), var(--verde-clinico)); }
  .avatar-user { background: var(--azul-profundo); color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; }
  .msg-bubble { padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.6; max-width: calc(100% - 80px); }
  .bubble-ai { background: var(--branco); border: 1px solid var(--borda); border-top-left-radius: 4px; color: var(--cinza-texto); box-shadow: var(--sombra-card); }
  .bubble-user { background: var(--azul-profundo); color: var(--branco); border-top-right-radius: 4px; }
  .typing-indicator { display: flex; align-items: center; gap: 5px; padding: 14px 16px; }
  .typing-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--cinza-medio); animation: typing 1.2s ease-in-out infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
  /* ── INPUT ── */
  .chat-input-area { background: var(--branco); border-top: 1px solid var(--borda); padding: 14px 16px; }
  .input-inner { max-width: 720px; margin: 0 auto; display: flex; gap: 10px; align-items: flex-end; }
  .chat-textarea {
    flex: 1; padding: 12px 16px; border: 1.5px solid var(--borda); border-radius: 14px;
    font-family: 'Inter', sans-serif; font-size: 14px; color: var(--cinza-texto); resize: none;
    min-height: 48px; max-height: 140px; outline: none; transition: border-color 0.2s;
    background: var(--cinza-claro); line-height: 1.5;
  }
  .chat-textarea::placeholder { color: var(--cinza-medio); }
  .chat-textarea:focus { border-color: var(--azul-vivo); background: var(--branco); }
  .send-btn {
    width: 48px; height: 48px; background: var(--azul-vivo); border: none; border-radius: 12px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, transform 0.1s; flex-shrink: 0; color: white;
  }
  .send-btn:hover { background: #1d4ed8; }
  .send-btn:active { transform: scale(0.95); }
  .send-btn:disabled { background: var(--borda); cursor: not-allowed; color: var(--cinza-medio); }
  .input-hint { font-size: 11px; color: var(--cinza-medio); text-align: center; margin-top: 8px; max-width: 720px; margin-inline: auto; }
  /* ── STEP PILLS ── */
  .step-pills { display: flex; gap: 4px; flex-wrap: wrap; padding: 8px 16px; max-width: 720px; margin: 0 auto 4px; }
  .step-pill { padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .step-done { background: var(--verde-suave); color: var(--verde-clinico); }
  .step-active { background: var(--azul-claro); color: var(--azul-vivo); }
  .step-pending { background: var(--cinza-claro); color: var(--cinza-medio); }
  /* ── RELATÓRIO SOAP ── */
  .soap-container { max-width: 720px; margin: 0 auto; width: 100%; }
  .soap-header { background: linear-gradient(135deg, var(--azul-profundo), var(--azul-medio)); border-radius: 16px 16px 0 0; padding: 20px 24px; display: flex; align-items: center; gap: 14px; }
  .soap-header-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.12); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--branco); flex-shrink: 0; }
  .soap-header h2 { font-family: 'Instrument Serif', serif; font-size: 20px; color: var(--branco); }
  .soap-header p { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 2px; }
  .soap-body { background: var(--branco); border: 1px solid var(--borda); border-top: none; border-radius: 0 0 16px 16px; padding: 24px; box-shadow: var(--sombra); }
  .soap-section { margin-bottom: 20px; }
  .soap-section:last-child { margin-bottom: 0; }
  .soap-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--azul-vivo); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid var(--azul-claro); display: flex; align-items: center; gap: 6px; }
  .soap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .soap-field { background: var(--cinza-claro); border-radius: 10px; padding: 10px 14px; }
  .soap-field-label { font-size: 10px; font-weight: 600; color: var(--cinza-medio); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .soap-field-value { font-size: 13px; color: var(--cinza-texto); line-height: 1.5; }
  .soap-field.full { grid-column: 1 / -1; }
  .red-flags-section { background: var(--vermelho-suave); border: 1.5px solid #fca5a5; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; }
  .red-flags-title { font-size: 11px; font-weight: 700; color: var(--vermelho-alerta); letter-spacing: 0.10em; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
  .red-flag-item { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #991b1b; margin-bottom: 4px; line-height: 1.4; }
  .red-flag-item::before { content: '⚠'; flex-shrink: 0; }
  .no-flags { font-size: 13px; color: var(--verde-clinico); display: flex; align-items: center; gap: 6px; }
  .resumo-box { background: linear-gradient(135deg, #eff6ff, #f0fdf4); border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
  .resumo-label { font-size: 10px; font-weight: 700; color: var(--azul-vivo); letter-spacing: 0.10em; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
  .resumo-text { font-size: 13px; color: var(--cinza-texto); line-height: 1.6; }
  .soap-actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
  .btn-action { flex: 1; min-width: 140px; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .btn-copy { background: var(--cinza-claro); color: var(--cinza-texto); border: 1px solid var(--borda); }
  .btn-copy:hover { background: var(--borda); }
  .btn-pep { background: var(--verde-clinico); color: var(--branco); }
  .btn-pep:hover { background: #047857; }
  .pep-note { font-size: 11px; color: var(--cinza-medio); margin-top: 10px; line-height: 1.5; text-align: center; }
  /* ── DASHBOARD ── */
  .dashboard-wrap { flex: 1; overflow-y: auto; padding: 20px 16px 32px; max-width: 760px; margin: 0 auto; width: 100%; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
  .stat-card { background: var(--branco); border: 1px solid var(--borda); border-radius: 12px; padding: 14px 8px; text-align: center; box-shadow: var(--sombra-card); }
  .stat-value { font-family: 'Instrument Serif', serif; font-size: 26px; color: var(--azul-profundo); }
  .stat-label { font-size: 9.5px; color: var(--cinza-medio); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; line-height: 1.4; }
  .stat-card-alert .stat-value { color: var(--vermelho-alerta); }
  .section-block { margin-bottom: 24px; }
  .section-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--cinza-texto); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
  .alert-title { color: var(--vermelho-alerta); }
  .empty-state { background: var(--branco); border: 1px dashed var(--borda); border-radius: 12px; padding: 28px; text-align: center; }
  .empty-state p { font-weight: 600; margin-bottom: 4px; font-size: 14px; }
  .empty-state span { font-size: 12px; color: var(--cinza-medio); }
  .emergencia-card { background: var(--vermelho-suave); border: 1.5px solid #fca5a5; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
  .emergencia-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 10px; }
  .emergencia-head strong { color: #991b1b; font-size: 14px; }
  .emergencia-card p { font-size: 13px; color: #991b1b; line-height: 1.5; margin-bottom: 10px; }
  .time-chip { font-size: 11px; color: var(--cinza-medio); white-space: nowrap; flex-shrink: 0; }
  .triagem-card { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--branco); border: 1px solid var(--borda); border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; transition: border-color 0.2s, box-shadow 0.2s; }
  .triagem-card:hover { border-color: var(--azul-vivo); box-shadow: var(--sombra-card); }
  .triagem-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .triagem-main strong { font-size: 14px; color: var(--cinza-texto); }
  .triagem-queixa { font-size: 12px; color: var(--cinza-medio); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360px; }
  .triagem-meta { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .badge-flag { display: flex; align-items: center; gap: 4px; background: var(--vermelho-suave); color: var(--vermelho-alerta); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; }
  /* ── TOAST ── */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--azul-profundo); color: var(--branco); padding: 14px 20px; border-radius: 12px; font-size: 12.5px; line-height: 1.5; max-width: 90%; width: 420px; box-shadow: var(--sombra); z-index: 200; display: flex; align-items: flex-start; gap: 10px; animation: fadeSlide 0.3s ease; }
  .toast-icon { color: #34d399; flex-shrink: 0; margin-top: 1px; }
  @media (max-width: 540px) {
    .landing-card { padding: 32px 20px; }
    .landing-headline { font-size: 22px; }
    .soap-grid { grid-template-columns: 1fr; }
    .soap-header { padding: 16px; }
    .soap-body { padding: 16px; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .triagem-queixa { max-width: 140px; }
    .header-sub { display: none; }
  }
`;

// ─── HELPERS ────────────────────────────────────────────────────────────────
function extractJSON(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function formatRelative(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

async function readShared(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

async function writeShared(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Erro de armazenamento:", e);
  }
}

const EMPTY_STATS = { totalTriagens: 0, totalRedFlags: 0, totalEmergencias: 0 };

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────
export default function MedSenseAI() {
  const [screen, setScreen] = useState("role");
  const [toast, setToast] = useState(null);

  // estado do paciente
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [doneSummary, setDoneSummary] = useState("");
  const [emergencyMsg, setEmergencyMsg] = useState(null);

  // estado do painel médico
  const [triagens, setTriagens] = useState([]);
  const [emergencias, setEmergencias] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [selectedTriagem, setSelectedTriagem] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // injeta estilos
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  // rolagem automática do chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // toast some sozinho
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // ─── PAINEL: carregamento e polling ───────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    const [queue, emerg, st] = await Promise.all([
      readShared("medsense:queue", []),
      readShared("medsense:emergencias", []),
      readShared("medsense:stats", EMPTY_STATS),
    ]);
    setTriagens(queue);
    setEmergencias(emerg);
    setStats(st);
    setLoadingDashboard(false);
  }, []);

  useEffect(() => {
    if (screen !== "d-dashboard") return;
    loadDashboard();
    const interval = setInterval(loadDashboard, 4000);
    return () => clearInterval(interval);
  }, [screen, loadDashboard]);

  // ─── PACIENTE: lógica de chat ──────────────────────────────────────────────
  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  };

  const callGemini = async (history) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const contents = history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
      }),
    });
    if (!response.ok) throw new Error("Erro de API " + response.status);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  };

  const registerTriagem = async (parsed) => {
    const triagem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      patientName,
      patientAge,
      timestamp: new Date().toISOString(),
      status: "pendente",
      soap: parsed.soap,
      red_flags: parsed.red_flags || [],
      resumo_medico: parsed.resumo_medico || "",
    };
    const queue = await readShared("medsense:queue", []);
    await writeShared("medsense:queue", [triagem, ...queue]);
    const st = await readShared("medsense:stats", EMPTY_STATS);
    await writeShared("medsense:stats", {
      ...st,
      totalTriagens: (st.totalTriagens || 0) + 1,
      totalRedFlags: (st.totalRedFlags || 0) + (parsed.red_flags?.length || 0),
    });
    setDoneSummary(parsed.resumo_paciente || "Seu relato foi registrado com sucesso. O médico já tem acesso ao seu histórico.");
  };

  const registerEmergencia = async (mensagem) => {
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      patientName,
      patientAge,
      timestamp: new Date().toISOString(),
      mensagem: mensagem || "Sintoma de alerta identificado durante a triagem.",
    };
    const list = await readShared("medsense:emergencias", []);
    await writeShared("medsense:emergencias", [item, ...list]);
    const st = await readShared("medsense:stats", EMPTY_STATS);
    await writeShared("medsense:stats", { ...st, totalEmergencias: (st.totalEmergencias || 0) + 1 });
    setEmergencyMsg(item.mensagem);
  };

  const startChat = async () => {
    if (!patientName.trim()) return;
    setScreen("p-chat");
    setProgress(5);
    setIsLoading(true);
    const greeting = `Olá. Meu nome é ${patientName}${patientAge ? `, tenho ${patientAge} anos` : ""}. Estou chegando para minha consulta.`;
    const history = [{ role: "user", content: greeting }];
    setMessages([{ role: "user", content: greeting, isHidden: true }]);
    try {
      const reply = await callGemini(history);
      setMessages([{ role: "assistant", content: reply }]);
      setProgress(10);
    } catch (e) {
      setMessages([{
        role: "assistant",
        content: "Não foi possível conectar ao assistente agora. Verifique sua conexão e tente novamente.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "48px";
    setIsLoading(true);

    const stepIdx = Math.min(completedSteps.length, STEPS.length - 1);
    const step = STEPS[stepIdx];
    let newCompleted = completedSteps;
    if (step && !completedSteps.includes(step.key)) {
      newCompleted = [...completedSteps, step.key];
      setCompletedSteps(newCompleted);
    }
    setProgress(Math.min(92, 10 + newCompleted.length * 10));

    try {
      const reply = await callGemini(newMessages);
      if (!reply) throw new Error("resposta vazia");
      const parsed = extractJSON(reply);

      if (parsed && parsed.tipo === "EMERGENCIA") {
        await registerEmergencia(parsed.mensagem);
        setScreen("p-emergency");
        return;
      }

      if (parsed && parsed.tipo === "RELATORIO_SOAP") {
        setProgress(100);
        setMessages((prev) => [...prev, { role: "assistant", content: "Triagem concluída! Preparando seu resumo..." }]);
        await registerTriagem(parsed);
        setTimeout(() => setScreen("p-done"), 1100);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Tive um problema na conexão. Pode repetir sua resposta, por favor?",
      }]);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, isLoading, messages, completedSteps, patientName, patientAge]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const goHome = () => {
    setScreen("role");
    setPatientName("");
    setPatientAge("");
    setMessages([]);
    setInputText("");
    setProgress(0);
    setCompletedSteps([]);
    setDoneSummary("");
    setEmergencyMsg(null);
    setSelectedTriagem(null);
  };

  const startNewTriagem = () => {
    setPatientName("");
    setPatientAge("");
    setMessages([]);
    setInputText("");
    setProgress(0);
    setCompletedSteps([]);
    setDoneSummary("");
    setEmergencyMsg(null);
    setScreen("p-landing");
  };

  // ─── MÉDICO: ações ──────────────────────────────────────────────────────────
  const buildReportText = (t) => {
    const s = t.soap;
    return `RELATÓRIO SOAP — MedSense AI
Paciente: ${t.patientName}${t.patientAge ? `, ${t.patientAge} anos` : ""}
Gerado: ${new Date(t.timestamp).toLocaleString("pt-BR")}

SUBJETIVO
Queixa principal: ${s.subjetivo.queixa_principal}
HPI: ${s.subjetivo.hpi}
Histórico patológico: ${s.subjetivo.historico_patologico}
Histórico familiar: ${s.subjetivo.historico_familiar}
Medicamentos: ${s.subjetivo.medicamentos}
Alergias: ${s.subjetivo.alergias}
Hábitos: ${s.subjetivo.habitos}

OBJETIVO: ${s.objetivo}
AVALIAÇÃO: ${s.avaliacao}
PLANO: ${s.plano}

RED FLAGS: ${t.red_flags?.length ? t.red_flags.join("; ") : "Nenhum"}

RESUMO MÉDICO
${t.resumo_medico}`;
  };

  const copyReport = (t) => {
    navigator.clipboard.writeText(buildReportText(t)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const confirmPEP = async (id) => {
    const queue = await readShared("medsense:queue", []);
    await writeShared("medsense:queue", queue.filter((q) => q.id !== id));
    setToast("Relatório injetado no prontuário (PEP). Os dados temporários da triagem foram excluídos da camada MedSense — política de minimização de dados (LGPD).");
    setSelectedTriagem(null);
    setScreen("d-dashboard");
    loadDashboard();
  };

  const dismissEmergencia = async (id) => {
    const list = await readShared("medsense:emergencias", []);
    await writeShared("medsense:emergencias", list.filter((e) => e.id !== id));
    loadDashboard();
  };

  // ════════════════════════════════════════════════════════════════════════
  // TELA: SELEÇÃO DE PERFIL
  // ════════════════════════════════════════════════════════════════════════
  if (screen === "role") {
    return (
      <div className="medsense-root">
        <div className="landing">
          <div className="landing-card">
            <div className="logo-area">
              <div className="logo-icon"><Stethoscope size={26} color="#fff" /></div>
              <div className="logo-text">
                <h1>MedSense AI</h1>
                <span>Copiloto de Triagem Pré-Consulta</span>
              </div>
            </div>
            <h2 className="landing-headline">
              Sua consulta começa<br /><em>antes de você entrar</em>
            </h2>
            <p className="landing-sub">
              Um agente de IA conduz a anamnese pré-consulta e entrega ao médico um relatório
              estruturado antes de o paciente sentar no consultório. Escolha como deseja acessar.
            </p>
            <div className="role-options">
              <button className="role-option" onClick={() => setScreen("p-landing")}>
                <div className="role-option-icon role-icon-patient"><User size={22} /></div>
                <div className="role-option-text">
                  <strong>Sou paciente</strong>
                  <span>Iniciar minha triagem pré-consulta</span>
                </div>
                <ArrowRight size={18} className="role-option-arrow" />
              </button>
              <button className="role-option" onClick={() => setScreen("d-dashboard")}>
                <div className="role-option-icon role-icon-doctor"><Stethoscope size={22} /></div>
                <div className="role-option-text">
                  <strong>Painel do médico</strong>
                  <span>Ver triagens recebidas e relatórios SOAP</span>
                </div>
                <ArrowRight size={18} className="role-option-arrow" />
              </button>
            </div>
            <div className="trust-badges">
              <div className="badge"><div className="badge-dot" /> LGPD Conforme</div>
              <div className="badge"><div className="badge-dot" /> Dados Criptografados</div>
              <div className="badge"><div className="badge-dot" /> Sem Diagnósticos</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TELA: FORMULÁRIO INICIAL DO PACIENTE
  // ════════════════════════════════════════════════════════════════════════
  if (screen === "p-landing") {
    return (
      <div className="medsense-root">
        <div className="landing">
          <div className="landing-card">
            <button className="back-link" onClick={goHome}>
              <ArrowLeft size={14} /> Voltar
            </button>
            <div className="logo-area">
              <div className="logo-icon"><Stethoscope size={26} color="#fff" /></div>
              <div className="logo-text">
                <h1>MedSense AI</h1>
                <span>Copiloto de Triagem Pré-Consulta</span>
              </div>
            </div>
            <h2 className="landing-headline">
              Sua consulta começa<br /><em>antes de você entrar</em>
            </h2>
            <p className="landing-sub">
              Responda algumas perguntas no seu ritmo. Nosso agente de IA coleta seu histórico
              e prepara um relatório completo para o médico antes da consulta começar.
            </p>
            <div className="landing-form">
              <div>
                <label className="form-label">Seu nome completo</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ex: Joana Santos"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && patientName.trim() && startChat()}
                />
              </div>
              <div>
                <label className="form-label">Idade (opcional)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="Ex: 34"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && patientName.trim() && startChat()}
                />
              </div>
              <button className="btn-primary" onClick={startChat} disabled={!patientName.trim()}>
                Iniciar Triagem →
              </button>
            </div>
            <div className="trust-badges">
              <div className="badge"><div className="badge-dot" /> LGPD Conforme</div>
              <div className="badge"><div className="badge-dot" /> Dados Criptografados</div>
              <div className="badge"><div className="badge-dot" /> Sem Diagnósticos</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TELA: PROTOCOLO DE EMERGÊNCIA
  // ════════════════════════════════════════════════════════════════════════
  if (screen === "p-emergency") {
    return (
      <div className="medsense-root">
        <div className="emergency-screen">
          <div className="emergency-card">
            <div className="emergency-icon"><AlertTriangle size={36} /></div>
            <h2>Atenção, {patientName.split(" ")[0]}</h2>
            <p className="emergency-msg">{emergencyMsg}</p>
            <div className="emergency-instructions">
              <p>Os sintomas relatados podem indicar uma emergência médica.</p>
              <p><strong>Não aguarde a consulta.</strong> Procure ajuda imediatamente:</p>
            </div>
            <a className="emergency-samu" href="tel:192">
              <Phone size={18} /> Ligar para o SAMU — 192
            </a>
            <p className="emergency-note">
              Ou dirija-se ao pronto-socorro mais próximo. Esta triagem foi interrompida e a
              clínica já foi notificada.
            </p>
            <button className="emergency-close" onClick={goHome}>Encerrar</button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TELA: TRIAGEM CONCLUÍDA (PACIENTE)
  // ════════════════════════════════════════════════════════════════════════
  if (screen === "p-done") {
    return (
      <div className="medsense-root">
        <div className="landing">
          <div className="landing-card done-card">
            <div className="done-icon"><Check size={32} /></div>
            <h2 className="landing-headline">Tudo certo, {patientName.split(" ")[0]}!</h2>
            <p className="done-text">{doneSummary}</p>
            <p className="done-sub">Pode aguardar tranquilo — seu histórico já está com o médico.</p>
            <div className="done-actions">
              <button className="btn-primary" onClick={startNewTriagem}>Fazer nova triagem</button>
              <button className="btn-ghost" onClick={goHome}>Voltar ao início</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TELA: CHAT DE TRIAGEM (PACIENTE)
  // ════════════════════════════════════════════════════════════════════════
  if (screen === "p-chat") {
    return (
      <div className="medsense-root">
        <div className="chat-app">
          <div className="chat-header">
            <button className="icon-btn" onClick={goHome} aria-label="Voltar">
              <ArrowLeft size={18} />
            </button>
            <div className="header-logo">
              <div className="header-icon"><Stethoscope size={16} /></div>
              <div>
                <div className="header-title">MedSense AI</div>
                <div className="header-sub">Triagem de {patientName}</div>
              </div>
            </div>
            <div className="header-badge">
              <div className="pulse-dot" /> Ao vivo
            </div>
          </div>

          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="step-pills">
            {STEPS.map((s, idx) => {
              let cls = "step-pending";
              if (completedSteps.includes(s.key)) cls = "step-done";
              else if (idx === completedSteps.length) cls = "step-active";
              return (
                <span key={s.key} className={`step-pill ${cls}`}>
                  {completedSteps.includes(s.key) ? "✓ " : ""}{s.label}
                </span>
              );
            })}
          </div>

          <div className="chat-messages">
            {messages.filter((m) => !m.isHidden).map((msg, i) => {
              const isUser = msg.role === "user";
              const initials = patientName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
              return (
                <div key={i} className={`msg-row ${isUser ? "user" : ""}`}>
                  <div className={`msg-avatar ${isUser ? "avatar-user" : "avatar-ai"}`}>
                    {isUser ? initials : <Stethoscope size={15} color="#fff" />}
                  </div>
                  <div className={`msg-bubble ${isUser ? "bubble-user" : "bubble-ai"}`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="msg-row">
                <div className="msg-avatar avatar-ai"><Stethoscope size={15} color="#fff" /></div>
                <div className="msg-bubble bubble-ai">
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <div className="input-inner">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                placeholder="Digite sua resposta aqui..."
                value={inputText}
                rows={1}
                onChange={(e) => { setInputText(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button className="send-btn" onClick={sendMessage} disabled={isLoading || !inputText.trim()} aria-label="Enviar">
                <Send size={18} />
              </button>
            </div>
            <p className="input-hint">
              Dados criptografados · LGPD conforme · Sem diagnósticos · Pressione Enter para enviar
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TELA: PAINEL DO MÉDICO — DASHBOARD
  // ════════════════════════════════════════════════════════════════════════
  if (screen === "d-dashboard") {
    return (
      <div className="medsense-root">
        <div className="chat-app">
          <div className="chat-header">
            <button className="icon-btn" onClick={goHome} aria-label="Voltar">
              <ArrowLeft size={18} />
            </button>
            <div className="header-logo">
              <div className="header-icon"><Stethoscope size={16} /></div>
              <div>
                <div className="header-title">Painel do Médico</div>
                <div className="header-sub">Dr. Roberto Kalil · Cardiologia</div>
              </div>
            </div>
            <button className="icon-btn" onClick={loadDashboard} aria-label="Atualizar">
              <RefreshCw size={16} className={loadingDashboard ? "spin" : ""} />
            </button>
          </div>

          <div className="dashboard-wrap">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalTriagens || 0}</div>
                <div className="stat-label">Triagens concluídas</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalRedFlags || 0}</div>
                <div className="stat-label">Red flags identificados</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{(stats.totalTriagens || 0) * 10}</div>
                <div className="stat-label">Minutos economizados (est.)</div>
              </div>
              <div className="stat-card stat-card-alert">
                <div className="stat-value">{stats.totalEmergencias || 0}</div>
                <div className="stat-label">Emergências detectadas</div>
              </div>
            </div>

            {emergencias.length > 0 && (
              <div className="section-block">
                <h3 className="section-title alert-title">
                  <AlertTriangle size={15} /> Alertas de emergência
                </h3>
                {emergencias.map((e) => (
                  <div key={e.id} className="emergencia-card">
                    <div className="emergencia-head">
                      <strong>{e.patientName}{e.patientAge ? `, ${e.patientAge} anos` : ""}</strong>
                      <span className="time-chip">{formatRelative(e.timestamp)}</span>
                    </div>
                    <p>{e.mensagem}</p>
                    <button className="btn-action btn-copy" onClick={() => dismissEmergencia(e.id)}>
                      Marcar como tratado
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="section-block">
              <h3 className="section-title"><Inbox size={15} /> Triagens recebidas</h3>
              {triagens.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhuma triagem pendente.</p>
                  <span>Quando um paciente concluir a triagem (em outra aba ou dispositivo), o relatório aparece aqui automaticamente.</span>
                </div>
              ) : (
                triagens.map((t) => (
                  <button
                    key={t.id}
                    className="triagem-card"
                    onClick={() => { setSelectedTriagem(t); setScreen("d-report"); }}
                  >
                    <div className="triagem-main">
                      <strong>{t.patientName}{t.patientAge ? `, ${t.patientAge} anos` : ""}</strong>
                      <span className="triagem-queixa">{t.soap?.subjetivo?.queixa_principal}</span>
                    </div>
                    <div className="triagem-meta">
                      {t.red_flags?.length > 0 && (
                        <span className="badge-flag"><AlertTriangle size={12} /> {t.red_flags.length}</span>
                      )}
                      <span className="time-chip">{formatRelative(t.timestamp)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {toast && (
          <div className="toast">
            <Check size={16} className="toast-icon" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TELA: RELATÓRIO SOAP (MÉDICO)
  // ════════════════════════════════════════════════════════════════════════
  if (screen === "d-report" && selectedTriagem) {
    const t = selectedTriagem;
    const s = t.soap;
    const flags = t.red_flags || [];
    return (
      <div className="medsense-root">
        <div className="chat-app">
          <div className="chat-header">
            <button className="icon-btn" onClick={() => { setSelectedTriagem(null); setScreen("d-dashboard"); }} aria-label="Voltar">
              <ArrowLeft size={18} />
            </button>
            <div className="header-logo">
              <div className="header-icon"><FileText size={16} /></div>
              <div>
                <div className="header-title">Relatório SOAP</div>
                <div className="header-sub">{t.patientName}</div>
              </div>
            </div>
          </div>

          <div className="chat-messages" style={{ padding: "20px 16px 24px" }}>
            <div className="soap-container">
              <div className="soap-header">
                <div className="soap-header-icon"><ClipboardCheck size={20} color="#fff" /></div>
                <div>
                  <h2>Relatório SOAP</h2>
                  <p>
                    Paciente: {t.patientName}{t.patientAge ? `, ${t.patientAge} anos` : ""} ·{" "}
                    {new Date(t.timestamp).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="soap-body">
                <div className="resumo-box">
                  <div className="resumo-label">Resumo para o médico</div>
                  <p className="resumo-text">{t.resumo_medico}</p>
                </div>

                {flags.length > 0 ? (
                  <div className="red-flags-section">
                    <div className="red-flags-title"><AlertTriangle size={13} /> Red flags identificados</div>
                    {flags.map((f, i) => (
                      <div key={i} className="red-flag-item">{f}</div>
                    ))}
                  </div>
                ) : (
                  <div className="red-flags-section" style={{ background: "#f0fdf4", border: "1.5px solid #6ee7b7" }}>
                    <div className="red-flags-title" style={{ color: "#059669" }}>Red flags</div>
                    <div className="no-flags"><Check size={14} /> Nenhum sinal de alerta identificado na triagem.</div>
                  </div>
                )}

                <div className="soap-section">
                  <div className="soap-label">S — Subjetivo</div>
                  <div className="soap-grid">
                    <div className="soap-field full">
                      <div className="soap-field-label">Queixa principal</div>
                      <div className="soap-field-value">{s.subjetivo.queixa_principal || "—"}</div>
                    </div>
                    <div className="soap-field full">
                      <div className="soap-field-label">História da doença atual (HPI)</div>
                      <div className="soap-field-value">{s.subjetivo.hpi || "—"}</div>
                    </div>
                    <div className="soap-field">
                      <div className="soap-field-label">Histórico patológico</div>
                      <div className="soap-field-value">{s.subjetivo.historico_patologico || "Não relatado"}</div>
                    </div>
                    <div className="soap-field">
                      <div className="soap-field-label">Histórico familiar</div>
                      <div className="soap-field-value">{s.subjetivo.historico_familiar || "Não relatado"}</div>
                    </div>
                    <div className="soap-field">
                      <div className="soap-field-label">Medicamentos em uso</div>
                      <div className="soap-field-value">{s.subjetivo.medicamentos || "Nenhum"}</div>
                    </div>
                    <div className="soap-field">
                      <div className="soap-field-label">Alergias</div>
                      <div className="soap-field-value">{s.subjetivo.alergias || "Nenhuma relatada"}</div>
                    </div>
                    <div className="soap-field full">
                      <div className="soap-field-label">Hábitos de vida</div>
                      <div className="soap-field-value">{s.subjetivo.habitos || "Não relatado"}</div>
                    </div>
                  </div>
                </div>

                {[
                  { label: "O — Objetivo", key: "objetivo" },
                  { label: "A — Avaliação", key: "avaliacao" },
                  { label: "P — Plano", key: "plano" },
                ].map(({ label, key }) => (
                  <div className="soap-section" key={key}>
                    <div className="soap-label">{label}</div>
                    <div className="soap-field" style={{ borderRadius: 10 }}>
                      <div className="soap-field-value" style={{ color: "#64748b", fontStyle: "italic" }}>
                        {s[key]}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="soap-actions">
                  <button className="btn-action btn-copy" onClick={() => copyReport(t)}>
                    <Copy size={14} /> {copied ? "Copiado!" : "Copiar relatório"}
                  </button>
                  <button className="btn-action btn-pep" onClick={() => confirmPEP(t.id)}>
                    <ClipboardCheck size={14} /> Confirmar e enviar ao PEP
                  </button>
                </div>
                <p className="pep-note">
                  Ao confirmar, o relatório é considerado injetado no prontuário da clínica e os
                  dados temporários desta triagem são excluídos da camada MedSense (minimização
                  de dados — LGPD).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
