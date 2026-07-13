/**
 * AttachmentList.test.tsx — upload appends a row, download link, size-limit error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))
vi.mock('@/api/exercises/files', () => ({
  uploadExerciseFile: vi.fn(),
  exerciseFileURL: (id: string) => `/api/exercises/files/${id}`,
}))
vi.mock('@/lib/exerciseErrors', () => ({
  exerciseErrorMessage: () => 'admin.ex.err.fileTooLarge',
}))

import { uploadExerciseFile } from '@/api/exercises/files'
import { AttachmentList } from './AttachmentList'
import { emptyDraft, type DraftFormValues } from '@/lib/exerciseSchemas'

const mockUpload = vi.mocked(uploadExerciseFile)

function Harness({ attachments = [] as { FileID: string; Name: string }[] }) {
  const draft = emptyDraft()
  draft.Variants[0].Tasks[0].Attachments = attachments
  const form = useForm<DraftFormValues>({ defaultValues: draft })
  return (
    <FormProvider {...form}>
      <AttachmentList variantIndex={0} taskIndex={0} disabled={false} />
    </FormProvider>
  )
}

describe('AttachmentList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders existing attachments with a download link', () => {
    render(<Harness attachments={[{ FileID: 'f1', Name: 'notes.pdf' }]} />)
    const link = screen.getByText('notes.pdf').closest('a')
    expect(link).toHaveAttribute('href', '/api/exercises/files/f1')
  })

  it('uploads a picked file and appends a row', async () => {
    mockUpload.mockResolvedValue({ FileID: 'f2', Name: 'dump.bin', Size: 10 })
    render(<Harness />)
    const input = screen.getByTestId('attachment-file-input')
    const file = new File(['x'], 'dump.bin')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('dump.bin')).toBeInTheDocument())
    expect(mockUpload).toHaveBeenCalledWith(file)
  })

  it('shows the mapped error when upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('413'))
    render(<Harness />)
    const input = screen.getByTestId('attachment-file-input')
    fireEvent.change(input, { target: { files: [new File(['x'], 'big.bin')] } })
    expect(await screen.findByText('admin.ex.err.fileTooLarge')).toBeInTheDocument()
  })
})
