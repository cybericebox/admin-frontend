import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VariableRichText } from './VariableRichText'

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
})
