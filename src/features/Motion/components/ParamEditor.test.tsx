/**
 * ParamEditor tests (issue #337)
 *
 * M2.1: Text param with maxLength counter.
 * M2.2: Colour param.
 * M2.3: Hold slider.
 * M2.4: NumberList with add/remove/validation.
 * M2.5: Number param with validation.
 * M2.6: Image param (picking).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MotionTemplate, ParamValues } from '../types'
import ParamEditor from './ParamEditor'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function textTemplate(): MotionTemplate {
  return {
    schemaVersion: 1,
    id: 'test-text',
    version: '1.0.0',
    name: 'Test text',
    description: 'Test',
    category: 'lower-third',
    status: 'stable',
    tags: [],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {
      name: {
        kind: 'text',
        label: 'Name',
        maxLength: 40,
        default: 'Jane Doe',
        required: true
      }
    },
    layers: [],
    primaryTextParam: 'name'
  }
}

function colourTemplate(): MotionTemplate {
  return {
    ...textTemplate(),
    id: 'test-colour',
    params: {
      accent: {
        kind: 'colour',
        label: 'Accent',
        default: '#ff3366',
        binds: []
      }
    }
  }
}

function holdTemplate(): MotionTemplate {
  return {
    ...textTemplate(),
    id: 'test-hold',
    hold: { min: 1, max: 10, default: 2 },
    params: {
      hold: {
        kind: 'hold',
        label: 'Hold',
        min: 1,
        max: 10,
        default: 2
      }
    }
  }
}

function numberListTemplate(): MotionTemplate {
  return {
    ...textTemplate(),
    id: 'test-number-list',
    params: {
      data: {
        kind: 'numberList',
        label: 'Data',
        default: [
          { label: 'Jan', value: 10 },
          { label: 'Feb', value: 50 },
          { label: 'Mar', value: 30 }
        ],
        valueMin: 0,
        valueMax: 100
      }
    }
  }
}

function numberTemplate(): MotionTemplate {
  return {
    ...textTemplate(),
    id: 'test-number',
    params: {
      score: {
        kind: 'number',
        label: 'Score',
        default: 72,
        min: 0,
        max: 100
      }
    }
  }
}

function imageTemplate(): MotionTemplate {
  return {
    ...textTemplate(),
    id: 'test-image',
    params: {
      image: {
        kind: 'image',
        label: 'Source image'
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParamEditor', () => {
  it('M2.1 - text param shows input with maxLength counter', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ParamEditor template={textTemplate()} values={{ name: '' }} onChange={onChange} />
    )

    const input = screen.getByRole('textbox', { name: /Name/i })
    expect(input).toBeInTheDocument()

    await user.type(input, 'Jane Doe')

    // Check counter shows character count
    expect(screen.getByText(/8\/40/)).toBeInTheDocument()

    // onChange should be called with the typed text
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    expect(lastCall[0]).toHaveProperty('name', 'Jane Doe')
  })

  it('M2.1 - text param refuses characters beyond maxLength', async () => {
    const onChange = vi.fn()

    render(
      <ParamEditor template={textTemplate()} values={{ name: '' }} onChange={onChange} />
    )

    const input = screen.getByRole('textbox', { name: /Name/i })
    // The input should have maxLength attribute
    expect(input).toHaveAttribute('maxLength', '40')
  })

  it('M2.2 - colour param shows colour input', () => {
    const onChange = vi.fn()

    render(
      <ParamEditor
        template={colourTemplate()}
        values={{ accent: '#ff3366' }}
        onChange={onChange}
      />
    )

    const input = screen.getByLabelText(/Accent/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('#ff3366')
  })

  it('M2.3 - hold slider appears when template has hold param', () => {
    const onChange = vi.fn()

    render(
      <ParamEditor template={holdTemplate()} values={{ hold: 2 }} onChange={onChange} />
    )

    const slider = screen.getByRole('slider', { name: /Hold/i })
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('aria-valuemin', '1')
    expect(slider).toHaveAttribute('aria-valuemax', '10')
  })

  it('M2.3 - no hold slider when template lacks hold param', () => {
    const onChange = vi.fn()

    render(
      <ParamEditor
        template={textTemplate()}
        values={{ name: 'Jane Doe' }}
        onChange={onChange}
      />
    )

    expect(screen.queryByRole('slider', { name: /Hold/i })).not.toBeInTheDocument()
  })

  it('M2.4 - numberList shows rows and supports add/remove', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    const values: ParamValues = {
      data: [
        { label: 'Jan', value: 10 },
        { label: 'Feb', value: 50 },
        { label: 'Mar', value: 30 }
      ]
    }

    render(
      <ParamEditor template={numberListTemplate()} values={values} onChange={onChange} />
    )

    // Click "Add row" 5 times (3 existing + 5 = 8 max)
    const addButton = screen.getByRole('button', { name: /Add row/i })
    for (let i = 0; i < 5; i++) {
      await user.click(addButton)
    }

    // After 5 clicks, the Add row button should be disabled (at 8 rows)
    expect(screen.getByRole('button', { name: /Add row/i })).toBeDisabled()

    // Remove row 2
    const removeButton = screen.getByRole('button', { name: /Remove row 2/i })
    await user.click(removeButton)
  })

  it('M2.4 - numberList shows error for out-of-range value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    const values: ParamValues = {
      data: [
        { label: 'Jan', value: 10 },
        { label: 'Feb', value: 50 },
        { label: 'Mar', value: 30 }
      ]
    }

    render(
      <ParamEditor template={numberListTemplate()} values={values} onChange={onChange} />
    )

    // Find the value input for the first row and set it to 150 (out of range)
    const valueInputs = screen.getAllByRole('spinbutton')
    await user.clear(valueInputs[0])
    await user.type(valueInputs[0], '150')

    // There should be an error for the out-of-range value
    expect(screen.getByText(/outside/i)).toBeInTheDocument()
  })

  it('M2.5 - number param shows spinbutton and validates range', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <ParamEditor
        template={numberTemplate()}
        values={{ score: 72 }}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('spinbutton', { name: /Score/i })
    expect(input).toBeInTheDocument()

    // Enter out-of-range value
    await user.clear(input)
    await user.type(input, '120')

    // Error should appear
    expect(screen.getByText(/outside|invalid|range/i)).toBeInTheDocument()

    // Enter valid value
    await user.clear(input)
    await user.type(input, '72')
  })

  it('M2.6 - image param shows Choose image button', async () => {
    const onPickImage = vi.fn()
    const user = userEvent.setup()

    render(
      <ParamEditor
        template={imageTemplate()}
        values={{}}
        onChange={vi.fn()}
        onPickImage={onPickImage}
      />
    )

    const chooseButton = screen.getByRole('button', { name: /Choose image/i })
    await user.click(chooseButton)
    expect(onPickImage).toHaveBeenCalled()
  })

  it('M2.6 - image param shows error message', () => {
    render(
      <ParamEditor
        template={imageTemplate()}
        values={{}}
        onChange={vi.fn()}
        onPickImage={vi.fn()}
        imageError="Image has no transparent pixels"
      />
    )

    expect(screen.getByText(/no transparent pixels/i)).toBeInTheDocument()
  })
})
