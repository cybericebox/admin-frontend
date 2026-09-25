import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { t } from '@/i18n/t'
import { InAppBodyEditor, normalizeInAppBody } from './InAppBodyEditor'

describe('InAppBodyEditor', () => {
  it('uses the platform font rather than a per-message font selector', () => {
    render(<InAppBodyEditor value="" onChange={vi.fn()} variables={[]} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('admin.notif.editor.bold') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('admin.notif.editor.italic') })).toBeInTheDocument()
  })

  it('preserves a font in an existing template when saving another edit', () => {
    expect(normalizeInAppBody('<span style="font-family:Arial">Legacy</span>')).toBe('<span style="font-family:Arial">Legacy</span>')
  })

  it('inserts a selected variable into the message body', () => {
    const onChange = vi.fn()
    render(<InAppBodyEditor value="Welcome " onChange={onChange} variables={[{ name: 'Name', description: 'User name', example: 'Alex' }]} />)
    const editor = screen.getByRole('textbox', { name: t('admin.notif.tpl.body') })
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.keyUp(editor)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    fireEvent.click(screen.getByRole('button', { name: /\{\{\.Name\}\}/ }))
    expect(onChange).toHaveBeenLastCalledWith('Welcome {{.Name}}')
    expect(editor.querySelector('[data-var="Name"]')).toHaveClass('bg-amber-100')
  })

  it('retains only supported inline formatting', () => {
    expect(normalizeInAppBody('<strong>Bold</strong><i>Italic</i><script>alert(1)</script>')).toBe('<strong>Bold</strong><em>Italic</em>')
  })

  it('inserts at the cursor in the middle of the body', () => {
    const onChange = vi.fn()
    render(<InAppBodyEditor value="Hi there" onChange={onChange} variables={[{ name: 'Name', description: 'User name' }]} />)
    const editor = screen.getByRole('textbox', { name: t('admin.notif.tpl.body') })
    const range = document.createRange()
    range.setStart(editor.firstChild!, 3)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.keyUp(editor)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    fireEvent.click(screen.getByRole('button', { name: /\{\{\.Name\}\}/ }))
    expect(onChange).toHaveBeenLastCalledWith('Hi {{.Name}}there')
  })

  it('marks variables in a previously saved template', () => {
    render(<InAppBodyEditor value="Hello {{.Name}}" onChange={vi.fn()} variables={[{ name: 'Name', example: 'Alex' }]} />)
    expect(screen.getByRole('textbox').querySelector('[data-var="Name"]')).toHaveClass('bg-amber-100')
  })

  it('marks saved variables when their definitions arrive after the template', () => {
    const onChange = vi.fn()
    const { rerender } = render(<InAppBodyEditor value="Hello {{.Name}}" onChange={onChange} variables={[]} />)
    expect(screen.getByRole('textbox').querySelector('[data-var="Name"]')).toBeNull()
    rerender(<InAppBodyEditor value="Hello {{.Name}}" onChange={onChange} variables={[{ name: 'Name' }]} />)
    expect(screen.getByRole('textbox').querySelector('[data-var="Name"]')).toHaveClass('bg-amber-100')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('undoes and redoes a variable insertion with keyboard shortcuts', () => {
    const onChange = vi.fn()
    render(<InAppBodyEditor value="Hello " onChange={onChange} variables={[{ name: 'Name' }]} />)
    const editor = screen.getByRole('textbox', { name: t('admin.notif.tpl.body') })
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    fireEvent.click(screen.getByRole('button', { name: /\{\{\.Name\}\}/ }))
    expect(onChange).toHaveBeenLastCalledWith('Hello {{.Name}}')
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith('Hello ')
    expect(editor.querySelector('[data-var]')).toBeNull()
    fireEvent.keyDown(editor, { key: 'z', metaKey: true, shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith('Hello {{.Name}}')
    expect(editor.querySelector('[data-var="Name"]')).toHaveClass('bg-amber-100')
  })

  it('keeps formatting around a variable in the saved token', () => {
    const onChange = vi.fn()
    render(<InAppBodyEditor value="Hello" onChange={onChange} variables={[{ name: 'Name' }]} />)
    const editor = screen.getByRole('textbox', { name: t('admin.notif.tpl.body') })
    const range = document.createRange()
    range.selectNodeContents(editor)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.mouseUp(editor)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.bold') }))
    expect(onChange).toHaveBeenLastCalledWith('<strong>Hello</strong>')
    fireEvent.keyDown(editor, { key: 'z', metaKey: true })
    expect(onChange).toHaveBeenLastCalledWith('Hello')
    fireEvent.keyDown(editor, { key: 'z', metaKey: true, shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith('<strong>Hello</strong>')
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    fireEvent.click(screen.getByRole('button', { name: /\{\{\.Name\}\}/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('{{.Name}}'))
  })
})
