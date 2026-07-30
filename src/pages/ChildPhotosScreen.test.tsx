import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChildPhotosScreen from './ChildPhotosScreen'
import { useAuthStore } from '../store/authStore'
import { useChildStore } from '../store/childStore'
import { extractExifMetadata } from '../lib/photos/metadata'

const photoMocks = vi.hoisted(() => ({
  fetchFamilyMembers: vi.fn(),
  fetchLocalPhotos: vi.fn(),
  uploadLocalPhoto: vi.fn(),
}))

vi.mock('../lib/local-server', () => ({
  fetchFamilyMembers: photoMocks.fetchFamilyMembers,
  fetchLocalPhotos: photoMocks.fetchLocalPhotos,
  uploadLocalPhoto: photoMocks.uploadLocalPhoto,
  updateLocalPhoto: vi.fn(async () => ({ photo: {} })),
  deleteLocalPhoto: vi.fn(async () => ({ ok: true })),
  fetchLocalFamilyQuestions: vi.fn(async () => ({ questions: [] })),
  updateLocalFamilyQuestion: vi.fn(async () => ({ question: {} })),
  deleteLocalFamilyQuestion: vi.fn(async () => ({ ok: true })),
  createLocalQuestion: vi.fn(async () => ({ question: { id: 'q-1' } })),
  createLocalPhotoQuestion: vi.fn(async () => ({ question: { id: 'q-1' } })),
}))

/** GPS 좌표(37.5, 127)를 담은 최소 JPEG 바이트열을 만든다. */
function createJpegWithGps(): ArrayBuffer {
  const buffer = new ArrayBuffer(144)
  const view = new DataView(buffer)
  const tiffStart = 12

  const writeAscii = (offset: number, value: string) => {
    ;[...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  }
  const writeEntry = (offset: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(offset, tag, true)
    view.setUint16(offset + 2, type, true)
    view.setUint32(offset + 4, count, true)
    view.setUint32(offset + 8, value, true)
  }
  const writeRational = (offset: number, numerator: number, denominator: number) => {
    view.setUint32(offset, numerator, true)
    view.setUint32(offset + 4, denominator, true)
  }

  view.setUint16(0, 0xffd8) // SOI
  view.setUint16(2, 0xffe1) // APP1
  view.setUint16(4, 140) // 세그먼트 길이
  writeAscii(6, 'Exif\0\0')
  writeAscii(tiffStart, 'II')
  view.setUint16(tiffStart + 2, 42, true)
  view.setUint32(tiffStart + 4, 8, true)

  // IFD0: GPS IFD 포인터 하나만
  view.setUint16(20, 1, true)
  writeEntry(22, 0x8825, 4, 1, 28)
  view.setUint32(34, 0, true)

  // GPS IFD
  view.setUint16(40, 4, true)
  writeEntry(42, 0x0001, 2, 2, 'N'.charCodeAt(0))
  writeEntry(54, 0x0002, 5, 3, 84)
  writeEntry(66, 0x0003, 2, 2, 'E'.charCodeAt(0))
  writeEntry(78, 0x0004, 5, 3, 108)
  view.setUint32(90, 0, true)

  writeRational(96, 37, 1)
  writeRational(104, 30, 1)
  writeRational(112, 0, 1)
  writeRational(120, 127, 1)
  writeRational(128, 0, 1)
  writeRational(136, 0, 1)

  return buffer
}

function createGpsPhotoFile(name = 'gps-photo.jpg') {
  return new File([createJpegWithGps()], name, {
    type: 'image/jpeg',
    lastModified: Date.parse('2024-03-04T00:00:00.000Z'),
  })
}

function resetStores() {
  window.localStorage.clear()
  window.sessionStorage.clear()
  useAuthStore.setState({
    role: 'child',
    userName: '김보호',
    userId: 'guardian-1',
    phoneNumber: '01022223333',
    authToken: 'profile-token',
  })
  useChildStore.setState({
    activeSeniorId: 'senior-1',
    photos: [],
    questions: [],
  })
}

function renderPhotosScreen(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/child/photos', state }]}>
      <ChildPhotosScreen />
    </MemoryRouter>
  )
}

async function uploadedFileHasNoGps(file: File) {
  const exif = extractExifMetadata(await file.arrayBuffer())
  return exif.gpsLatitude == null && exif.gpsLongitude == null
}

describe('ChildPhotosScreen GPS 마스킹', () => {
  beforeEach(() => {
    resetStores()
    photoMocks.fetchFamilyMembers.mockReset()
    photoMocks.fetchLocalPhotos.mockReset()
    photoMocks.uploadLocalPhoto.mockReset()

    photoMocks.fetchFamilyMembers.mockResolvedValue({
      members: [{ id: 'senior-1', name: '김영자', role: 'parent', relationship: '부모님', isMe: false }],
    })
    photoMocks.fetchLocalPhotos.mockResolvedValue({ photos: [] })
    photoMocks.uploadLocalPhoto.mockImplementation(async (_file: File, _chapterId: string, metadata: Record<string, string>) => ({
      photo: {
        id: 'photo-1',
        fileName: 'gps-photo.jpg',
        url: '/api/files/photos/gps-photo.jpg',
        metadata,
        registeredQuestions: [],
      },
      questions: [{ questionText: '이 사진은 어디에서 찍었나요?' }],
    }))
  })

  it('원본 좌표를 서버로 보내지 않고 장소를 마스킹 문구로 대체한다', async () => {
    const file = createGpsPhotoFile()
    // 사전 조건: 원본 파일에는 좌표가 들어있다.
    expect(extractExifMetadata(await file.arrayBuffer())).toMatchObject({
      gpsLatitude: 37.5,
      gpsLongitude: 127,
    })

    renderPhotosScreen({ fromQuestions: true })
    await screen.findByText('사진 업로드')

    fireEvent.change(screen.getByLabelText('사진 파일 선택'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: '사진 올리기' }))

    await waitFor(() => expect(photoMocks.uploadLocalPhoto).toHaveBeenCalledTimes(1))

    const [uploadedFile, chapterId, metadata] = photoMocks.uploadLocalPhoto.mock.calls[0]
    expect(chapterId).toBe('childhood')
    expect(metadata.location).toBe('공개 전 확인 필요')
    expect(JSON.stringify(metadata)).not.toContain('37.5')
    expect(JSON.stringify(metadata)).not.toContain('127')

    // 업로드된 파일 바이트열에서도 EXIF GPS 가 제거되어야 한다.
    expect(uploadedFile).not.toBe(file)
    expect(uploadedFile.name).toBe('gps-photo.jpg')
    expect(await uploadedFileHasNoGps(uploadedFile)).toBe(true)
  })

  it('자녀가 입력한 장소는 유지하면서 마스킹 문구를 덧붙인다', async () => {
    renderPhotosScreen({ fromQuestions: true })
    await screen.findByText('사진 업로드')

    fireEvent.change(screen.getByLabelText('사진 파일 선택'), { target: { files: [createGpsPhotoFile()] } })
    fireEvent.change(screen.getByPlaceholderText('예: 외할머니 댁 마당'), {
      target: { value: '외할머니 댁 마당' },
    })
    fireEvent.click(screen.getByRole('button', { name: '사진 올리기' }))

    await waitFor(() => expect(photoMocks.uploadLocalPhoto).toHaveBeenCalledTimes(1))
    expect(photoMocks.uploadLocalPhoto.mock.calls[0][2].location).toBe('외할머니 댁 마당 · 공개 전 확인 필요')
  })

  it('좌표가 없는 사진은 장소를 바꾸지 않고 원본 파일을 그대로 올린다', async () => {
    const file = new File(['hello'], 'scan.png', { type: 'image/png' })

    renderPhotosScreen({ fromQuestions: true })
    await screen.findByText('사진 업로드')

    fireEvent.change(screen.getByLabelText('사진 파일 선택'), { target: { files: [file] } })
    fireEvent.change(screen.getByPlaceholderText('예: 외할머니 댁 마당'), {
      target: { value: '외할머니 댁 마당' },
    })
    fireEvent.click(screen.getByRole('button', { name: '사진 올리기' }))

    await waitFor(() => expect(photoMocks.uploadLocalPhoto).toHaveBeenCalledTimes(1))

    const [uploadedFile, , metadata] = photoMocks.uploadLocalPhoto.mock.calls[0]
    expect(uploadedFile).toBe(file)
    expect(metadata.location).toBe('외할머니 댁 마당')
  })

  it('마스킹된 사진은 목록에서 좌표 대신 확인 필요 배지로 표시된다', async () => {
    const { container } = renderPhotosScreen()
    await waitFor(() => expect(screen.getByText('사진 추가하기')).toBeInTheDocument())

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [createGpsPhotoFile()] } })

    await waitFor(() => expect(photoMocks.uploadLocalPhoto).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('위치 정보 공개 전 확인 필요')).toBeInTheDocument())

    expect(screen.queryByText(/37\.5/)).toBeNull()
    expect(useChildStore.getState().photos[0].metadata).toMatchObject({
      gpsMasked: true,
      location: '공개 전 확인 필요',
    })
  })
})
