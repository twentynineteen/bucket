/**
 * ParamEditor tests (issue #337)
 *
 * Text param with maxLength counter, colour param, hold slider,
 * numberList with add/remove/validation, number param, image param.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MotionTemplate, ParamValues } from '../types'
import ParamEditor from './ParamEditor'

// ---------------------------------------------------------------------------
// Stateful wrapper for controlled-component tests
// ---------------------------------------------------------------------------

function Wrapper({
  template,
  initialValues,
  onPickImage,
  imageError
}: {
  template: MotionTemplate
  initialValues: ParamValues
  onPickImage?: () => void
  imageError?: string | null
}) {
  const [values, setValues] = useState(initialValues)
  return (
    <ParamEditor
      template={template}
      values={values}
      onChange={setValues}
      onPickImage={onPickImage}
      imageError={imageError}
    />
  )
}

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
  it('text param shows input with maxLength counter', async () => {
    const user = userEvent.setup()

    render(<Wrapper template={textTemplate()} initialValues={{ name: '' }} />)

    const input = screen.getByRole('textbox', { name: /Name/i })
    expect(input).toBeInTheDocument()

    await user.type(input, 'Jane Doe')

    // Check counter shows character count
    expect(screen.getByText(/8\/40/)).toBeInTheDocument()
  })

  it('text param refuses characters beyond maxLength', () => {
    render(<Wrapper template={textTemplate()} initialValues={{ name: '' }} />)

    const input = screen.getByRole('textbox', { name: /Name/i })
    expect(input).toHaveAttribute('maxLength', '40')
  })

  it('colour param shows colour input', () => {
    render(<Wrapper template={colourTemplate()} initialValues={{ accent: '#ff3366' }} />)

    const input = screen.getByLabelText(/Accent/i)
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('#ff3366')
  })

  it('hold slider appears when template has hold param', () => {
    render(<Wrapper template={holdTemplate()} initialValues={{ hold: 2 }} />)

    const slider = screen.getByRole('slider', { name: /Hold/i })
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('aria-valuemin', '1')
    expect(slider).toHaveAttribute('aria-valuemax', '10')
  })

  it('no hold slider when template lacks hold param', () => {
    render(<Wrapper template={textTemplate()} initialValues={{ name: 'Jane Doe' }} />)

    expect(screen.queryByRole('slider', { name: /Hold/i })).not.toBeInTheDocument()
  })

  it('numberList shows rows and supports add/remove', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper
        template={numberListTemplate()}
        initialValues={{
          data: [
            { label: 'Jan', value: 10 },
            { label: 'Feb', value: 50 },
            { label: 'Mar', value: 30 }
          ]
        }}
      />
    )

    // Click "Add row" 5 times (3 existing + 5 = 8 max)
    for (let i = 0; i < 5; i++) {
      const btn = screen.getByRole('button', { name: /Add row/i })
      await user.click(btn)
    }

    // Count visible rows: each row has a "Remove row N" button
    const removeButtons = screen.getAllByRole('button', { name: /Remove row/i })
    expect(removeButtons).toHaveLength(8)

    // After 5 clicks, the Add row button should be disabled (at 8 rows)
    expect(screen.getByRole('button', { name: /Add row/i })).toBeDisabled()

    // Remove row 2
    const removeButton = screen.getByRole('button', { name: /Remove row 2/i })
    await user.click(removeButton)
  })

  it('numberList shows error for out-of-range value', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper
        template={numberListTemplate()}
        initialValues={{
          data: [
            { label: 'Jan', value: 10 },
            { label: 'Feb', value: 50 },
            { label: 'Mar', value: 30 }
          ]
        }}
      />
    )

    // Find the value input for the first row and set it to 150 (out of range)
    const valueInputs = screen.getAllByRole('spinbutton')
    await user.clear(valueInputs[0])
    await user.type(valueInputs[0], '150')

    // There should be an error for the out-of-range value
    expect(screen.getByText(/outside/i)).toBeInTheDocument()
  })

  it('number param shows spinbutton and validates range', async () => {
    const user = userEvent.setup()

    render(<Wrapper template={numberTemplate()} initialValues={{ score: 72 }} />)

    const input = screen.getByRole('spinbutton', { name: /Score/i })
    expect(input).toBeInTheDocument()

    // Enter out-of-range value
    await user.clear(input)
    await user.type(input, '120')

    // Error should appear
    expect(screen.getByText(/outside/i)).toBeInTheDocument()
  })

  it('image param shows Choose image button', async () => {
    const onPickImage = vi.fn()
    const user = userEvent.setup()

    render(
      <Wrapper template={imageTemplate()} initialValues={{}} onPickImage={onPickImage} />
    )

    const chooseButton = screen.getByRole('button', { name: /Choose image/i })
    await user.click(chooseButton)
    expect(onPickImage).toHaveBeenCalled()
  })

  it('image param shows error message', () => {
    render(
      <Wrapper
        template={imageTemplate()}
        initialValues={{}}
        onPickImage={vi.fn()}
        imageError="Image has no transparent pixels - use a cut-out PNG with a transparent background"
      />
    )

    expect(screen.getByText(/no transparent pixels/i)).toBeInTheDocument()
  })

  it('image param shows picked file name', () => {
    render(
      <Wrapper
        template={imageTemplate()}
        initialValues={{ image: { pickedPath: '/photos/runner.png' } }}
        onPickImage={vi.fn()}
      />
    )

    expect(screen.getByText('runner.png')).toBeInTheDocument()
  })

  it('F4: empty required text field shows exactly one error, not two', () => {
    const tmpl = textTemplate()
    // Simulate paramErrors from validateParams: the "required text is empty" error
    const paramErrors = [{ paramId: 'name', message: 'name: required text is empty' }]

    render(
      <ParamEditor
        template={tmpl}
        values={{ name: '' }}
        onChange={vi.fn()}
        paramErrors={paramErrors}
      />
    )

    // "Name is required" comes from the field itself.
    // The paramErrors error should NOT also show because the field already
    // covers that state. One user-facing message per state.
    const alerts = screen.getAllByText(/required/i)
    expect(alerts).toHaveLength(1)
  })
})
