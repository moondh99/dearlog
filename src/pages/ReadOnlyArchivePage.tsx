import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SERVICE_RESTRICTION_MESSAGE } from '../../shared/service-access'
import { fetchFamilyMembers, fetchLocalAutobiographyDraft, fetchLocalInterviewRecords, fetchLocalMemories, fetchLocalPhotos, type LocalFamilyMember } from '../lib/local-server'
import type { Memory, StoredPhoto } from '../lib/types'
import { normalizeAutobiographyNarratives } from '../store/autobiographyStore'
import { useAuthStore } from '../store/authStore'
import type { GhostwriterResult } from '../types/agents'
import './ReadOnlyService.css'

type ArchiveRecord = {
  id: string
  question?: { text?: string } | null
  chapter?: { title?: string } | null
  transcriptText?: string | null
  aiSummary?: string | null
  audioUrl?: string | null
}
type Archive = { records: ArchiveRecord[]; memories: Memory[]; photos: StoredPhoto[]; chapters: GhostwriterResult[]; errors: string[] }
const emptyArchive = (): Archive => ({ records: [], memories: [], photos: [], chapters: [], errors: [] })

export default function ReadOnlyArchivePage() {
  const { role, userId, userName } = useAuthStore()
  const navigate = useNavigate()
  const [members, setMembers] = useState<LocalFamilyMember[]>([])
  const [seniorId, setSeniorId] = useState<string | null>(null)
  const [memberLoading, setMemberLoading] = useState(true)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [archive, setArchive] = useState<Archive>(emptyArchive)

  useEffect(() => {
    let alive = true
    setMembers([])
    setSeniorId(null)
    setArchive(emptyArchive())
    setMemberLoading(true)
    setMemberError(null)
    if (role === 'parent' && userId) {
      setMembers([{ id: userId, name: userName, role: 'parent', relationship: '본인', isMe: true }])
      setSeniorId(userId)
      setMemberLoading(false)
    } else if (role === 'child') {
      fetchFamilyMembers().then(result => {
        if (!alive) return
        const allowed = [
          ...result.members.filter(member => member.role === 'parent'),
          ...result.members.filter(member => member.role !== 'parent' && member.isMe && member.id === userId),
        ]
        setMembers(allowed)
        setSeniorId(allowed[0]?.id ?? null)
      }).catch(error => {
        if (alive) setMemberError(error instanceof Error ? error.message : '기록 공간을 확인하지 못했습니다.')
      }).finally(() => { if (alive) setMemberLoading(false) })
    } else {
      setMemberLoading(false)
    }
    return () => { alive = false }
  }, [role, userId, userName])

  useEffect(() => {
    // Only IDs freshly returned by the authorized family-members API (or the parent's own ID).
    // URL parameters, persisted family caches and demo stores do not choose an account.
    if (!seniorId || !members.some(member => member.id === seniorId)) return
    let alive = true
    setLoading(true)
    setArchive(emptyArchive())
    // The pre-existing no-link fallback reads the guardian's own records without creating a link.
    // With any parent space present, an explicit own ID still requires the existing self-link.
    const querySeniorId = role === 'child' && seniorId === userId && members.every(member => member.id === userId) ? undefined : seniorId
    Promise.allSettled([
      fetchLocalInterviewRecords(querySeniorId),
      fetchLocalMemories(querySeniorId),
      fetchLocalPhotos(querySeniorId),
      fetchLocalAutobiographyDraft(querySeniorId),
    ]).then(([records, memories, photos, draft]) => {
      if (!alive) return
      const errors: string[] = []
      for (const [label, result] of [['인터뷰', records], ['기억', memories], ['사진', photos], ['자서전', draft]] as const) {
        if (result.status === 'rejected') errors.push(`${label}: ${result.reason instanceof Error ? result.reason.message : '조회하지 못했습니다.'}`)
      }
      setArchive({
        records: records.status === 'fulfilled' ? records.value.records : [],
        memories: memories.status === 'fulfilled' ? memories.value.memories : [],
        photos: photos.status === 'fulfilled' ? photos.value.photos : [],
        chapters: draft.status === 'fulfilled' ? normalizeAutobiographyNarratives(draft.value.draft?.narratives) : [],
        errors,
      })
      setLoading(false)
    })
    return () => { alive = false }
  }, [seniorId, members, role, userId])

  const selectedMember = members.find(member => member.id === seniorId)

  return <main className="readonly-service">
    <header className="readonly-bar"><Link to="/company">디어로그 소개</Link><p className="readonly-eyebrow">{userName}님의 기존 계정</p><h1>기존 기록 조회</h1><p>{SERVICE_RESTRICTION_MESSAGE}</p><p className="readonly-note">서버에서 이 계정에 허용한 기록만 읽습니다. 새 기록, 녹음, 초대, 수정, AI 생성 기능은 사용할 수 없습니다.</p><nav aria-label="기록 조회 메뉴"><a href="mailto:hello@dear-log.com">이용 문의</a><button type="button" onClick={() => navigate('/logout', { replace: true })}>로그아웃</button></nav></header>
    {memberLoading && <p role="status">허용된 기록 공간을 확인하는 중…</p>}
    {memberError && <p role="alert">{memberError}</p>}
    {!memberLoading && !memberError && members.length === 0 && <p className="readonly-empty">조회할 수 있는 기존 기록 공간이 없습니다. 현재 새 연결과 초대는 받지 않습니다.</p>}
    {role === 'child' && members.length > 0 && <div><label htmlFor="archive-space">연결된 기존 기록 공간</label><select id="archive-space" value={seniorId ?? ''} onChange={event => { const id = event.target.value; if (members.some(member => member.id === id)) { setArchive(emptyArchive()); setSeniorId(id) } }}>{members.map(member => <option key={member.id} value={member.id}>{member.isMe ? '내 계정의 기존 기록' : member.recordSpaceName || `${member.name}님의 기록`}</option>)}</select></div>}
    {selectedMember && <p className="readonly-note">{selectedMember.isMe ? '내 계정의 기존 기록' : selectedMember.recordSpaceName || `${selectedMember.name}님의 기록`}</p>}
    {loading && <p role="status">기존 기록을 불러오는 중…</p>}
    {archive.errors.length > 0 && <div role="alert">{archive.errors.map(error => <p key={error}>{error}</p>)}<p>접근할 수 없는 기록은 표시하지 않습니다.</p></div>}
    {selectedMember && !loading && <>
      <nav className="readonly-tabs" aria-label="기록 종류"><a href="#archive-interviews">인터뷰</a><a href="#archive-memories">기억</a><a href="#archive-autobiography">자서전</a><a href="#archive-photos">사진</a></nav>
      <section id="archive-interviews" aria-labelledby="archive-interviews-title"><h2 id="archive-interviews-title">인터뷰 기록</h2>{archive.records.length === 0 && <p className="readonly-empty">현재 조회 가능한 인터뷰 기록이 없습니다.</p>}{archive.records.map(record => <article key={record.id}><h3>{record.question?.text || record.chapter?.title || '인터뷰 기록'}</h3><details><summary>원문 읽기</summary><p className="readonly-record-text">{record.transcriptText || '표시할 원문이 없습니다.'}</p></details>{record.aiSummary && <details><summary>저장된 정리본 읽기</summary><p className="readonly-record-text">{record.aiSummary}</p></details>}{record.audioUrl && <div><p className="readonly-note">저장된 원본 음성</p><audio controls preload="none" src={record.audioUrl} aria-label="저장된 원본 음성 재생" /></div>}</article>)}</section>
      <section id="archive-memories" aria-labelledby="archive-memories-title"><h2 id="archive-memories-title">저장된 기억</h2>{archive.memories.length === 0 && <p className="readonly-empty">현재 조회 가능한 기억이 없습니다.</p>}{archive.memories.map(memory => <article key={memory.id}><h3>{memory.topic || '기억'}</h3><details><summary>기억 읽기</summary><p className="readonly-record-text">{memory.cleanedTranscript || memory.originalTranscript || '현재 표시할 수 있는 본문이 없습니다.'}</p></details></article>)}</section>
      <section id="archive-autobiography" aria-labelledby="archive-autobiography-title"><h2 id="archive-autobiography-title">저장된 자서전</h2><p className="readonly-note">이미 저장된 문장만 표시하며 새로 생성하거나 수정하지 않습니다.</p>{archive.chapters.length === 0 && <p className="readonly-empty">현재 조회 가능한 자서전 초안이 없습니다.</p>}{archive.chapters.map(chapter => <article key={chapter.chapterId}><h3>{chapter.chapterTitle}</h3>{chapter.paragraphs.map(paragraph => <p className="readonly-record-text" key={paragraph.paragraphId}>{paragraph.text}</p>)}</article>)}</section>
      <section id="archive-photos" aria-labelledby="archive-photos-title"><h2 id="archive-photos-title">저장된 사진</h2>{archive.photos.length === 0 && <p className="readonly-empty">현재 조회 가능한 사진이 없습니다.</p>}{archive.photos.map(photo => <figure key={photo.id}>{photo.url && <img src={photo.url} alt={photo.analysis?.description || '저장된 가족 사진'} loading="lazy" />}<figcaption>{photo.analysis?.description || '저장된 사진'}</figcaption></figure>)}</section>
    </>}
  </main>
}
