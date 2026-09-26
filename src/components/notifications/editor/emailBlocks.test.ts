import { describe, it, expect } from 'vitest'
import { THEME_TOKENS, PLATFORM_BRAND, defaultBlockForType } from './emailBlocks'
import type { LogoBlock, ImageBlock, EmailBodyBlock } from './emailBlocks'

describe('THEME_TOKENS', () => {
  it('lists the three theme tokens the backend accepts', () => {
    expect(THEME_TOKENS).toEqual(['theme:brand', 'theme:accent', 'theme:on_accent'])
  })
})

describe('PLATFORM_BRAND', () => {
  it('matches the platform brand constants (constraints.md)', () => {
    expect(PLATFORM_BRAND).toEqual({
      'theme:brand':     '#211A52',
      'theme:accent':    '#211A52',
      'theme:on_accent': '#FFFFFF',
    })
  })

  it('keys are exactly the THEME_TOKENS', () => {
    expect(Object.keys(PLATFORM_BRAND).sort()).toEqual([...THEME_TOKENS].sort())
  })
})

describe('block type shapes', () => {
  it('accepts a minimal LogoBlock', () => {
    const b: LogoBlock = { type: 'logo' }
    expect(b.type).toBe('logo')
  })

  it('accepts a LogoBlock with align/width_px', () => {
    const b: LogoBlock = { type: 'logo', align: 'center', width_px: 96 }
    expect(b).toEqual({ type: 'logo', align: 'center', width_px: 96 })
  })

  it('accepts an ImageBlock referencing an uploaded file_id', () => {
    const b: ImageBlock = { type: 'image', file_id: 'ffffffff-0000-1111-2222-333333333333' }
    expect(b.file_id).toBeDefined()
  })

  it('EmailBodyBlock accepts a LogoBlock member', () => {
    const blocks: EmailBodyBlock[] = [{ type: 'logo' }, { type: 'divider' }]
    expect(blocks[0].type).toBe('logo')
  })
})

describe('defaultBlockForType', () => {
  it('returns rich_text block with empty root', () => {
    const b = defaultBlockForType('rich_text')
    expect(b.type).toBe('rich_text')
    if (b.type === 'rich_text') {
      expect(b.content.root.children).toEqual([])
    }
  })

  it('returns button block with empty label and url', () => {
    const b = defaultBlockForType('button')
    expect(b.type).toBe('button')
    if (b.type === 'button') {
      expect(b.label).toBe('')
      expect(b.url).toBe('')
    }
  })

  it('returns divider block', () => {
    const b = defaultBlockForType('divider')
    expect(b.type).toBe('divider')
  })

  it('returns image block', () => {
    const b = defaultBlockForType('image')
    expect(b.type).toBe('image')
  })

  it('returns preset block', () => {
    const b = defaultBlockForType('preset')
    expect(b.type).toBe('preset')
  })

  it('returns logo block', () => {
    const b = defaultBlockForType('logo')
    expect(b.type).toBe('logo')
  })
})
