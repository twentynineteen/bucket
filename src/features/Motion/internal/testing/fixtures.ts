/**
 * Test fixtures for Motion (issue #327)
 *
 * Minimal valid templates for exporter and evaluator tests: one per layer kind,
 * one per param type, escaping strings, and structural fixtures. Every fixture
 * must pass the schema; tests import them and exercise the evaluator, exporters,
 * and resolve module against them.
 */
import type { MotionTemplate } from '../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Base metadata shared across all fixtures. */
function base(
  id: string,
  overrides?: Partial<MotionTemplate>
): Omit<MotionTemplate, 'layers' | 'params'> {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    name: id.replace(/-/g, ' '),
    description: `Test fixture: ${id}`,
    category: 'lower-third',
    status: 'stable',
    tags: ['test'],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Layer-kind fixtures
// ---------------------------------------------------------------------------

/** A minimal text layer fixture. */
export const textFixture: MotionTemplate = {
  ...base('fixture-text'),
  params: {
    name: {
      kind: 'text',
      label: 'Name',
      maxLength: 40,
      default: 'Jane Doe',
      required: true
    }
  },
  layers: [
    {
      kind: 'text',
      id: 'title',
      anchor: { x: 0, y: 0 },
      position: [
        { t: 0, value: { x: 200, y: 500 }, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: { x: 200, y: 500 } }
      ],
      opacity: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 0.5, value: 1 }
      ],
      text: 'Jane Doe',
      param: 'name',
      font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
      align: 'left',
      lineHeight: 1.2,
      multiline: false,
      fill: '#ffffff'
    }
  ],
  primaryTextParam: 'name'
}

/** A minimal rect layer fixture. */
export const rectFixture: MotionTemplate = {
  ...base('fixture-rect'),
  params: {},
  layers: [
    {
      kind: 'rect',
      id: 'bg',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 100, y: 100 } }],
      opacity: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 1 }
      ],
      width: 1000,
      height: 200,
      fill: '#ff3366',
      radius: 24
    }
  ]
}

/** A minimal ellipse layer fixture. */
export const ellipseFixture: MotionTemplate = {
  ...base('fixture-ellipse'),
  params: {},
  layers: [
    {
      kind: 'ellipse',
      id: 'dot',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 1920, y: 1080 } }],
      radiusX: 50,
      radiusY: 50,
      fill: '#00ff00'
    }
  ]
}

/** A minimal path layer fixture (closed, filled). */
export const pathFixture: MotionTemplate = {
  ...base('fixture-path'),
  params: {},
  layers: [
    {
      kind: 'path',
      id: 'triangle',
      anchor: { x: 0, y: 0 },
      d: 'M 100 100 L 200 300 L 300 100 Z',
      fill: '#0000ff'
    }
  ]
}

/** A minimal arc layer fixture. */
export const arcFixture: MotionTemplate = {
  ...base('fixture-arc', { category: 'data' }),
  params: {
    score: {
      kind: 'number',
      label: 'Score',
      default: 72,
      min: 0,
      max: 100
    }
  },
  layers: [
    {
      kind: 'arc',
      id: 'ring',
      anchor: { x: 1920, y: 1080 },
      innerRadius: 400,
      outerRadius: 480,
      sweep: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 1 }
      ],
      startAngle: [{ t: 0, value: 0 }],
      sweepFromParam: { param: 'score', max: 100 },
      fill: '#ff3366'
    }
  ]
}

/** A minimal group fixture (group containing a rect and text). */
export const groupFixture: MotionTemplate = {
  ...base('fixture-group'),
  params: {},
  layers: [
    {
      kind: 'group',
      id: 'container',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 100, y: 200 } }],
      scale: [{ t: 0, value: { x: 1, y: 1 } }],
      children: [
        {
          kind: 'rect',
          id: 'bg-inner',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 10, y: 0 } }],
          width: 500,
          height: 100,
          fill: '#333333',
          radius: 8
        },
        {
          kind: 'text',
          id: 'label-inner',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 20, y: 30 } }],
          text: 'Label',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 48 },
          align: 'left',
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff'
        }
      ]
    }
  ]
}

/** A particles layer fixture. */
export const particlesFixture: MotionTemplate = {
  ...base('fixture-particles', { category: 'data' }),
  params: {
    image: { kind: 'image', label: 'Source image' }
  },
  layers: [
    {
      kind: 'particles',
      id: 'scatter',
      anchor: { x: 0, y: 0 },
      points: [
        { x: 100, y: 200, region: 'uk' },
        { x: 300, y: 400, region: 'fr' },
        { x: 500, y: 600 },
        { x: 700, y: 800 },
        { x: 900, y: 1000 }
      ],
      seed: 42,
      assembleStart: 0,
      assembleEnd: 1,
      baseFill: '#888888',
      regionFills: { uk: 'accent1', fr: 'accent2' },
      pointRadius: 4,
      imageParam: 'image'
    }
  ]
}

/** A series layer fixture. */
export const seriesFixture: MotionTemplate = {
  ...base('fixture-series', { category: 'data' }),
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
  },
  layers: [
    {
      kind: 'series',
      id: 'chart',
      anchor: { x: 0, y: 0 },
      series: {
        param: 'data',
        area: { x: 400, y: 600, w: 2000, h: 800 },
        valueRange: [0, 100],
        dot: { radiusX: 20, radiusY: 20, fill: '#ff3366' },
        connector: { dotSpacing: 40, radius: 4, fill: '#ff336680' },
        label: {
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 32 },
          fill: '#ffffff',
          align: 'center',
          offsetY: 40
        },
        marker: {
          ellipse: { radiusX: 30, radiusY: 30, fill: '#ffffff' },
          segmentDuration: 0.4,
          ease: [0.16, 1, 0.3, 1]
        },
        band: {
          hatch: { spacing: 20, angle: 45, fill: '#ff336640' }
        }
      }
    }
  ]
}

/** A text layer with counter fixture. */
export const counterFixture: MotionTemplate = {
  ...base('fixture-counter', { category: 'data' }),
  params: {
    value: {
      kind: 'number',
      label: 'Value',
      default: 72,
      min: 0,
      max: 100
    }
  },
  layers: [
    {
      kind: 'text',
      id: 'counter-text',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 1920, y: 1080 } }],
      text: '0%',
      font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 120 },
      align: 'center',
      lineHeight: 1,
      multiline: false,
      fill: '#ffffff',
      counter: {
        param: 'value',
        decimals: 0,
        prefix: '',
        suffix: '%',
        progress: [
          { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
          { t: 1, value: 1 }
        ]
      }
    }
  ]
}

// ---------------------------------------------------------------------------
// Param-type fixtures
// ---------------------------------------------------------------------------

/** Template with a text param. Same as textFixture. */
export const textParamFixture = textFixture

/** Template with a colour param. */
export const colourParamFixture: MotionTemplate = {
  ...base('fixture-colour'),
  params: {
    accent: {
      kind: 'colour',
      label: 'Accent',
      default: '#ff3366',
      binds: ['layers[0]']
    }
  },
  layers: [
    {
      kind: 'rect',
      id: 'bar',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 0, y: 900 } }],
      width: 3840,
      height: 40,
      fill: '#ff3366',
      radius: 0
    }
  ]
}

/** Template with a hold param. */
export const holdParamFixture: MotionTemplate = {
  ...base('fixture-hold'),
  hold: { min: 1, max: 10, default: 2 },
  params: {
    hold: { kind: 'hold', label: 'Hold', min: 1, max: 10, default: 2 }
  },
  layers: [
    {
      kind: 'rect',
      id: 'bg',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 0, y: 0 } }],
      opacity: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 1, ease: [0.16, 1, 0.3, 1] },
        { t: 3, value: 1, ease: [0.25, 0, 0.84, 0] },
        { t: 3.5, value: 0 }
      ],
      width: 3840,
      height: 2160,
      fill: '#000000',
      radius: 0
    }
  ]
}

/** Template with a numberList param. Same as seriesFixture. */
export const numberListParamFixture = seriesFixture

/** Template with a number param. Same as arcFixture. */
export const numberParamFixture = arcFixture

/** Template with an image param. Same as particlesFixture. */
export const imageParamFixture = particlesFixture

// ---------------------------------------------------------------------------
// Group-of-groups fixture
// ---------------------------------------------------------------------------

export const groupOfGroupsFixture: MotionTemplate = {
  ...base('fixture-group-of-groups'),
  params: {},
  layers: [
    {
      kind: 'group',
      id: 'outer',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 100, y: 100 } }],
      opacity: [{ t: 0, value: 0.5 }],
      children: [
        {
          kind: 'group',
          id: 'inner',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 50, y: 50 } }],
          opacity: [{ t: 0, value: 0.5 }],
          children: [
            {
              kind: 'rect',
              id: 'leaf',
              anchor: { x: 0, y: 0 },
              position: [{ t: 0, value: { x: 10, y: 10 } }],
              opacity: [{ t: 0, value: 0.8 }],
              width: 100,
              height: 100,
              fill: '#ff0000',
              radius: 0
            }
          ]
        }
      ]
    }
  ]
}

// ---------------------------------------------------------------------------
// Escaping strings
// ---------------------------------------------------------------------------

/** Characters that need careful escaping in every exporter. */
export const escapingStrings = {
  /** Accented Latin text. */
  accents: 'Zoë Ångström',
  /** Emoji including a ZWJ sequence (woman technologist). */
  emoji: '🎉👩‍💻',
  /** Right-to-left Arabic. */
  rtl: 'مرحبا بالعالم',
  /** Double quote. */
  doubleQuote: '"',
  /** Single quote (apostrophe). */
  singleQuote: "'",
  /** Backslash. */
  backslash: '\\',
  /** Closing Lua long-string bracket. */
  doubleBracket: ']]',
  /** Newline. */
  newline: '\n',
  /** Line separator U+2028. */
  lineSeparator: ' ',
  /** Paragraph separator U+2029. */
  paragraphSeparator: ' ',
  /** C0 control character (U+0001 SOH). */
  c0Control: '\u0001'
} as const

// ---------------------------------------------------------------------------
// All fixtures for iteration
// ---------------------------------------------------------------------------

/** Every layer-kind fixture, for tests that iterate over all templates. */
export const layerKindFixtures: MotionTemplate[] = [
  textFixture,
  rectFixture,
  ellipseFixture,
  pathFixture,
  arcFixture,
  groupFixture,
  particlesFixture,
  seriesFixture,
  counterFixture
]

/** Every param-type fixture. */
export const paramTypeFixtures: MotionTemplate[] = [
  textParamFixture,
  colourParamFixture,
  holdParamFixture,
  numberListParamFixture,
  numberParamFixture,
  imageParamFixture
]

/**
 * A fixture with every animatable property animated, for ease-dimension tests.
 * Animates: position, scale, rotation, opacity, fill colour, rect size,
 * text tracking, arc sweep, arc startAngle, counter progress.
 */
export const allAnimatedFixture: MotionTemplate = {
  ...base('fixture-all-animated', { category: 'data' }),
  params: {
    score: {
      kind: 'number',
      label: 'Score',
      default: 72,
      min: 0,
      max: 100
    }
  },
  layers: [
    {
      kind: 'rect',
      id: 'animated-rect',
      anchor: { x: 0, y: 0 },
      position: [
        { t: 0, value: { x: 100, y: 100 }, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: { x: 500, y: 500 } }
      ],
      scale: [
        { t: 0, value: { x: 1, y: 1 }, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: { x: 2, y: 2 } }
      ],
      rotation: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 90 }
      ],
      opacity: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 1 }
      ],
      width: 500,
      height: 300,
      widthAnimation: [
        { t: 0, value: 500, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 800 }
      ],
      heightAnimation: [
        { t: 0, value: 300, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 500 }
      ],
      fill: '#ff3366',
      fillAnimation: [
        { t: 0, value: '#ff3366', ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: '#3366ff' }
      ],
      radius: 24
    },
    {
      kind: 'text',
      id: 'animated-text',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 200, y: 800 } }],
      text: 'Test',
      font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
      align: 'left',
      lineHeight: 1.2,
      multiline: false,
      fill: '#ffffff',
      tracking: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 50 }
      ]
    },
    {
      kind: 'arc',
      id: 'animated-arc',
      anchor: { x: 1920, y: 1080 },
      innerRadius: 400,
      outerRadius: 480,
      sweep: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 1 }
      ],
      startAngle: [
        { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
        { t: 1, value: 90 }
      ],
      sweepFromParam: { param: 'score', max: 100 },
      fill: '#ff3366'
    },
    {
      kind: 'text',
      id: 'animated-counter',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 1920, y: 1500 } }],
      text: '0%',
      font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 120 },
      align: 'center',
      lineHeight: 1,
      multiline: false,
      fill: '#ffffff',
      counter: {
        param: 'score',
        decimals: 0,
        prefix: '',
        suffix: '%',
        progress: [
          { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
          { t: 1, value: 1 }
        ]
      }
    }
  ]
}
