import { useState, useEffect, useRef } from 'react';
import { BellRing, CheckCircle2, Inbox, Mic, PhoneCall, Square, Send, Loader2, ImageUp } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../components/Layout';
import { createSilenceDetector, SilenceDetector } from '../lib/interview/silence-detector';
import SilenceIndicator from '../components/SilenceIndicator';
import StatusNotice, { type StatusNoticeTone } from '../components/StatusNotice';
import { handleInterviewMessage, injectFamilyQuestion, processEndOfSession, processPhotoUpload } from '../lib/agents/router';
import { getNextQuestion, isInjectionAppropriate, markAnswered, notifyQuestioner } from '../lib/agents/family-question-queue';
import { linkMemoryToPhoto } from '../lib/agents/photo-recall';
import { buildShortAnswerNudge, estimateInterviewProgress, getMemoryScopeCategories, shouldNudgeForShortAnswer } from '../lib/insights/memory-insights';
import {
  acceptLocalInterviewSession,
  createLocalInterviewSession,
  endLocalInterviewSession,
  fetchLocalNotifications,
  fetchLocalProgress,
  fetchLocalVapidPublicKey,
  markLocalNotificationRead,
  pauseLocalInterviewSession,
  registerLocalPushSubscription,
  saveLocalInterviewRecord,
  uploadLocalAudio,
  type LocalNotification,
} from '../lib/local-server';
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
const MEMORY_SCOPE_CATEGORIES = getMemoryScopeCategories();

type PhotoPreviewState = {
  url: string;
  fileName: string;
  status: 'analyzing' | 'ready' | 'error';
  analysis: PhotoAnalysisResult | null;
};

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildAnalysisTags(analysis: PhotoAnalysisResult): string[] {
  return [
    ...analysis.people.map((person) => `인물: ${person}`),
    ...analysis.places.map((place) => `장소: ${place}`),
    ...analysis.objects.map((object) => `사물: ${object}`),
  ].slice(0, 6);
}

function buildPhotoVisualCue(analysis: PhotoAnalysisResult): string {
  const clues = [
    analysis.estimatedEra && analysis.estimatedEra !== '알 수 없음' ? `시기: ${analysis.estimatedEra}` : null,
    analysis.places[0] ? `장소: ${analysis.places[0]}` : null,
    analysis.people[0] ? `인물: ${analysis.people[0]}` : null,
    analysis.objects[0] ? `사물: ${analysis.objects[0]}` : null,
  ].filter((clue): clue is string => Boolean(clue));

  return clues.length > 0
    ? clues.join(' · ')
    : '사진 속 장면을 단서로 회상을 시작합니다';
}

function buildPhotoInterviewPrompt(analysis: PhotoAnalysisResult, questions: string[]): string {
  const photoIntro = analysis.description
    ? `사진을 살펴보니 ${analysis.description}`
    : '사진을 함께 보며 떠오르는 기억을 여쭤보고 싶습니다.';
  const visualCue = buildPhotoVisualCue(analysis);
  const questionText = questions.length > 0
    ? questions.map((question, index) => `${index + 1}. ${question}`).join('\n')
    : '1. 이 사진을 보시면 가장 먼저 어떤 기억이 떠오르시나요?';

  return `${photoIntro}\n\n사진 단서: ${visualCue}\n\n이 장면을 보며 먼저 여쭤볼 질문입니다.\n${questionText}`;
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
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'idle' | 'registering' | 'ready' | 'error'>('idle');
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [serverProgress, setServerProgress] = useState<{
    character: string;
    totalRecords: number;
    progress: Array<{ count: number; complete: boolean; chapter: { title: string; minAnswerCount: number } }>;
  } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState | null>(null);
  const [silenceState, setSilenceState] = useState<SilenceState>(DEFAULT_SILENCE_STATE);
  const [notice, setNotice] = useState<{ tone: StatusNoticeTone; title: string; message?: string } | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext>({
    emotionState: DEFAULT_EMOTION_STATE,
    silenceState: DEFAULT_SILENCE_STATE,
    speechProfile: null,
  });

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const currentAudioBlobRef = useRef<Blob | null>(null);
  const stopRecordingResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const silenceDetectorRef = useRef<SilenceDetector>(createSilenceDetector());
  const silenceIntervalRef = useRef<number | null>(null);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const updateMemoryPrivacy = useStore(state => state.updateMemoryPrivacy);
  const speechProfile = useStore(state => state.speechProfile.profile);
  const interviewProgress = estimateInterviewProgress(messages);

  const refreshServerProgress = async () => {
    try {
      setServerProgress(await fetchLocalProgress());
    } catch {
      // 로컬 서버가 꺼져 있어도 시니어 인터뷰 화면은 기존 방식으로 계속 사용할 수 있습니다.
    }
  };

  const refreshNotifications = async () => {
    try {
      setNotificationStatus('loading');
      const result = await fetchLocalNotifications('senior');
      setNotifications(result.notifications);
      setUnreadNotificationCount(result.unreadCount);
      setNotificationStatus('idle');
    } catch {
      setNotificationStatus('error');
    }
  };

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

    // Web Push 알림을 눌러 들어온 경우 ringing 세션을 앱 내 음성 인터뷰로 수락합니다.
    const incomingCallSessionId = new URLSearchParams(window.location.search).get('callSessionId');
    const sessionPromise = incomingCallSessionId
      ? acceptLocalInterviewSession(incomingCallSessionId)
      : createLocalInterviewSession('childhood');

    sessionPromise
      .then((result) => {
        setLocalSessionId(result.session.id);
        if (incomingCallSessionId) {
          setNotice({
            tone: 'success',
            title: '앱 인터뷰 전화를 받았습니다',
            message: '마이크 버튼을 누르고 편하게 말씀해 주세요. 음성 원본과 원문은 로컬 서버에 저장됩니다.',
          });
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(() => {
        // 로컬 서버가 꺼져 있어도 기존 프론트 프로토타입 인터뷰는 계속 동작합니다.
      });
    void refreshServerProgress();
    void refreshNotifications();

    // 브라우저 푸시를 놓쳐도 앱을 열어둔 시니어가 새 알림을 확인할 수 있도록 주기적으로 가져옵니다.
    const notificationInterval = window.setInterval(() => {
      void refreshNotifications();
    }, 15_000);

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
        // Chrome SpeechRecognition은 사용자가 녹음을 멈추기 전에도 onend를 낼 수 있습니다.
        // MediaRecorder가 아직 살아 있으면 원본 오디오 저장을 위해 녹음 상태를 유지합니다.
        if (mediaRecorderRef.current?.state !== 'recording') {
          setIsRecording(false);
        }
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
      clearInterval(notificationInterval);
      silenceDetectorRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
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

  const startVoiceCapture = async () => {
    if (!isSupported) {
      setNotice({
        tone: 'error',
        title: '음성 인식을 지원하지 않는 브라우저입니다',
        message: '음성 녹음을 사용하려면 크롬 브라우저에서 다시 열어 주세요.',
      });
      return;
    }

    try {
      setNotice(null);
      setTranscript('');
      currentAudioBlobRef.current = null;
      audioChunksRef.current = [];

      if (navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const blob = audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
            : null;
          currentAudioBlobRef.current = blob;
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          stopRecordingResolverRef.current?.(blob);
          stopRecordingResolverRef.current = null;
        };
        recorder.start();
      }

      recognitionRef.current?.start();
      silenceDetectorRef.current.start();
      startSilencePolling();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording toggle error:', error);
      setIsRecording(false);
      setNotice({
        tone: 'error',
        title: '마이크를 시작하지 못했습니다',
        message: '브라우저 마이크 권한을 허용한 뒤 다시 눌러 주세요.',
      });
    }
  };

  const stopVoiceCapture = async (): Promise<Blob | null> => {
    recognitionRef.current?.stop();
    silenceDetectorRef.current.stop();
    stopSilencePolling();
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      return currentAudioBlobRef.current;
    }

    return new Promise((resolve) => {
      stopRecordingResolverRef.current = resolve;
      recorder.stop();
    });
  };

  const toggleRecording = () => {
    if (isRecording || mediaRecorderRef.current?.state === 'recording') {
      void stopVoiceCapture();
      return;
    }
    void startVoiceCapture();
  };

  const handleRegisterSeniorPush = async () => {
    try {
      setPushStatus('registering');
      const { publicKey } = await fetchLocalVapidPublicKey();
      await registerLocalPushSubscription(publicKey, 'senior');
      setPushStatus('ready');
      setNotice({
        tone: 'success',
        title: '앱 연락 알림이 켜졌습니다',
        message: '보호자가 인터뷰를 시작하면 이 기기로 알림이 옵니다.',
      });
    } catch (error) {
      setPushStatus('error');
      setNotice({
        tone: 'error',
        title: '앱 연락 알림을 켜지 못했습니다',
        message: error instanceof Error ? error.message : 'VAPID 키와 브라우저 알림 권한을 확인해 주세요.',
      });
    }
  };

  const handleNotificationAction = async (notification: LocalNotification) => {
    try {
      await markLocalNotificationRead(notification.id, 'senior');
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, status: 'read', readAt: new Date().toISOString() }
            : item
        )
      );
      setUnreadNotificationCount((count) => Math.max(0, count - (notification.status === 'unread' ? 1 : 0)));

      if (notification.type === 'app_interview_call' && notification.metadata.sessionId) {
        const result = await acceptLocalInterviewSession(notification.metadata.sessionId);
        setLocalSessionId(result.session.id);
        setNotice({
          tone: 'success',
          title: '가족의 인터뷰 연락을 받았습니다',
          message: '마이크 버튼을 누르고 지금 떠오르는 이야기를 들려주세요.',
        });
        return;
      }

      setNotice({
        tone: 'info',
        title: notification.title,
        message: notification.body,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        title: '알림을 처리하지 못했습니다',
        message: error instanceof Error ? error.message : '잠시 뒤 다시 눌러 주세요.',
      });
    } finally {
      void refreshNotifications();
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

    const recordedBlob = mediaRecorderRef.current?.state === 'recording' || isRecording
      ? await stopVoiceCapture()
      : currentAudioBlobRef.current;

    // 앱 내 음성 인터뷰는 원본 오디오 파일과 STT 원문을 모두 로컬 서버에 저장합니다.
    const audioUploadPromise = recordedBlob
      ? uploadLocalAudio(recordedBlob, `dearlog-${Date.now()}.webm`).then((result) => result.fileKey)
      : Promise.resolve('audio/browser-speech-placeholder.txt');

    audioUploadPromise
      .then((audioFileKey) => saveLocalInterviewRecord({
        chapterId: 'childhood',
        sessionId: localSessionId,
        transcriptText: userMsg.text,
        mode: activePhotoId ? 'photo' : 'app_call',
        audioFileKey,
      }))
      .then(() => {
        currentAudioBlobRef.current = null;
        return refreshServerProgress();
      })
      .catch(() => {
        setNotice({
          tone: 'info',
          title: '로컬 서버 저장은 대기 중입니다',
          message: '인터뷰 화면은 계속 사용할 수 있습니다. 서버를 켠 뒤 다음 답변부터 DB에 저장됩니다.',
        });
      });

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
      if (localSessionId) {
        await endLocalInterviewSession(localSessionId).catch(() => undefined);
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

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: buildPhotoInterviewPrompt(result.analysis, result.interviewQuestions),
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

  const handleHardshipPause = async () => {
    if (localSessionId) {
      await pauseLocalInterviewSession(localSessionId).catch(() => undefined);
    }
    await stopVoiceCapture().catch(() => null);
    setNotice({
      tone: 'info',
      title: '잠시 쉬어가도 괜찮습니다',
      message: '지금까지의 진행 상황을 저장했고, 다음에 이어서 말씀하실 수 있습니다.',
    });
  };

  const latestUnreadNotification = notifications.find((item) => item.status === 'unread') ?? notifications[0] ?? null;

  return (
    <div
      data-testid="interview-shell"
      className="mx-auto grid h-full min-h-0 w-full max-w-6xl gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_310px]"
    >
      <section className="premium-panel flex min-h-0 flex-col overflow-hidden rounded-[32px]">
        <div className="shrink-0 border-b border-primary-light/20 bg-primary px-6 py-6 text-primary-pale md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary-pale/50">Memory interview</p>
              <h1 className="mt-2 text-[26px] font-black leading-tight md:text-[30px]">말씀 나누기</h1>
              <p className="mt-2 max-w-xl text-[15px] font-semibold leading-relaxed text-primary-pale/75">
                자녀가 준비한 사진의 인물·장소·시기 단서를 보며, 부모님은 말씀하기·사진 보기·그만하기만으로 회상을 남깁니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:min-w-[300px]">
              {[
                ['대화', Math.max(0, messages.filter((message) => message.role === 'user').length)],
                ['사진', activePhotoId ? 1 : 0],
                ['진행', `${interviewProgress.filter((item) => item.covered).length}/${interviewProgress.length}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[18px] border border-white/15 bg-white/10 px-3 py-2">
                  <p className="text-[11px] font-black text-primary-pale/60">{label}</p>
                  <p className="mt-1 text-[19px] font-black text-primary-pale">{value}</p>
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
                  ? "bg-primary text-primary-pale text-[17px] md:text-[19px] font-medium shadow-[0_12px_30px_rgba(92,52,32,0.12)]"
                  : "border border-border bg-surface text-text text-[18px] md:text-[21px] font-bold shadow-sm"
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {photoPreview && (
          <div data-testid="photo-preview-card" className="mr-auto max-w-[92%] md:max-w-[82%]">
            <span className="text-[13px] text-text-subtle mb-1.5 px-1 font-semibold block">사진 회상</span>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
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
                    <div className="rounded-2xl border border-border/70 bg-surface-alt/80 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-text-subtle">AI 인터뷰어가 읽은 사진 단서</p>
                      <p className="mt-1 text-[14px] font-black text-text">
                        {buildPhotoVisualCue(photoPreview.analysis)}
                      </p>
                    </div>
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
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-5 shadow-sm">
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
          className="shrink-0 border-t border-border bg-surface/90 px-5 py-5 backdrop-blur md:px-7"
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

          <div className="rounded-2xl border border-primary/15 bg-primary-pale/90 px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-pale text-primary">
                  <Inbox className="h-5 w-5" aria-hidden="true" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-black text-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-primary">가족 알림</p>
                  {latestUnreadNotification ? (
                    <>
                      <p className="mt-0.5 truncate text-[15px] font-black text-text">{latestUnreadNotification.title}</p>
                      <p className="mt-0.5 truncate text-[13px] font-semibold leading-relaxed text-text-muted">
                        {latestUnreadNotification.body}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-[13px] font-semibold leading-relaxed text-text-muted">
                      새 알림이 오면 이곳에 표시됩니다. 푸시가 막혀도 앱 안에서 확인할 수 있습니다.
                    </p>
                  )}
                </div>
              </div>
              {latestUnreadNotification && (
                <button
                  type="button"
                  onClick={() => handleNotificationAction(latestUnreadNotification)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-black text-primary-pale shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light"
                >
                  {latestUnreadNotification.type === 'app_interview_call' ? (
                    <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {latestUnreadNotification.type === 'app_interview_call' ? '연락 받기' : '확인'}
                </button>
              )}
            </div>

            {notifications.length > 1 && (
              <div className="mt-3 grid gap-2 border-t border-border/70 pt-3">
                {notifications.slice(0, 3).map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationAction(notification)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all duration-300 ease-out hover:bg-surface-alt',
                      notification.status === 'unread' ? 'bg-primary-pale/70' : 'bg-transparent'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black text-text">{notification.title}</span>
                      <span className="block truncate text-[12px] font-semibold text-text-subtle">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-black text-primary">
                      {notification.status === 'unread' ? '새 알림' : '읽음'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {notificationStatus === 'error' && (
              <p className="mt-2 text-[12px] font-semibold text-error">로컬 서버 알림함을 불러오지 못했습니다.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface-alt/75 px-4 py-3 shadow-sm">
            <p className="text-[13px] font-black text-secondary">부모님 참여는 세 단계로 끝납니다</p>
            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-text-muted">
              마이크로 말씀하기, 자녀가 올린 사진 속 단서 보기, 오늘의 이야기 마치기만 하면 기억 카드와 가족 검수본은 Dearlog가 정리합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRegisterSeniorPush}
            disabled={pushStatus === 'registering' || pushStatus === 'ready'}
            className="flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary-pale px-4 py-3 text-[14px] font-black text-primary shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 disabled:opacity-55"
          >
            <BellRing className="h-4 w-4" />
            {pushStatus === 'ready' ? '앱 연락 알림 켜짐' : pushStatus === 'registering' ? '알림 등록 중...' : '앱 연락 알림 켜기'}
          </button>

          <div className="flex items-end gap-3 md:gap-5">
            {/* Recording button */}
            <button
              onClick={toggleRecording}
              aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-out",
                isRecording
                  ? "w-[72px] h-[72px] md:w-[88px] md:h-[88px] bg-error/10 border-2 border-error/40 text-error ring-4 ring-error/15 animate-pulse"
                  : "w-[68px] h-[68px] md:w-[80px] md:h-[80px] bg-primary text-primary-pale shadow-[0_14px_32px_rgba(92,52,32,0.15)] hover:bg-primary-light hover:scale-105"
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
              className="h-[76px] w-full resize-none rounded-2xl border border-border/80 bg-surface-alt/75 px-4 py-3 pr-14 text-[16px] text-text shadow-sm outline-none transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-primary/40 focus:bg-surface focus:ring-4 focus:ring-primary/10 md:h-[96px] md:px-5 md:py-4 md:pr-16 md:text-[18px]"
              />
              <button
                onClick={handleSend}
                disabled={!transcript.trim() || isTyping}
                aria-label="말씀 보내기"
                className="absolute bottom-3 right-3 rounded-xl bg-primary p-2.5 text-primary-pale shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light disabled:opacity-40 md:p-3"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* End session button */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border/80 bg-surface/80 px-5 py-3 text-[16px] font-bold text-text-muted shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-surface-alt md:py-4 md:text-[17px]">
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
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-secondary py-3 text-[16px] font-bold text-secondary-pale shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary/90 disabled:opacity-40 md:py-4 md:text-[18px]"
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
            <button
              type="button"
              onClick={handleHardshipPause}
              className="sm:col-span-2 flex w-full items-center justify-center rounded-2xl border border-error/30 bg-error/10 px-5 py-3 text-[16px] font-black text-error shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-error/15"
            >
              힘들어요
            </button>
          </div>
        </div>
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-y-auto lg:block">
        <div className="space-y-4">
          <section className="premium-panel rounded-[28px] p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Book progress</p>
            <h2 className="mt-2 text-[21px] font-black text-text">자서전 성장 진척도</h2>
            <div className="mt-5 rounded-[24px] border border-primary/20 bg-primary-pale/70 px-5 py-4 text-center">
              <p className="text-[42px] leading-none" aria-label="진척도 캐릭터">
                {serverProgress?.character ?? '🌰'}
              </p>
              <p className="mt-2 text-[15px] font-black text-primary">
                기록 {serverProgress?.totalRecords ?? messages.filter((message) => message.role === 'user').length}개
              </p>
              <p className="mt-1 text-[12px] font-bold text-primary/75">
                챕터별 15개 답변이 쌓이면 다음 장으로 넘어갈 수 있습니다.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {(serverProgress?.progress ?? []).slice(0, 7).map((item) => (
                <div key={item.chapter.title} className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-black text-text">{item.chapter.title}</span>
                    <span className={cn('text-[12px] font-black', item.complete ? 'text-primary' : 'text-text-subtle')}>
                      {item.count}/{item.chapter.minAnswerCount}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-border/70">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (item.count / item.chapter.minAnswerCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="premium-panel rounded-[28px] p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Session guide</p>
            <h2 className="mt-2 text-[21px] font-black text-text">오늘의 회상 흐름</h2>
            <div className="mt-5 space-y-2">
              {interviewProgress.map((item) => (
                <div
                  key={item.category}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border px-3 py-3 transition-all duration-300 ease-out hover:-translate-y-0.5',
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

          <section className="premium-panel rounded-[28px] p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-text-subtle">Recording scope</p>
            <h2 className="mt-2 text-[20px] font-black text-text">Dearlog가 기록하는 범위</h2>
            <p className="mt-2 text-[13px] font-bold leading-relaxed text-text-muted">
              모든 기억을 다 묻지 않고, 자서전과 가족 대화에 남기 좋은 여섯 범위로 나눠 질문합니다.
            </p>
            <div className="mt-4 grid gap-2">
              {MEMORY_SCOPE_CATEGORIES.map((category) => (
                <div key={category.id} className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
                  <p className="text-[14px] font-black text-text">{category.label}</p>
                  <p className="mt-1 text-[12px] font-semibold leading-relaxed text-text-muted">{category.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="premium-panel-soft rounded-[28px] p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-secondary">Caregiver prepared</p>
            <h2 className="mt-2 text-[20px] font-black text-text">자녀가 준비하는 인터뷰</h2>
            <div className="mt-4 space-y-3 text-[14px] font-bold leading-relaxed text-secondary">
              <p className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">사진과 질문은 가족 공간에서 미리 넣습니다.</p>
              <p className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">부모님은 앱 메뉴를 탐색하지 않고 이 화면에서 답변만 합니다.</p>
              <p className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">기록 후 가족이 공개 범위와 문장을 함께 확인합니다.</p>
            </div>
          </section>

          <section className="premium-panel-soft rounded-[28px] p-5">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">좋은 질문</p>
            <div className="mt-4 space-y-3 text-[14px] font-bold leading-relaxed text-primary">
              <p className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">이 사진 속 장소에 도착했을 때 어떤 기분이셨나요?</p>
              <p className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">사진에 보이는 사람과 그날 나눈 말이 기억나시나요?</p>
              <p className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">그 장면을 가족에게 한 문장으로 남긴다면요?</p>
            </div>
          </section>

          <section className="premium-panel rounded-[28px] p-5">
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
