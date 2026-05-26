import { useState, useEffect } from "react";
import {
  Mic, Phone, BookOpen, MessageCircle, Home,
  Clock, Camera, ChevronLeft, FileText,
  Shield, Check, Send, Link,
  Users, Download, Bot, Plus,
  Settings, ChevronRight, Star,
  Image, BookMarked, Volume2, Pause, Square, Play,
} from "lucide-react";

type Screen =
  | "onboarding" | "intro" | "login" | "modeSelect"
  | "parentAccess" | "parentHome" | "parentHomeLarge" | "parentComparison"
  | "parentInterview" | "phoneGuide" | "parentSchedule" | "phoneBookingConfirm" | "phoneComplete"
  | "voiceStudio" | "photoStory" | "voiceAnswer" | "storySaved"
  | "voiceStart" | "voiceQuestion" | "voiceRecording" | "voiceReview" | "voiceSaved" | "interviewProgress"
  | "parentProgress" | "parentVoiceList" | "parentVoice"
  | "childHome" | "childQuestions" | "childQuestionWrite" | "childPhoto"
  | "childProgressDetail" | "childChapterReview" | "chapterView" | "childSourceVerify"
  | "familyInvite" | "completion" | "chatbot";

const C = {
  bg: "#FAF3E8",
  card: "#FFFDF8",
  primary: "#8B6A3E",
  ink: "#3D2C1E",
  amber: "#C8956C",
  amberBg: "#F5E3CF",
  sage: "#6B8F71",
  sageBg: "#E4EFE5",
  warmGray: "#E8E0D4",
  sepia: "#F2D9B8",
  text2: "#7A6A5C",
  bd: "#E8E0D4",
};

const serif = "'Noto Serif KR', serif";
const sans = "'Noto Sans KR', sans-serif";

/* ── Helpers ── */

function Waveform({ active = true, color = C.primary }: { active?: boolean; color?: string }) {
  const heights = [12, 20, 28, 20, 34, 20, 12, 28, 20, 34, 12, 20, 28, 12, 20];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40 }}>
      <style>{`@keyframes dw{from{transform:scaleY(0.38)}to{transform:scaleY(1)}}`}</style>
      {heights.map((h, i) => (
        <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: color, opacity: active ? 0.8 : 0.28, animation: active ? `dw 1.3s ease-in-out ${i * 0.09}s infinite alternate` : "none" }} />
      ))}
    </div>
  );
}

function ProgressBarDark({ value }: { value: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 99, height: 10, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: "rgba(255,255,255,0.65)", borderRadius: 99, transition: "width 0.5s" }} />
    </div>
  );
}

function ProgressBarLight({ value }: { value: number }) {
  return (
    <div style={{ background: C.warmGray, borderRadius: 99, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: `linear-gradient(90deg,${C.primary},${C.amber})`, borderRadius: 99 }} />
    </div>
  );
}

function StatusBar({ dark }: { dark?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px 6px", color: dark ? "rgba(255,255,255,0.9)" : C.ink, fontSize: 12, fontFamily: sans, fontWeight: 600 }}>
      <span>9:41</span>
      <div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 11 }}>
        <span>WiFi</span><span>🔋</span>
      </div>
    </div>
  );
}

function BackHeader({ onBack, title, dark }: { onBack: () => void; title?: string; dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", color: dark ? "#fff" : C.ink }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: dark ? "#fff" : C.ink, display: "flex" }}>
        <ChevronLeft size={24} />
      </button>
      {title && <span style={{ fontFamily: sans, fontSize: 17, fontWeight: 600 }}>{title}</span>}
    </div>
  );
}

function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? 30 : size === "md" ? 22 : 17;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <BookOpen size={sz} color={C.primary} />
      <span style={{ fontFamily: serif, fontSize: sz * 0.85, fontWeight: 700, color: C.primary, letterSpacing: "0.06em" }}>DEARLOG</span>
    </div>
  );
}

function Btn({ label, onClick, variant = "primary", full = true, size = "md" }: {
  label: string; onClick?: () => void;
  variant?: "primary" | "sage" | "amber" | "outline" | "ghost";
  full?: boolean; size?: "sm" | "md" | "lg";
}) {
  const bgMap: Record<string, string> = { primary: C.primary, sage: C.sage, amber: C.amber, outline: "transparent", ghost: "transparent" };
  const fgMap: Record<string, string> = { primary: "#FFFDF8", sage: "#FFFDF8", amber: "#FFFDF8", outline: C.primary, ghost: C.text2 };
  const bdMap: Record<string, string> = { primary: "none", sage: "none", amber: "none", outline: `2px solid ${C.primary}`, ghost: "none" };
  const py = size === "lg" ? 20 : size === "sm" ? 10 : 16;
  const fs = size === "lg" ? 18 : size === "sm" ? 13 : 16;
  return (
    <button onClick={onClick} style={{ background: bgMap[variant], color: fgMap[variant], border: bdMap[variant], borderRadius: 14, padding: `${py}px 20px`, fontFamily: sans, fontSize: fs, fontWeight: 700, cursor: "pointer", width: full ? "100%" : "auto", letterSpacing: "0.01em" }}>
      {label}
    </button>
  );
}

function Card({ children, sepia, style }: { children: React.ReactNode; sepia?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ background: sepia ? "#FDF5E8" : C.card, borderRadius: 18, padding: 20, border: `1.5px solid ${sepia ? "#E8D5B0" : C.bd}`, boxShadow: "0 2px 14px rgba(61,44,30,0.07)", ...style }}>
      {children}
    </div>
  );
}

function TrustBadge({ label, variant = "sage" }: { label: string; variant?: "sage" | "amber" | "sepia" }) {
  const map = { sage: { bg: C.sageBg, fg: C.sage }, amber: { bg: C.amberBg, fg: C.amber }, sepia: { bg: C.sepia, fg: C.primary } };
  const { bg, fg } = map[variant];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, borderRadius: 99, padding: "5px 13px" }}>
      <Shield size={12} color={fg} />
      <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: fg }}>{label}</span>
    </div>
  );
}

function Chip({ status }: { status: "pending" | "scheduled" | "done" | "review" | "writing" }) {
  const map = {
    pending: { l: "대기 중", bg: C.warmGray, fg: C.text2 },
    scheduled: { l: "예정됨", bg: C.amberBg, fg: C.amber },
    done: { l: "답변 완료", bg: C.sageBg, fg: C.sage },
    review: { l: "확인 필요", bg: C.amberBg, fg: C.amber },
    writing: { l: "작성 중", bg: C.sepia, fg: C.primary },
  };
  const { l, bg, fg } = map[status];
  return <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, background: bg, color: fg, borderRadius: 99, padding: "3px 10px" }}>{l}</span>;
}

function ParentNav({ active, go }: { active: Screen; go: (s: Screen) => void }) {
  const tabs: { icon: typeof Home; label: string; id: Screen }[] = [
    { icon: Home, label: "홈", id: "parentHome" },
    { icon: Phone, label: "이야기", id: "parentInterview" },
    { icon: FileText, label: "기록", id: "parentVoiceList" },
    { icon: Settings, label: "설정", id: "parentAccess" },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1.5px solid ${C.bd}`, background: C.card }}>
      {tabs.map(({ icon: Icon, label, id }) => {
        const on = active === id;
        return (
          <button key={id} onClick={() => go(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "11px 0", background: "none", border: "none", cursor: "pointer", color: on ? C.primary : C.text2 }}>
            <Icon size={21} />
            <span style={{ fontFamily: sans, fontSize: 10, fontWeight: on ? 700 : 400 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChildNav({ active, go }: { active: Screen; go: (s: Screen) => void }) {
  const tabs: { icon: typeof Home; label: string; id: Screen }[] = [
    { icon: Home, label: "홈", id: "childHome" },
    { icon: FileText, label: "질문", id: "childQuestions" },
    { icon: Camera, label: "사진", id: "childPhoto" },
    { icon: BookMarked, label: "챕터", id: "childChapterReview" },
    { icon: MessageCircle, label: "대화", id: "chatbot" },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1.5px solid ${C.bd}`, background: C.card }}>
      {tabs.map(({ icon: Icon, label, id }) => {
        const on = active === id;
        return (
          <button key={id} onClick={() => go(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "11px 0", background: "none", border: "none", cursor: "pointer", color: on ? C.primary : C.text2 }}>
            <Icon size={20} />
            <span style={{ fontFamily: sans, fontSize: 10, fontWeight: on ? 700 : 400 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Screens ── */

function S01_Onboarding({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      {/* Hero */}
      <div style={{ position: "relative", height: 296, flexShrink: 0, background: `linear-gradient(160deg,#8B6A3E14 0%,#C8956C22 55%,#F2D9B8 100%)`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
          {/* Book */}
          <div style={{ width: 144, height: 186, background: `linear-gradient(158deg,${C.primary} 0%,#3E1E08 100%)`, borderRadius: "4px 18px 18px 4px", boxShadow: "10px 10px 40px rgba(61,44,30,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 11, background: "rgba(0,0,0,0.2)", borderRadius: "4px 0 0 4px" }} />
            <BookOpen size={42} color="rgba(255,253,248,0.8)" />
            <div style={{ textAlign: "center", padding: "0 16px" }}>
              <div style={{ fontFamily: serif, fontSize: 11, color: "rgba(255,253,248,0.65)", lineHeight: 1.6 }}>가족의 자서전</div>
              <div style={{ width: 32, height: 1, background: "rgba(255,253,248,0.3)", margin: "8px auto 0" }} />
            </div>
          </div>
          {/* Photo stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ c: C.sepia, r: -4 }, { c: C.amberBg, r: 3 }, { c: C.warmGray, r: -2 }].map(({ c, r }, i) => (
              <div key={i} style={{ width: 70, height: 54, background: c, borderRadius: 8, border: `1.5px solid rgba(139,106,62,0.2)`, boxShadow: "2px 3px 10px rgba(61,44,30,0.14)", transform: `rotate(${r}deg)` }} />
            ))}
          </div>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, padding: "22px 28px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center" }}><Logo /></div>
        <h1 style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, color: C.ink, lineHeight: 1.65, textAlign: "center", margin: 0 }}>
          가족의 이야기를<br />오래 남기는 방법
        </h1>
        <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.9, textAlign: "center", margin: 0 }}>
          부모님의 목소리와 기억을 모아,<br />가족이 다시 꺼내볼 수 있는 자서전으로 정리합니다.
        </p>
        <div style={{ marginTop: "auto" }}><Btn label="시작하기" onClick={() => go("intro")} size="lg" /></div>
      </div>
    </div>
  );
}

function S02_Intro({ go }: { go: (s: Screen) => void }) {
  const cards = [
    { icon: Phone, title: "전화로 편하게 답변해요", desc: "정해진 시간에 질문을 듣고, 편하게 이야기하면 됩니다.", bg: C.amberBg, ic: C.amber },
    { icon: FileText, title: "목소리와 원문을 보존해요", desc: "말씀하신 내용은 원문으로 남고, 가족이 나중에 확인할 수 있어요.", bg: C.sepia, ic: C.primary },
    { icon: Users, title: "가족이 함께 완성해요", desc: "자녀는 질문과 사진을 더하고, 완성된 이야기를 챕터별로 확인합니다.", bg: C.sageBg, ic: C.sage },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ padding: "10px 24px 0" }}><Logo /></div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 0", display: "flex", flexDirection: "column", gap: 13 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>말로 남기고,<br />책처럼 정리해요</h1>
        {cards.map(({ icon: Icon, title, desc, bg, ic }, i) => (
          <Card key={i} style={{ display: "flex", gap: 15, alignItems: "flex-start" }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={22} color={ic} />
            </div>
            <div>
              <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 5 }}>{title}</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.75 }}>{desc}</div>
            </div>
          </Card>
        ))}
        <div style={{ paddingBottom: 8 }}><Btn label="다음으로" onClick={() => go("login")} /></div>
      </div>
    </div>
  );
}

function S03_Login({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 28px 48px", gap: 28 }}>
        <div style={{ textAlign: "center" }}><Logo size="lg" /></div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, color: C.ink, lineHeight: 1.6, margin: 0 }}>DEARLOG에<br />오신 것을 환영해요</h1>
          <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, marginTop: 10, lineHeight: 1.75 }}>가족의 이야기를 함께 기록해보세요</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 8 }}>
          <button onClick={() => go("modeSelect")} style={{ background: "#FEE500", color: C.ink, borderRadius: 14, padding: "17px 24px", fontFamily: sans, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <MessageCircle size={20} />카카오로 시작하기
          </button>
          <Btn label="이메일로 시작하기" onClick={() => go("modeSelect")} variant="outline" />
          <div style={{ textAlign: "center" }}>
            <button onClick={() => go("modeSelect")} style={{ fontFamily: sans, fontSize: 14, color: C.text2, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              로그인하기
            </button>
          </div>
        </div>
        <div style={{ marginTop: "auto", textAlign: "center" }}>
          <p style={{ fontFamily: sans, fontSize: 11, color: C.text2, lineHeight: 1.8 }}>시작하면 서비스 이용약관 및 개인정보 처리방침에<br />동의하는 것으로 간주합니다</p>
        </div>
      </div>
    </div>
  );
}

function S04_ModeSelect({ go }: { go: (s: Screen) => void }) {
  const [sel, setSel] = useState<"parent" | "child" | null>(null);
  const modes = [
    { id: "parent" as const, icon: BookOpen, label: "내 이야기를 남기기", desc: "부모님 본인이 직접 목소리로 이야기를 남깁니다.", next: "parentAccess" as Screen },
    { id: "child" as const, icon: Users, label: "부모님의 이야기 모으기", desc: "자녀가 질문과 사진을 더해 가족 기록을 함께 완성합니다.", next: "childHome" as Screen },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 24px 40px", gap: 22 }}>
        <div>
          <Logo />
          <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink, marginTop: 22, lineHeight: 1.5 }}>누구의 이야기를<br />기록할까요?</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {modes.map(({ id, icon: Icon, label, desc, next }) => {
            const on = sel === id;
            return (
              <button key={id} onClick={() => setSel(id)} style={{ background: on ? `linear-gradient(135deg,${C.primary}12,${C.amber}14)` : C.card, border: `2.5px solid ${on ? C.primary : C.bd}`, borderRadius: 20, padding: "22px 20px", cursor: "pointer", textAlign: "left", boxShadow: on ? `0 4px 20px ${C.primary}20` : "0 2px 12px rgba(61,44,30,0.06)", transition: "all 0.18s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: on ? C.primary : C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.18s" }}>
                    <Icon size={26} color={on ? "#FFFDF8" : C.amber} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {label}{on && <Check size={18} color={C.primary} />}
                    </div>
                    <div style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.75 }}>{desc}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <Btn label="선택하고 계속하기" onClick={() => { if (sel) go(modes.find(m => m.id === sel)!.next); }} variant={sel ? "primary" : "outline"} />
      </div>
    </div>
  );
}

function S05_ParentAccess({ go, setFontSize }: { go: (s: Screen) => void; setFontSize: (s: "normal" | "large" | "xlarge") => void }) {
  const [sel, setSel] = useState<"normal" | "large" | "xlarge">("normal");
  const opts = [{ id: "normal" as const, label: "기본", sz: 17 }, { id: "large" as const, label: "크게", sz: 22 }, { id: "xlarge" as const, label: "아주 크게", sz: 28 }];
  const prevSz = sel === "normal" ? 16 : sel === "large" ? 22 : 28;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 24px 40px", gap: 22 }}>
        <Logo />
        <div>
          <h1 style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>보기 편한 글씨 크기를<br />골라주세요</h1>
          <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, marginTop: 10, lineHeight: 1.75 }}>나중에도 언제든 바꿀 수 있어요.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {opts.map(({ id, label, sz }) => (
            <button key={id} onClick={() => setSel(id)} style={{ flex: 1, background: sel === id ? C.primary : C.card, border: `2px solid ${sel === id ? C.primary : C.bd}`, borderRadius: 15, padding: "15px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
              <span style={{ fontFamily: serif, fontSize: sz, fontWeight: 700, color: sel === id ? "#FFFDF8" : C.ink }}>가</span>
              <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, color: sel === id ? "rgba(255,253,248,0.85)" : C.text2 }}>{label}</span>
            </button>
          ))}
        </div>
        <Card sepia style={{ textAlign: "center" }}>
          <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 8 }}>미리보기</div>
          <div style={{ fontFamily: serif, fontSize: prevSz, fontWeight: 700, color: C.ink, lineHeight: 1.65, transition: "font-size 0.2s" }}>오늘은 어떤 이야기를<br />남겨볼까요?</div>
        </Card>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn label="이 크기로 시작하기" onClick={() => { setFontSize(sel); go("parentHome"); }} />
          <p style={{ fontFamily: sans, fontSize: 12, color: C.text2, textAlign: "center", margin: 0 }}>나중에도 언제든 바꿀 수 있어요.</p>
        </div>
      </div>
    </div>
  );
}

function S06_ParentHome({ go }: { go: (s: Screen) => void }) {
  const cards = [
    { icon: BookOpen, title: "이야기 남기기", desc: "사진, 녹음, 전화로 기억을 남겨보세요.", btn: "시작하기", next: "parentInterview" as Screen, bg: C.amberBg, ic: C.amber },
    { icon: BookOpen, title: "진행 상황 보기", desc: "자서전이 얼마나 완성되었는지 확인해요.", btn: "진행 보기", next: "parentProgress" as Screen, bg: C.sageBg, ic: C.sage },
    { icon: FileText, title: "남긴 이야기 확인", desc: "내 목소리와 정리된 내용을 볼 수 있어요.", btn: "기록 보기", next: "parentVoiceList" as Screen, bg: C.sepia, ic: C.primary },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <Logo />
          <button onClick={() => go("parentAccess")} style={{ background: C.card, border: `1.5px solid ${C.bd}`, borderRadius: 10, padding: "6px 12px", fontFamily: sans, fontSize: 12, color: C.text2, cursor: "pointer" }}>글씨 크기</button>
        </div>
        {/* Progress banner */}
        <div style={{ background: `linear-gradient(135deg,${C.primary},#3E1E08)`, borderRadius: 18, padding: "18px 20px", marginBottom: 18, color: "#FFFDF8" }}>
          <p style={{ fontFamily: sans, fontSize: 12, margin: "0 0 4px", opacity: 0.7 }}>자서전 완성까지</p>
          <p style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>65% 완성</p>
          <ProgressBarDark value={65} />
        </div>
        <h2 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.55, marginBottom: 15 }}>오늘은 어떤 이야기를<br />남겨볼까요?</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cards.map(({ icon: Icon, title, desc, btn, next, bg, ic }) => (
            <Card key={title}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={21} color={ic} />
                </div>
                <div>
                  <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.65 }}>{desc}</div>
                </div>
              </div>
              <Btn label={btn} onClick={() => go(next)} variant={next === "parentInterview" ? "primary" : "outline"} size="sm" />
            </Card>
          ))}
        </div>
      </div>
      <ParentNav active="parentHome" go={go} />
    </div>
  );
}

function S07_ParentHomeLarge({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 20px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <Logo size="lg" />
          <button onClick={() => go("parentAccess")} style={{ background: C.card, border: `2px solid ${C.primary}`, borderRadius: 12, padding: "10px 15px", fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.primary, cursor: "pointer" }}>글씨 크기</button>
        </div>
        <h1 style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, color: C.ink, margin: "0 0 26px", lineHeight: 1.3 }}>오늘의<br />이야기</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          <button onClick={() => go("parentInterview")} style={{ background: `linear-gradient(135deg,${C.primary},#3E1E08)`, borderRadius: 24, padding: "26px 22px", border: "none", cursor: "pointer", textAlign: "left", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 64, height: 64, background: "rgba(255,253,248,0.16)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Mic size={32} color="#FFFDF8" />
              </div>
              <span style={{ fontFamily: sans, fontSize: 26, fontWeight: 700, color: "#FFFDF8" }}>이야기 남기기</span>
            </div>
            <p style={{ fontFamily: sans, fontSize: 17, color: "rgba(255,253,248,0.76)", lineHeight: 1.6, margin: "0 0 18px" }}>사진, 녹음, 전화로 기억을 남겨요.</p>
            <div style={{ background: "rgba(255,253,248,0.16)", borderRadius: 14, padding: "16px 0", textAlign: "center" }}>
              <span style={{ fontFamily: sans, fontSize: 21, fontWeight: 700, color: "#FFFDF8" }}>시작하기</span>
            </div>
          </button>
          <button onClick={() => go("parentVoiceList")} style={{ background: C.card, borderRadius: 24, padding: "26px 22px", border: `2.5px solid ${C.bd}`, cursor: "pointer", textAlign: "left", flex: 1, boxShadow: "0 2px 14px rgba(61,44,30,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 64, height: 64, background: C.sepia, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText size={32} color={C.primary} />
              </div>
              <span style={{ fontFamily: sans, fontSize: 26, fontWeight: 700, color: C.ink }}>내 기록 보기</span>
            </div>
            <p style={{ fontFamily: sans, fontSize: 17, color: C.text2, lineHeight: 1.6, margin: "0 0 18px" }}>남긴 이야기를 확인해요.</p>
            <div style={{ background: C.warmGray, borderRadius: 14, padding: "16px 0", textAlign: "center" }}>
              <span style={{ fontFamily: sans, fontSize: 21, fontWeight: 700, color: C.ink }}>보기</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function S08_ParentComparison({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 20px 30px", gap: 18 }}>
        <Logo />
        <h1 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>부모님께 맞는 화면을<br />선택하세요</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, background: C.card, borderRadius: 16, padding: 13, border: `1.5px solid ${C.bd}` }}>
            <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 9, textAlign: "center" }}>기본 화면</div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 9 }}>
              <div style={{ fontFamily: serif, fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 7 }}>오늘의 이야기</div>
              <div style={{ background: C.card, borderRadius: 8, padding: 8, marginBottom: 6 }}>
                <div style={{ fontFamily: sans, fontSize: 9, fontWeight: 700, color: C.ink, marginBottom: 3 }}>전화로 이야기하기</div>
                <div style={{ fontFamily: sans, fontSize: 8, color: C.text2, marginBottom: 6 }}>편하게 답해요</div>
                <div style={{ background: C.primary, borderRadius: 5, padding: "3px 0", textAlign: "center" }}>
                  <span style={{ fontFamily: sans, fontSize: 8, color: "#FFFDF8" }}>시작하기</span>
                </div>
              </div>
              <div style={{ background: C.card, borderRadius: 8, padding: 8 }}>
                <div style={{ fontFamily: sans, fontSize: 9, fontWeight: 700, color: C.ink, marginBottom: 3 }}>남긴 이야기 확인</div>
                <div style={{ fontFamily: sans, fontSize: 8, color: C.text2 }}>기록을 볼 수 있어요</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, background: C.card, borderRadius: 16, padding: 13, border: `2px solid ${C.primary}` }}>
            <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 9, textAlign: "center" }}>큰 글씨 화면</div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 9 }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 9, lineHeight: 1.3 }}>오늘의<br />이야기</div>
              <div style={{ background: `linear-gradient(135deg,${C.primary},#3E1E08)`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#FFFDF8", marginBottom: 3 }}>전화 받기</div>
                <div style={{ fontFamily: sans, fontSize: 9, color: "rgba(255,253,248,0.75)", marginBottom: 7 }}>편하게 답하세요</div>
                <div style={{ background: "rgba(255,253,248,0.16)", borderRadius: 6, padding: "5px 0", textAlign: "center" }}>
                  <span style={{ fontFamily: sans, fontSize: 11, color: "#FFFDF8" }}>시작하기</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, textAlign: "center", lineHeight: 1.75, margin: 0 }}>큰 글씨 화면은 문구와 버튼을 더 크게 보여드립니다.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: "auto" }}>
          <Btn label="큰 글씨 화면 사용" onClick={() => go("parentHomeLarge")} />
          <Btn label="기본 화면 사용" onClick={() => go("parentHome")} variant="outline" />
        </div>
      </div>
    </div>
  );
}

function S09_InterviewModeSelect({ go }: { go: (s: Screen) => void }) {
  const methods = [
    { dest: "photoStory" as Screen, icon: Image, ibg: C.sepia, ic: C.primary,
      label: "사진 보고 이야기하기", desc: "자녀가 올린 사진을 보며 그날의 이야기를 들려주세요.", btn: "사진 보기" },
    { dest: "voiceAnswer" as Screen, icon: Mic, ibg: C.amberBg, ic: C.amber,
      label: "음성녹음으로 답하기", desc: "앱에서 질문을 보고 바로 녹음으로 답할 수 있어요.", btn: "녹음 시작" },
    { dest: "phoneGuide" as Screen, icon: Phone, ibg: C.warmGray, ic: C.text2,
      label: "전화로 답하기", desc: "전화로 질문을 듣고 편하게 이야기해 주세요.", btn: "통화 시작하기" },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentHome")} />
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ marginBottom: 4 }}>
          <h1 style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: "0 0 9px" }}>
            어떤 방식으로<br />이야기할까요?
          </h1>
          <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.75, margin: 0 }}>
            편한 방법으로 기억을 남겨보세요.
          </p>
        </div>
        {methods.map(({ dest, icon: Icon, ibg, ic, label, desc, btn }) => (
          <button key={dest} onClick={() => go(dest)} style={{ background: C.card, border: `2px solid ${C.bd}`, borderRadius: 20, padding: "20px 20px 18px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 12px rgba(61,44,30,0.07)", display: "block", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 15, marginBottom: 15 }}>
              <div style={{ width: 54, height: 54, background: ibg, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={26} color={ic} />
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.65 }}>{desc}</div>
              </div>
            </div>
            <div style={{ background: C.primary, borderRadius: 12, padding: "13px 0", textAlign: "center" }}>
              <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: "#FFFDF8" }}>{btn}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Phone interview flow ── */

function SA_PhoneGuide({ go }: { go: (s: Screen) => void }) {
  const [paused, setPaused] = useState(false);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#162016" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px 6px", color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: sans, fontWeight: 600 }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 11 }}>
          <span>WiFi</span><span>🔋</span>
        </div>
      </div>
      <BackHeader onBack={() => go("parentInterview")} title="전화로 이야기하기" dark />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Active call card */}
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 28, padding: "32px 22px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, border: "1px solid rgba(255,255,255,0.1)" }}>
          <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(107,175,107,0.4)}50%{box-shadow:0 0 0 20px rgba(107,175,107,0)}}`}</style>
          <div style={{ width: 82, height: 82, background: "#1E4D1E", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", animation: paused ? "none" : "pulse 2s infinite" }}>
            <Phone size={36} color="#7FCF7F" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: sans, fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 6, letterSpacing: "0.04em" }}>DEARLOG 기록 전화</div>
            <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: paused ? "#C8956C" : "#7FCF7F", letterSpacing: "0.04em" }}>{paused ? "통화 일시 중지" : "통화 중"}</div>
          </div>
          <div style={{ fontFamily: serif, fontSize: 52, fontWeight: 700, color: "#fff", letterSpacing: "0.08em", lineHeight: 1 }}>03:24</div>
        </div>
        {/* Current question */}
        <div style={{ background: "rgba(242,217,184,0.12)", borderRadius: 20, padding: "22px 20px", border: "1px solid rgba(242,217,184,0.18)" }}>
          <div style={{ fontFamily: sans, fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12, letterSpacing: "0.08em" }}>현재 질문</div>
          <p style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: "#FAF3E8", lineHeight: 1.75, margin: 0 }}>
            "어릴 적 가장 기억에 남는 집은<br />어떤 모습이었나요?"
          </p>
        </div>
        {/* Helper */}
        <p style={{ fontFamily: sans, fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.8, margin: 0 }}>
          기억나는 만큼 천천히 말씀해주세요.
        </p>
        {/* Control buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setPaused(p => !p)} style={{ flex: 1, padding: "18px 0", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 18, fontFamily: sans, fontSize: 16, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            {paused ? "계속하기" : "잠시 멈춤"}
          </button>
          <button style={{ flex: 1, padding: "18px 0", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 18, fontFamily: sans, fontSize: 16, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            다음 질문
          </button>
        </div>
        <button onClick={() => go("phoneComplete")} style={{ width: "100%", padding: "22px 0", background: "#B03030", borderRadius: 20, border: "none", fontFamily: sans, fontSize: 17, fontWeight: 700, color: "#fff", cursor: "pointer", letterSpacing: "0.02em" }}>
          통화 마치기
        </button>
        <p style={{ fontFamily: sans, fontSize: 12, color: "rgba(255,255,255,0.28)", textAlign: "center", margin: 0 }}>
          통화 내용은 원문으로 보존됩니다.
        </p>
      </div>
    </div>
  );
}

function SB_PhoneBookingConfirm({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentSchedule")} title="예약 완료" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 22px 36px", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "16px 0 4px" }}>
          <div style={{ width: 80, height: 80, background: C.sageBg, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={40} color={C.sage} />
          </div>
          <h1 style={{ fontFamily: serif, fontSize: 25, fontWeight: 700, color: C.ink, textAlign: "center", margin: 0, lineHeight: 1.45 }}>
            인터뷰가<br />예약되었어요
          </h1>
        </div>
        <Card>
          {[
            { label: "예약 날짜", value: "2026년 5월 29일 (금)" },
            { label: "예약 시간", value: "오전 10:00" },
            { label: "받을 번호", value: "010-1234-5678" },
          ].map(({ label, value }, i, arr) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.bd}` : "none" }}>
              <span style={{ fontFamily: sans, fontSize: 14, color: C.text2 }}>{label}</span>
              <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.ink }}>{value}</span>
            </div>
          ))}
          <div style={{ paddingTop: 14 }}>
            <Btn label="변경하기" onClick={() => go("parentSchedule")} variant="ghost" size="sm" />
          </div>
        </Card>
        <div style={{ marginTop: "auto" }}>
          <Btn label="확인" onClick={() => go("parentHome")} size="lg" />
        </div>
      </div>
    </div>
  );
}

function SC_PhoneComplete({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 22px 36px", display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
        <div style={{ width: 90, height: 90, background: C.sageBg, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 14px ${C.sageBg}80` }}>
          <Check size={44} color={C.sage} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: "0 0 12px" }}>
            통화 내용이<br />저장되었어요
          </h1>
          <p style={{ fontFamily: sans, fontSize: 15, color: C.text2, lineHeight: 1.85, margin: 0 }}>
            남겨주신 이야기는 원문과 정리본으로<br />확인할 수 있습니다.
          </p>
        </div>
        <TrustBadge label="원문 보존됨" variant="sage" />
        <Card style={{ width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: C.bg, borderRadius: 14, padding: "18px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: C.primary, marginBottom: 5 }}>3분 24초</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.text2 }}>통화 시간</div>
            </div>
            <div style={{ width: 1, background: C.bd, margin: "8px 0" }} />
            <div style={{ flex: 1, background: C.bg, borderRadius: 14, padding: "18px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: C.amber, marginBottom: 5 }}>1개</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.text2 }}>답변한 질문</div>
            </div>
          </div>
        </Card>
        <div style={{ background: C.sepia, borderRadius: 18, padding: "18px 20px", width: "100%", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: 99, background: C.amber, flexShrink: 0, marginTop: 6 }} />
          <p style={{ fontFamily: sans, fontSize: 14, color: C.ink, lineHeight: 1.7, margin: 0 }}>
            원문 정리가 완료되면 <strong>내가 남긴 이야기</strong>에서 확인하실 수 있어요.
          </p>
        </div>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
          <Btn label="남긴 이야기 보기" onClick={() => go("parentVoiceList")} size="lg" />
          <Btn label="오늘은 여기까지" onClick={() => go("parentHome")} variant="outline" size="lg" />
        </div>
      </div>
    </div>
  );
}

/* ── Voice recording interview flow ── */

/* ── 오늘의 이야기 — unified single-screen recording studio ── */

type RecordingState = "idle" | "recording" | "paused" | "saved";

function S_VoiceStudio({ go }: { go: (s: Screen) => void }) {
  const [recState, setRecState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [inputText, setInputText] = useState("");
  useEffect(() => {
    if (recState !== "recording") return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recState]);
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentInterview")} title="오늘의 이야기" />

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "6px 20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Notice card */}
          <div style={{ background: C.sepia, borderRadius: 16, padding: "15px 18px", display: "flex", alignItems: "flex-start", gap: 13, border: `1.5px solid #E8D5B0` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.amberBg, border: `1.5px solid #DDBA8A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Clock size={17} color={C.amber} />
            </div>
            <div>
              <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>잠시 쉬어가도 괜찮습니다</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.65 }}>바쁘신 날엔 건너뛰셔도 돼요. 편하실 때 이야기해 주세요.</div>
            </div>
          </div>

          {/* Family notification card */}
          <div style={{ background: C.sageBg, borderRadius: 16, padding: "15px 18px", display: "flex", alignItems: "center", gap: 13, border: `1.5px solid rgba(107,143,113,0.22)` }}>
            <div style={{ width: 40, height: 40, background: C.sage, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={20} color="#FFFDF8" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: C.sage, marginBottom: 3, letterSpacing: "0.05em" }}>가족 알림</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>이야기가 저장되면 자녀에게 알림이 가요.</div>
            </div>
          </div>

          {/* 3-step guide card */}
          <Card>
            <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 16 }}>부모님 참여는 세 단계로 끝납니다</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {[
                { n: "1", t: "질문을 읽어보세요", d: "화면에 표시된 질문을 천천히 읽어주세요." },
                { n: "2", t: "마이크를 누르고 답해주세요", d: "버튼을 누른 뒤 편하게 말씀하세요." },
                { n: "3", t: "저장 버튼을 누르세요", d: "이야기가 원문으로 안전하게 보관됩니다." },
              ].map(({ n, t, d }) => (
                <div key={n} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 99, background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: sans, fontSize: 13, fontWeight: 700, color: C.amber }}>{n}</div>
                  <div>
                    <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 3 }}>{t}</div>
                    <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, lineHeight: 1.6 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18 }}>
              <button style={{ background: C.primary, border: "none", borderRadius: 11, padding: "11px 18px", fontFamily: sans, fontSize: 13, fontWeight: 700, color: "#FFFDF8", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Phone size={14} color="#FFFDF8" />
                앱 연락 알림 켜기
              </button>
            </div>
          </Card>

          {/* Today's question */}
          <Card sepia>
            <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 8, letterSpacing: "0.04em" }}>오늘의 질문 · 어린 시절 챕터</div>
            <p style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.75, margin: 0 }}>
              "어릴 적 가장 기억에 남는 집은 어떤 모습이었나요?"
            </p>
          </Card>

          {/* ── State-specific recording area ── */}

          {recState === "idle" && (
            <>
              {/* Large circular mic button */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <button
                  onClick={() => { setSeconds(0); setRecState("recording"); }}
                  style={{ width: 104, height: 104, borderRadius: 99, background: `linear-gradient(148deg,${C.ink} 0%,#4A2C10 100%)`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 32px rgba(61,44,30,0.38), inset 0 1px 0 rgba(255,253,248,0.08)` }}
                >
                  <Mic size={48} color="#FFFDF8" />
                </button>
                <span style={{ fontFamily: sans, fontSize: 13, color: C.text2 }}>누르고 말씀해 주세요</span>
              </div>

              {/* Text input area */}
              <div style={{ background: C.card, border: `1.5px solid ${C.bd}`, borderRadius: 18, overflow: "hidden" }}>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="마이크 버튼을 누르고 말씀하시거나, 여기에 직접 적어주세요."
                  style={{ display: "block", width: "100%", minHeight: 80, padding: "16px 16px 8px", background: "transparent", border: "none", outline: "none", fontFamily: sans, fontSize: 14, color: C.ink, resize: "none", boxSizing: "border-box", lineHeight: 1.8 }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
                  <button style={{ width: 40, height: 40, background: C.primary, borderRadius: 11, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Send size={17} color="#FFFDF8" />
                  </button>
                </div>
              </div>
            </>
          )}

          {recState === "recording" && (
            <div style={{ background: C.card, borderRadius: 22, padding: "24px 20px", border: `2px solid rgba(139,106,62,0.2)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Waveform active={true} color={C.primary} />
              <div style={{ fontFamily: serif, fontSize: 50, fontWeight: 700, color: C.primary, letterSpacing: "0.07em", lineHeight: 1 }}>{fmt(seconds)}</div>
              <p style={{ fontFamily: sans, fontSize: 15, color: C.text2, textAlign: "center", lineHeight: 1.75, margin: 0 }}>
                듣고 있어요.<br />천천히 말씀해주세요.
              </p>
              <div style={{ display: "flex", gap: 11, width: "100%" }}>
                <button onClick={() => setRecState("paused")} style={{ flex: 1, background: C.warmGray, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Pause size={18} color={C.ink} />잠시 멈춤
                </button>
                <button onClick={() => setRecState("saved")} style={{ flex: 1, background: C.sage, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: "#FFFDF8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Check size={18} color="#FFFDF8" />저장
                </button>
              </div>
            </div>
          )}

          {recState === "paused" && (
            <div style={{ background: C.card, borderRadius: 22, padding: "24px 20px", border: `2px solid ${C.amberBg}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: C.amber }} />
                <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink }}>잠시 멈췄어요</span>
              </div>
              <div style={{ fontFamily: serif, fontSize: 46, fontWeight: 700, color: C.text2, letterSpacing: "0.07em" }}>{fmt(seconds)}</div>
              <div style={{ display: "flex", gap: 11, width: "100%" }}>
                <button onClick={() => setRecState("recording")} style={{ flex: 1, background: C.primary, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: "#FFFDF8", cursor: "pointer" }}>
                  계속 녹음
                </button>
                <button onClick={() => setRecState("saved")} style={{ flex: 1, background: C.warmGray, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.ink, cursor: "pointer" }}>
                  저장하고 마치기
                </button>
              </div>
            </div>
          )}

          {recState === "saved" && (
            <div style={{ background: C.sageBg, borderRadius: 22, padding: "26px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, border: `2px solid rgba(107,143,113,0.25)` }}>
              <div style={{ width: 64, height: 64, background: C.sage, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={32} color="#FFFDF8" />
              </div>
              <TrustBadge label="저장됨" variant="sage" />
              <p style={{ fontFamily: sans, fontSize: 14, color: C.ink, textAlign: "center", lineHeight: 1.8, margin: 0 }}>
                오늘 남겨주신 이야기가<br />원문과 함께 보존되었습니다.
              </p>
              <button onClick={() => { setRecState("idle"); setSeconds(0); setInputText(""); }} style={{ background: "transparent", border: `2px solid ${C.sage}`, borderRadius: 13, padding: "12px 24px", fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.sage, cursor: "pointer" }}>
                다음 질문 이어가기
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Bottom action strip */}
      <div style={{ background: C.card, borderTop: `1.5px solid ${C.bd}`, padding: "12px 16px 22px", display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => go("childPhoto")} style={{ flex: 1, background: C.amberBg, border: "none", borderRadius: 12, padding: "12px 4px", fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.amber, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <Camera size={18} color={C.amber} />
          사진으로 회상
        </button>
        <button onClick={() => go("parentHome")} style={{ flex: 2, background: C.sage, border: "none", borderRadius: 12, padding: "14px 8px", fontFamily: sans, fontSize: 14, fontWeight: 700, color: "#FFFDF8", cursor: "pointer" }}>
          오늘의 이야기 마치기
        </button>
        <button style={{ flex: 1, background: C.warmGray, border: "none", borderRadius: 12, padding: "12px 4px", fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.text2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <Shield size={18} color={C.text2} />
          힘들어요
        </button>
      </div>
    </div>
  );
}

/* ── 사진 보고 이야기하기 ── */

function S_PhotoStory({ go }: { go: (s: Screen) => void }) {
  const [active, setActive] = useState(false);
  const [inputText, setInputText] = useState("");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentInterview")} title="사진 보고 이야기하기" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Family photo */}
          <div style={{ height: 210, background: `linear-gradient(158deg,#D9BC9A 0%,#A07848 45%,#5D3020 100%)`, borderRadius: 20, position: "relative", overflow: "hidden", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: 9, border: "1px solid rgba(255,253,248,0.2)", borderRadius: 12, pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.2 }}>
              <Image size={56} color="rgba(255,253,248,0.9)" />
            </div>
            <div style={{ position: "absolute", top: 14, left: 16, background: "rgba(61,44,30,0.55)", borderRadius: 99, padding: "4px 12px" }}>
              <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, color: "#FFFDF8", letterSpacing: "0.05em" }}>사진 1 / 3</span>
            </div>
            <div style={{ position: "absolute", bottom: 13, right: 15 }}>
              <span style={{ fontFamily: sans, fontSize: 10, color: "rgba(255,253,248,0.45)", letterSpacing: "0.1em" }}>1978</span>
            </div>
          </div>

          {/* Question */}
          <Card sepia>
            <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 8, letterSpacing: "0.04em" }}>이 사진에 대해 말씀해 주세요</div>
            <p style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: C.ink, lineHeight: 1.72, margin: "0 0 12px" }}>
              "이 사진은 언제 찍은 사진인가요?"
            </p>
            <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.7, margin: 0 }}>
              사진 속 장소, 사람, 그날의 분위기를 편하게 말씀해주세요.
            </p>
          </Card>

          {/* Mic button */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "4px 0" }}>
            <button
              onClick={() => setActive(!active)}
              style={{ width: 96, height: 96, borderRadius: 99, background: active ? "#C44B4B" : `linear-gradient(148deg,${C.ink},#4A2C10)`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? "0 6px 28px rgba(196,75,75,0.38)" : "0 8px 30px rgba(61,44,30,0.36)" }}
            >
              {active ? <Square size={38} color="#FFFDF8" /> : <Mic size={44} color="#FFFDF8" />}
            </button>
            <span style={{ fontFamily: sans, fontSize: 13, color: active ? "#C44B4B" : C.text2 }}>
              {active ? "녹음 중… 눌러서 중지" : "누르고 말씀해 주세요"}
            </span>
          </div>

          {/* Text input */}
          <div style={{ background: C.card, border: `1.5px solid ${C.bd}`, borderRadius: 16, overflow: "hidden" }}>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="말씀하시거나 직접 적어주세요."
              style={{ display: "block", width: "100%", minHeight: 72, padding: "15px 15px 8px", background: "transparent", border: "none", outline: "none", fontFamily: sans, fontSize: 14, color: C.ink, resize: "none", boxSizing: "border-box", lineHeight: 1.8 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 12px 12px" }}>
              <button style={{ width: 38, height: 38, background: C.primary, borderRadius: 10, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={16} color="#FFFDF8" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom strip */}
      <div style={{ background: C.card, borderTop: `1.5px solid ${C.bd}`, padding: "12px 16px 22px", display: "flex", gap: 8, flexShrink: 0 }}>
        <button style={{ flex: 1, background: C.warmGray, border: "none", borderRadius: 12, padding: "13px 4px", fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.ink, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <ChevronRight size={17} color={C.ink} />
          다음 사진
        </button>
        <button onClick={() => go("storySaved")} style={{ flex: 2, background: C.sage, border: "none", borderRadius: 12, padding: "14px 8px", fontFamily: sans, fontSize: 14, fontWeight: 700, color: "#FFFDF8", cursor: "pointer" }}>
          저장하기
        </button>
        <button onClick={() => go("parentHome")} style={{ flex: 1, background: C.warmGray, border: "none", borderRadius: 12, padding: "13px 4px", fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.text2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <Clock size={17} color={C.text2} />
          여기까지
        </button>
      </div>
    </div>
  );
}

/* ── 음성녹음으로 답하기 ── */

type VAState = "idle" | "recording" | "paused";

function S_VoiceAnswer({ go }: { go: (s: Screen) => void }) {
  const [va, setVa] = useState<VAState>("idle");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (va !== "recording") return;
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [va]);
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentInterview")} title="음성녹음으로 답하기" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "8px 20px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Chapter + progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ background: C.primary, borderRadius: 99, padding: "6px 15px" }}>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#FFFDF8" }}>어린 시절</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 12, color: C.text2 }}>1 / 5 질문</span>
          </div>

          {/* Question */}
          <div style={{ background: `linear-gradient(135deg,${C.primary}0D,${C.amber}10)`, border: `2px solid ${C.amberBg}`, borderRadius: 20, padding: "22px 20px" }}>
            <p style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.72, margin: 0 }}>
              "어릴 적 가장 기억에 남는 집은 어떤 모습이었나요?"
            </p>
          </div>

          <p style={{ fontFamily: sans, fontSize: 14, color: C.text2, textAlign: "center", margin: 0 }}>
            천천히 말씀하셔도 괜찮아요.
          </p>

          {/* idle */}
          {va === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11, padding: "10px 0" }}>
              <button
                onClick={() => { setSeconds(0); setVa("recording"); }}
                style={{ width: 104, height: 104, borderRadius: 99, background: `linear-gradient(148deg,${C.ink},#4A2C10)`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(61,44,30,0.36)" }}
              >
                <Mic size={50} color="#FFFDF8" />
              </button>
              <span style={{ fontFamily: sans, fontSize: 14, color: C.text2 }}>누르고 말씀해 주세요</span>
            </div>
          )}

          {/* recording */}
          {va === "recording" && (
            <div style={{ background: C.card, borderRadius: 22, padding: "24px 20px", border: `2px solid rgba(139,106,62,0.18)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Waveform active={true} color={C.primary} />
              <div style={{ fontFamily: serif, fontSize: 52, fontWeight: 700, color: C.primary, letterSpacing: "0.07em", lineHeight: 1 }}>{fmt(seconds)}</div>
              <div style={{ display: "flex", gap: 11, width: "100%" }}>
                <button onClick={() => setVa("paused")} style={{ flex: 1, background: C.warmGray, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Pause size={18} color={C.ink} />잠시 멈춤
                </button>
                <button onClick={() => go("storySaved")} style={{ flex: 1, background: C.sage, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: "#FFFDF8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Check size={18} color="#FFFDF8" />저장하기
                </button>
              </div>
            </div>
          )}

          {/* paused */}
          {va === "paused" && (
            <div style={{ background: C.card, borderRadius: 22, padding: "24px 20px", border: `2px solid ${C.amberBg}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: C.amber }} />
                <span style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, color: C.ink }}>잠시 멈췄어요</span>
              </div>
              <div style={{ fontFamily: serif, fontSize: 48, fontWeight: 700, color: C.text2, letterSpacing: "0.07em" }}>{fmt(seconds)}</div>
              <div style={{ display: "flex", gap: 11, width: "100%" }}>
                <button onClick={() => setVa("recording")} style={{ flex: 1, background: C.primary, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: "#FFFDF8", cursor: "pointer" }}>
                  계속 녹음
                </button>
                <button onClick={() => go("storySaved")} style={{ flex: 1, background: C.warmGray, border: "none", borderRadius: 14, padding: "16px 0", fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.ink, cursor: "pointer" }}>
                  저장하고 마치기
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Skip question strip */}
      <div style={{ background: C.card, borderTop: `1.5px solid ${C.bd}`, padding: "12px 20px 22px", flexShrink: 0 }}>
        <Btn label="질문 넘기기" variant="ghost" size="sm" />
      </div>
    </div>
  );
}

/* ── 공통 저장 완료 화면 ── */

function S_StorySaved({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 24px 44px", gap: 22, alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 88, height: 88, background: C.sageBg, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={44} color={C.sage} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontSize: 27, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: "0 0 14px" }}>
            이야기가<br />저장되었어요
          </h1>
          <p style={{ fontFamily: sans, fontSize: 15, color: C.text2, lineHeight: 1.85, margin: 0 }}>
            남겨주신 목소리와 내용은<br />원문으로 보존됩니다.
          </p>
        </div>
        <TrustBadge label="원문 보존됨" variant="sage" />
        <Card sepia style={{ width: "100%", boxSizing: "border-box", textAlign: "center" }}>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginBottom: 6 }}>저장된 이야기</div>
          <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 700, color: C.ink }}>어린 시절 · 1번 질문</div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 13, width: "100%", marginTop: 8 }}>
          <Btn label="다음 이야기" onClick={() => go("parentInterview")} size="lg" />
          <Btn label="오늘은 여기까지" onClick={() => go("parentHome")} variant="outline" />
        </div>
      </div>
    </div>
  );
}

function SD_VoiceStart({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentInterview")} title="음성녹음 인터뷰" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 22px 32px", display: "flex", flexDirection: "column", gap: 22 }}>
        <h1 style={{ fontFamily: serif, fontSize: 25, fontWeight: 700, color: C.ink, lineHeight: 1.55, margin: 0 }}>
          앱에서 바로<br />이야기해요
        </h1>
        <p style={{ fontFamily: sans, fontSize: 15, color: C.text2, lineHeight: 1.85, margin: 0 }}>
          아래 버튼을 누르고 질문에 답해주세요.<br />천천히 말씀하셔도 괜찮아요.
        </p>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
          <div style={{ width: 120, height: 120, background: `linear-gradient(135deg,${C.primary}18,${C.amber}1E)`, border: `3.5px solid ${C.amberBg}`, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mic size={58} color={C.primary} />
          </div>
        </div>
        <Card sepia>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginBottom: 9 }}>준비된 첫 번째 질문</div>
          <p style={{ fontFamily: serif, fontSize: 16, color: C.ink, lineHeight: 1.8, margin: "0 0 10px" }}>
            "어릴 적 가장 기억에 남는 집은 어떤 모습이었나요?"
          </p>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.text2 }}>총 5개 질문 · 어린 시절 챕터</div>
        </Card>
        <div style={{ marginTop: "auto" }}>
          <Btn label="녹음 시작하기" onClick={() => go("voiceQuestion")} size="lg" />
        </div>
      </div>
    </div>
  );
}

function SE_VoiceQuestion({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("voiceStart")} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 22px 32px", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ background: C.primary, borderRadius: 99, padding: "6px 15px" }}>
            <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: "#FFFDF8" }}>첫 번째 질문</span>
          </div>
          <span style={{ fontFamily: sans, fontSize: 13, color: C.text2 }}>1 / 5</span>
        </div>
        <div style={{ background: `linear-gradient(135deg,${C.primary}0D,${C.amber}10)`, border: `2px solid ${C.amberBg}`, borderRadius: 20, padding: "24px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
          <p style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, color: C.ink, lineHeight: 1.7, margin: 0 }}>
            "어릴 적 가장 기억에 남는 집은 어떤 모습이었나요?"
          </p>
          <div style={{ background: C.bg, borderRadius: 12, padding: "12px 15px" }}>
            <p style={{ fontFamily: sans, fontSize: 14, color: C.text2, lineHeight: 1.65, margin: 0 }}>
              생각나는 장면부터 편하게 말씀해주세요.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Btn label="녹음 시작" onClick={() => go("voiceRecording")} size="lg" />
          <Btn label="질문 넘기기" variant="ghost" size="sm" />
        </div>
      </div>
    </div>
  );
}

function SF_VoiceRecording({ go }: { go: (s: Screen) => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 22px 32px", gap: 18, alignItems: "center" }}>
        <h1 style={{ fontFamily: serif, fontSize: 29, fontWeight: 700, color: C.ink, margin: 0 }}>듣고 있어요</h1>
        {/* Large timer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
          <div style={{ background: C.primary, borderRadius: 22, padding: "20px 38px" }}>
            <span style={{ fontFamily: serif, fontSize: 52, fontWeight: 700, color: "#FFFDF8", letterSpacing: "0.07em" }}>{fmt(seconds)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 9, height: 9, borderRadius: 99, background: "#D44F4F" }} />
            <span style={{ fontFamily: sans, fontSize: 14, color: C.text2 }}>녹음 중</span>
          </div>
        </div>
        <Waveform active={true} color={C.primary} />
        <Card sepia style={{ width: "100%", boxSizing: "border-box" }}>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginBottom: 8 }}>현재 질문</div>
          <p style={{ fontFamily: serif, fontSize: 15, color: C.ink, lineHeight: 1.8, margin: 0 }}>
            "어릴 적 가장 기억에 남는 집은 어떤 모습이었나요?"
          </p>
        </Card>
        <p style={{ fontFamily: sans, fontSize: 15, color: C.text2, textAlign: "center", margin: 0 }}>천천히 말씀해주세요.</p>
        {/* Large accessible controls */}
        <div style={{ display: "flex", gap: 26, marginTop: "auto" }}>
          <button style={{ width: 84, height: 84, borderRadius: 99, background: C.warmGray, border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: "0 2px 12px rgba(61,44,30,0.1)" }}>
            <Pause size={36} color={C.ink} />
            <span style={{ fontFamily: sans, fontSize: 10, color: C.ink, fontWeight: 600 }}>일시정지</span>
          </button>
          <button onClick={() => go("voiceReview")} style={{ width: 84, height: 84, borderRadius: 99, background: "#C44B4B", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: "0 4px 18px rgba(196,75,75,0.32)" }}>
            <Square size={30} color="#FFFDF8" />
            <span style={{ fontFamily: sans, fontSize: 10, color: "#FFFDF8", fontWeight: 600 }}>중지</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SG_VoiceReview({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("voiceRecording")} title="녹음 완료 확인" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 22px 32px", display: "flex", flexDirection: "column", gap: 22 }}>
        <h1 style={{ fontFamily: serif, fontSize: 25, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>이대로 저장할까요?</h1>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginBottom: 4 }}>녹음 길이</div>
              <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: C.ink }}>02:34</div>
            </div>
            <div style={{ background: C.sageBg, borderRadius: 12, padding: "8px 14px" }}>
              <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.sage }}>1 / 5 질문</span>
            </div>
          </div>
          <Waveform active={false} color={C.text2} />
          <div style={{ marginTop: 16 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 11, background: C.amberBg, border: "none", borderRadius: 13, padding: "15px 18px", cursor: "pointer", width: "100%", boxSizing: "border-box" }}>
              <Play size={22} color={C.amber} />
              <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: C.ink }}>내 목소리 듣기</span>
            </button>
          </div>
        </Card>
        <Card sepia>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginBottom: 8 }}>답변한 질문</div>
          <p style={{ fontFamily: serif, fontSize: 15, color: C.ink, lineHeight: 1.8, margin: 0 }}>
            "어릴 적 가장 기억에 남는 집은 어떤 모습이었나요?"
          </p>
        </Card>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 13 }}>
          <Btn label="저장하기" onClick={() => go("voiceSaved")} size="lg" />
          <Btn label="다시 녹음하기" onClick={() => go("voiceRecording")} variant="outline" />
        </div>
      </div>
    </div>
  );
}

function SH_VoiceSaved({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 22px 40px", gap: 22, alignItems: "center" }}>
        <div style={{ width: 86, height: 86, background: C.sageBg, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={44} color={C.sage} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontSize: 27, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: "0 0 12px" }}>이야기가<br />저장되었어요</h1>
          <p style={{ fontFamily: sans, fontSize: 15, color: C.text2, lineHeight: 1.85, margin: 0 }}>
            목소리와 원문이 함께 보존됩니다.
          </p>
        </div>
        <TrustBadge label="원문 보존됨" variant="sage" />
        <Card sepia style={{ width: "100%", boxSizing: "border-box", textAlign: "center" }}>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginBottom: 6 }}>저장된 이야기</div>
          <div style={{ fontFamily: sans, fontSize: 18, fontWeight: 700, color: C.ink }}>어린 시절 · 1번 질문</div>
          <div style={{ fontFamily: sans, fontSize: 13, color: C.text2, marginTop: 5 }}>녹음 길이 02:34</div>
        </Card>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 13, width: "100%" }}>
          <Btn label="다음 질문" onClick={() => go("voiceQuestion")} size="lg" />
          <Btn label="오늘은 여기까지" onClick={() => go("parentHome")} variant="outline" />
        </div>
      </div>
    </div>
  );
}

function SI_InterviewProgress({ go }: { go: (s: Screen) => void }) {
  const questions = [
    { text: "어릴 적 살던 집은 어떤 모습이었나요?", done: true },
    { text: "가장 친했던 어린 시절 친구는 누구인가요?", done: true },
    { text: "어린 시절 가장 좋아했던 계절은 언제였나요?", done: false },
    { text: "처음 학교에 갔던 날 기억나시나요?", done: false },
    { text: "어린 시절 힘들었던 순간이 있었나요?", done: false },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentHome")} title="오늘의 인터뷰" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 22px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ background: `linear-gradient(135deg,${C.primary},#3E1E08)`, borderRadius: 20, padding: "22px", color: "#FFFDF8" }}>
          <div style={{ fontFamily: sans, fontSize: 13, opacity: 0.7, marginBottom: 5 }}>현재 챕터</div>
          <div style={{ fontFamily: serif, fontSize: 25, fontWeight: 700, marginBottom: 16 }}>어린 시절</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
            <span style={{ fontFamily: sans, fontSize: 13, opacity: 0.7 }}>질문 진행</span>
            <span style={{ fontFamily: serif, fontSize: 24, fontWeight: 700 }}>2 / 5</span>
          </div>
          <ProgressBarDark value={40} />
        </div>
        <div>
          <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 12 }}>질문 목록</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: C.card, borderRadius: 13, padding: "14px 15px", border: `1.5px solid ${q.done ? C.sageBg : C.bd}` }}>
                <div style={{ width: 28, height: 28, borderRadius: 99, background: q.done ? C.sageBg : C.warmGray, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {q.done ? <Check size={14} color={C.sage} /> : <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: C.text2 }}>{i + 1}</span>}
                </div>
                <p style={{ fontFamily: sans, fontSize: 13, color: q.done ? C.text2 : C.ink, lineHeight: 1.7, margin: 0, flex: 1 }}>{q.text}</p>
                {q.done && <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 600, color: C.sage, background: C.sageBg, borderRadius: 99, padding: "3px 10px", flexShrink: 0, whiteSpace: "nowrap" }}>저장됨</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Btn label="다음 질문" onClick={() => go("voiceQuestion")} size="lg" />
          <Btn label="오늘은 여기까지" onClick={() => go("parentHome")} variant="outline" />
        </div>
      </div>
    </div>
  );
}

function S10_Schedule({ go }: { go: (s: Screen) => void }) {
  const [day, setDay] = useState(1);
  const [time, setTime] = useState("오전 10:00");
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const times = ["오전 10:00", "오후 2:00", "오후 7:00"];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("phoneGuide")} title="전화 시간 선택" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>언제 전화를<br />드릴까요?</h1>
        <div>
          <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.text2, marginBottom: 11 }}>요일</div>
          <div style={{ display: "flex", gap: 6 }}>
            {days.map((d, i) => (
              <button key={i} onClick={() => setDay(i)} style={{ flex: 1, padding: "13px 0", background: day === i ? C.primary : C.card, color: day === i ? "#FFFDF8" : C.ink, border: `1.5px solid ${day === i ? C.primary : C.bd}`, borderRadius: 11, fontFamily: sans, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.14s" }}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.text2, marginBottom: 11 }}>시간</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {times.map(t => (
              <button key={t} onClick={() => setTime(t)} style={{ padding: "18px 22px", background: time === t ? C.primary : C.card, color: time === t ? "#FFFDF8" : C.ink, border: `2px solid ${time === t ? C.primary : C.bd}`, borderRadius: 16, fontFamily: sans, fontSize: 18, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 13, transition: "all 0.14s" }}>
                <Clock size={18} color={time === t ? "#FFFDF8" : C.amber} />
                {t}
                {time === t && <Check size={18} color="#FFFDF8" style={{ marginLeft: "auto" }} />}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "auto" }}>
          <Btn label="이 시간으로 예약하기" onClick={() => go("phoneBookingConfirm")} />
        </div>
      </div>
    </div>
  );
}

function S11_ParentProgress({ go }: { go: (s: Screen) => void }) {
  const chapters = [
    { label: "어린 시절", status: "done" as const },
    { label: "청년 시절", status: "scheduled" as const },
    { label: "결혼과 가족", status: "pending" as const },
    { label: "일과 삶", status: "pending" as const },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentHome")} title="진행 현황" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>자서전 완성까지</h1>
        <div style={{ background: `linear-gradient(135deg,${C.primary},#3E1E08)`, borderRadius: 20, padding: "20px 22px", color: "#FFFDF8" }}>
          <div style={{ fontFamily: serif, fontSize: 36, fontWeight: 700, marginBottom: 4 }}>65%</div>
          <div style={{ fontFamily: sans, fontSize: 13, opacity: 0.7, marginBottom: 13 }}>65% 완성되었어요</div>
          <ProgressBarDark value={65} />
        </div>
        <div style={{ display: "flex", gap: 11 }}>
          <Card style={{ flex: 1, textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: C.primary }}>13</div>
            <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginTop: 4 }}>완료한 이야기</div>
          </Card>
          <Card style={{ flex: 1, textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: C.amber }}>7</div>
            <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginTop: 4 }}>남은 질문</div>
          </Card>
        </div>
        <Card sepia>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginBottom: 4 }}>최근 이야기</div>
          <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: C.ink }}>어린 시절</div>
        </Card>
        <div>
          <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 11 }}>챕터 진행</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {chapters.map(({ label, status }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 13, background: C.card, borderRadius: 13, padding: "13px 15px", border: `1.5px solid ${C.bd}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 99, background: status === "done" ? C.sageBg : status === "scheduled" ? C.amberBg : C.warmGray, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {status === "done" ? <Check size={14} color={C.sage} /> : status === "scheduled" ? <Mic size={14} color={C.amber} /> : <Clock size={14} color={C.text2} />}
                </div>
                <span style={{ fontFamily: sans, fontSize: 14, fontWeight: status === "scheduled" ? 700 : 400, color: status === "pending" ? C.text2 : C.ink, flex: 1 }}>{label}</span>
                <Chip status={status} />
              </div>
            ))}
          </div>
        </div>
        <Btn label="다음 이야기 이어가기" onClick={() => go("parentInterview")} />
      </div>
    </div>
  );
}

function S_ParentVoiceList({ go }: { go: (s: Screen) => void }) {
  const [filter, setFilter] = useState(0);
  const chips = ["전체", "어린 시절", "청년 시절", "가족", "완료", "수정 필요"];
  type MethodKey = "음성녹음" | "전화 기록" | "사진 회상";
  type StatusKey = "원문 보존됨" | "정리 완료" | "수정 필요";
  const stories: Array<{ chapter: string; title: string; preview: string; date: string; method: MethodKey; status: StatusKey; hasAudio: boolean }> = [
    { chapter: "어린 시절", title: "어린 시절의 집", preview: "마당이 넓던 집과 동네 친구들에 대한 기억…", date: "2026.05.12", method: "음성녹음", status: "원문 보존됨", hasAudio: true },
    { chapter: "청년 시절", title: "처음 서울에 올라온 날", preview: "아는 사람 하나 없던 서울에서 느꼈던 외로움과 책임감…", date: "2026.05.18", method: "전화 기록", status: "정리 완료", hasAudio: true },
    { chapter: "가족", title: "가족사진 속 봄날", preview: "자녀가 올린 사진을 보며 떠올린 그날의 분위기…", date: "2026.05.20", method: "사진 회상", status: "원문 보존됨", hasAudio: false },
  ];
  const methodStyle: Record<MethodKey, { bg: string; color: string }> = {
    "음성녹음": { bg: C.amberBg, color: C.amber },
    "전화 기록": { bg: C.warmGray, color: C.text2 },
    "사진 회상": { bg: C.sepia, color: C.primary },
  };
  const statusStyle: Record<StatusKey, { bg: string; color: string }> = {
    "원문 보존됨": { bg: C.sageBg, color: C.sage },
    "정리 완료": { bg: "#E8F3E8", color: C.sage },
    "수정 필요": { bg: "#FDECEA", color: "#B03030" },
  };
  const filtered = filter === 0 ? stories : stories.filter(s => {
    const chip = chips[filter];
    if (chip === "완료") return s.status === "정리 완료";
    if (chip === "수정 필요") return s.status === "수정 필요";
    return s.chapter === chip;
  });
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentHome")} title="내가 남긴 이야기" />
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontFamily: sans, fontSize: 14, color: C.text2, lineHeight: 1.75, margin: "0 0 2px" }}>
          지금까지 남긴 목소리와 정리된 이야기를 모아볼 수 있어요.
        </p>
        {/* Summary card */}
        <div style={{ background: `linear-gradient(135deg,${C.ink},#4A2C10)`, borderRadius: 22, padding: "22px 22px" }}>
          <div style={{ fontFamily: sans, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em", marginBottom: 16 }}>DEARLOG 아카이브</div>
          <div style={{ display: "flex", gap: 0, marginBottom: 18 }}>
            <div style={{ flex: 1, borderRight: "1px solid rgba(255,255,255,0.12)", paddingRight: 18 }}>
              <div style={{ fontFamily: serif, fontSize: 30, fontWeight: 700, color: "#FAF3E8", marginBottom: 2 }}>13개</div>
              <div style={{ fontFamily: sans, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>총 이야기</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 18 }}>
              <div style={{ fontFamily: serif, fontSize: 30, fontWeight: 700, color: C.amber, marginBottom: 2 }}>65%</div>
              <div style={{ fontFamily: sans, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>자서전 완성도</div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 9 }}>
            <BookOpen size={14} color="rgba(255,255,255,0.45)" />
            <span style={{ fontFamily: sans, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>최근 기록: <strong style={{ color: "#FFFDF8", fontWeight: 600 }}>어린 시절의 집</strong></span>
          </div>
        </div>
        {/* Filter chips */}
        <div style={{ display: "flex", gap: 7, overflowX: "auto" as const, paddingBottom: 2 }}>
          {chips.map((c, i) => (
            <button key={i} onClick={() => setFilter(i)} style={{ flexShrink: 0, padding: "9px 16px", background: filter === i ? C.primary : C.card, border: `1.5px solid ${filter === i ? C.primary : C.bd}`, borderRadius: 99, fontFamily: sans, fontSize: 13, fontWeight: filter === i ? 700 : 400, color: filter === i ? "#FFFDF8" : C.text2, cursor: "pointer", whiteSpace: "nowrap" as const }}>
              {c}
            </button>
          ))}
        </div>
        {/* Story cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", fontFamily: sans, fontSize: 14, color: C.text2 }}>해당하는 이야기가 없어요.</div>
          )}
          {filtered.map((s, i) => {
            const ms = methodStyle[s.method];
            const ss = statusStyle[s.status];
            return (
              <button key={i} onClick={() => go("parentVoice")} style={{ background: C.card, border: `1.5px solid ${C.bd}`, borderRadius: 20, padding: "20px 20px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 14px rgba(61,44,30,0.07)", display: "block", width: "100%", boxSizing: "border-box" as const }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontFamily: sans, fontSize: 11, color: C.text2, letterSpacing: "0.06em" }}>{s.chapter}</span>
                  <span style={{ fontFamily: sans, fontSize: 11, color: C.text2 }}>{s.date}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: C.ink, flex: 1, lineHeight: 1.4 }}>{s.title}</span>
                  <ChevronRight size={19} color={C.text2} style={{ flexShrink: 0, marginTop: 3 }} />
                </div>
                <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.65, margin: "0 0 14px" }}>{s.preview}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" as const }}>
                  <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: ms.color, background: ms.bg, borderRadius: 8, padding: "3px 10px" }}>{s.method}</span>
                  <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: ss.color, background: ss.bg, borderRadius: 8, padding: "3px 10px" }}>{s.status}</span>
                  {s.hasAudio && (
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                      <Volume2 size={14} color={C.text2} />
                      <span style={{ fontFamily: sans, fontSize: 11, color: C.text2 }}>음성</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {/* Bottom CTA */}
        <div style={{ marginTop: 4 }}>
          <Btn label="+ 새 이야기 남기기" onClick={() => go("parentInterview")} size="lg" />
        </div>
      </div>
      <ParentNav active="parentVoiceList" go={go} />
    </div>
  );
}

function S12_VoiceRecord({ go }: { go: (s: Screen) => void }) {
  const [tab, setTab] = useState(0);
  const tabs = ["정리본", "원문", "수정 요청"];
  const [editReason, setEditReason] = useState<number | null>(null);
  const reasons = ["표현이 어색해요", "내용이 달라요", "더 추가하고 싶어요"];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("parentVoiceList")} title="내가 남긴 이야기" />

      {/* Top meta card */}
      <div style={{ padding: "6px 20px 16px", background: C.card, borderBottom: `1.5px solid ${C.bd}` }}>
        <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, letterSpacing: "0.08em", marginBottom: 5 }}>어린 시절</div>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 10 }}>어린 시절의 집</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          <span style={{ fontFamily: sans, fontSize: 12, color: C.text2 }}>2026.05.12</span>
          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: C.amber, background: C.amberBg, borderRadius: 8, padding: "3px 10px" }}>음성녹음</span>
          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: C.sage, background: C.sageBg, borderRadius: 8, padding: "3px 10px" }}>원문 보존됨</span>
        </div>
      </div>

      {/* Segmented tab control */}
      <div style={{ padding: "12px 20px", background: C.card, borderBottom: `1.5px solid ${C.bd}` }}>
        <div style={{ display: "flex", background: C.bg, borderRadius: 14, padding: 4, gap: 3 }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: "10px 0", background: tab === i ? C.card : "transparent", border: tab === i ? `1px solid ${C.bd}` : "1px solid transparent", borderRadius: 10, fontFamily: sans, fontSize: 13, fontWeight: tab === i ? 700 : 500, color: tab === i ? C.primary : C.text2, cursor: "pointer", boxShadow: tab === i ? "0 1px 6px rgba(61,44,30,0.1)" : "none", transition: "all 0.18s" }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>

        {/* 정리본 */}
        {tab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: C.card, borderRadius: 22, overflow: "hidden", border: `1.5px solid ${C.bd}`, boxShadow: "0 3px 18px rgba(61,44,30,0.08)" }}>
              <div style={{ background: `linear-gradient(135deg,${C.sepia},${C.amberBg})`, padding: "20px 22px 16px" }}>
                <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 6, letterSpacing: "0.07em" }}>정리된 이야기</div>
                <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink }}>어린 시절의 집</div>
              </div>
              <div style={{ padding: "22px 22px" }}>
                <p style={{ fontFamily: serif, fontSize: 17, color: C.ink, lineHeight: 2.05, margin: "0 0 22px" }}>
                  마당이 넓던 집과 동네 친구들에 대한 기억을 중심으로 정리된 이야기입니다.
                </p>
                <div style={{ borderLeft: `3px solid ${C.amber}`, paddingLeft: 16, marginBottom: 22 }}>
                  <p style={{ fontFamily: serif, fontSize: 15, color: C.text2, lineHeight: 1.9, margin: 0, fontStyle: "italic" }}>
                    "봄이면 감나무 아래서 동네 친구들이랑 놀았지요."
                  </p>
                </div>
                <div style={{ background: C.bg, borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 9 }}>
                  <Shield size={14} color={C.text2} style={{ marginTop: 2, flexShrink: 0 }} />
                  <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.7, margin: 0 }}>
                    이 내용은 부모님의 원문 기록을 바탕으로 정리되었습니다.
                  </p>
                </div>
                <Btn label="원문과 비교하기" onClick={() => setTab(1)} variant="outline" size="sm" />
              </div>
            </div>
          </div>
        )}

        {/* 원문 */}
        {tab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Audio player */}
            <div style={{ background: C.card, borderRadius: 22, padding: "22px 20px", border: `1.5px solid ${C.bd}`, boxShadow: "0 2px 14px rgba(61,44,30,0.07)" }}>
              <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, letterSpacing: "0.06em", marginBottom: 16 }}>목소리 기록</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, background: C.primary, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 14px ${C.primary}55` }}>
                  <Play size={24} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <Waveform active={false} color={C.amber} />
                  <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginTop: 5 }}>3분 24초</div>
                </div>
              </div>
              <Btn label="목소리 듣기" onClick={() => {}} size="sm" />
            </div>
            {/* Question */}
            <div style={{ background: C.sepia, borderRadius: 18, padding: "18px 20px", border: `1px solid ${C.amberBg}` }}>
              <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 10, letterSpacing: "0.06em" }}>질문</div>
              <p style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: C.ink, lineHeight: 1.8, margin: 0 }}>
                "어릴 적 가장 기억에 남는 집은 어떤 모습이었나요?"
              </p>
            </div>
            {/* Original transcript */}
            <div style={{ background: C.card, borderRadius: 22, padding: "24px 22px", border: `1.5px solid ${C.bd}`, boxShadow: "0 2px 14px rgba(61,44,30,0.07)" }}>
              <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 16, letterSpacing: "0.06em" }}>원문 기록</div>
              <p style={{ fontFamily: serif, fontSize: 18, color: C.ink, lineHeight: 2.1, margin: "0 0 20px" }}>
                "그때 우리 집은 마당이 넓었고… 봄이면 감나무 아래서 동네 친구들이랑 놀았지요. 담장 너머로 이웃집 아주머니가 음식도 나눠주시고…"
              </p>
              <TrustBadge label="원문 보존됨" variant="sage" />
            </div>
          </div>
        )}

        {/* 수정 요청 */}
        {tab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: C.card, borderRadius: 22, padding: "24px 22px", border: `1.5px solid ${C.bd}`, boxShadow: "0 2px 14px rgba(61,44,30,0.07)" }}>
              <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 20 }}>
                수정이 필요한 이유를 알려주세요
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {reasons.map((r, i) => (
                  <button key={i} onClick={() => setEditReason(editReason === i ? null : i)} style={{ textAlign: "left", padding: "17px 18px", background: editReason === i ? C.amberBg : C.bg, border: `1.5px solid ${editReason === i ? C.amber : C.bd}`, borderRadius: 16, fontFamily: sans, fontSize: 16, color: editReason === i ? C.primary : C.ink, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.18s" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 99, border: `2px solid ${editReason === i ? C.amber : C.bd}`, background: editReason === i ? C.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.18s" }}>
                      {editReason === i && <Check size={13} color="#fff" />}
                    </div>
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: sans, fontSize: 14, color: C.text2, marginBottom: 10 }}>수정하고 싶은 내용을 적어주세요.</div>
                <textarea rows={4} placeholder="예: 감나무가 아니라 대추나무였어요." style={{ width: "100%", padding: "16px 18px", background: C.bg, border: `1.5px solid ${C.bd}`, borderRadius: 16, fontFamily: sans, fontSize: 16, color: C.ink, resize: "none" as const, outline: "none", boxSizing: "border-box" as const, lineHeight: 1.75 }} />
              </div>
              <Btn label="수정 요청 보내기" onClick={() => {}} size="lg" />
            </div>
          </div>
        )}
      </div>
      <ParentNav active="parentVoiceList" go={go} />
    </div>
  );
}

function S13_ChildHome({ go }: { go: (s: Screen) => void }) {
  const cards = [
    { icon: FileText, title: "질문 남기기", desc: "부모님께 꼭 묻고 싶었던 이야기를 적어보세요.", next: "childQuestions" as Screen, bg: C.amberBg, ic: C.amber },
    { icon: Camera, title: "사진으로 기억 열기", desc: "가족사진을 올리고, 그날의 이야기를 함께 남겨요.", next: "childPhoto" as Screen, bg: C.sepia, ic: C.primary },
    { icon: BookMarked, title: "챕터 확인하기", desc: "정리된 이야기를 책의 목차처럼 확인해요.", next: "childChapterReview" as Screen, bg: C.sageBg, ic: C.sage },
    { icon: Shield, title: "원문 확인하기", desc: "정리된 내용이 어떤 목소리 기록에서 왔는지 확인해요.", next: "childSourceVerify" as Screen, bg: C.warmGray, ic: C.text2 },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px 8px" }}>
        <Logo />
        <div style={{ background: `linear-gradient(135deg,${C.ink} 0%,#4A2C10 100%)`, borderRadius: 20, padding: "20px", margin: "14px 0", color: "#FFFDF8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: 99, background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: serif, fontSize: 21, color: C.primary }}>母</span>
            </div>
            <div>
              <div style={{ fontFamily: sans, fontSize: 12, opacity: 0.65 }}>어머니의 자서전</div>
              <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 700 }}>자서전 완성도 72%</div>
            </div>
          </div>
          <ProgressBarDark value={72} />
          <div style={{ fontFamily: sans, fontSize: 11, opacity: 0.62, marginTop: 8 }}>최근 이야기: 청년 시절</div>
        </div>
        <h2 style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: C.ink, lineHeight: 1.55, margin: "0 0 6px" }}>부모님의 이야기를<br />함께 완성해요</h2>
        <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.65, margin: "0 0 14px" }}>질문, 사진, 챕터를 모아 가족 자서전을 만들어갑니다.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {cards.map(({ icon: Icon, title, desc, next, bg, ic }) => (
            <button key={title} onClick={() => go(next)} style={{ background: C.card, border: `1.5px solid ${C.bd}`, borderRadius: 18, padding: "17px 18px", cursor: "pointer", textAlign: "left", display: "flex", gap: 14, alignItems: "flex-start", boxShadow: "0 2px 10px rgba(61,44,30,0.06)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={21} color={ic} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{title}</div>
                <div style={{ fontFamily: sans, fontSize: 12, color: C.text2, lineHeight: 1.65 }}>{desc}</div>
              </div>
              <ChevronRight size={16} color={C.text2} style={{ marginTop: 4 }} />
            </button>
          ))}
        </div>
      </div>
      <ChildNav active="childHome" go={go} />
    </div>
  );
}

function S14_ChildQuestions({ go }: { go: (s: Screen) => void }) {
  const questions = [
    { text: "처음 사회생활을 시작했을 때 가장 기억나는 일은 무엇인가요?", status: "done" as const },
    { text: "결혼을 결심하게 된 순간은 언제였나요?", status: "scheduled" as const },
    { text: "자녀에게 꼭 남기고 싶은 말이 있나요?", status: "pending" as const },
  ];
  const sections: { label: string; qs: typeof questions }[] = [
    { label: "추천 질문", qs: questions.slice(0, 1) },
    { label: "내가 남긴 질문", qs: questions.slice(1, 2) },
    { label: "답변 완료", qs: questions.slice(2) },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px" }}>
        <h2 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>부모님께 남길 질문</h2>
        <button onClick={() => go("childQuestionWrite")} style={{ background: C.primary, border: "none", borderRadius: 11, padding: "9px 13px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <Plus size={15} color="#FFFDF8" />
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#FFFDF8" }}>새 질문</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 14px" }}>
        {sections.map(({ label, qs }) => (
          <div key={label} style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 11 }}>{label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {qs.map((q, i) => (
                <Card key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <p style={{ fontFamily: sans, fontSize: 13, color: C.ink, lineHeight: 1.75, margin: 0, flex: 1, paddingRight: 8 }}>{q.text}</p>
                    <Chip status={q.status} />
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <Btn label="수정" variant="ghost" size="sm" full={false} />
                    <Btn label="삭제" variant="ghost" size="sm" full={false} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 20px 10px" }}><Btn label="새 질문 남기기" onClick={() => go("childQuestionWrite")} /></div>
      <ChildNav active="childQuestions" go={go} />
    </div>
  );
}

function S15_ChildQuestionWrite({ go }: { go: (s: Screen) => void }) {
  const [input, setInput] = useState("");
  const [rephrased, setRephrased] = useState(false);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("childQuestions")} title="질문 남기기" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <h1 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>부모님께 묻고 싶은<br />이야기가 있나요?</h1>
        <div style={{ background: C.card, border: `1.5px solid ${C.bd}`, borderRadius: 16, overflow: "hidden" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="예: 엄마가 결혼을 결심했던 순간은 언제였어?" style={{ width: "100%", minHeight: 96, padding: "15px", background: "transparent", border: "none", outline: "none", fontFamily: sans, fontSize: 14, color: C.ink, resize: "none", boxSizing: "border-box", lineHeight: 1.75 }} />
          <div style={{ padding: "0 14px 13px", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setRephrased(true)} style={{ background: C.primary, border: "none", borderRadius: 10, padding: "8px 15px", fontFamily: sans, fontSize: 13, fontWeight: 700, color: "#FFFDF8", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Star size={13} color="#FFFDF8" />다듬기
            </button>
          </div>
        </div>
        {rephrased && (
          <Card style={{ border: `2px solid ${C.amberBg}`, background: "#FDF8F0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 13 }}>
              <Star size={15} color={C.amber} />
              <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: C.amber }}>더 편하게 답할 수 있는 문장으로 다듬었어요</span>
            </div>
            <div style={{ marginBottom: 11 }}>
              <div style={{ fontFamily: sans, fontSize: 10, color: C.text2, marginBottom: 4 }}>원래 질문</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.text2, fontStyle: "italic", padding: "8px 11px", background: C.bg, borderRadius: 8 }}>"엄마가 결혼을 결심했던 순간은 언제였어?"</div>
            </div>
            <div>
              <div style={{ fontFamily: sans, fontSize: 10, color: C.sage, marginBottom: 4, fontWeight: 600 }}>다듬은 질문</div>
              <div style={{ fontFamily: serif, fontSize: 14, color: C.ink, fontWeight: 700, padding: "11px 13px", background: C.sageBg, borderRadius: 8, lineHeight: 1.75 }}>"결혼을 결심하게 된 특별한 순간이나 마음이 있으셨나요?"</div>
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
              <Btn label="이 질문 남기기" onClick={() => go("childQuestions")} size="sm" full={false} />
              <Btn label="다시 다듬기" variant="outline" size="sm" full={false} />
              <Btn label="직접 수정" variant="ghost" size="sm" full={false} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function S16_ChildPhoto({ go }: { go: (s: Screen) => void }) {
  const [uploaded, setUploaded] = useState(false);
  const suggestions = [
    "이 사진은 언제 찍은 사진인가요?",
    "사진 속 장소는 어떤 의미가 있었나요?",
    "이때 가족들은 어떤 이야기를 나누고 있었나요?",
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("childHome")} title="사진으로 기억 열기" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: "0 0 7px" }}>사진으로 기억을<br />열어보세요</h1>
          <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, lineHeight: 1.75, margin: 0 }}>사진 한 장이 오래된 이야기를 다시 꺼내는 단서가 됩니다.</p>
        </div>
        {!uploaded ? (
          <button onClick={() => setUploaded(true)} style={{ border: `2px dashed ${C.bd}`, borderRadius: 20, padding: "40px 20px", background: C.card, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 54, height: 54, borderRadius: 15, background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Image size={26} color={C.amber} />
            </div>
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: C.primary }}>가족사진 올리기</span>
            <span style={{ fontFamily: sans, fontSize: 12, color: C.text2 }}>탭해서 사진을 선택하세요</span>
          </button>
        ) : (
          <>
            <Card sepia>
              <div style={{ height: 155, background: `linear-gradient(135deg,${C.sepia},${C.amberBg})`, borderRadius: 12, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 40 }}>📷</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["날짜", "장소", "사진 설명"].map(label => (
                  <div key={label}>
                    <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 4 }}>{label}</div>
                    <div style={{ background: C.bg, borderRadius: 9, padding: "9px 12px", fontFamily: sans, fontSize: 13, color: C.text2, border: `1px solid ${C.bd}` }}>{label}를 입력하세요</div>
                  </div>
                ))}
              </div>
            </Card>
            <div>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 11 }}>이 사진과 함께 남길 질문</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {suggestions.map((s, i) => (
                  <Card key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
                    <span style={{ fontFamily: sans, fontSize: 13, color: C.ink, flex: 1 }}>{s}</span>
                    <button style={{ background: C.amberBg, border: "none", borderRadius: 8, padding: "6px 9px", cursor: "pointer", marginLeft: 10 }}><Plus size={13} color={C.amber} /></button>
                  </Card>
                ))}
              </div>
            </div>
            <Btn label="사진과 질문 저장" onClick={() => go("childHome")} />
          </>
        )}
      </div>
      <ChildNav active="childPhoto" go={go} />
    </div>
  );
}

function S17_ChildProgressDetail({ go }: { go: (s: Screen) => void }) {
  const chapters = [
    { label: "어린 시절", pct: 100, status: "done" as const },
    { label: "청년 시절", pct: 60, status: "scheduled" as const },
    { label: "결혼과 가족", pct: 0, status: "pending" as const },
    { label: "일과 삶", pct: 0, status: "pending" as const },
    { label: "자녀에게 남기는 말", pct: 0, status: "pending" as const },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("childHome")} title="기록 진행 현황" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ background: `linear-gradient(135deg,${C.ink},#4A2C10)`, borderRadius: 20, padding: "20px 22px", color: "#FFFDF8" }}>
          <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 700, marginBottom: 4 }}>72%</div>
          <div style={{ fontFamily: sans, fontSize: 12, opacity: 0.65, marginBottom: 12 }}>자서전 완성도</div>
          <ProgressBarDark value={72} />
        </div>
        <div>
          <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 11 }}>챕터별 진행</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {chapters.map(({ label, pct, status }) => (
              <div key={label} style={{ background: C.card, borderRadius: 13, padding: "13px 15px", border: `1.5px solid ${C.bd}`, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</span>
                  <Chip status={status} />
                </div>
                {pct > 0 && <ProgressBarLight value={pct} />}
              </div>
            ))}
          </div>
        </div>
        <Card sepia>
          <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 6 }}>다음 예약 전화</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Clock size={16} color={C.amber} />
            <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.ink }}>2026.05.28 오전 10:00</span>
          </div>
        </Card>
        <Btn label="다음 질문 남기기" onClick={() => go("childQuestionWrite")} />
      </div>
    </div>
  );
}

function S18_ChildChapterReview({ go }: { go: (s: Screen) => void }) {
  const chapters = [
    { num: "1장", title: "어린 시절의 집", status: "done" as const, preview: "마당이 넓던 집과 동네 친구들에 대한 기억…", bc: C.sage, statusLabel: "확인 완료" },
    { num: "2장", title: "청년 시절의 선택", status: "review" as const, preview: "처음 서울에 올라왔던 순간과 혼자 견뎌야 했던 시간…", bc: C.amber, statusLabel: "확인 필요" },
    { num: "3장", title: "가족을 이루던 순간", status: "writing" as const, preview: "작성 중인 챕터입니다.", bc: C.text2, statusLabel: "작성 중" },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ padding: "13px 20px 0" }}>
        <h2 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>챕터를 확인해보세요</h2>
        <p style={{ fontFamily: sans, fontSize: 12, color: C.text2, marginTop: 6, lineHeight: 1.65 }}>완성된 이야기를 가족이 함께 읽고 확인할 수 있어요.</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
        {chapters.map(({ num, title, status, preview, bc }) => (
          <Card key={num} style={{ borderLeft: `4px solid ${bc}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9 }}>
              <div>
                <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 2 }}>{num}</div>
                <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink }}>{title}</div>
              </div>
              <Chip status={status} />
            </div>
            <p style={{ fontFamily: sans, fontSize: 12, color: C.text2, lineHeight: 1.75, margin: "0 0 13px" }}>{preview}</p>
            <div style={{ display: "flex", gap: 7 }}>
              <Btn label="내용 보기" onClick={() => go("chapterView")} variant="outline" size="sm" full={false} />
              <Btn label="원문 확인" onClick={() => go("childSourceVerify")} variant="ghost" size="sm" full={false} />
              <Btn label="수정 요청" variant="ghost" size="sm" full={false} />
            </div>
          </Card>
        ))}
      </div>
      <ChildNav active="childChapterReview" go={go} />
    </div>
  );
}

function S_ChapterView({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
      <StatusBar />
      <BackHeader onBack={() => go("childChapterReview")} />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Hero photo */}
        <div style={{ height: 234, background: `linear-gradient(158deg,#D9BC9A 0%,#A07848 42%,#5D3020 100%)`, position: "relative", flexShrink: 0 }}>
          {/* Sepia grain lines */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.08, background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)" }} />
          {/* Vintage photo border inset */}
          <div style={{ position: "absolute", inset: 10, border: "1px solid rgba(255,253,248,0.18)", pointerEvents: "none" }} />
          {/* Centred muted house illustration */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
            <div style={{ opacity: 0.28 }}>
              <div style={{ width: 74, height: 52, background: "rgba(255,253,248,0.55)", borderRadius: "3px 3px 0 0", position: "relative" }}>
                {/* Roof triangle */}
                <div style={{ position: "absolute", bottom: "100%", left: -9, right: -9, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "22px solid rgba(255,253,248,0.45)" }} />
              </div>
              <div style={{ width: 74, height: 5, background: "rgba(255,253,248,0.22)" }} />
            </div>
            <div style={{ fontFamily: serif, fontSize: 11, color: "rgba(255,253,248,0.32)", letterSpacing: "0.14em" }}>어린 시절</div>
          </div>
          {/* Bottom fade into bg */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 88, background: `linear-gradient(transparent,${C.bg})` }} />
          {/* Chapter badge */}
          <div style={{ position: "absolute", top: 14, left: 18, background: "rgba(61,44,30,0.58)", borderRadius: 99, padding: "5px 14px" }}>
            <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, color: "#FFFDF8", letterSpacing: "0.05em" }}>1장</span>
          </div>
          {/* Year stamp */}
          <div style={{ position: "absolute", bottom: 92, right: 18 }}>
            <span style={{ fontFamily: sans, fontSize: 10, color: C.ink, opacity: 0.4, letterSpacing: "0.12em" }}>1958</span>
          </div>
        </div>

        {/* Chapter header */}
        <div style={{ padding: "0 24px 32px" }}>
          <h1 style={{ fontFamily: serif, fontSize: 25, fontWeight: 700, color: C.ink, lineHeight: 1.4, margin: "0 0 8px" }}>어린 시절의 집</h1>
          <p style={{ fontFamily: sans, fontSize: 12, color: C.text2, margin: "0 0 20px", letterSpacing: "0.05em" }}>1950년대 말 · 경상남도 밀양</p>

          {/* Decorative rule */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: C.bd }} />
            <BookOpen size={13} color={C.text2} />
            <div style={{ flex: 1, height: 1, background: C.bd }} />
          </div>

          {/* Body paragraph 1 */}
          <p style={{ fontFamily: serif, fontSize: 15, color: C.ink, lineHeight: 2.1, margin: "0 0 20px" }}>
            어머니는 어릴 적 살던 집에 대해 이야기할 때면 목소리가 조금 낮아졌습니다. 마당이 넓던 그 집에는 봄이면 감나무 아래 그늘이 생겼고, 여름이면 처마 밑으로 빗소리가 고였습니다.
          </p>

          {/* Pull-quote highlight */}
          <div style={{ background: C.sepia, borderRadius: 17, padding: "18px 20px", marginBottom: 20, borderLeft: `4px solid ${C.amber}` }}>
            <p style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: C.ink, lineHeight: 1.82, margin: "0 0 10px", fontStyle: "italic" }}>
              "그때 우리 집은 마당이 넓었고, 봄이면 감나무 아래서 동네 친구들이랑 놀았지요."
            </p>
            <span style={{ fontFamily: sans, fontSize: 11, color: C.text2 }}>어머니의 목소리 기록 중</span>
          </div>

          {/* Body paragraph 2 */}
          <p style={{ fontFamily: serif, fontSize: 15, color: C.ink, lineHeight: 2.1, margin: "0 0 24px" }}>
            담장 너머로 이웃집 아주머니가 음식도 나눠주시고, 명절이면 골목 전체가 하나의 마당처럼 이어졌다고 합니다. 친구들과 뛰어놀다 넘어져도 누군가의 어머니가 약을 발라주었고, 그 온기가 지금도 선하게 기억난다고 하셨습니다.
          </p>

          {/* Section divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: C.bd }} />
            <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: C.text2, whiteSpace: "nowrap", letterSpacing: "0.07em", textTransform: "uppercase" }}>원문에서 가져온 이야기</span>
            <div style={{ flex: 1, height: 1, background: C.bd }} />
          </div>

          {/* Source record card */}
          <Card sepia style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Volume2 size={14} color={C.amber} />
                <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: C.ink }}>기록: 어린 시절 인터뷰 01</span>
              </div>
              <TrustBadge label="원문 보존됨" variant="sage" />
            </div>
            <div style={{ background: "#FBF5E8", borderRadius: 10, padding: "13px 15px", marginBottom: 14 }}>
              <p style={{ fontFamily: serif, fontSize: 13, color: C.ink, lineHeight: 1.9, margin: 0 }}>
                "처마 밑에 앉아서 비 오는 걸 보던 게 제일 좋았어요. 빗소리가 참 좋았거든…"
              </p>
            </div>
            <Waveform active={false} color={C.text2} />
          </Card>
        </div>
      </div>

      {/* Fixed bottom action bar */}
      <div style={{ background: C.card, borderTop: `1.5px solid ${C.bd}`, padding: "14px 20px 26px", display: "flex", gap: 11, flexShrink: 0 }}>
        <button onClick={() => go("childSourceVerify")} style={{ flex: 1, background: "transparent", border: `2px solid ${C.primary}`, borderRadius: 14, padding: "15px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.primary, cursor: "pointer" }}>
          원문 보기
        </button>
        <button onClick={() => go("childChapterReview")} style={{ flex: 1, background: C.primary, border: "none", borderRadius: 14, padding: "15px 0", fontFamily: sans, fontSize: 15, fontWeight: 700, color: "#FFFDF8", cursor: "pointer" }}>
          다음 챕터 →
        </button>
      </div>
    </div>
  );
}

function S19_SourceVerify({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("childChapterReview")} title="원문 확인" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <h1 style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>이 이야기가 어디서<br />왔는지 확인해요</h1>
        <Card style={{ background: "#F9F5ED", borderColor: "#E8D5B0" }}>
          <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 8 }}>정리된 내용</div>
          <p style={{ fontFamily: serif, fontSize: 14, color: C.ink, lineHeight: 1.9, margin: 0 }}>"어머니는 청년 시절 서울로 올라오며 외로움과 책임감을 크게 느꼈다고 회상했습니다."</p>
        </Card>
        <div>
          <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 9 }}>원문 기록</div>
          <Card sepia>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <Volume2 size={16} color={C.amber} />
              <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink }}>기록: 청년 시절 인터뷰 03</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: sans, fontSize: 11, color: C.text2, marginBottom: 2 }}>녹음 날짜</div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.ink, fontWeight: 600 }}>2026.05.12</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 9, padding: "10px 13px" }}>
              <div style={{ fontFamily: sans, fontSize: 10, color: C.text2, marginBottom: 3 }}>원문 일부</div>
              <p style={{ fontFamily: serif, fontSize: 13, color: C.ink, lineHeight: 1.8, margin: 0 }}>"처음 서울에 올라왔을 때는 아는 사람도 없고…"</p>
            </div>
          </Card>
        </div>
        <TrustBadge label="원문 확인됨" variant="sage" />
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Btn label="목소리 듣기" />
          <Btn label="전체 기록 보기" variant="outline" />
          <Btn label="수정 요청" variant="ghost" />
        </div>
      </div>
    </div>
  );
}

function S20_FamilyInvite({ go }: { go: (s: Screen) => void }) {
  const members = [
    { l: "나", init: "나", col: C.primary },
    { l: "동생", init: "동", col: C.sage },
    { l: "손녀", init: "손", col: C.amber },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <BackHeader onBack={() => go("childHome")} title="가족 초대" />
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <h1 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.5, margin: 0 }}>가족과 함께<br />완성해보세요</h1>
          <p style={{ fontFamily: sans, fontSize: 13, color: C.text2, marginTop: 9, lineHeight: 1.75 }}>형제, 자매, 손주도 질문을 남기고 챕터를 함께 확인할 수 있어요.</p>
        </div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          {members.map(({ l, init, col }) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 60, height: 60, borderRadius: 99, background: col, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: "#FFFDF8" }}>{init}</span>
              </div>
              <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.ink }}>{l}</span>
              <div style={{ background: C.sageBg, borderRadius: 99, padding: "2px 9px" }}>
                <span style={{ fontFamily: sans, fontSize: 9, color: C.sage }}>참여 중</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <button style={{ width: 60, height: 60, borderRadius: 99, background: C.warmGray, display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${C.bd}`, cursor: "pointer" }}>
              <Plus size={26} color={C.text2} />
            </button>
            <span style={{ fontFamily: sans, fontSize: 12, color: C.text2 }}>초대하기</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <button style={{ background: C.card, border: `1.5px solid ${C.bd}`, borderRadius: 14, padding: "15px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 11, boxShadow: "0 2px 10px rgba(61,44,30,0.06)" }}>
            <div style={{ width: 38, height: 38, background: C.amberBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Link size={17} color={C.amber} />
            </div>
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.ink }}>링크로 초대</span>
            <ChevronRight size={16} color={C.text2} style={{ marginLeft: "auto" }} />
          </button>
          <button style={{ background: "#FEE500", borderRadius: 14, padding: "15px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 11, border: "none" }}>
            <MessageCircle size={19} color={C.ink} />
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink }}>카카오톡으로 초대</span>
          </button>
        </div>
        <Btn label="초대 보내기" onClick={() => go("childHome")} />
      </div>
    </div>
  );
}

function S21_Completion({ go }: { go: (s: Screen) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar dark />
      <div style={{ background: `linear-gradient(160deg,${C.ink} 0%,#4A2C10 100%)`, padding: "30px 24px 36px", textAlign: "center" }}>
        <div style={{ width: 66, height: 66, borderRadius: 99, background: C.sageBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Check size={32} color={C.sage} />
        </div>
        <h1 style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: "#FFFDF8", lineHeight: 1.45, margin: "0 0 10px" }}>자서전이<br />완성되었어요</h1>
        <p style={{ fontFamily: sans, fontSize: 13, color: "rgba(255,253,248,0.7)", lineHeight: 1.9, margin: 0 }}>부모님의 목소리와 기억을 바탕으로<br />가족이 오래 간직할 이야기가 완성되었습니다.</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "22px 20px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
        <button style={{ background: `linear-gradient(135deg,${C.primary},${C.amber})`, borderRadius: 20, padding: "22px", border: "none", cursor: "pointer", textAlign: "left", boxShadow: `0 4px 22px ${C.primary}2E` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 11 }}>
            <div style={{ width: 46, height: 46, background: "rgba(255,253,248,0.16)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Download size={21} color="#FFFDF8" />
            </div>
            <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 700, color: "#FFFDF8" }}>자서전 PDF / 책</span>
          </div>
          <p style={{ fontFamily: sans, fontSize: 12, color: "rgba(255,253,248,0.76)", lineHeight: 1.75, margin: "0 0 14px" }}>완성된 자서전을 PDF로 보거나 책으로 제작할 수 있어요.</p>
          <div style={{ background: "rgba(255,253,248,0.16)", borderRadius: 11, padding: "12px 0", textAlign: "center" }}>
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: "#FFFDF8" }}>자서전 보기</span>
          </div>
        </button>
        <button onClick={() => go("chatbot")} style={{ background: `linear-gradient(135deg,${C.sage},#3D6B48)`, borderRadius: 20, padding: "22px", border: "none", cursor: "pointer", textAlign: "left", boxShadow: "0 4px 22px rgba(107,143,113,0.26)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 11 }}>
            <div style={{ width: 46, height: 46, background: "rgba(255,253,248,0.16)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={21} color="#FFFDF8" />
            </div>
            <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 700, color: "#FFFDF8" }}>가족 대화방</span>
          </div>
          <p style={{ fontFamily: sans, fontSize: 12, color: "rgba(255,253,248,0.76)", lineHeight: 1.75, margin: "0 0 14px" }}>남겨진 기록을 바탕으로 부모님의 삶과 가치관을 다시 물어볼 수 있어요.</p>
          <div style={{ background: "rgba(255,253,248,0.16)", borderRadius: 11, padding: "12px 0", textAlign: "center" }}>
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: "#FFFDF8" }}>대화 시작하기</span>
          </div>
        </button>
        <Btn label="처음으로 돌아가기" onClick={() => go("onboarding")} variant="outline" />
      </div>
    </div>
  );
}

function S22_Chatbot({ go }: { go: (s: Screen) => void }) {
  const [input, setInput] = useState("");
  const msgs = [
    { role: "user", text: "엄마는 청년 시절에 가장 힘들었던 순간이 언제였어?" },
    { role: "bot", text: "남겨진 기록에 따르면, 어머니는 서울로 처음 올라왔을 때 외로움과 책임감을 크게 느끼셨다고 말씀하셨어요.", source: "기록: 청년 시절 인터뷰 03" },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <StatusBar />
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 18px", borderBottom: `1.5px solid ${C.bd}`, background: C.card }}>
        <div style={{ width: 40, height: 40, borderRadius: 99, background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: serif, fontSize: 18, color: C.primary }}>母</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink }}>부모님의 이야기에게 물어보세요</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: 99, background: C.sage }} />
            <span style={{ fontFamily: sans, fontSize: 10, color: C.sage }}>원문 기록 기반</span>
          </div>
        </div>
        <button onClick={() => go("childHome")} style={{ background: "none", border: "none", cursor: "pointer", color: C.text2, display: "flex" }}>
          <ChevronLeft size={21} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
              {m.role === "bot" && (
                <div style={{ width: 32, height: 32, borderRadius: 99, background: C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: serif, fontSize: 14, color: C.primary }}>母</span>
                </div>
              )}
              <div style={{ maxWidth: "76%" }}>
                <div style={{ background: m.role === "user" ? C.primary : C.card, borderRadius: m.role === "user" ? "17px 17px 4px 17px" : "17px 17px 17px 4px", padding: "12px 16px", boxShadow: "0 2px 8px rgba(61,44,30,0.08)" }}>
                  <p style={{ fontFamily: sans, fontSize: 13, color: m.role === "user" ? "#FFFDF8" : C.ink, lineHeight: 1.8, margin: 0 }}>{m.text}</p>
                </div>
                {m.role === "bot" && "source" in m && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <TrustBadge label={m.source!} variant="sepia" />
                    <button style={{ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: 11, color: C.primary, fontWeight: 600 }}>원문 보기</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "10px 15px 18px", background: C.card, borderTop: `1.5px solid ${C.bd}` }}>
        <div style={{ display: "flex", gap: 9, background: C.bg, borderRadius: 14, padding: "7px 7px 7px 14px", border: `1.5px solid ${C.bd}` }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="궁금한 이야기를 물어보세요" style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: sans, fontSize: 13, color: C.ink }} />
          <button style={{ width: 38, height: 38, background: C.primary, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", flexShrink: 0 }}>
            <Send size={15} color="#FFFDF8" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Nav config ── */

type Group = { label: string; screens: Screen[] };

const GROUPS: Group[] = [
  { label: "온보딩", screens: ["onboarding", "intro", "login", "modeSelect"] },
  { label: "부모 모드", screens: ["parentAccess", "parentHome", "parentHomeLarge", "parentComparison", "parentProgress", "parentVoiceList", "parentVoice"] },
  { label: "전화 인터뷰", screens: ["parentInterview", "phoneGuide", "phoneComplete"] },
  { label: "음성 인터뷰", screens: ["voiceStudio", "photoStory", "voiceAnswer", "storySaved"] },
  { label: "자녀 모드", screens: ["childHome", "childQuestions", "childQuestionWrite", "childPhoto", "childProgressDetail", "childChapterReview", "chapterView", "childSourceVerify", "familyInvite", "completion", "chatbot"] },
];

const LABELS: Record<Screen, string> = {
  onboarding: "온보딩", intro: "서비스 소개", login: "로그인", modeSelect: "모드 선택",
  parentAccess: "글씨 설정", parentHome: "부모 홈", parentHomeLarge: "부모 홈 (대)", parentComparison: "화면 비교",
  parentInterview: "인터뷰 방식 선택", phoneGuide: "전화로 이야기하기", parentSchedule: "시간 선택",
  phoneBookingConfirm: "예약 완료", phoneComplete: "통화 저장 완료",
  voiceStudio: "오늘의 이야기", photoStory: "사진 보고 이야기하기", voiceAnswer: "음성녹음으로 답하기", storySaved: "이야기 저장 완료",
  voiceStart: "음성녹음 시작", voiceQuestion: "질문 안내", voiceRecording: "녹음 중",
  voiceReview: "녹음 완료 확인", voiceSaved: "저장 완료", interviewProgress: "오늘의 인터뷰",
  parentProgress: "진행 현황", parentVoiceList: "이야기 목록", parentVoice: "이야기 상세",
  childHome: "자녀 홈", childQuestions: "질문 관리", childQuestionWrite: "질문 남기기", childPhoto: "사진 기억",
  childProgressDetail: "기록 현황", childChapterReview: "챕터 확인", chapterView: "챕터 내용 보기", childSourceVerify: "원문 확인",
  familyInvite: "가족 초대", completion: "완성", chatbot: "가족 대화방",
};

/* ── App ── */

export default function App() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("normal");
  const go = (s: Screen) => setScreen(s);

  function renderScreen() {
    switch (screen) {
      case "onboarding": return <S01_Onboarding go={go} />;
      case "intro": return <S02_Intro go={go} />;
      case "login": return <S03_Login go={go} />;
      case "modeSelect": return <S04_ModeSelect go={go} />;
      case "parentAccess": return <S05_ParentAccess go={go} setFontSize={setFontSize} />;
      case "parentHome": return <S06_ParentHome go={go} />;
      case "parentHomeLarge": return <S07_ParentHomeLarge go={go} />;
      case "parentComparison": return <S08_ParentComparison go={go} />;
      case "parentInterview": return <S09_InterviewModeSelect go={go} />;
      case "phoneGuide": return <SA_PhoneGuide go={go} />;
      case "parentSchedule": return <S10_Schedule go={go} />;
      case "phoneBookingConfirm": return <SB_PhoneBookingConfirm go={go} />;
      case "phoneComplete": return <SC_PhoneComplete go={go} />;
      case "voiceStudio": return <S_VoiceStudio go={go} />;
      case "photoStory": return <S_PhotoStory go={go} />;
      case "voiceAnswer": return <S_VoiceAnswer go={go} />;
      case "storySaved": return <S_StorySaved go={go} />;
      case "voiceStart": return <SD_VoiceStart go={go} />;
      case "voiceQuestion": return <SE_VoiceQuestion go={go} />;
      case "voiceRecording": return <SF_VoiceRecording go={go} />;
      case "voiceReview": return <SG_VoiceReview go={go} />;
      case "voiceSaved": return <SH_VoiceSaved go={go} />;
      case "interviewProgress": return <SI_InterviewProgress go={go} />;
      case "parentProgress": return <S11_ParentProgress go={go} />;
      case "parentVoiceList": return <S_ParentVoiceList go={go} />;
      case "parentVoice": return <S12_VoiceRecord go={go} />;
      case "childHome": return <S13_ChildHome go={go} />;
      case "childQuestions": return <S14_ChildQuestions go={go} />;
      case "childQuestionWrite": return <S15_ChildQuestionWrite go={go} />;
      case "childPhoto": return <S16_ChildPhoto go={go} />;
      case "childProgressDetail": return <S17_ChildProgressDetail go={go} />;
      case "childChapterReview": return <S18_ChildChapterReview go={go} />;
      case "chapterView": return <S_ChapterView go={go} />;
      case "childSourceVerify": return <S19_SourceVerify go={go} />;
      case "familyInvite": return <S20_FamilyInvite go={go} />;
      case "completion": return <S21_Completion go={go} />;
      case "chatbot": return <S22_Chatbot go={go} />;
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1A0E06", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px 48px", fontFamily: sans }}>
      {/* Grouped pill nav */}
      <div style={{ marginBottom: 24, width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 12 }}>
        {GROUPS.map(({ label, screens }) => (
          <div key={label}>
            <div style={{ fontFamily: sans, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.32)", marginBottom: 6, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {screens.map(s => (
                <button key={s} onClick={() => go(s)} style={{ padding: "6px 13px", borderRadius: 99, background: screen === s ? C.primary : "rgba(255,255,255,0.07)", color: screen === s ? "#FFFDF8" : "rgba(255,255,255,0.52)", border: screen === s ? `1.5px solid ${C.amber}` : "1.5px solid rgba(255,255,255,0.1)", fontFamily: sans, fontSize: 11, fontWeight: screen === s ? 700 : 400, cursor: "pointer", transition: "all 0.14s" }}>
                  {LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Phone frame */}
      <div style={{ width: 390, background: "#100A04", borderRadius: 52, padding: "13px 13px 0", boxShadow: "0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1.5px rgba(255,255,255,0.06)", position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", width: 110, height: 26, background: "#06030100", borderRadius: 13, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 99, background: "#0A0602" }} />
        </div>
        <div style={{ width: 362, height: 784, borderRadius: 40, overflow: "hidden", background: C.bg, display: "flex", flexDirection: "column", position: "relative" }}>
          {renderScreen()}
        </div>
        <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 96, height: 4, background: "rgba(255,255,255,0.16)", borderRadius: 99 }} />
        </div>
      </div>
    </div>
  );
}
