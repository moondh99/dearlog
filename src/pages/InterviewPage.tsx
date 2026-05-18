import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, Loader2, ImageUp } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../components/Layout';
import { createSilenceDetector, SilenceDetector } from '../lib/interview/silence-detector';
import SilenceIndicator from '../components/SilenceIndicator';
import StatusNotice, { type StatusNoticeTone } from '../components/StatusNotice';
import { handleInterviewMessage, injectFamilyQuestion, processEndOfSession, processPhotoUpload } from '../lib/agents/router';
import { getNextQuestion, isInjectionAppropriate, markAnswered, notifyQuestioner } from '../lib/agents/family-question-queue';
import { linkMemoryToPhoto } from '../lib/agents/photo-recall';
import { buildShortAnswerNudge, estimateInterviewProgress, shouldNudgeForShortAnswer } from '../lib/insights/memory-insights';
import type { ChatMessage, SessionContext, SilenceState, EmotionClassification, Memory, PhotoAnalysisResult } from '../lib/types';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const DEFAULT_EMOTION_STATE: EmotionClassification = {
  current: 'neutral',
  trajectory: [],
  confidence: 0,
};

const DEFAULT_SILENCE_STATE: SilenceState = {
  isActive: false,
  silenceDuration: 0,
  phase: 'normal',
};

const OPENING_MEMORY_CURSOR_KEY = 'dearlog-opening-memory-cursor';

type PhotoPreviewState = {
  url: string;
  fileName: string;
  status: 'analyzing' | 'ready' | 'error';
  analysis: PhotoAnalysisResult | null;
};

function buildAnalysisTags(analysis: PhotoAnalysisResult): string[] {
  return [
    ...analysis.people.map((person) => `인물: ${person}`),
    ...analysis.places.map((place) => `장소: ${place}`),
    ...analysis.objects.map((object) => `사물: ${object}`),
  ].slice(0, 6);
}

function buildContextualOpening(memories: Memory[]): string | null {
  const candidates = memories
    .filter((memory) => memory.cleanedTranscript.trim() || memory.publishVersion.trim() || memory.topic.trim())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (candidates.length === 0) return null;

  const currentCursor = Number(window.localStorage.getItem(OPENING_MEMORY_CURSOR_KEY) ?? '0');
  const index = Number.isFinite(currentCursor) ? currentCursor % candidates.length : 0;
  const memory = candidates[index];
  window.localStorage.setItem(OPENING_MEMORY_CURSOR_KEY, String((index + 1) % candidates.length));

  const topic = memory.topic?.trim() || '지난번 이야기';
  const person = memory.tags.people.find(Boolean);
  const place = memory.tags.places.find(Boolean);
  const emotion = memory.tags.emotions.find(Boolean);
  const timePeriod = memory.tags.timePeriod?.trim();
  const excerpt = (memory.cleanedTranscript || memory.publishVersion || memory.originalTranscript)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  if (person) {
    return `어르신, 지난번에 "${topic}" 이야기를 들려주셨지요. 그 이야기 속 ${person}님에 대해 조금 더 여쭤보고 싶습니다. 그분과 함께했던 장면 중 아직 마음에 남아 있는 순간이 있으실까요?`;
  }

  if (place) {
    return `어르신, 보관함에 남아 있는 "${topic}" 이야기를 다시 이어가 보고 싶습니다. ${place}의 분위기나 풍경이 지금도 떠오르신다면, 어떤 모습이 가장 선명하신가요?`;
  }

  if (emotion) {
    return `어르신, 지난 기록에서 "${topic}" 이야기에 ${emotion}의 마음이 담겨 있었습니다. 그 마음이 들었던 까닭을 오늘 조금 더 들려주실 수 있을까요?`;
  }

  if (timePeriod) {
    return `어르신, "${topic}" 이야기는 ${timePeriod} 무렵의 기억으로 남아 있네요. 그 시절을 떠올리면 가장 먼저 생각나는 사람이나 장소가 있으신가요?`;
  }

  if (excerpt) {
    return `어르신, 지난번에 "${topic}" 이야기를 들려주셨습니다. "${excerpt}${excerpt.length >= 80 ? '...' : ''}" 이 기억에서 오늘은 어떤 부분을 조금 더 이어서 말씀해보고 싶으신가요?`;
  }

  return `어르신, 보관함에 남아 있는 "${topic}" 이야기를 오늘 조금 더 이어가 보고 싶습니다. 그 기억에서 아직 다 하지 못한 말씀이 있으실까요?`;
}

export default function InterviewPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [activeFamilyQuestionId, setActiveFamilyQuestionId] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState | null>(null);
  const [silenceState, setSilenceState] = useState<SilenceState>(DEFAULT_SILENCE_STATE);
  const [notice, setNotice] = useState<{ tone: StatusNoticeTone; title: string; message?: string } | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext>({
    emotionState: DEFAULT_EMOTION_STATE,
    silenceState: DEFAULT_SILENCE_STATE,
    speechProfile: null,
  });

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const silenceDetectorRef = useRef<SilenceDetector>(createSilenceDetector());
  const silenceIntervalRef = useRef<number | null>(null);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const updateMemoryPrivacy = useStore(state => state.updateMemoryPrivacy);
  const speechProfile = useStore(state => state.speechProfile.profile);
  const interviewProgress = estimateInterviewProgress(messages);

  // Keep sessionContext in sync with speechProfile from store
  useEffect(() => {
    setSessionContext(prev => ({ ...prev, speechProfile }));
  }, [speechProfile]);

  useEffect(() => {
    // Initialize with a memory-aware opening when archived memories exist.
    const initChat = async () => {
      setIsTyping(true);
      const contextualOpening = buildContextualOpening(useStore.getState().memories);
      if (contextualOpening) {
        setMessages([{ role: 'model', text: contextualOpening }]);
        setIsTyping(false);
        return;
      }

      try {
        const response = await handleInterviewMessage('', [], sessionContext);
        setMessages([{ role: 'model', text: response.text }]);
        setSessionContext(prev => ({ ...prev, emotionState: response.emotionState }));
      } catch {
        setMessages([{ role: 'model', text: '어르신, 오늘 함께 인생의 소중한 조각들을 모아보고 싶습니다. 가장 기억에 남는 어린 시절의 풍경은 어떤 모습인가요?' }]);
      }
      setIsTyping(false);
    };
    initChat();

    // Setup Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ko-KR';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          // 확정된 결과만 누적
          setTranscript(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
        }

        // Notify silence detector of speech
        silenceDetectorRef.current.onSpeechDetected();
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setNotice({
            tone: 'error',
            title: '마이크 권한이 필요합니다',
            message: '브라우저 주소창의 권한 설정에서 마이크 사용을 허용해 주세요.',
          });
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      // Cleanup silence polling interval
      if (silenceIntervalRef.current !== null) {
        clearInterval(silenceIntervalRef.current);
      }
      silenceDetectorRef.current.stop();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current);
      }
    };
  }, []);

  // Poll silence detector state for UI updates
  const startSilencePolling = () => {
    if (silenceIntervalRef.current !== null) return;
    silenceIntervalRef.current = window.setInterval(() => {
      const state = silenceDetectorRef.current.getState();
      setSilenceState(state);
      setSessionContext(prev => ({ ...prev, silenceState: state }));
    }, 500);
  };

  const stopSilencePolling = () => {
    if (silenceIntervalRef.current !== null) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    setSilenceState(DEFAULT_SILENCE_STATE);
    setSessionContext(prev => ({ ...prev, silenceState: DEFAULT_SILENCE_STATE }));
  };

  const clearPhotoPreview = () => {
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    }
    setPhotoPreview(null);
  };

  const startPhotoPreview = (file: File): string => {
    clearPhotoPreview();
    const previewUrl = URL.createObjectURL(file);
    photoPreviewUrlRef.current = previewUrl;
    setPhotoPreview({
      url: previewUrl,
      fileName: file.name || '선택한 사진',
      status: 'analyzing',
      analysis: null,
    });
    return previewUrl;
  };

  const toggleRecording = () => {
    if (!isSupported) {
      setNotice({
        tone: 'error',
        title: '음성 인식을 지원하지 않는 브라우저입니다',
        message: '음성 녹음을 사용하려면 크롬 브라우저에서 다시 열어 주세요.',
      });
      return;
    }

    try {
      if (isRecording) {
        recognitionRef.current?.stop();
        silenceDetectorRef.current.stop();
        stopSilencePolling();
        setIsRecording(false);
      } else {
        setNotice(null);
        setTranscript('');
        recognitionRef.current?.start();
        silenceDetectorRef.current.start();
        startSilencePolling();
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Recording toggle error:', error);
      setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if (!transcript.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: transcript.trim() };
    const newHistory = [...messages, userMsg];

    setNotice(null);
    setMessages(newHistory);
    setTranscript('');
    setIsTyping(true);

    // Reset silence detector on send
    silenceDetectorRef.current.reset();

    try {
      const response = await handleInterviewMessage(userMsg.text, newHistory, sessionContext);
      const responseHistory: ChatMessage[] = [
        ...newHistory,
        { role: 'model', text: response.text },
        ...(shouldNudgeForShortAnswer(userMsg.text)
          ? [{ role: 'model' as const, text: buildShortAnswerNudge(userMsg.text) }]
          : []),
      ];
      const finalHistory = await maybeInjectFamilyQuestion(responseHistory, userMsg.text);
      setMessages(finalHistory);
      setSessionContext(prev => ({ ...prev, emotionState: response.emotionState }));
    } catch {
      setMessages([...newHistory, { role: 'model', text: '죄송합니다. 잠시 생각이 멈췄네요. 다시 한 번 말씀해 주시겠어요?' }]);
    }
    setIsTyping(false);
  };

  const maybeInjectFamilyQuestion = async (
    currentMessages: ChatMessage[],
    currentContext: string
  ): Promise<ChatMessage[]> => {
    if (activeFamilyQuestionId) return currentMessages;
    if (!isInjectionAppropriate(currentContext, currentMessages)) return currentMessages;

    const question = getNextQuestion(currentContext);
    if (!question) return currentMessages;

    const text = await injectFamilyQuestion(question, sessionContext);
    setActiveFamilyQuestionId(question.id);

    return [...currentMessages, { role: 'model', text }];
  };

  const handleEndSession = async () => {
    if (messages.length < 2) return;

    // Stop silence detection
    silenceDetectorRef.current.stop();
    stopSilencePolling();

    setIsSummarizing(true);
    const userTranscripts = messages
      .filter(m => m.role === 'user')
      .map(m => m.text)
      .join('\n');

    try {
      const result = await processEndOfSession(userTranscripts, messages);
      // Preserve the existing screen behavior: newly completed stories appear
      // in family-facing flows unless the user later changes the privacy level.
      updateMemoryPrivacy(result.memory.id, 'family');
      if (activeFamilyQuestionId) {
        markAnswered(activeFamilyQuestionId, result.memory.id);
        notifyQuestioner(activeFamilyQuestionId);
        setActiveFamilyQuestionId(null);
      }
      if (activePhotoId) {
        linkMemoryToPhoto(activePhotoId, result.memory.id);
        setActivePhotoId(null);
      }
      clearPhotoPreview();

      const skippedAgents = result.errors
        .filter((error) => error.skipped)
        .map((error) => error.agent);

      if (skippedAgents.length > 0) {
        setNotice({
          tone: 'info',
          title: '오늘의 기억 카드가 저장되었습니다',
          message: `일부 고급 처리는 건너뛰었습니다: ${skippedAgents.join(', ')}`,
        });
      } else {
        setNotice({
          tone: 'success',
          title: '오늘의 기억 카드가 저장되었습니다',
          message: '추억 보관함에서 바로 확인할 수 있습니다.',
        });
      }
    } catch (error) {
      console.error('Advanced end-of-session pipeline failed:', error);
      setNotice({
        tone: 'error',
        title: '기억 카드 저장에 실패했습니다',
        message: '잠시 후 다시 시도해 주세요. 입력한 대화는 화면에 그대로 남아 있습니다.',
      });
      setIsSummarizing(false);
      return;
    }

    setIsSummarizing(false);
    setMessages([]);

    // Restart
    setIsTyping(true);
    const contextualOpening = buildContextualOpening(useStore.getState().memories);
    if (contextualOpening) {
      setMessages([{ role: 'model', text: contextualOpening }]);
    } else {
      try {
        const response = await handleInterviewMessage('', [], sessionContext);
        setMessages([{ role: 'model', text: response.text }]);
      } catch {
        setMessages([{ role: 'model', text: '어르신, 오늘 함께 인생의 소중한 조각들을 모아보고 싶습니다. 가장 기억에 남는 어린 시절의 풍경은 어떤 모습인가요?' }]);
      }
    }
    setIsTyping(false);
  };

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;

    const previewUrl = startPhotoPreview(file);
    setNotice(null);
    setIsTyping(true);
    try {
      const result = await processPhotoUpload(file);
      setActivePhotoId(result.analysis.photoId);
      setPhotoPreview((prev) => (
        prev?.url === previewUrl
          ? { ...prev, status: 'ready', analysis: result.analysis }
          : prev
      ));

      const photoIntro = result.analysis.description
        ? `사진을 살펴보니 ${result.analysis.description}`
        : '사진을 함께 보며 떠오르는 기억을 여쭤보고 싶습니다.';
      const questionText = result.interviewQuestions.length > 0
        ? result.interviewQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n')
        : '이 사진을 보시면 가장 먼저 어떤 기억이 떠오르시나요?';

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `${photoIntro}\n\n${questionText}`,
        },
      ]);
      setNotice({
        tone: 'success',
        title: '사진을 회상 질문에 연결했습니다',
        message: '사진에서 떠오르는 이야기를 이어서 말씀해 주세요.',
      });
    } catch (error) {
      console.error('Photo upload pipeline failed:', error);
      setPhotoPreview((prev) => (
        prev?.url === previewUrl
          ? { ...prev, status: 'error' }
          : prev
      ));
      setNotice({
        tone: 'error',
        title: '사진을 불러오지 못했습니다',
        message: '이미지 파일을 확인한 뒤 다시 시도해 주세요.',
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: '사진을 불러오는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Silence indicator callbacks
  const handleSilenceContinue = () => {
    silenceDetectorRef.current.reset();
  };

  const handleSilenceChangeTopic = async () => {
    silenceDetectorRef.current.reset();
    setIsTyping(true);
    try {
      const response = await handleInterviewMessage(
        '다른 이야기를 하고 싶습니다.',
        messages,
        sessionContext
      );
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      setSessionContext(prev => ({ ...prev, emotionState: response.emotionState }));
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: '좋습니다, 다른 이야기를 해볼까요? 어르신이 좋아하시는 계절이나 음식에 대해 이야기해 주시겠어요?' }]);
    }
    setIsTyping(false);
  };

  const handleSilenceEndSession = () => {
    handleEndSession();
  };

  return (
    <div
      data-testid="interview-shell"
      className="grid min-h-0 h-full w-full max-w-6xl mx-auto gap-5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_310px]"
    >
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[32px] border border-border bg-surface shadow-[0_22px_60px_rgba(41,35,33,0.1)]">
        <div className="shrink-0 border-b border-border bg-[#2A2027] px-5 py-5 text-white md:px-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/50">Memory interview</p>
              <h1 className="mt-2 text-[26px] font-black leading-tight md:text-[30px]">말씀 나누기</h1>
              <p className="mt-2 max-w-xl text-[15px] font-semibold leading-relaxed text-white/65">
                음성, 텍스트, 사진을 함께 받아 오늘의 회상을 기억 카드로 정리합니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:min-w-[300px]">
              {[
                ['대화', Math.max(0, messages.filter((message) => message.role === 'user').length)],
                ['사진', activePhotoId ? 1 : 0],
                ['진행', `${interviewProgress.filter((item) => item.covered).length}/${interviewProgress.length}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[18px] border border-white/10 bg-white/8 px-3 py-2">
                  <p className="text-[11px] font-black text-white/48">{label}</p>
                  <p className="mt-1 text-[19px] font-black text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Messages */}
        <div
          data-testid="interview-messages"
          className="min-h-0 flex-1 overflow-y-auto scroll-pb-4 px-4 md:px-8 py-5 md:py-7 space-y-5 md:space-y-7"
        >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "flex flex-col max-w-[92%] md:max-w-[82%]",
              msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <span className="text-[13px] text-text-subtle mb-1.5 px-1 font-semibold">
              {msg.role === 'user' ? '어르신' : 'Dearlog'}
            </span>
            <div
              className={cn(
                "px-5 py-4 md:px-6 md:py-5 leading-relaxed rounded-2xl",
                msg.role === 'user'
                  ? "bg-primary text-white text-[17px] md:text-[19px] font-medium"
                  : "bg-surface-alt border border-border text-text text-[18px] md:text-[21px] font-bold"
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {photoPreview && (
          <div data-testid="photo-preview-card" className="mr-auto max-w-[92%] md:max-w-[82%]">
            <span className="text-[13px] text-text-subtle mb-1.5 px-1 font-semibold block">사진 회상</span>
            <div className="overflow-hidden rounded-2xl bg-surface-alt border border-border">
              <img
                src={photoPreview.url}
                alt={`${photoPreview.fileName} 미리보기`}
                className="w-full max-h-[260px] object-contain bg-border"
              />
              <div className="px-5 py-4 md:px-6 md:py-5 space-y-3">
                <div>
                  <p className="text-[12px] font-black text-secondary uppercase tracking-wide">선택한 사진</p>
                  <p className="text-[16px] md:text-[18px] font-bold text-text break-all">{photoPreview.fileName}</p>
                </div>

                {photoPreview.status === 'analyzing' && (
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    사진 속 장면을 살펴보고 있어요...
                  </div>
                )}

                {photoPreview.status === 'ready' && photoPreview.analysis && (
                  <div className="space-y-2">
                    <p className="text-[15px] md:text-[16px] font-semibold text-text-muted leading-relaxed">
                      {photoPreview.analysis.description || '사진에서 떠오르는 장면을 바탕으로 질문을 준비했습니다.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {photoPreview.analysis.estimatedEra !== '알 수 없음' && (
                        <span className="px-2.5 py-1 rounded-lg bg-secondary-pale text-secondary text-[12px] font-bold">
                          {photoPreview.analysis.estimatedEra}
                        </span>
                      )}
                      {buildAnalysisTags(photoPreview.analysis).map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-lg bg-surface border border-border text-[12px] font-bold text-text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {photoPreview.status === 'error' && (
                  <p className="text-[15px] font-semibold text-error">
                    사진 분석에 실패했습니다. 사진은 다시 선택해 주세요.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {isTyping && (
          <div className="mr-auto max-w-[82%]">
            <span className="text-[13px] text-text-subtle mb-1.5 px-1 font-semibold block">Dearlog</span>
            <div className="px-6 py-5 rounded-2xl bg-surface-alt border border-border flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
              <span className="text-[18px] text-text-muted font-semibold">말씀을 듣고 있어요...</span>
            </div>
          </div>
        )}

        {isRecording && (
          <SilenceIndicator
            silenceState={silenceState}
            onContinue={handleSilenceContinue}
            onChangeTopic={handleSilenceChangeTopic}
            onEndSession={handleSilenceEndSession}
          />
        )}

        <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          data-testid="interview-input-panel"
          className="shrink-0 border-t border-border bg-surface px-4 py-4 md:px-6"
        >
        <div className="flex flex-col gap-3">
          {notice && (
            <StatusNotice
              tone={notice.tone}
              title={notice.title}
              message={notice.message}
              onDismiss={() => setNotice(null)}
            />
          )}

          <div className="flex items-end gap-3 md:gap-5">
            {/* Recording button */}
            <button
              onClick={toggleRecording}
              aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
              className={cn(
                "flex items-center justify-center rounded-full shrink-0 transition-all duration-200",
                isRecording
                  ? "w-[72px] h-[72px] md:w-[88px] md:h-[88px] bg-error/10 border-2 border-error/40 text-error ring-4 ring-error/15 animate-pulse"
                  : "w-[68px] h-[68px] md:w-[80px] md:h-[80px] bg-primary text-white shadow-[0_16px_34px_rgba(122,49,67,0.26)] hover:bg-primary-light hover:scale-105"
              )}
            >
              {isRecording
                ? <Square className="w-8 h-8 fill-current" />
                : <Mic className="w-9 h-9" />}
            </button>

            {/* Transcript textarea */}
            <div className="flex-1 relative">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="마이크 버튼을 누르고 말씀하시거나, 여기에 직접 적어주세요."
                className="w-full h-[76px] md:h-[96px] px-4 md:px-5 py-3 md:py-4 pr-14 md:pr-16 rounded-2xl border border-border bg-surface-alt text-[16px] md:text-[18px] resize-none focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none text-text placeholder:text-text-subtle transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!transcript.trim() || isTyping}
                aria-label="말씀 보내기"
                className="absolute right-3 bottom-3 p-2.5 md:p-3 bg-primary text-white rounded-xl disabled:opacity-40 hover:bg-primary-light transition-colors shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* End session button */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3">
            <label className="flex items-center justify-center gap-2 px-5 py-3 md:py-4 bg-surface-alt border border-border rounded-2xl text-[16px] md:text-[17px] font-bold text-text-muted hover:bg-border/30 transition-colors cursor-pointer">
              <ImageUp className="w-5 h-5" />
              사진으로 회상
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = '';
                  handlePhotoUpload(file);
                }}
              />
            </label>
            <button
              onClick={handleEndSession}
              disabled={messages.length < 2 || isSummarizing}
              className="w-full py-3 md:py-4 bg-secondary text-white rounded-2xl text-[16px] md:text-[18px] font-bold hover:bg-secondary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-3 shadow-sm"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  기억 카드 분석 중...
                </>
              ) : (
                '오늘의 이야기 마치기'
              )}
            </button>
          </div>
        </div>
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-y-auto lg:block">
        <div className="space-y-4">
          <section className="rounded-[28px] border border-border bg-surface p-5 shadow-[0_16px_44px_rgba(41,35,33,0.08)]">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Session guide</p>
            <h2 className="mt-2 text-[21px] font-black text-text">오늘의 회상 흐름</h2>
            <div className="mt-5 space-y-2">
              {interviewProgress.map((item) => (
                <div
                  key={item.category}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border px-3 py-3',
                    item.covered
                      ? 'border-primary/18 bg-primary-pale text-primary'
                      : 'border-border bg-surface-alt text-text-muted'
                  )}
                >
                  <span className="text-[14px] font-black">{item.category}</span>
                  <span className="text-[12px] font-black">{item.covered ? '확보' : '대기'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-primary/15 bg-primary-pale p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">좋은 질문</p>
            <div className="mt-4 space-y-3 text-[14px] font-bold leading-relaxed text-primary">
              <p className="rounded-2xl bg-surface px-4 py-3 shadow-sm">그 장면에서 가장 먼저 보이는 사람은 누구였나요?</p>
              <p className="rounded-2xl bg-surface px-4 py-3 shadow-sm">그때의 냄새, 소리, 계절감이 기억나시나요?</p>
              <p className="rounded-2xl bg-surface px-4 py-3 shadow-sm">가족에게 꼭 남기고 싶은 한 문장이 있다면요?</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-surface p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-text-subtle">기록 상태</p>
            <div className="mt-4 space-y-3 text-[14px] font-bold text-text-muted">
              <div className="flex items-center justify-between">
                <span>마이크</span>
                <span className={isRecording ? 'text-error' : 'text-primary'}>{isRecording ? '녹음 중' : '대기'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>사진 연결</span>
                <span className={activePhotoId ? 'text-primary' : 'text-text-subtle'}>{activePhotoId ? '연결됨' : '없음'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>가족 질문</span>
                <span className={activeFamilyQuestionId ? 'text-secondary' : 'text-text-subtle'}>{activeFamilyQuestionId ? '대화 중' : '없음'}</span>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
