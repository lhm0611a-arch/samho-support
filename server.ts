import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const app = express();
app.use(cors());
const PORT = 3000;

app.use(express.json());

// Set up Multer with Memory Storage for zero-storage pipeline
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize Gemini
let aiInstances: Record<string, GoogleGenAI> = {};
function getAI(purpose: 'report' | 'counsel' | 'chat' | 'default' = 'default'): GoogleGenAI {
  if (aiInstances[purpose]) {
    return aiInstances[purpose];
  }
  let key = process.env.GEMINI_API_KEY;
  if (purpose === 'report' && process.env.GEMINI_API_KEY_REPORT) {
    key = process.env.GEMINI_API_KEY_REPORT;
  } else if (purpose === 'counsel' && process.env.GEMINI_API_KEY_COUNSEL) {
    key = process.env.GEMINI_API_KEY_COUNSEL;
  } else if (purpose === 'chat' && process.env.GEMINI_API_KEY_CHAT) {
    key = process.env.GEMINI_API_KEY_CHAT;
  }
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  aiInstances[purpose] = new GoogleGenAI({ apiKey: key });
  return aiInstances[purpose];
}

function extractJson(text: string): any {
  if (!text) return {};
  
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch (e) {}
  
  // Try cleaning markdown
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // Try extracting substring
  const startIndex = cleaned.indexOf('{');
  let endIndex = cleaned.lastIndexOf('}');
  
  while (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    try {
      return JSON.parse(cleaned.substring(startIndex, endIndex + 1));
    } catch (e: any) {
       // If parse failed, try finding the previous '}' in case there is trailing garbage containing '}'
       const prevEndIndex = cleaned.lastIndexOf('}', endIndex - 1);
       if (prevEndIndex > startIndex) {
           endIndex = prevEndIndex;
           continue; // Try parsing again with the shorter substring
       }
       
       console.error("Failed substring JSON parse:", e.message);
       
       // As a last resort, try replacing unescaped newlines within the substring
       try {
           const singleLine = cleaned.substring(startIndex, endIndex + 1)
               .replace(/\n/g, '\\n')
               .replace(/\r/g, '\\r')
               .replace(/\t/g, '\\t');
           return JSON.parse(singleLine);
       } catch (e2: any) {
           console.error("Failed single-line JSON parse:", e2.message);
           break; // Give up
       }
    }
  }
  
  console.error("Could not extract JSON from text");
  return {};
}

// API Route for analyzing audio
app.post('/api/analyze-audio', upload.single('audio'), async (req, res) => {
  try {
    const file = (req as any).file;
    const { workerName, companyCode, counselorName } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    let ai;
    try {
      ai = getAI('counsel');
    } catch (err: any) {
      console.warn('Gemini API key is not configured. Returning fallback audio analysis.');
      return res.json({
        summary: "API 키가 설정되지 않아 오디오 분석이 불가능합니다.",
        category: "기타",
        urgency: "아니오",
        sentiment: "neutral",
        keywords: ["오류", "설정 필요"]
      });
    }

    const prompt = `너는 HD현대삼호 조선소의 전문 통역사다. 다음 오디오는 외국인 근로자와의 상담 녹음이다.

[참고 정보 - 오디오 내 등장인물 및 소속 파악용]
- 근로자 이름: ${workerName || '미상'}
- 소속 업체: ${companyCode || '미상'}
- 담당 통역사/상담자: ${counselorName || '미상'}

위 참고 정보를 활용하여 오디오의 대화 내용을 텍스트로 변환(STT)하고, 이를 바탕으로 객관적인 근거에 따라 분석 결과를 제공하라.
단순한 요약이 아닌, 상담록(Consultation Record) 형태로 체계적으로 작성해야 한다.
외국어로 대화한 내용이 있다면 반드시 명확한 한국어로 번역하여 작성하라.
작성 형식은 개조식(bullet points)을 사용하고, 질의응답 및 상담 내용이 상세히 포함되도록 하라.

반드시 아래 JSON 스키마로만 결과를 반환해라. 마크다운(\`\`\`json)을 포함하지 말고 순수 JSON만 반환하라.
{
  "raw_transcript": "음성을 텍스트로 변환한 전체 대화 내용 (이름, 소속업체 등을 참고하여 정확하게 표기)",
  "ai_summary": {
    "meeting_minutes": "[상담자: ${counselorName || '미상'} / 대상자: ${workerName || '미상'}]\\n\\n■ 주요 안건\\n- ...\\n\\n■ 상세 상담 내용 (질의응답 포함)\\n- ...\\n\\n■ 향후 조치 계획\\n- ...",
    "keywords": ["비자", "급여", "기숙사" 중 택일 또는 추출된 단어 최대 5개],
    "urgency": "high" | "medium" | "low",
    "risk_flag": boolean (폭언, 임금체불, 산재, 자살 조짐 등 심각한 위험 감지 시 true)
  }
}`;

    let response;

    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: file.buffer.toString('base64'),
                  mimeType: file.mimetype,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('suspended') || err.message.includes('PERMISSION_DENIED') || err.message.includes('403'))) {
        console.error('Gemini API key is suspended or denied. Please update the API key in settings.');
        res.json({ reply: "제공된 AI API 키가 정지(Suspended)되었거나 권한이 없습니다.\n새로운 정상적인 API 키를 환경변수에 등록해주세요." });
      } else if (err.message && (err.message.includes('429') || err.message.includes('Quota') || err.message.includes('401') || err.message.includes('UNAUTHENTICATED'))) {
        console.error('Gemini API Error in /api/analyze-audio:', err.message || err);
        console.warn('Gemini API quota exceeded in /api/analyze-audio. Using fallback.');
        return res.json({
          original_text: "음성 파일이 접수되었습니다. (AI API 호출 한도 초과로 자동 변환이 제한됨)",
          translation_to_korean: "AI API 일일 제공량이 초과되어 번역을 수행할 수 없습니다.",
          ai_summary: {
            meeting_minutes: "AI API 호출 한도(무료 쿼터) 초과로 인하여 녹음 파일의 텍스트 변환 및 요약이 불가능합니다.\n\n나중에 다시 시도하거나 직접 상담 내용을 기록해주시기 바랍니다.",
            keywords: ["할당량 초과"],
            urgency: "low",
            risk_flag: false
          }
        });
      } else {
        throw err;
      }
    }

    const resultText = response.text || '{}';
    
    // Explicitly delete buffer to help Garbage Collection
    file.buffer = Buffer.alloc(0);
    
    let parsedResult;
    try {
      parsedResult = extractJson(resultText);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON', resultText);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json(parsedResult);
  } catch (error) {
    console.error('Error analyzing audio:', error);
    res.status(500).json({ error: 'Failed to analyze audio' });
  }
});

// API Route for generating action response

app.post('/api/generate-one-line-summary', async (req, res) => {
  try {
    const { notes } = req.body;
    
    if (!notes) {
      return res.status(400).json({ error: 'Notes are required' });
    }

    const ai = getAI('counsel');
    if (!ai) {
      return res.json({ summary: notes.substring(0, 50) + '...' });
    }

    const prompt = `다음 상담 내용을 1줄로 매우 간결하게 요약해줘:
${notes}`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    const text = result.text || '';
    res.json({ summary: text.trim() });
  } catch (error) {
    console.error('Error generating one-line summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

app.post('/api/generate-response', async (req, res) => {
  try {
    const { summary, notes, category, country } = req.body;
    
    let ai;
    try {
      ai = getAI('counsel');
    } catch (err: any) {
      console.warn('Gemini API key is not configured. Returning fallback response generation.');
      return res.json({
        actionPlan: "API 키가 설정되지 않아 액션 플랜을 생성할 수 없습니다.",
        messageToWorker: {
          korean: "API 키가 설정되지 않았습니다.",
          native: "API key is not configured."
        },
        followUp: "설정 메뉴 또는 환경 변수(GEMINI_API_KEY)에 API 키를 등록해주세요."
      });
    }
    const prompt = `너는 HD현대삼호 외국인지원센터의 수석 노무 관리사다. 
다음 상담 내역 및 회의록(상세 내용)을 철저히 분석하여, 담당자가 실제 취해야 할 구체적인 조치 방안(액션 플랜)과 근로자에게 전달할 다국어 메시지(한국어 및 ${country || '해당 국가'}어)를 생성하라.

[입력 데이터]
상담 분야: ${category}
상담 요약(사전 입력): ${summary}
상담 회의록(실제 상세 내용): 
${notes || '(상담 회의록 내용이 비어있다면, 주어진 상담 요약과 분야만으로 최선의 조치 방안을 제안하세요.)'}

[요구사항]
1. 단순 일반론적이거나 지어낸 내용("아무말 대잔치")을 철저히 배제할 것.
2. 상담 회의록에 구체적인 문제(예: 특정 수당 미지급, 기숙사 문제, 비자 연장 등)가 있다면, 이를 직접 해결하기 위한 실무적인 조치 방안을 제안할 것.
3. 근로자에게 보내는 다국어 메시지는 문제 해결 진행 상황을 안심시키는 따뜻하고 전문적인 톤으로 작성할 것.

반드시 아래 JSON 스키마로만 결과를 반환해라. 마크다운(\`\`\`json) 제외.
{
  "recommended_action": "담당자가 시스템에 기록할 실무 조치 결과 제안 (3~4문장, 개조식 가능)",
  "translated_message": "근로자에게 발송할 다국어 안내문 (한국어\\n\\n[해당 언어 번역])"
}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });
      
      let rawText = response?.text || '{}';
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      
      res.json(extractJson(rawText));
    } catch (err: any) {
      if (err.message && (err.message.includes('suspended') || err.message.includes('PERMISSION_DENIED') || err.message.includes('403'))) {
        console.error('Gemini API key is suspended or denied. Please update the API key in settings.');
        res.json({ reply: "제공된 AI API 키가 정지(Suspended)되었거나 권한이 없습니다.\n새로운 정상적인 API 키를 환경변수에 등록해주세요." });
      } else if (err.message && (err.message.includes('429') || err.message.includes('Quota') || err.message.includes('401') || err.message.includes('UNAUTHENTICATED'))) {
        console.error('Gemini API Error in /api/generate-response:', err.message || err);
        console.warn('Gemini API quota exceeded in /api/generate-response. Using fallback.');
        res.json({
          recommended_action: "AI API 호출 한도(무료 쿼터)가 초과되어 추천 조치안을 생성할 수 없습니다. 담당자님께서 직접 조치결과를 작성해 주시기 바랍니다.",
          translated_message: "AI API 호출 한도(무료 쿼터)가 초과되어 다국어 번역을 제공할 수 없습니다. 직접 입력해주세요.\n\nAI API Quota exceeded. Please type manually."
        });
      } else {
        throw err;
      }
    }
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Firebase FireStore initialization helper
let db: any = null;
function getDb(): any {
  if (!db) {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let app;
    let databaseId = '';
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      databaseId = config.firestoreDatabaseId;
      const firebaseConfig = {
        projectId: config.projectId,
        appId: config.appId,
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
      };
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }
    } else {
      const fallbackConfig = {
        projectId: "enhanced-tokenizer-wd2jw",
        appId: "1:482301380709:web:af5f8cad74ff0873471e8c",
        apiKey: "AIzaSyC_fQq_qdlXbJ8BwBY1Zqq4Ljq2r_eJZmQ",
        authDomain: "enhanced-tokenizer-wd2jw.firebaseapp.com",
        storageBucket: "enhanced-tokenizer-wd2jw.firebasestorage.app",
        messagingSenderId: "482301380709"
      };
      databaseId = "ai-studio-masterspecai-e22969bb-3c6a-42e5-a094-d4bb0566063a";
      if (getApps().length === 0) {
        app = initializeApp(fallbackConfig);
      } else {
        app = getApp();
      }
    }
    
    db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
  return db;
}

// Generate and store daily AI insights
async function generateDailyInsights(reportType: 'daily' | 'weekly' | 'monthly' = 'daily') {
  console.log(`Generating scheduled AI insights for ${reportType}...`);
  try {
    const firestore = getDb();
    
    // Determine timeframe based on report type
    const now = new Date();
    let daysToLookBack = 1;
    let periodName = '전일';
    let reportTitleStr = '일일 보고서';
    
    if (reportType === 'weekly') {
      daysToLookBack = 7;
      periodName = '전주 (1주일)';
      reportTitleStr = '주간 보고서';
    } else if (reportType === 'monthly') {
      daysToLookBack = 30; // Approximation or we can use exact month
      periodName = '전월 (1개월)';
      reportTitleStr = '월간 보고서';
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - daysToLookBack);
    cutoffDate.setHours(0, 0, 0, 0); // Start of the cutoff day
    
    // Fetch counseling tickets
    const ticketsSnapshot = await getDocs(collection(firestore, 'counseling_tickets'));
    let allTickets: any[] = [];
    ticketsSnapshot.forEach(doc => {
      allTickets.push({ id: doc.id, ...doc.data() });
    });

    // Fetch events for other tasks
    const eventsSnapshot = await getDocs(collection(firestore, 'events'));
    let allEvents: any[] = [];
    eventsSnapshot.forEach(doc => {
      allEvents.push({ id: doc.id, ...doc.data() });
    });

    // Fetch counselors to map names
    const counselorsSnapshot = await getDocs(collection(firestore, 'counselors'));
    let counselors: any[] = [];
    counselorsSnapshot.forEach(doc => {
      counselors.push({ id: doc.id, ...doc.data() });
    });
    
    // Filter tickets based on timeframe
    const recentTickets = allTickets.filter(t => {
      if (!t.created_at) return false;
      const ticketDate = new Date(t.created_at);
      return ticketDate >= cutoffDate;
    });

    // Filter events based on timeframe
    const recentEvents = allEvents.filter(e => {
      if (!e.start) return false;
      const eventDate = new Date(e.start);
      return eventDate >= cutoffDate;
    });
    
    // Calculate statistics
    const total = recentTickets.length;
    const completed = recentTickets.filter(t => t.status === '처리완료').length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const redFlags = recentTickets.filter(t => t.red_flag).length;
    
    const COUNTRIES = ['베트남', '우즈베키스탄', '캄보디아', '네팔', '인도네시아', '태국', '몽골', '필리핀', '기타'];
    const CATEGORIES = ['임금/근로조건', '비자/체류', '산업안전/보건', '기숙사/식사', '정서/심리', '행정/생활', '기타'];
    
    const byCountry = COUNTRIES.map(country => {
      const count = recentTickets.filter(t => t.country === country).length;
      return { name: country, count };
    }).filter(item => item.count > 0);

    const byCategory = CATEGORIES.map(category => {
      const count = recentTickets.filter(t => t.category === category).length;
      return { name: category, count };
    }).filter(item => item.count > 0);
    
    // Extract actual content for Gemini
    // Only include completed counseling cases (실제 수행한 실적 건만)
    const completedTickets = recentTickets.filter((t: any) => t.status === '처리완료');
    
    const counselingDetails = completedTickets.map(t => {
      const rawResult = t.action_result || (t.ai_summary ? t.ai_summary.summary_text : '') || t.summary || '';
      return {
        업체명: t.company_code || '미상',
        이름: t.worker_name || '익명',
        카테고리: t.category,
        긴급여부: t.red_flag ? '예 (민감/위험)' : '아니오',
        상담내용_및_결과: rawResult
      };
    });

    const otherTasks = recentEvents
      .filter(e => !['연차', '반차', '상담'].includes(e.type) && e.performanceDetail)
      .map(e => {
        const cInfo = counselors.find(c => c.id === e.counselorId);
        return {
          통역사: cInfo ? `${cInfo.country} - ${cInfo.name}` : '미상',
          업무유형: e.type,
          업무제목: e.title,
          업무실적: e.performanceDetail
        };
      });
    
    const stats = { 
      기간: periodName,
      byCountry, 
      byCategory, 
      total, 
      completed, 
      completionRate, 
      redFlags,
      counselingDetails,
      otherTasks
    };
    
    // Generate content using Gemini
    let aiInstance;
    try {
      aiInstance = getAI('report');
    } catch (err: any) {
      console.warn("Gemini API key is not configured. Returning fallback daily insights.");
      const fallbackInsights = {
        insights: [
          "Gemini API 키가 설정되지 않아 자동 요약이 비활성화되었습니다.",
          "시스템 설정에서 API 키를 등록해주세요.",
          "실제 접수/처리 내역은 정상적으로 확인 가능합니다."
        ],
        report: `# ⚠️ 자동 리포트 생성 불가 안내\n\n현재 구글 Gemini API 키가 환경변수에 설정되지 않아 ${reportTitleStr}를 자동 생성할 수 없습니다.\n\n* **원인**: 시스템에 \`GEMINI_API_KEY\`가 입력되지 않음\n* **조치**: 환경 설정에서 API 키를 등록해주세요.`,
        tickets: counselingDetails
      };
      await setDoc(doc(firestore, "ai_insights", "latest"), {
        ...fallbackInsights,
        updated_at: now.toISOString(),
        reportType: reportType
      });
      return;
    }
    const prompt = `너는 HD현대삼호 외국인지원센터의 상담 실적 보고 담당자다.
다음은 ${stats.기간} 동안 "실제 처리 완료된" 외국인 근로자 상담 세부 내용과 통계 데이터다.

[상담 데이터 및 통계]
${JSON.stringify(stats, null, 2)}

위 데이터를 기반으로 있는 그대로의 실적을 투명하게 보고하는 ${reportTitleStr}를 마크다운으로 작성하라.

[작성 지침]
1. 어조 및 문체: 과도한 강조어, 형용사, 부사(예: 매우, 심각한, 혁신적인 등)를 철저히 배제하고, 오직 팩트(사실) 위주의 담백하고 건조한 객관적인 문체를 사용할 것. 모든 문장은 명사형 종결이나 간결한 개조식(bullet points)으로 작성할 것.
2. 구성 (필수 포함):
    - **[현황 요약]**: 전체 상담 처리 현황 및 기타 업무 실적(번역, 교육지원 등) 주요 특이사항을 명확하게 요약.
    - **[핵심 지표]**: 접수 건수, 완료 건수, 기타 업무 건수, 긴급 사례 건수 등 핵심 숫자를 깔끔한 마크다운 표(|---|) 형식으로 작성하여 한눈에 파악할 수 있도록 구성할 것.
    - **[주요 국적 및 유형]**: 주요 국적별, 상담 유형별 분포 현황을 마크다운 표나 간결한 개조식으로 요약.
    - **[상담 및 주요 업무 실적]**: 완료된 상담 및 기타 등록된 업무 실적(otherTasks 활용)의 주요 내용을 요약. 어떤 통역사가 어떤 업무 실적을 냈는지 분명히 보고. 주요 카테고리별로 묶어서 간결하게 나열할 것.
3. 데이터 제약: 과도한 추론은 배제하고, 철저하게 실적(Fact) 기반으로만 서술할 것.
4. 형식: 제목, 부제목(##, ###), 굵은 글씨(**), 마크다운 표(|---|) 등을 적절히 활용하여 시각적으로 깔끔하고 정돈되게 구성할 것.

결과는 다음 JSON 형식으로 반환할 것:
1. "insights": 핵심 성과 요약 3줄 (텍스트만).
2. "report": 위 요구사항을 완벽히 반영한 마크다운 리포트 전문.

반드시 아래 JSON 스키마로만 결과를 반환해라. 마크다운(\`\`\`json) 제외.
{
  "insights": ["...", "...", "..."],
  "report": "# 외국인 지원센터 상담 실적 ${reportTitleStr}\\n\\n..."
}`;

    let response;
    let retries = 3;
    while (retries > 0) {
      try {
        response = await aiInstance.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { 
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                insights: { type: 'array', items: { type: 'string' } },
                report: { type: 'string' },
                summarizedTickets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      업체명: { type: 'string' },
                      이름: { type: 'string' },
                      카테고리: { type: 'string' },
                      긴급여부: { type: 'string' },
                      상담요약: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        });
        break; // Success
      } catch (err: any) {
        retries--;
        const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'));
        const isOverloaded = err.status === 503 || (err.message && err.message.includes('503'));
        
        if (isRateLimit || isOverloaded) {
          console.warn(`Gemini API overloaded/rate-limited. Retries left: ${retries}.`);
          if (retries === 0) {
            console.warn('Gemini API quota exceeded. Using fallback mock insights.');
            response = {
              text: JSON.stringify({
                insights: [
                  "최근 비자 및 체류 관련 상담 문의가 증가하는 추세입니다. (임시 데이터)",
                  "근로 여건 및 기숙사 환경에 대한 점검 및 보완이 필요합니다. (임시 데이터)",
                  "AI API 할당량이 초과되어 임시 리포트를 출력합니다."
                ],
                report: "# 리포트 생성 실패\n\nAI API 할당량이 초과되어 리포트를 생성할 수 없습니다. 잠시 후 다시 시도해주세요.\n\n*현재 할당량 초과 상태입니다.*",
                summarizedTickets: counselingDetails.map(t => ({
                  업체명: t.업체명 || '',
                  이름: t.이름 || '',
                  카테고리: t.카테고리 || '',
                  긴급여부: t.긴급여부 || '',
                  상담요약: t.상담내용_및_결과 || 'AI 요약 할당량 초과'
                }))
              })
            };
            break;
          }
          const waitTime = isRateLimit ? 12000 : 2000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw err;
        }
      }
    }
    
    let parsed: any = {};
    try {
      let rawText = response?.text || '{}';
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      
      parsed = extractJson(rawText);
    } catch (e) {
      console.error('JSON Parse error in generateDailyInsights:', e, 'Raw text:', response?.text);
    }
    
    // Write back to Firestore
    await setDoc(doc(firestore, 'ai_insights', 'latest'), {
      insights: parsed.insights || [],
      report: parsed.report || '',
      tickets: parsed.summarizedTickets && parsed.summarizedTickets.length > 0 ? parsed.summarizedTickets : counselingDetails.map((t: any) => ({
        업체명: t.업체명,
        이름: t.이름,
        카테고리: t.카테고리,
        긴급여부: t.긴급여부,
        상담요약: t.실제상담결과 || t.기존입력내용
      })),
      reportType: reportType,
      updated_at: new Date().toISOString()
    });
    
    console.log('AI insights updated successfully!');
  } catch (error) {
    console.error('Error in generateDailyInsights:', error);
  }
}

// Convert markdown to clean HTML tailored for dark theme email layouts
function markdownToHtml(md: string): string {
  if (!md) return '';
  
  // Use marked to parse
  let html = marked.parse(md, { async: false }) as string;
  
  // Add inline styles for email rendering
  html = html
    .replace(/<h1(.*?)>/g, '<h1$1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">')
    .replace(/<h2(.*?)>/g, '<h2$1 style="color: #f1f5f9; font-size: 18px; font-weight: 600; margin-top: 20px; margin-bottom: 10px;">')
    .replace(/<h3(.*?)>/g, '<h3$1 style="color: #e2e8f0; font-size: 15px; font-weight: 600; margin-top: 16px; margin-bottom: 8px;">')
    .replace(/<p(.*?)>/g, '<p$1 style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">')
    .replace(/<ul(.*?)>/g, '<ul$1 style="margin-bottom: 12px; padding-left: 20px; color: #e2e8f0;">')
    .replace(/<li(.*?)>/g, '<li$1 style="color: #e2e8f0; font-size: 14px; margin-bottom: 6px; line-height: 1.6;">')
    .replace(/<table(.*?)>/g, '<table$1 border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; font-size: 14px; margin-bottom: 20px;">')
    .replace(/<th(.*?)>/g, '<th$1 style="background-color: rgba(255,255,255,0.05); padding: 12px; text-align: left; border: 1px solid rgba(255,255,255,0.15); font-weight: 600;">')
    .replace(/<td(.*?)>/g, '<td$1 style="padding: 12px; border: 1px solid rgba(255,255,255,0.15);">')
    .replace(/<strong(.*?)>/g, '<strong$1 style="color: #ffffff; font-weight: 700;">');
    
  return html;
}

// Generate and send daily email report
async function sendDailyEmailReport(emailAddress: string, reportType: 'daily' | 'weekly' | 'monthly' = 'daily', customData?: { report: string, insights: string[], periodNameStr?: string, total?: number, redFlags?: number }) {
  console.log(`Preparing ${reportType} AI email report for ${emailAddress}...`);
  try {
    const firestore = getDb();
    
    let data;
    if (customData && customData.report) {
      console.log('Using custom report data from request...');
      data = {
        insights: customData.insights,
        report: customData.report,
        reportType: reportType,
        tickets: [] // We might not have raw tickets, but we can just show the report
      };
    } else {
      // Retrieve latest report from DB
      let docSnap = await getDoc(doc(firestore, 'ai_insights', 'latest'));
      data = docSnap.exists() ? docSnap.data() : null;
      
      // If no data exists or type mismatches, run generation first
      if (!data || !data.report || data.reportType !== reportType) {
        console.log('No existing insights found or mismatching report type. Generating first...');
        await generateDailyInsights(reportType);
        docSnap = await getDoc(doc(firestore, 'ai_insights', 'latest'));
        data = docSnap.exists() ? docSnap.data() : null;
      }
    }
    
    const insights = data?.insights || [
      "최근 비자 및 체류 관련 상담 문의가 증가하는 추세입니다.",
      "근로 여건 및 기숙사 환경에 대한 점검 및 보완이 필요합니다.",
      "안전 보건 교육 활성화를 통한 산업재해 예방이 권장됩니다."
    ];
    const reportMarkdown = data?.report || "# 일일 보고서\n\n현재 등록된 상담 데이터가 부족하여 기본 리포트를 출력합니다.";
    const ticketsData = data?.tickets || [];
    
    let periodName = reportType === 'weekly' ? '전주 1주일' : reportType === 'monthly' ? '전월 1개월' : '전일';
    let reportTitle = reportType === 'weekly' ? '주간 보고서' : reportType === 'monthly' ? '월간 보고서' : '일일 보고서';
    let reportTitleShort = reportType === 'weekly' ? '주간' : reportType === 'monthly' ? '월간' : '일일';
    
    if (customData && customData.periodNameStr) {
      periodName = customData.periodNameStr + ' 데이터';
      reportTitle = 'AI 실적 보고서 (' + customData.periodNameStr + ')';
      reportTitleShort = 'AI 실적 (' + customData.periodNameStr + ')';
    }
    
    // Fetch stats for the email overview
    // In this case, we'll re-calculate basic numbers from ticketsData
    const total = ticketsData.length;
    let completed = 0; // We didn't save status in tickets array, but we can just use total as basic info, or re-fetch
    const ticketsSnapshot = await getDocs(collection(firestore, 'counseling_tickets'));
    const allTickets: any[] = [];
    ticketsSnapshot.forEach(doc => {
      allTickets.push(doc.data());
    });
    // However, the email needs to reflect the current period's total/completed. We'll use the total from ticketsData as the period's total.
    // For complete stats, let's just re-calculate from all tickets for simplicity if needed, or pass them in data.
    // Actually, data has everything we need if we had saved it, but we didn't save total/completed to latest.
    // We'll calculate the period's total and redFlags directly from ticketsData.
    const periodTotal = customData?.total !== undefined ? customData.total : ticketsData.length;
    const periodRedFlags = customData?.redFlags !== undefined ? customData.redFlags : ticketsData.filter((t: any) => t.긴급여부 && t.긴급여부.includes('예')).length;
    const periodCompletionRate = 100; // Simplified for the report since we just process what we have
    
    const reportHtml = markdownToHtml(reportMarkdown);
    const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const tableRowsHtml = ticketsData.map((t: any) => {
      const isRedFlag = t.긴급여부 && t.긴급여부.includes('예');
      return `
        <tr style="background-color: ${isRedFlag ? 'rgba(239, 68, 68, 0.05)' : 'transparent'};">
          <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #cbd5e1; font-size: 13px;">${t.업체명}</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #cbd5e1; font-size: 13px;">${t.이름}</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #cbd5e1; font-size: 13px;">
            <span style="background-color: rgba(255, 255, 255, 0.05); padding: 4px 8px; border-radius: 4px; font-size: 11px;">${t.카테고리}</span>
          </td>
          <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: ${isRedFlag ? '#ef4444' : '#cbd5e1'}; font-size: 13px; font-weight: ${isRedFlag ? 'bold' : 'normal'};">
            ${isRedFlag ? '⚠️ ' : ''}${t.상담요약}
          </td>
        </tr>
      `;
    }).join('');

    const tableHtml = `
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 25px; margin-top: 30px;">
        <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0;">📎 전체 상담 현황 요약 (${periodName})</h3>
        <div style="overflow-x: auto;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; overflow: hidden; text-align: left;">
            <thead>
              <tr style="background-color: rgba(255, 255, 255, 0.03);">
                <th style="padding: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 12px; font-weight: 500; width: 15%;">업체명</th>
                <th style="padding: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 12px; font-weight: 500; width: 15%;">이름</th>
                <th style="padding: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 12px; font-weight: 500; width: 15%;">분야</th>
                <th style="padding: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 12px; font-weight: 500;">상담 요약</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #64748b; font-size: 13px;">해당 기간 내 상담 내역이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>외국인지원센터 외국인 지원센터 상담 실적 보고서</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0f172a; padding: 40px 10px;">
        <tr>
          <td>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 650px; background-color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 35px 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td>
                        <span style="color: #60a5fa; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">HD HYUNDAI SAMHO</span>
                        <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 8px 0 0 0; letter-spacing: -0.5px;">HD현대삼호 외국인지원센터 ${reportTitleShort} 보고서</h1>
                        <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">${todayStr} 기준 자동 발송</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Content Body -->
              <tr>
                <td style="padding: 40px;">
                  
                  <!-- KPIs -->
                  <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0;">📊 종합 현황 (${periodName})</h3>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                    <tr>
                      <td width="48%" style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 15px; text-align: center;">
                        <span style="color: #94a3b8; font-size: 12px; font-weight: 500;">진행/접수 건수</span>
                        <div style="color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 4px;">${periodTotal} <span style="font-size: 13px; font-weight: 500; color: #94a3b8;">건</span></div>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="background-color: ${periodRedFlags > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${periodRedFlags > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}; border-radius: 12px; padding: 15px; text-align: center;">
                        <span style="color: #94a3b8; font-size: 12px; font-weight: 500;">긴급 위험 감지 (Red Flag)</span>
                        <div style="color: ${periodRedFlags > 0 ? '#ef4444' : '#ffffff'}; font-size: 22px; font-weight: 700; margin-top: 4px;">${periodRedFlags} <span style="font-size: 13px; font-weight: 500; color: #94a3b8;">건</span></div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Quick Insights -->
                  <div style="background-color: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 4px 12px 12px 4px; padding: 20px; margin-bottom: 35px;">
                    <h3 style="color: #60a5fa; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">💡 AI 주요 인사이트</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                      ${insights.map((insight: string) => `<li style="color: #cbd5e1; font-size: 13.5px; line-height: 1.6; margin-bottom: 8px;">${insight}</li>`).join('')}
                    </ul>
                  </div>
                  
                  <!-- Detailed Report Section -->
                  <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 25px;">
                    <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0;">📝 실적 보고서 세부 사항</h3>
                    <div style="background-color: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 14px; padding: 25px; color: #cbd5e1;">
                      ${reportHtml}
                    </div>
                  </div>
                  
                  
                  
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0f172a; padding: 25px 40px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                  <p style="color: #64748b; font-size: 11px; margin: 0; line-height: 1.5;">본 메일은 HD현대삼호 외국인지원센터 AI 모니터링 시스템에서 정기적으로 자동 생성 및 발송하는 실적 보고서입니다.</p>
                  <p style="color: #475569; font-size: 10px; margin: 8px 0 0 0;">© 2026 HD Hyundai Samho Foreign Support Center. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
    
    // Transporter configuration
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) {
      // Option A: Gmail API (OAuth2) via HTTP to bypass Render SMTP blocking
      const oAuth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
      );
      oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

      const fromAddress = process.env.SMTP_USER || 'hshi.dongbang1@gmail.com';
      const fromName = 'HD현대삼호 외국인지원센터 AI';
      const utf8FromName = `=?utf-8?B?${Buffer.from(fromName).toString('base64')}?=`;
      const subject = `HD현대삼호 외국인지원센터 ${reportTitleShort} 보고서`;
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: ${utf8FromName} <${fromAddress}>`,
        `To: ${emailAddress}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/html; charset="utf-8"',
        'MIME-Version: 1.0',
        '',
        htmlContent
      ];
      const message = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      console.log(`Daily AI Email Report sent successfully to ${emailAddress} via Gmail API HTTP!`);
      console.log('Message ID:', res.data.id);
      return { success: true, messageId: res.data.id };
    }

    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({ // @ts-ignore

        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: parseInt(process.env.SMTP_PORT || '587') === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 20000,
        family: 4, // Force IPv4 to prevent ENETUNREACH on Render
        tls: {
          rejectUnauthorized: false
        }
      });
    } else {
      console.log('No SMTP config found. Creating Ethereal test account for email sending...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({ // @ts-ignore

        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        }
      });
    }
    
    const mailOptions = {
      from: `"HD현대삼호 외국인지원센터 AI" <${process.env.SMTP_USER || 'hshi.dongbang1@gmail.com'}>`,
      to: emailAddress,
      subject: `HD현대삼호 외국인지원센터 ${reportTitleShort} 보고서`,
      html: htmlContent
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`Daily AI Email Report sent successfully to ${emailAddress} via SMTP!`);
    console.log('Message ID:', info.messageId);
    
    const testUrl = nodemailer.getTestMessageUrl(info);
    if (testUrl) {
      console.log('Ethereal Test Inbox URL to view sent email:', testUrl);
      return { success: true, testUrl, messageId: info.messageId };
    }
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending daily email report:', error);
    const errorMessage = typeof error.response === 'string' ? error.response : (error.message || String(error));
    if (errorMessage.includes('535-5.7.8') || errorMessage.includes('Username and Password not accepted')) {
      console.error('=========================================');
      console.error('SMTP Authentication Failed!');
      console.error('If you are using Gmail, you MUST use an "App Password" rather than your regular account password.');
      console.error('Please generate an App Password in your Google Account settings (Security -> 2-Step Verification -> App passwords)');
      console.error('and update the SMTP_PASS environment variable.');
      console.error('=========================================');
    }
    throw error;
  }
}

// Scheduled automatic reminder for upcoming counseling sessions (every minute)
cron.schedule('* * * * *', async () => {
  try {
    const firestore = getDb();
    
    // Find tickets that are '배정완료' and haven't sent a reminder yet
    const q = query(
      collection(firestore, 'counseling_tickets'),
      where('status', '==', '배정완료')
    );
    
    const snapshot = await getDocs(q);
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;
    
    for (const ticketDoc of snapshot.docs) {
      const ticket = ticketDoc.data();
      
      // Skip if already sent
      if (ticket.reminder_sent) continue;
      
      if (ticket.reservation_time) {
        const resTime = new Date(ticket.reservation_time).getTime();
        const timeDiff = resTime - now;
        
        // If reservation is in <= 30 minutes (but not in the past by more than 10 mins to avoid stale alerts)
        if (timeDiff <= THIRTY_MINUTES && timeDiff > -10 * 60 * 1000) {
          console.log(`Sending 30-min reminder for ticket ${ticketDoc.id}`);
          
          // Fetch counselor to get their chat ID
          let counselorChatId = undefined;
          if (ticket.counselor_id) {
            const counselorDoc = await getDoc(doc(firestore, 'counselors', ticket.counselor_id));
            if (counselorDoc.exists()) {
              counselorChatId = counselorDoc.data().telegram_chat_id;
            }
          }

          // Trigger internal fetch to our telegram notify endpoint
          try {
            await fetch('http://localhost:3000/api/notify-telegram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ticket: ticket,
                telegram_chat_id: counselorChatId,
                type: 'REMINDER'
              })
            });
            
            // Mark as sent
            await updateDoc(doc(firestore, 'counseling_tickets', ticketDoc.id), {
              reminder_sent: true
            });
          } catch (err) {
            console.error(`Failed to send reminder for ticket ${ticketDoc.id}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in scheduled counseling reminder:', err);
  }
});

// 매일 아침 8시 - 일일 보고서
cron.schedule('0 8 * * *', async () => {
  console.log('Running scheduled Daily Report generation and delivery at 8:00 AM');
  try {
    const firestore = getDb();
    const docSnap = await getDoc(doc(firestore, 'settings', 'email_config'));
    const recipients = docSnap.exists() && docSnap.data().recipients ? docSnap.data().recipients : ['p021435@hd.com'];
    
    for (const email of recipients) {
      await sendDailyEmailReport(email, 'daily');
    }
  } catch (err) {
    console.error('Error in scheduled daily report delivery:', err);
  }
});

// 매주 월요일 아침 8시 - 주간 보고서
cron.schedule('0 8 * * 1', async () => {
  console.log('Running scheduled Weekly Report generation and delivery at 8:00 AM');
  try {
    const firestore = getDb();
    const docSnap = await getDoc(doc(firestore, 'settings', 'email_config'));
    const recipients = docSnap.exists() && docSnap.data().recipients ? docSnap.data().recipients : ['p021435@hd.com'];
    
    for (const email of recipients) {
      await sendDailyEmailReport(email, 'weekly');
    }
  } catch (err) {
    console.error('Error in scheduled weekly report delivery:', err);
  }
});

// 매월 1일 아침 8시 - 월간 보고서
cron.schedule('0 8 1 * *', async () => {
  console.log('Running scheduled Monthly Report generation and delivery at 8:00 AM');
  try {
    const firestore = getDb();
    const docSnap = await getDoc(doc(firestore, 'settings', 'email_config'));
    const recipients = docSnap.exists() && docSnap.data().recipients ? docSnap.data().recipients : ['p021435@hd.com'];
    
    for (const email of recipients) {
      await sendDailyEmailReport(email, 'monthly');
    }
  } catch (err) {
    console.error('Error in scheduled monthly report delivery:', err);
  }
});

// Disable auto-triggering on startup in dev to save Gemini quota
/*
setTimeout(async () => {
  try {
    // await generateDailyInsights();
    const firestore = getDb();
    const docSnap = await getDoc(doc(firestore, 'settings', 'email_config'));
    const recipients = docSnap.exists() && docSnap.data().recipients ? docSnap.data().recipients : ['p021435@hd.com'];
    
    console.log(`Startup daily insights check disabled. To test, use the manual trigger API.`);
  } catch (err) {
    console.error('Error in initial daily AI insights and email delivery on startup:', err);
  }
}, 10000);
*/

// API route to get the latest pre-computed daily insights
app.get('/api/get-latest-insights', async (req, res) => {
  try {
    const firestore = getDb();
    const docSnap = await getDoc(doc(firestore, 'ai_insights', 'latest'));
    if (docSnap.exists()) {
      res.json(docSnap.data());
    } else {
      res.json({
        insights: [
          "이번 주 베트남 국적 근로자의 '비자/체류' 문의가 전주 대비 42% 증가했습니다.",
          "임금 및 근로조건 관련 상담이 안정세를 유지하고 있으나 지속적인 모니터링이 필요합니다.",
          "일부 우즈베키스탄 작업장에서 기숙사 소음 관련 민원 및 건의사항이 접수되었습니다."
        ],
        report: "",
        updated_at: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('Failed to get latest insights:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger to send the AI email report immediately
app.post('/api/test-email-report', async (req, res) => {
  try {
    const firestore = getDb();
    const docSnap = await getDoc(doc(firestore, 'settings', 'email_config'));
    let recipients = docSnap.exists() && docSnap.data().recipients ? docSnap.data().recipients : ['p021435@hd.com'];
    
    if (req.body && req.body.email) {
      recipients = [req.body.email];
    }
    
    const reportType = (req.body && req.body.type) ? req.body.type : 'daily';
    const customData = (req.body && req.body.customReport) ? {
      report: req.body.customReport,
      insights: req.body.customInsights,
      periodNameStr: req.body.customPeriodName,
      total: req.body.customTotal,
      redFlags: req.body.customRedFlags
    } : undefined;
    
    const results = [];
    let firstTestUrl = null;
    for (const email of recipients) {
      const result = await sendDailyEmailReport(email, reportType, customData);
      results.push(result);
      if (result.testUrl && !firstTestUrl) {
        firstTestUrl = result.testUrl;
      }
    }
    res.json({ 
      message: `${reportType} report emails sent successfully`, 
      results,
      testUrl: firstTestUrl
    });

  } catch (error: any) {
    console.error('Failed to send test email report:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-insights', async (req, res) => {
  try {
    const { stats } = req.body;
    
    let ai;
    try {
      ai = getAI('report');
    } catch (err: any) {
      console.warn('Gemini API key is not configured. Using fallback mock insights.');
      return res.json({
        insights: [
          "Gemini API 키가 설정되지 않아 AI 분석 기능이 비활성화되었습니다.",
          "설정 메뉴 또는 환경 변수(GEMINI_API_KEY)에 API 키를 등록해주세요.",
          "실제 접수/처리 내역은 하단 목록에서 정상적으로 확인 가능합니다."
        ],
        report: "# ⚠️ AI 리포트 생성 불가 안내\n\n현재 구글 Gemini API 키가 환경변수에 설정되지 않아 리포트를 자동 생성할 수 없습니다.\n\n* **원인**: 시스템에 `GEMINI_API_KEY`가 입력되지 않음\n* **조치**: 환경 설정에서 API 키를 등록해주세요.\n\n> 하단의 개별 데이터 목록은 정상적으로 조회 가능합니다."
      });
    }
    
    const prompt = `너는 HD현대삼호 외국인지원센터의 수석 분석가다.
다음은 기간 내 실제 접수 및 처리된 외국인 근로자 상담 통계 데이터다.

[통계 데이터]
${JSON.stringify(stats, null, 2)}

위 데이터를 기반으로 "AI 심층 분석 리포트"를 마크다운으로 작성하라.

[작성 지침]
1. 어조 및 문체: 과도한 강조어, 형용사, 부사를 철저히 배제하고, 팩트(사실) 위주의 담백하고 객관적인 문체를 사용할 것. 모든 문장은 명사형 종결이나 간결한 개조식(bullet points)으로 작성할 것.
2. 구성 (필수 포함):
    - **[핵심 성과 요약]**: 상담 성과 요약 및 기타 업무 실적(번역, 현장지원, 교육통역 등) 종합 요약.
    - **[데이터 심층 분석]**: 국적별, 유형별 상담 통계를 바탕으로 한 구조적 트렌드 분석. 
    - **[기타 업무 실적 현황]**: 통역사들의 상담 외 주요 실적(otherTasks 데이터 활용)을 요약 보고. 어떤 통역사가 어떤 업무까지 했는지 구체적으로 보고서에 기재.
    - **[주요 리스크 및 취약점]**: 긴급(고위험군) 사례를 중심으로 잠재적인 리스크 분석.
    - **[전략적 제언 및 향후 계획]**: 개선 방안 및 전략적 제언.
3. 형식: 제목, 부제목(##, ###), 굵은 글씨(**), 마크다운 표(|---|) 등을 적절히 활용하여 시각적으로 깔끔하게 구성할 것.

결과는 다음 JSON 형식으로 반환할 것:
1. "insights": 대시보드 상단 노출용 핵심 인사이트 3줄 (텍스트만).
2. "report": 위 요구사항을 완벽히 반영한 마크다운 리포트 전문.

반드시 아래 JSON 스키마로만 결과를 반환해라. 마크다운(\`\`\`json) 제외.
{
  "insights": ["인사이트 1", "인사이트 2", "인사이트 3"],
  "report": "# 외국인 지원센터 AI 심층 분석 리포트\\n\\n..."
}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });
      let rawText = response?.text || '{}';
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      
      res.json(extractJson(rawText));
    } catch (err: any) {
      if (err.message && (err.message.includes('suspended') || err.message.includes('PERMISSION_DENIED') || err.message.includes('403'))) {
        console.error('Gemini API key is suspended or denied. Please update the API key in settings.');
        res.json({ reply: "제공된 AI API 키가 정지(Suspended)되었거나 권한이 없습니다.\n새로운 정상적인 API 키를 환경변수에 등록해주세요." });
      } else if (err.message && (err.message.includes('429') || err.message.includes('Quota') || err.message.includes('401') || err.message.includes('UNAUTHENTICATED'))) {
        console.warn('Gemini API quota exceeded in /api/generate-insights. Using fallback mock insights.');
        res.json({
          insights: [
            "현재 AI API 일일 할당량이 초과되어 요약이 일시 중지되었습니다.",
            "시스템 안정화를 위해 잠시 후 다시 시도하거나 내일 이용해 주세요.",
            "실제 접수/처리 내역은 하단 목록에서 정상적으로 확인 가능합니다."
          ],
          report: "# ⚠️ AI 리포트 생성 제한 안내\n\n현재 구글 Gemini AI 일일 제공량(무료 할당량)이 초과되어 리포트를 자동 생성할 수 없습니다.\n\n* **원인**: 단기간 내 과도한 AI 리포트/요약 생성 요청 (1일 무료 제공량 초과)\n* **조치**: 내일 다시 이용하시거나, 관리자에게 문의해 주세요.\n\n> 하단의 개별 데이터 목록은 정상적으로 조회 가능합니다."
        });
      } else {
        throw err;
      }
    }
  } catch (error: any) {
    console.error('AI Insights Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trigger-daily-insights', async (req, res) => {
  try {
    await generateDailyInsights();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notify-telegram', async (req, res) => {
  try {
    const { ticket, telegram_chat_id, type = 'NEW_TICKET', counselor_name } = req.body;
    console.log('[notify-telegram] Received request with ticket worker_name:', ticket?.worker_name, 'chat_id:', telegram_chat_id, 'type:', type);
    
    const firestore = getDb();
    const telegramConfigDoc = await getDoc(doc(firestore, 'settings', 'telegram_config'));
    
    let botToken = process.env.TELEGRAM_BOT_TOKEN;
    let groupChatId = null; // Ignore process.env.TELEGRAM_CHAT_ID;
    
    if (telegramConfigDoc.exists()) {
      const configData = telegramConfigDoc.data();
      if (configData.bot_token) {
        botToken = configData.bot_token;
      }
      if (configData.group_chat_id) {
        groupChatId = configData.group_chat_id;
      }
    }
    
    let title = '🚨 <b>신규 상담 접수 알림</b>';
    if (type === 'ASSIGNED') {
      title = '✅ <b>상담 배정 알림</b> (통역위원 배정 완료)';
    } else if (type === 'REMINDER') {
      title = '⏰ <b>상담 예약 30분 전 알림</b>';
    }

    const escapeHtml = (text: any) => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    const formatDate = (dateString: string | undefined | null) => {
      if (!dateString) return '미지정';
      const parsed = new Date(dateString);
      if (isNaN(parsed.getTime())) return '미지정 (유효하지 않은 날짜)';
      return parsed.toLocaleString('ko-KR');
    };

    const message = `
${title}
─────────────────
👤 <b>이름:</b> ${escapeHtml(ticket.worker_name)}
🆔 <b>사번:</b> ${escapeHtml(ticket.emp_id)}
📞 <b>연락처:</b> ${escapeHtml(ticket.phone_number || '-')}
🌐 <b>국적:</b> ${escapeHtml(ticket.country)} / <b>소속:</b> ${escapeHtml(ticket.company_code)}
${type === 'ASSIGNED' ? `👨‍💼 <b>배정 통역사:</b> ${escapeHtml(counselor_name || ticket.counselor_name || ticket.counselor_id)}\n` : ''}🔖 <b>분야:</b> ${escapeHtml(ticket.category)}

🕒 <b>예약 일시:</b> ${formatDate(ticket.reservation_time)}
⚠️ <b>중요도:</b> ${ticket.urgency === 'high' ? '🔴 높음' : ticket.urgency === 'medium' ? '🟡 보통' : '🟢 낮음'}

👉 <a href="https://samho-support.onrender.com">접수 검토 바로가기</a>
`;

    // Gather distinct chat IDs to notify (counselor personal + global/center group chat)
    const targetChatIds = new Set<string>();
    if (telegram_chat_id) {
      targetChatIds.add(String(telegram_chat_id).trim());
    }
    if (groupChatId) {
      targetChatIds.add(String(groupChatId).trim());
    }
    
    // Add all managers (ID starts with admin) who have a telegram_chat_id
    try {
      const counselorsRef = collection(firestore, 'counselors');
      const counselorsSnap = await getDocs(counselorsRef);
      counselorsSnap.forEach(doc => {
        const data = doc.data();
        if (data.id && String(data.id).toLowerCase().startsWith('admin')) {
          if (data.telegram_chat_id) {
            targetChatIds.add(String(data.telegram_chat_id).trim());
          }
        }
      });
    } catch (err) {
      console.error('Failed to fetch managers for telegram notification:', err);
    }
    
    if (botToken && targetChatIds.size > 0) {
      const sendPromises = Array.from(targetChatIds).map(async (chatId) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: 'HTML'
            })
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Failed to send Telegram message to ${chatId}: Status ${response.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (err) {
          console.error(`Error sending to Telegram chat ID ${chatId}:`, err);
        }
      });
      
      await Promise.all(sendPromises);
    } else {
      console.log('[Mock Telegram] Sending message to target chat IDs:', Array.from(targetChatIds), message);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Telegram Notification Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test-telegram', async (req, res) => {
  try {
    const { bot_token, group_chat_id } = req.body;
    
    const token = bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = group_chat_id; // Ignore process.env.TELEGRAM_CHAT_ID;
    
    if (!token) {
      return res.status(400).json({ error: '텔레그램 봇 토큰(TELEGRAM_BOT_TOKEN)이 설정되지 않았습니다.' });
    }
    if (!chatId) {
      return res.status(400).json({ error: '텔레그램 Chat ID가 설정되지 않았습니다.' });
    }
    
    const message = `🔔 <b>HD현대삼호 외국인지원센터 AI</b>\n\n텔레그램 알림 테스트 성공!\n현재 외국인지원센터 텔레그램 연동이 완벽하게 연결되었습니다.`;
    
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.description === 'Bad Request: chat not found') {
        throw new Error('채팅방을 찾을 수 없습니다 (chat not found). 봇에게 먼저 메시지(/start)를 보냈는지 확인하시거나, 단체방에 봇이 초대되어 있는지 확인해주세요.');
      }
      if (errorData.description === 'Not Found' || response.status === 404 || response.status === 401) { throw new Error('텔레그램 봇 토큰(Bot Token)이 올바르지 않거나 봇을 찾을 수 없습니다.'); } throw new Error(errorData.description || `Telegram API responded with status ${response.status}`);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Test Telegram Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, category, referenceUrl, language } = req.body;
    
    let referenceText = '';
    
    // Read local knowledge files
    const knowledgeDir = path.join(process.cwd(), 'src', 'knowledge');
    try {
      if (fs.existsSync(knowledgeDir)) {
        const files = fs.readdirSync(knowledgeDir);
        for (const file of files) {
          if (file.endsWith('.md') || file.endsWith('.txt')) {
            const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8');
            referenceText += `\n--- [${file}] ---\n${content}\n`;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading knowledge files:', e);
    }

    if (referenceUrl) {
      try {
        const refResponse = await fetch(referenceUrl);
        if (refResponse.ok) {
          referenceText += `\n--- [Reference URL] ---\n` + await refResponse.text();
        } else {
          console.warn('Failed to fetch reference URL:', referenceUrl);
        }
      } catch (e) {
        console.warn('Error fetching reference URL:', e);
      }
    }


    const systemInstruction = `너는 HD현대삼호 조선소 외국인지원센터의 긴급 상담 챗봇이다.
현재 상담 분야는 [${category}]이다.
질문자(사용자)의 언어는 [${language}]이다. 가장 중요한 규칙: 반드시 사용자가 선택한 언어([${language}])로만 대답해라. 사용자가 다른 언어로 질문하더라도 대답은 무조건 [${language}]로 작성해라. 한국어는 포함하지 마라.
근로자나 담당자가 긴급하게 문의하는 내용에 대해 전문적이고 친절하게, 그리고 신속하게 답변해야 한다.
가독성을 높이기 위해 줄바꿈, 글머리 기호(마크다운) 등을 적절히 사용해서 문장을 보기 좋게 정리해서 답변해라.

[상담 기본 방향]
- 협력사(하청업체) 소속 외국인의 경우: 1차적으로 소속 업체의 대표, 총무, 또는 소장에게 문의하여 해결을 요청하도록 안내해라. 만약 업체 관계자와 문제가 있거나 해결이 불가능한 경우, 관련 정부 기관(고용노동부 등)에 도움을 요청할 수 있도록 연결해주어라.
- 직영 소속 외국인의 경우: 1차적으로 소속 부서의 팀장에게 문의하여 해결을 요청하도록 안내하고, 이후 사내의 정해진 절차를 따르도록 안내해라.

${referenceText ? `[사내 규정 및 전문 지식]\n${referenceText}\n위 참고 자료를 우선적으로 기반하여 정확하게 답변하라.` : '일반적인 노무 관리 및 외국인 근로자 지원 규정을 바탕으로 답변하라.'}`;

const ai = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT_ID || 'YOUR_GOOGLE_CLOUD_PROJECT_ID',
      location: 'asia-northeast3'
    });

    const vertexContents = history.map((msg: any) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    vertexContents.push({ role: 'user', parts: [{ text: message }] });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: vertexContents,
        config: {
          systemInstruction: systemInstruction
        }
      });
      res.json({ reply: response.text || '' });
    } catch (err: any) {
      console.error('Vertex AI Error in /api/chat:', err.message || err);
      res.json({ reply: "현재 AI API 호출에 실패했습니다. 관리자에게 문의하세요." });
    }
  } catch (error: any) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate chat response' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
