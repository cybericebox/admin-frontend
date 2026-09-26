import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VariableRichText } from './VariableRichText'
import { t } from '@/i18n/t'

// Menu items render label + <code>name</code>; locate an item by its key.
const variableItem = (name: string) => screen.getByText(name, { selector: 'code' }).closest('button')!

describe('VariableRichText', () => {
  it('renders without crashing', () => {
    const onChange = vi.fn()
    expect(() =>
      render(<VariableRichText value="" onChange={onChange} />)
    ).not.toThrow()
  })

  it('renders a textbox role element', () => {
    const onChange = vi.fn()
    render(<VariableRichText value="" onChange={onChange} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('with value="{{.Name}}" and dotted=true, renders a pill showing "Name"', () => {
    const onChange = vi.fn()
    render(
      <VariableRichText
        value="{{.Name}}"
        onChange={onChange}
        variables={[{ name: 'Name' }]}
        dotted={true}
      />
    )
    const pill = document.querySelector('[data-var="Name"]')
    expect(pill).toBeInTheDocument()
    expect(pill?.textContent).toBe('Name')
  })

  it('highlights an existing token when the variable catalog arrives later', () => {
    const onChange = vi.fn()
    const { rerender } = render(<VariableRichText value="Hello {{.Name}}" onChange={onChange} dotted variables={[]} />)
    expect(document.querySelector('[data-var="Name"]')).toBeNull()
    rerender(<VariableRichText value="Hello {{.Name}}" onChange={onChange} dotted variables={[{ name: 'Name' }]} />)
    expect(document.querySelector('[data-var="Name"]')).toHaveClass('var-pill')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('works with dotted=false (non-dotted vars like {{Name}})', () => {
    const onChange = vi.fn()
    render(
      <VariableRichText
        value="{{Name}}"
        onChange={onChange}
        variables={[{ name: 'Name' }]}
        dotted={false}
      />
    )
    const pill = document.querySelector('[data-var="Name"]')
    expect(pill).toBeInTheDocument()
    expect(pill?.textContent).toBe('Name')
  })

  it('dotted=true does NOT render pill for bare {{Name}} token', () => {
    const onChange = vi.fn()
    render(
      <VariableRichText
        value="{{Name}}"
        onChange={onChange}
        variables={[{ name: 'Name' }]}
        dotted={true}
      />
    )
    // bare {{Name}} is not matched in dotted mode, so no pill
    expect(document.querySelector('[data-var="Name"]')).not.toBeInTheDocument()
  })

  it('renders placeholder via data-placeholder attribute', () => {
    const onChange = vi.fn()
    render(
      <VariableRichText
        value=""
        onChange={onChange}
        placeholder="Enter subject..."
      />
    )
    const el = screen.getByRole('textbox')
    expect(el).toHaveAttribute('data-placeholder', 'Enter subject...')
  })

  it('calls onChange when input event fires', () => {
    const onChange = vi.fn()
    render(<VariableRichText value="" onChange={onChange} />)
    const textbox = screen.getByRole('textbox')
    fireEvent.input(textbox, { target: { innerHTML: 'hello world' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('renders without variables prop', () => {
    const onChange = vi.fn()
    expect(() =>
      render(<VariableRichText value="plain text" onChange={onChange} />)
    ).not.toThrow()
  })

  it('inserts a chosen variable into the active field', () => {
    const onChange = vi.fn()
    render(<VariableRichText value="Hello " onChange={onChange} dotted variables={[{ name: 'Name', description: 'User name', example: 'Alex' }]} />)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    expect(variableItem('Name')).not.toHaveTextContent('{{')
    fireEvent.click(variableItem('Name'))
    expect(onChange).toHaveBeenLastCalledWith('Hello {{.Name}}')
    expect(document.querySelector('[data-var="Name"]')).toBeInTheDocument()
  })

  it('inserts at the cursor inside existing text', () => {
    const onChange = vi.fn()
    render(<VariableRichText value="Hi there" onChange={onChange} dotted variables={[{ name: 'Name', description: 'User name' }]} />)
    const editor = screen.getByRole('textbox')
    const range = document.createRange()
    range.setStart(editor.firstChild!, 3)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.keyUp(editor)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    fireEvent.click(variableItem('Name'))
    expect(onChange).toHaveBeenLastCalledWith('Hi {{.Name}}there')
  })

  it('searches the picker and inserts the active variable with Enter', () => {
    const onChange = vi.fn()
    render(<VariableRichText value="Hello " onChange={onChange} dotted variables={[{ name: 'Name' }, { name: 'event_name', description: 'Event name' }]} />)
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    const search = screen.getByRole('searchbox', { name: t('admin.notif.varPicker.search') })
    fireEvent.change(search, { target: { value: 'EVENT' } })
    expect(screen.queryByText('Name', { selector: 'code' })).not.toBeInTheDocument()
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('Hello {{.event_name}}')
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('undoes and redoes insertion while retaining the yellow variable marker', () => {
    const onChange = vi.fn()
    render(<VariableRichText value="Hello " onChange={onChange} dotted variables={[{ name: 'Name' }]} />)
    const editor = screen.getByRole('textbox')
    fireEvent.click(screen.getByRole('button', { name: t('admin.notif.editor.insertVariable') }))
    fireEvent.click(variableItem('Name'))
    expect(onChange).toHaveBeenLastCalledWith('Hello {{.Name}}')
    expect(editor.querySelector('[data-var="Name"]')).toHaveClass('var-pill')
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith('Hello ')
    expect(editor.querySelector('[data-var]')).toBeNull()
    fireEvent.keyDown(editor, { key: 'y', ctrlKey: true })
    expect(onChange).toHaveBeenLastCalledWith('Hello {{.Name}}')
    expect(editor.querySelector('[data-var="Name"]')).toHaveClass('var-pill')
  })
})
