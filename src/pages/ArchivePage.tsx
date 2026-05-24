import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronDown, ChevronUp, BookOpen, AlertCircle, MapPin, Camera, ShieldAlert, BarChart3, Tags } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../components/Layout';
import ConfidenceLabel from '../components/ConfidenceLabel';
import {
  buildContradictionCards,
  buildMemoryMapPoints,
  buildPhotoAlbumItems,
  buildTimelineGroups,
  computeServiceMetrics,
  getArchiveTabCounts,
  getSensitiveProtectionSuggestions,
  type ArchiveTabId,
} from '../lib/insights/memory-insights';
import { buildPhotoDerivedTags, buildTagDatabaseFromMemories, describeTagCategory } from '../lib/tags/tag-db';
import type { StoredPhoto } from '../lib/types';

function formatFileSize(size: number | null | undefined): string | null {
  if (typeof size !== 'number') return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatMetadataDate(value: string | null | undefined): string | null {
  return value ? value.replace('T', ' ').replace('.000Z', '') : null;
}

function formatGps(photo: StoredPhoto): string | null {
  const latitude = photo.metadata?.gpsLatitude;
  const longitude = photo.metadata?.gpsLongitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return '공개 전 확인 필요';
}

function buildMetadataRows(photo: StoredPhoto): Array<{ label: string; value: string }> {
  const metadata = photo.metadata;
  if (!metadata) return [];

  const camera = [metadata.cameraMake, metadata.cameraModel].filter(Boolean).join(' ');
  const capturedAtSource = metadata.capturedAtSource === 'exif'
    ? 'EXIF'
    : metadata.capturedAtSource === 'fileName'
      ? '파일명 추론'
      : null;
  const rows = [
    { label: '파일명', value: metadata.fileName },
    { label: '파일 형식', value: metadata.fileType },
    { label: '파일 크기', value: formatFileSize(metadata.fileSize) },
    {
      label: '촬영일',
      value: metadata.capturedAt
        ? `${formatMetadataDate(metadata.capturedAt)}${capturedAtSource ? ` · ${capturedAtSource}` : ''}`
        : null,
    },
    { label: '수정일', value: formatMetadataDate(metadata.lastModified) },
    { label: '카메라', value: camera || null },
    { label: 'GPS', value: formatGps(photo) },
    { label: '민감정보', value: formatGps(photo) ? 'EXIF/GPS는 가족 공개 전 확인 필요' : null },
    { label: '장소 힌트', value: metadata.inferredPlace },
  ];

  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

export default function ArchivePage() {
  const memories = useStore(state => state.memories);
  const ragEntries = useStore(state => state.ragIndex.entries);
  const photos = useStore(state => state.photos.photos);
  const familyQuestions = useStore(state => state.familyQuestions.questions);
  const calendarEvents = useStore(state => state.calendar.events);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ArchiveTabId>('summary');

  const timelineGroups = buildTimelineGroups(memories);
  const mapPoints = buildMemoryMapPoints(memories);
  const contradictionCards = buildContradictionCards(memories);
  const sensitiveSuggestions = getSensitiveProtectionSuggestions(memories);
  const albumItems = buildPhotoAlbumItems(photos, memories);
  const tagDatabase = buildTagDatabaseFromMemories(memories);
  const photoDerivedTags = photos.flatMap((photo) => buildPhotoDerivedTags({
    analysis: photo.analysis,
    metadata: photo.metadata,
  }));
  const photoMetadataSummaries = photos
    .map((photo) => ({ photo, rows: buildMetadataRows(photo) }))
    .filter((summary) => summary.rows.length > 0);
  const metrics = computeServiceMetrics({
    memories,
    ragEntryCount: ragEntries.length,
    photos,
    familyQuestions,
    calendarEvents,
  });
  const tabCounts = getArchiveTabCounts({
    memories,
    mapPoints,
    photos,
    contradictionCards,
    sensitiveSuggestions,
  });

  const tabs: Array<{ id: ArchiveTabId; label: string }> = [
    { id: 'summary', label: '요약' },
    { id: 'memories', label: '기억 목록' },
    { id: 'timeline', label: '타임라인' },
    { id: 'map', label: '기억 지도' },
    { id: 'photos', label: '사진 앨범' },
    { id: 'review', label: '검증 필요' },
  ];

  if (memories.length === 0 && photos.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary-pale text-primary">
          <BookOpen className="h-10 w-10" />
        </div>
        <p className="mt-6 text-[12px] font-black uppercase tracking-[0.18em] text-primary">Archive</p>
        <h2 className="mt-2 text-[28px] font-black text-text">아직 기록된 기억이 없습니다.</h2>
        <p className="mt-3 max-w-md text-[17px] font-medium leading-relaxed text-text-muted">
          첫 회상 인터뷰를 마치면 이야기, 태그, 사진, 공개 범위가 이곳에 정리됩니다.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3.5 text-[16px] font-black text-white shadow-[0_14px_32px_rgba(15,23,42,0.16)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light"
        >
          첫 기억 기록하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="premium-panel overflow-hidden rounded-[32px]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-primary p-6 text-primary-pale sm:p-8">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary-pale/50">Memory archive</p>
            <h1 className="mt-3 text-[30px] font-black leading-tight sm:text-[36px] text-primary-pale">추억 보관함</h1>
            <p className="mt-3 max-w-2xl text-[16px] font-semibold leading-relaxed text-primary-pale/65">
              인터뷰로 수집된 기억을 태그, 사진, 메타데이터, 가족 검수 상태까지 한 번에 확인합니다.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['기억', metrics.memoryCount],
                ['사진', metrics.photoCount],
                ['검색', metrics.indexedMemoryCount],
                ['일정', metrics.upcomingEventCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] border border-primary-light/20 bg-primary-light/30 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-black text-primary-pale/45">{label}</p>
                  <p className="mt-1 text-[24px] font-black text-primary-pale">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 bg-surface-alt/76 p-6 backdrop-blur sm:p-8">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">검수 상태</p>
              <h2 className="mt-2 text-[22px] font-black text-text">출판 가능한 기억을 고르는 단계입니다</h2>
              <p className="mt-3 text-[15px] font-semibold leading-relaxed text-text-muted">
                GPS/민감 감정/공개 범위는 가족 공개 전 반드시 확인하도록 표시됩니다.
              </p>
            </div>
            <Link
              to="/review"
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-[15px] font-black text-primary-pale shadow-[0_14px_28px_rgba(92,52,32,0.16)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light"
            >
              가족 검수로 이동
            </Link>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-[24px] border border-border/70 bg-surface-alt/72 p-2 shadow-sm backdrop-blur" role="tablist" aria-label="추억 보관함 보기">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'shrink-0 rounded-[16px] border px-4 py-2.5 text-[14px] font-black transition-all duration-300 ease-out',
              activeTab === tab.id
                ? 'bg-primary text-primary-pale border-primary shadow-sm'
                : 'bg-transparent border-transparent text-text-muted hover:-translate-y-0.5 hover:bg-surface'
            )}
          >
            {tab.label}
            <span className="ml-2 opacity-75">{tabCounts[tab.id]}</span>
          </button>
        ))}
      </div>

      {activeTab === 'summary' && <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['기억 카드', metrics.memoryCount],
          ['검색 연결', metrics.indexedMemoryCount],
          ['태그 DB', tagDatabase.tags.length],
          ['사진 연결', `${metrics.linkedPhotoCount}/${metrics.photoCount}`],
        ].map(([label, value]) => (
          <div key={label} className="premium-panel-soft rounded-[24px] p-5 transition-all duration-300 ease-out hover:-translate-y-0.5">
            <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide">{label}</p>
            <p className="text-[28px] font-black text-text mt-1">{value}</p>
          </div>
        ))}
      </section>}

      {activeTab === 'summary' && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="premium-panel rounded-[24px] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Tags className="w-5 h-5 text-primary" aria-hidden="true" />
              <h3 className="text-[18px] font-black text-text">태그 DB</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagDatabase.tags.slice(0, 12).map((tag) => (
                <span key={tag.id} className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-alt px-3 py-1.5 text-[13px] font-bold text-text-muted">
                  {describeTagCategory(tag.category)} · {tag.label}
                  <span className="text-text-subtle">{tag.usageCount}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="premium-panel rounded-[24px] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-secondary" aria-hidden="true" />
              <h3 className="text-[18px] font-black text-text">사진 메타데이터 활용</h3>
            </div>
            {photoDerivedTags.length === 0 ? (
              <p className="text-[14px] text-text-subtle">사진에서 연결할 메타데이터 태그가 아직 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {photoDerivedTags.slice(0, 10).map((tag, index) => (
                  <span key={`${tag.category}-${tag.label}-${index}`} className="inline-flex items-center gap-1 rounded-xl border border-secondary/20 bg-secondary-pale px-3 py-1.5 text-[13px] font-bold text-secondary">
                    {describeTagCategory(tag.category)} · {tag.label}
                  </span>
                ))}
              </div>
            )}
            {photoMetadataSummaries.length > 0 && (
              <div className="mt-4 space-y-3">
                {photoMetadataSummaries.slice(0, 3).map(({ photo, rows }) => (
                  <div key={photo.id} className="rounded-2xl border border-border bg-surface-alt p-3">
                    <div className="flex items-center gap-3">
                      <img src={photo.url} alt="메타데이터 사진" className="h-14 w-20 rounded-xl object-cover bg-border" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-text">원본 메타데이터</p>
                        <div className="mt-1 grid grid-cols-1 gap-1 text-[12px] text-text-muted">
                          {rows.slice(0, 8).map((row) => (
                            <p key={`${photo.id}-${row.label}`} className="truncate">
                              <span className="font-bold text-text-subtle">{row.label}</span>
                              {' '}
                              {row.value}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'timeline' && <section className="bg-surface rounded-[24px] border border-border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="text-[18px] font-black text-text">생애 타임라인</h3>
          </div>
          <div className="space-y-3">
            {timelineGroups.map((group) => (
              <div key={group.stage}>
                <div className="flex justify-between text-[14px] font-bold text-text">
                  <span>{group.stage}</span>
                  <span>{group.memories.length}개</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(12, (group.memories.length / memories.length) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
      </section>}

      {activeTab === 'map' && <section className="bg-surface rounded-[24px] border border-border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-secondary" />
          <h3 className="text-[18px] font-black text-text">기억 지도</h3>
        </div>
        {mapPoints.length === 0 ? (
          <p className="text-[14px] text-text-subtle">장소 태그가 있는 기억이 아직 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mapPoints.map((point) => (
              <div key={point.place} className="rounded-xl bg-surface-alt border border-border px-4 py-3">
                <div className="flex justify-between text-[15px] font-bold text-text">
                  <span>{point.place}</span>
                  <span>{point.count}개</span>
                </div>
                <p className="text-[13px] text-text-subtle line-clamp-2 mt-1">{point.topics.join(', ')}</p>
              </div>
            ))}
          </div>
        )}
      </section>}

      {activeTab === 'review' && <section className="bg-surface rounded-[24px] border border-border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-error" />
          <h3 className="text-[18px] font-black text-text">검증 및 보호 필요 항목</h3>
        </div>
        <div className="space-y-2">
          {sensitiveSuggestions.filter((item) => item.shouldRevokeSensitiveAccess).slice(0, 3).map((item) => (
            <div key={item.memoryId} className="rounded-xl bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-[13px] font-bold text-error">{item.topic}</p>
              <p className="text-[12px] text-error/80">민감정보 동의 확인 필요: {item.sensitiveEmotions.join(', ')}</p>
            </div>
          ))}
          {contradictionCards.slice(0, 3).map((card) => (
            <div key={card.memoryId} className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2">
              <p className="text-[13px] font-bold text-orange-700">{card.topic}</p>
              <p className="text-[12px] text-orange-700/80">충돌 후보 {card.relatedMemoryIds.length}건 · {card.severity}</p>
            </div>
          ))}
          {sensitiveSuggestions.length === 0 && contradictionCards.length === 0 && (
            <p className="text-[14px] text-text-subtle">보호 또는 검증 알림이 없습니다.</p>
          )}
        </div>
      </section>}

      {activeTab === 'photos' && albumItems.length > 0 && (
        <section className="bg-surface rounded-[24px] border border-border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-secondary" />
            <h3 className="text-[18px] font-black text-text">사진 회상 앨범</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {albumItems.slice(0, 6).map((item) => (
              <div key={item.photoId} className="rounded-2xl border border-border bg-surface-alt overflow-hidden">
                <img src={item.url} alt="회상 사진" className="w-full aspect-video object-cover bg-border" />
                <div className="p-3">
                  <p className="text-[13px] font-semibold text-text-muted line-clamp-2">{item.description}</p>
                  {item.linkedMemoryTopics.length > 0 && (
                    <p className="text-[12px] text-secondary font-bold mt-2">
                      연결 기억: {item.linkedMemoryTopics.join(', ')}
                    </p>
                  )}
                  {photos.find((photo) => photo.id === item.photoId)?.metadata?.capturedAt && (
                    <p className="text-[12px] text-text-subtle font-semibold mt-1">
                      추정 촬영일: {photos.find((photo) => photo.id === item.photoId)?.metadata?.capturedAt?.slice(0, 10)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'photos' && albumItems.length === 0 && (
        <section className="bg-surface rounded-[24px] border border-border p-8 text-center">
          <Camera className="w-10 h-10 text-border-strong mx-auto mb-3" />
          <p className="text-[16px] font-bold text-text-muted">아직 연결된 사진이 없습니다.</p>
        </section>
      )}
      
      {activeTab === 'memories' && <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-border">
        {memories.map((memory) => {
          const isExpanded = expandedId === memory.id;

          return (
            <div key={memory.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              {/* Timeline dot */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary/30 bg-primary-pale shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <div className="w-3 h-3 rounded-full bg-primary" />
              </div>

              {/* Card */}
              <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-3rem)] bg-surface p-6 rounded-[28px] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-border transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] hover:border-border-strong">
                <div
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : memory.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-[21px] font-black text-text mb-1.5">{memory.topic}</h3>
                      <span className="text-[13px] font-medium text-text-subtle block">
                        {format(new Date(memory.date), 'yyyy년 M월 d일', { locale: ko })}
                      </span>
                      <div className="flex items-center gap-2 mt-2.5">
                        <ConfidenceLabel label={memory.confidenceLabel} />
                        {memory.contradictions.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            모순 {memory.contradictions.length}건
                          </span>
                        )}
                      </div>
                    </div>
                    <button className="p-2 text-text-subtle hover:text-primary bg-surface-alt rounded-full transition-colors">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {memory.tags.timePeriod && (
                      <span className="inline-block px-3 py-1 rounded-lg text-[13px] font-semibold bg-primary-pale text-primary">
                        #{memory.tags.timePeriod}
                      </span>
                    )}
                    {memory.tags.places.map(place => (
                      <span key={place} className="inline-block px-3 py-1 rounded-lg text-[13px] font-semibold bg-primary-pale text-primary">
                        #{place}
                      </span>
                    ))}
                    {memory.tags.people.map(person => (
                      <span key={person} className="inline-block px-3 py-1 rounded-lg text-[13px] font-semibold bg-primary-pale text-primary">
                        #{person}
                      </span>
                    ))}
                    {memory.tags.emotions.map(emotion => (
                      <span key={emotion} className="inline-block px-3 py-1 rounded-lg text-[13px] font-semibold bg-primary-pale text-primary">
                        #{emotion}
                      </span>
                    ))}
                  </div>

                  <p className="text-[16px] text-text-muted line-clamp-2 leading-relaxed">
                    {memory.publishVersion}
                  </p>
                </div>

                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-border space-y-4">
                    <div className="bg-surface-alt p-5 rounded-2xl">
                      <h4 className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-2">어르신의 원래 말씀</h4>
                      <p className="text-[16px] text-text-muted italic leading-relaxed">
                        "{memory.originalTranscript}"
                      </p>
                    </div>
                    <div className="bg-primary-pale/60 p-5 rounded-2xl border border-primary/15">
                      <h4 className="text-[12px] font-bold text-primary/70 uppercase tracking-wide mb-2">다듬어진 이야기</h4>
                      <p className="text-[16px] text-text font-medium leading-relaxed">
                        {memory.cleanedTranscript}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}
