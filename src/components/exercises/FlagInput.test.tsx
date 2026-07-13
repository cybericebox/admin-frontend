/**
 * FlagInput.test.tsx — 0/1/N flag value semantics.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/i18n/t', () => ({ t: (key: string) => key }))

import { FlagInput } from './FlagInput'

describe('FlagInput', () => {
  const onChange = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('0 values → "random flag" caption', () => {
    render(<FlagInput value={[]} onChange={onChange} />)
    expect(screen.getByText('admin.exTask.flag.semantics0')).toBeInTheDocument()
  })

  it('1 value → "fixed" caption', () => {
    render(<FlagInput value={['CTF{x}']} onChange={onChange} />)
    expect(screen.getByText('admin.exTask.flag.semantics1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('CTF{x}')).toBeInTheDocument()
  })

  it('N values → "random pick" caption', () => {
    render(<FlagInput value={['a', 'b']} onChange={onChange} />)
    expect(screen.getByText('admin.exTask.flag.semanticsN')).toBeInTheDocument()
  })

  it('adds an empty value via the button', () => {
    render(<FlagInput value={['a']} onChange={onChange} />)
    fireEvent.click(screen.getByText('admin.exTask.flag.add'))
    expect(onChange).toHaveBeenCalledWith(['a', ''])
  })

  it('edits and removes values', () => {
    render(<FlagInput value={['a', 'b']} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('a'), { target: { value: 'aa' } })
    expect(onChange).toHaveBeenCalledWith(['aa', 'b'])
    fireEvent.click(screen.getByLabelText('remove-flag-1'))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('disabled hides the buttons', () => {
    render(<FlagInput value={['a']} onChange={onChange} disabled />)
    expect(screen.queryByText('admin.exTask.flag.add')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('remove-flag-0')).not.toBeInTheDocument()
  })
})
