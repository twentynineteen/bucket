/**
 * Faithful AE ExtendScript object model stub (issue #329)
 *
 * Models the documented After Effects scripting API so generated .jsx scripts
 * can be executed in a Node vm context and their AE DOM calls recorded.
 * Any method or matchName not in the documented API throws.
 *
 * Sources (each cited inline):
 * - LayerCollection: ae-scripting.docsforadobe.dev/layer/layercollection/
 * - CompItem: ae-scripting.docsforadobe.dev/item/compitem/
 * - Property: ae-scripting.docsforadobe.dev/property/property/
 * - PropertyGroup: ae-scripting.docsforadobe.dev/property/propertygroup/
 * - TextDocument: ae-scripting.docsforadobe.dev/text/textdocument/
 * - KeyframeEase: ae-scripting.docsforadobe.dev/other/keyframeease/
 * - Shape: ae-scripting.docsforadobe.dev/other/shape/
 * - Shape matchnames: ae-scripting.docsforadobe.dev/matchnames/layer/shapelayer/
 * - Text matchnames: ae-scripting.docsforadobe.dev/matchnames/layer/textlayer/
 * - AV matchnames: ae-scripting.docsforadobe.dev/matchnames/layer/avlayer/
 * - Effects matchnames: ae-scripting.docsforadobe.dev/matchnames/effects/firstparty/
 * - ItemCollection: ae-scripting.docsforadobe.dev/item/itemcollection/
 * - FontsObject: ae-scripting.docsforadobe.dev/text/fontsobject/ (AE 24.0+)
 *
 * Test-only helper. Not part of the production build.
 */
import vm from 'node:vm'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AEStubCall {
  method: string
  args: unknown[]
}

export interface AEStubResult {
  calls: AEStubCall[]
  comps: AEStubComp[]
  alerts: string[]
}

export interface AEStubComp {
  name: string
  width: number
  height: number
  pixelAspect: number
  duration: number
  frameRate: number
  layers: AEStubLayer[]
}

export interface AEStubLayer {
  kind: string
  name: string
  properties: Record<string, AEStubProperty>
  essentialProperties?: string[]
}

export interface AEStubProperty {
  keyframes: AEStubKeyframe[]
  expression?: string
  value?: unknown
}

export interface AEStubKeyframe {
  time: number
  value: unknown
  inEase?: { speed: number; influence: number }[]
  outEase?: { speed: number; influence: number }[]
  spatialInterpolation?: string
}

// ---------------------------------------------------------------------------
// Allowlisted matchNames (verified against docs)
// ---------------------------------------------------------------------------

/** Ease dimension counts per AE property type. */
const EASE_DIMS: Record<string, number> = {
  // ae-scripting.docsforadobe.dev/property/property/ - setTemporalEaseAtKey:
  // "2 for TwoD, 3 for ThreeD, 1 for all others"
  'ADBE Position': 1, // TwoD_SPATIAL -> "1 for all others"
  'ADBE Scale': 3, // ThreeD
  'ADBE Rotate Z': 1,
  'ADBE Opacity': 1,
  'ADBE Anchor Point': 1, // TwoD_SPATIAL -> 1
  // Shape layer properties - all OneD
  'ADBE Vector Fill Color': 1, // COLOR type but ease dim = 1
  'ADBE Vector Rect Size': 2, // TwoD
  'ADBE Vector Rect Roundness': 1,
  'ADBE Vector Ellipse Size': 2,
  'ADBE Vector Stroke Width': 1,
  'ADBE Vector Stroke Color': 1,
  'ADBE Vector Trim Start': 1,
  'ADBE Vector Trim End': 1,
  'ADBE Vector Trim Offset': 1,
  // Text animator properties
  'ADBE Text Tracking Amount': 1,
  'ADBE Text Selector Max Amount': 1, // Range Selector only
  'ADBE Text Expressible Amount': 1, // Expression Selector only (community.adobe.com/t5/.../14420729)
  // Effects
  'ADBE Slider Control-0001': 1,
  // Source Text
  'ADBE Text Document': 1
}

/**
 * Set of all matchNames that addProperty accepts on an indexed group.
 * Verified against ae-scripting.docsforadobe.dev/matchnames/layer/shapelayer/
 * and .../textlayer/ and .../effects/firstparty/
 */
const ADDABLE_MATCH_NAMES = new Set([
  // Shape layer content (shapelayer matchnames page)
  'ADBE Vector Group',
  'ADBE Vector Shape - Rect',
  'ADBE Vector Shape - Ellipse',
  'ADBE Vector Shape - Star',
  'ADBE Vector Shape - Group',
  'ADBE Vector Graphic - Fill',
  'ADBE Vector Graphic - Stroke',
  'ADBE Vector Graphic - G-Fill',
  'ADBE Vector Graphic - G-Stroke',
  'ADBE Vector Filter - Trim',
  'ADBE Vector Filter - Merge',
  'ADBE Vector Filter - Offset',
  'ADBE Vector Filter - PB',
  'ADBE Vector Filter - Repeater',
  'ADBE Vector Filter - RC',
  'ADBE Vector Filter - Twist',
  'ADBE Vector Filter - Roughen',
  'ADBE Vector Filter - Wiggler',
  'ADBE Vector Filter - Zigzag',
  // Text animators (textlayer matchnames page)
  'ADBE Text Animator',
  'ADBE Text Selector', // Range Selector
  'ADBE Text Expressible Selector', // Expression Selector (not in docs page; verified by common usage, flagged for #339)
  // Text animator properties (textlayer matchnames page)
  'ADBE Text Tracking Amount',
  'ADBE Text Anchor Point 3D',
  'ADBE Text Position 3D',
  'ADBE Text Scale 3D',
  'ADBE Text Rotation',
  'ADBE Text Opacity',
  'ADBE Text Fill Color',
  'ADBE Text Stroke Color',
  // Effects (effects/firstparty matchnames page)
  'ADBE Slider Control',
  'ADBE Color Control',
  'ADBE Checkbox Control',
  'ADBE Point Control',
  'ADBE Layer Control',
  'ADBE Dropdown Control',
  'ADBE Angle Control',
  'ADBE Point3D Control'
])

/**
 * Set of all matchNames that property(name) can navigate to.
 * These are named groups or leaf properties.
 */
const NAVIGABLE_MATCH_NAMES = new Set([
  // AV Layer (avlayer matchnames page)
  'ADBE Transform Group',
  'ADBE Anchor Point',
  'ADBE Position',
  'ADBE Scale',
  'ADBE Rotate Z',
  'ADBE Opacity',
  'ADBE Effect Parade',
  // Shape layer (shapelayer matchnames page)
  'ADBE Root Vectors Group',
  'ADBE Vector Group',
  'ADBE Vectors Group',
  'ADBE Vector Transform Group',
  'ADBE Vector Shape - Rect',
  'ADBE Vector Rect Size',
  'ADBE Vector Rect Position',
  'ADBE Vector Rect Roundness',
  'ADBE Vector Shape Direction',
  'ADBE Vector Shape - Ellipse',
  'ADBE Vector Ellipse Size',
  'ADBE Vector Ellipse Position',
  'ADBE Vector Shape - Group',
  'ADBE Vector Shape',
  'ADBE Vector Graphic - Fill',
  'ADBE Vector Fill Color',
  'ADBE Vector Fill Opacity',
  'ADBE Vector Fill Rule',
  'ADBE Vector Graphic - Stroke',
  'ADBE Vector Stroke Color',
  'ADBE Vector Stroke Width',
  'ADBE Vector Stroke Opacity',
  'ADBE Vector Filter - Trim',
  'ADBE Vector Trim Start',
  'ADBE Vector Trim End',
  'ADBE Vector Trim Offset',
  'ADBE Vector Trim Type',
  'ADBE Vector Blend Mode',
  'ADBE Vector Composite Order',
  'ADBE Vector Anchor',
  'ADBE Vector Position',
  'ADBE Vector Scale',
  'ADBE Vector Rotation',
  'ADBE Vector Group Opacity',
  // Text layer (textlayer matchnames page)
  'ADBE Text Properties',
  'ADBE Text Document',
  'ADBE Text Animators',
  'ADBE Text Animator',
  'ADBE Text Selectors',
  'ADBE Text Selector',
  'ADBE Text Expressible Selector', // see note above
  'ADBE Text Animator Properties',
  'ADBE Text Tracking Amount',
  'ADBE Text Selector Max Amount', // Range Selector child
  'ADBE Text Expressible Amount', // Expression Selector child (community.adobe.com/t5/.../14420729)
  'ADBE Text Selector Mode',
  'ADBE Text Percent Start',
  'ADBE Text Percent End',
  'ADBE Text Range Advanced',
  'ADBE Text Range Units',
  // Effects
  'ADBE Slider Control',
  'ADBE Slider Control-0001' // Slider value sub-property (convention; not in docs, flagged for #339)
])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function runInAEStub(
  script: string,
  options?: { missingFonts?: string[] }
): AEStubResult {
  const missingFonts = options?.missingFonts ?? []
  const preamble = buildPreamble(missingFonts)
  const extract = buildExtractScript()

  const context = vm.createContext({})
  vm.runInContext(preamble, context, { timeout: 5000 })
  vm.runInContext(script, context, { timeout: 5000 })
  return vm.runInContext(extract, context, { timeout: 5000 }) as AEStubResult
}

// ---------------------------------------------------------------------------
// Evaluate a stagger expression in isolation
// ---------------------------------------------------------------------------

/**
 * Evaluate a stagger selector expression in a vm context.
 * Sets up effect("name")(idx).valueAtTime backed by provided keyframes
 * with cubic-bezier interpolation.
 * Returns the resulting selector amount (0..100).
 */
export function evaluateStaggerExpression(
  expression: string,
  sliderKfs: AEStubKeyframe[],
  time: number,
  textIndex: number
): number {
  const kfsJson = JSON.stringify(sliderKfs)

  const setup = `
function __solve(x1, y1, x2, y2, x) {
  var t = x;
  for (var i = 0; i < 8; i++) {
    var bx = 3*(1-t)*(1-t)*t*x1 + 3*(1-t)*t*t*x2 + t*t*t;
    var dx = 3*(1-t)*(1-t)*x1 + 6*(1-t)*t*(x2-x1) + 3*t*t*(1-x2);
    if (Math.abs(dx) < 1e-10) break;
    t = t - (bx - x) / dx;
    t = Math.min(1, Math.max(0, t));
  }
  return 3*(1-t)*(1-t)*t*y1 + 3*(1-t)*t*t*y2 + t*t*t;
}

var __kfs = ${kfsJson};
var time = ${time};
var textIndex = ${textIndex};

function __valAt(kfs, t) {
  if (kfs.length === 0) return 0;
  if (kfs.length === 1) return kfs[0].value;
  if (t <= kfs[0].time) return kfs[0].value;
  if (t >= kfs[kfs.length-1].time) return kfs[kfs.length-1].value;
  for (var i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].time && t <= kfs[i+1].time) {
      var t0 = kfs[i].time, t1 = kfs[i+1].time;
      var v0 = kfs[i].value, v1 = kfs[i+1].value;
      var dt = t1 - t0;
      if (dt === 0) return v0;
      var tN = (t - t0) / dt;
      var outE = kfs[i].outEase;
      var inE = kfs[i+1].inEase;
      if (outE && outE.length > 0 && inE && inE.length > 0) {
        var avgS = Math.abs(v1 - v0) / dt;
        if (avgS === 0) avgS = 1;
        var bx1 = outE[0].influence / 100;
        var by1 = (outE[0].speed / avgS) * bx1;
        var bx2 = 1 - inE[0].influence / 100;
        var by2 = 1 - (inE[0].speed / avgS) * (1 - bx2);
        var prog = __solve(bx1, by1, bx2, by2, tN);
        return v0 + (v1 - v0) * prog;
      }
      return v0 + (v1 - v0) * tN;
    }
  }
  return kfs[kfs.length-1].value;
}

function effect(name) {
  return function(idx) {
    return {
      valueAtTime: function(t) { return __valAt(__kfs, t); },
      value: __valAt(__kfs, time)
    };
  };
}

function Math_min(a, b) { return a < b ? a : b; }
function Math_max(a, b) { return a > b ? a : b; }
`

  const ctx = vm.createContext({ Math })
  vm.runInContext(setup, ctx, { timeout: 2000 })

  // AE expressions return the last evaluated expression automatically.
  // In a JS function, we need an explicit return. Split on semicolons,
  // prepend 'return' to the last non-empty statement.
  const stmts = expression.split(';').filter((s: string) => s.trim())
  const last = stmts.pop()!
  const body =
    stmts.join('; ') + (stmts.length ? '; ' : '') + 'return ' + last.trim() + ';'
  const wrappedExpr = '(function() { ' + body + ' })()'
  const result = vm.runInContext(wrappedExpr, ctx, { timeout: 2000 })
  return typeof result === 'number' ? result : 0
}

// ---------------------------------------------------------------------------
// Preamble: the AE DOM inside the vm
// ---------------------------------------------------------------------------

function buildPreamble(missingFonts: string[]): string {
  return `
var __calls = [];
var __comps = [];
var __alerts = [];
var __missingFonts = ${JSON.stringify(missingFonts)};
var __easeDims = ${JSON.stringify(EASE_DIMS)};
var __addableNames = ${JSON.stringify([...ADDABLE_MATCH_NAMES])};
var __navigableNames = ${JSON.stringify([...NAVIGABLE_MATCH_NAMES])};

// -- Helpers ----------------------------------------------------------------

function __isAddable(name) {
  for (var i = 0; i < __addableNames.length; i++) {
    if (__addableNames[i] === name) return true;
  }
  return false;
}
function __isNavigable(name) {
  for (var i = 0; i < __navigableNames.length; i++) {
    if (__navigableNames[i] === name) return true;
  }
  return false;
}

// -- alert (ExtendScript global) -------------------------------------------
// ae-scripting.docsforadobe.dev/general/globals/
function alert(msg) { __alerts.push(String(msg)); }

// -- ParagraphJustification enum -------------------------------------------
// Standard AE enum; documented in TextDocument.justification
var ParagraphJustification = {
  LEFT_JUSTIFY: 2013,
  CENTER_JUSTIFY: 2014,
  RIGHT_JUSTIFY: 2015,
  FULL_JUSTIFY_LASTLINE_LEFT: 2016,
  FULL_JUSTIFY_LASTLINE_RIGHT: 2017,
  FULL_JUSTIFY_LASTLINE_CENTER: 2018,
  FULL_JUSTIFY_LASTLINE_FULL: 2019
};

// -- KeyframeInterpolationType enum ----------------------------------------
var KeyframeInterpolationType = {
  LINEAR: 6612,
  BEZIER: 6613,
  HOLD: 6614
};

// -- KeyframeEase ----------------------------------------------------------
// ae-scripting.docsforadobe.dev/other/keyframeease/
function KeyframeEase(speed, influence) {
  if (influence < 0.1 || influence > 100) {
    throw new Error("KeyframeEase influence must be in [0.1, 100], got " + influence);
  }
  this.speed = speed;
  this.influence = influence;
}

// -- Shape -----------------------------------------------------------------
// ae-scripting.docsforadobe.dev/other/shape/
function Shape() {
  this.vertices = [];
  this.inTangents = [];
  this.outTangents = [];
  this.closed = false;
}

// -- File ------------------------------------------------------------------
function File(path) {
  this.fsName = path;
  this.path = path.replace(/\\/[^\\/]*$/, "");
}

// -- TextDocument ----------------------------------------------------------
// ae-scripting.docsforadobe.dev/text/textdocument/
function TextDocument(text) {
  this.text = text || "";
  this.font = "ArialMT";
  this.fontSize = 24;
  this.fillColor = [1, 1, 1];
  this.applyFill = true;
  this.applyStroke = false;
  this.strokeColor = [0, 0, 0];
  this.strokeWidth = 0;
  this.justification = ParagraphJustification.LEFT_JUSTIFY;
  this.leading = 0;
  this.tracking = 0;
  this.boxText = false;       // read-only in real AE
  this.boxTextSize = [100, 100];
  this.pointText = true;      // read-only in real AE
}

// -- Cubic-bezier solver for valueAtTime interpolation --------------------
// Solves cubic-bezier(x1, y1, x2, y2) at parameter t, returning the y value.
function __solveCubicBezier(x1, y1, x2, y2, x) {
  // Newton-Raphson to find t where bezierX(t) = x
  var t = x;
  for (var i = 0; i < 8; i++) {
    var bx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    var dx = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(dx) < 1e-10) break;
    t = t - (bx - x) / dx;
    t = Math.min(1, Math.max(0, t));
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

// -- Property --------------------------------------------------------------
// ae-scripting.docsforadobe.dev/property/property/
function __makeProp(matchName, valueType) {
  var dims = __easeDims[matchName] || 1;
  var prop = {
    __matchName: matchName,
    __kfs: [],
    __dims: dims,
    __valueType: valueType || "OneD",
    expression: "",
    expressionEnabled: false,
    canSetExpression: true,
    value: undefined,
    numKeys: 0,

    // property/property/ - setValue
    setValue: function(val) {
      if (prop.numKeys > 0) throw new Error("Cannot setValue on property with keyframes");
      prop.value = val;
    },

    // property/property/ - setValueAtTime
    setValueAtTime: function(time, val) {
      prop.__kfs.push({ time: time, value: val });
      prop.numKeys = prop.__kfs.length;
      prop.value = val;
    },

    // property/property/ - valueAtTime(time, preExpression)
    // Interpolates keyframes using the stored bezier easing.
    valueAtTime: function(time) {
      var kfs = prop.__kfs;
      if (kfs.length === 0) return prop.value || 0;
      if (kfs.length === 1) return kfs[0].value;
      if (time <= kfs[0].time) return kfs[0].value;
      if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
      // Find the segment
      for (var si = 0; si < kfs.length - 1; si++) {
        if (time >= kfs[si].time && time <= kfs[si + 1].time) {
          var t0 = kfs[si].time;
          var t1 = kfs[si + 1].time;
          var v0 = kfs[si].value;
          var v1 = kfs[si + 1].value;
          var dt = t1 - t0;
          if (dt === 0) return v0;
          var tNorm = (time - t0) / dt;
          // If the outgoing key has ease, use cubic-bezier
          var outE = kfs[si].outEase;
          var inE = kfs[si + 1].inEase;
          if (outE && outE.length > 0 && inE && inE.length > 0) {
            // Convert AE speed/influence back to bezier x1,y1,x2,y2
            var avgSpeed = Math.abs(v1 - v0) / dt;
            if (avgSpeed === 0) avgSpeed = 1;
            var x1 = outE[0].influence / 100;
            var y1 = (outE[0].speed / avgSpeed) * x1;
            var x2 = 1 - inE[0].influence / 100;
            var y2 = 1 - (inE[0].speed / avgSpeed) * (1 - x2);
            var progress = __solveCubicBezier(x1, y1, x2, y2, tNorm);
            return v0 + (v1 - v0) * progress;
          }
          // Linear
          return v0 + (v1 - v0) * tNorm;
        }
      }
      return kfs[kfs.length - 1].value;
    },

    // property/property/ - setTemporalEaseAtKey
    setTemporalEaseAtKey: function(keyIndex, inEase, outEase) {
      __calls.push({ method: "setTemporalEaseAtKey", args: [keyIndex, inEase, outEase || inEase] });
      var actualOut = outEase || inEase;
      if (inEase.length !== dims) {
        throw new Error(
          'setTemporalEaseAtKey: "' + matchName + '" expects ' +
          dims + ' ease dims, got ' + inEase.length
        );
      }
      if (actualOut.length !== dims) {
        throw new Error(
          'setTemporalEaseAtKey: "' + matchName + '" expects ' +
          dims + ' ease dims, got ' + actualOut.length
        );
      }
      var kf = prop.__kfs[keyIndex - 1];
      if (kf) {
        kf.inEase = [];
        kf.outEase = [];
        for (var i = 0; i < inEase.length; i++) {
          kf.inEase.push({ speed: inEase[i].speed, influence: inEase[i].influence });
        }
        for (var j = 0; j < actualOut.length; j++) {
          kf.outEase.push({ speed: actualOut[j].speed, influence: actualOut[j].influence });
        }
      }
    },

    // property/property/ - setSpatialTangentsAtKey
    setSpatialTangentsAtKey: function(keyIndex, inTangent, outTangent) {
      var actualOut = outTangent || inTangent;
      __calls.push({ method: "setSpatialTangentsAtKey", args: [keyIndex, inTangent, actualOut] });
      var kf = prop.__kfs[keyIndex - 1];
      if (kf) {
        var isLinear = true;
        for (var a = 0; a < inTangent.length; a++) { if (inTangent[a] !== 0) isLinear = false; }
        for (var b = 0; b < actualOut.length; b++) { if (actualOut[b] !== 0) isLinear = false; }
        kf.spatialInterpolation = isLinear ? "linear" : "bezier";
      }
    },

    // property/property/ - setInterpolationTypeAtKey
    setInterpolationTypeAtKey: function(keyIndex, inType, outType) {
      __calls.push({ method: "setInterpolationTypeAtKey", args: [keyIndex, inType, outType || inType] });
    },

    // property/property/ - addToMotionGraphicsTemplateAs
    addToMotionGraphicsTemplateAs: function(comp, name) {
      __calls.push({ method: "addToMotionGraphicsTemplateAs", args: [comp, name] });
      return true;
    },

    // property/property/ - canAddToMotionGraphicsTemplate
    canAddToMotionGraphicsTemplate: function() { return true; }
  };

  // expression setter support
  Object.defineProperty(prop, "expression", {
    get: function() { return prop.__expression || ""; },
    set: function(val) {
      prop.__expression = val;
      prop.expressionEnabled = (val !== "");
    },
    enumerable: true,
    configurable: true
  });

  return prop;
}

// -- PropertyGroup ---------------------------------------------------------
// ae-scripting.docsforadobe.dev/property/propertygroup/
function __makeGroup(matchName) {
  var children = {};
  var indexedChildren = [];

  var group = {
    __matchName: matchName,
    __children: children,
    __indexedChildren: indexedChildren,
    matchName: matchName,
    numProperties: 0,

    // propertygroup/ - property(index_or_name)
    property: function(nameOrIndex) {
      if (typeof nameOrIndex === "number") {
        return indexedChildren[nameOrIndex - 1] || null;
      }
      if (!__isNavigable(nameOrIndex)) {
        throw new Error('property("' + nameOrIndex + '") is not a known AE matchName');
      }
      if (children[nameOrIndex]) return children[nameOrIndex];
      // Auto-create navigable leaf properties
      var child = __makeProp(nameOrIndex);
      children[nameOrIndex] = child;
      return child;
    },

    // propertygroup/ - addProperty(name)
    addProperty: function(name) {
      if (!__isAddable(name)) {
        throw new Error('addProperty("' + name + '") is not a known addable AE matchName');
      }
      var child;
      // Groups that contain sub-properties
      if (name === "ADBE Vector Group" ||
          name === "ADBE Vector Graphic - Fill" ||
          name === "ADBE Vector Graphic - Stroke" ||
          name === "ADBE Vector Filter - Trim" ||
          name === "ADBE Vector Shape - Rect" ||
          name === "ADBE Vector Shape - Ellipse" ||
          name === "ADBE Vector Shape - Star" ||
          name === "ADBE Vector Shape - Group" ||
          name === "ADBE Text Animator" ||
          name === "ADBE Text Selector" ||
          name === "ADBE Text Expressible Selector" ||
          name === "ADBE Slider Control") {
        child = __makeGroup(name);
        // Pre-populate known children for groups
        if (name === "ADBE Vector Group") {
          child.__children["ADBE Vectors Group"] = __makeGroup("ADBE Vectors Group");
          child.__children["ADBE Vector Transform Group"] = __makeGroup("ADBE Vector Transform Group");
        }
        if (name === "ADBE Text Animator") {
          child.__children["ADBE Text Selectors"] = __makeGroup("ADBE Text Selectors");
          child.__children["ADBE Text Animator Properties"] = __makeGroup("ADBE Text Animator Properties");
        }
        if (name === "ADBE Slider Control") {
          child.__children["ADBE Slider Control-0001"] = __makeProp("ADBE Slider Control-0001");
        }
        if (name === "ADBE Text Expressible Selector") {
          // Expression Selector's Amount is "ADBE Text Expressible Amount"
          // (community.adobe.com/t5/.../14420729), NOT "ADBE Text Selector Max Amount"
          child.__children["ADBE Text Expressible Amount"] = __makeProp("ADBE Text Expressible Amount");
        }
        if (name === "ADBE Text Selector") {
          // Range Selector's Amount is "ADBE Text Selector Max Amount"
          child.__children["ADBE Text Selector Max Amount"] = __makeProp("ADBE Text Selector Max Amount");
        }
      } else {
        child = __makeProp(name);
      }
      children[name] = child;
      indexedChildren.push(child);
      group.numProperties = indexedChildren.length;
      return child;
    },

    canAddProperty: function(name) { return __isAddable(name); }
  };

  return group;
}

// -- Transform group -------------------------------------------------------
function __makeTransformGroup() {
  var g = __makeGroup("ADBE Transform Group");
  g.__children["ADBE Anchor Point"] = __makeProp("ADBE Anchor Point", "TwoD_SPATIAL");
  g.__children["ADBE Position"] = __makeProp("ADBE Position", "TwoD_SPATIAL");
  g.__children["ADBE Scale"] = __makeProp("ADBE Scale", "ThreeD");
  g.__children["ADBE Rotate Z"] = __makeProp("ADBE Rotate Z");
  g.__children["ADBE Opacity"] = __makeProp("ADBE Opacity");
  return g;
}

// -- Layer -----------------------------------------------------------------
function __makeLayer(kind) {
  var transformGroup = __makeTransformGroup();
  var effectsGroup = __makeGroup("ADBE Effect Parade");
  var layerProps = {};

  // Shape layers get ADBE Root Vectors Group
  var rootVectors = null;
  if (kind === "shape") {
    rootVectors = __makeGroup("ADBE Root Vectors Group");
  }

  // Text layers get ADBE Text Properties
  var textProps = null;
  if (kind === "text") {
    textProps = __makeGroup("ADBE Text Properties");
    var tdProp = __makeProp("ADBE Text Document", "TEXT_DOCUMENT");
    tdProp.value = new TextDocument("");
    textProps.__children["ADBE Text Document"] = tdProp;
    textProps.__children["ADBE Text Animators"] = __makeGroup("ADBE Text Animators");
  }

  var layer = {
    __kind: kind,
    __essentialProps: [],
    name: "",
    index: 0,
    inPoint: 0,
    outPoint: 0,
    startTime: 0,
    enabled: true,
    source: undefined,
    parent: undefined,

    // layer/layerobject - property(matchName)
    property: function(nameOrIndex) {
      if (nameOrIndex === "ADBE Transform Group") return transformGroup;
      if (nameOrIndex === "ADBE Effect Parade") return effectsGroup;
      if (nameOrIndex === "ADBE Root Vectors Group" && rootVectors) return rootVectors;
      if (nameOrIndex === "ADBE Text Properties" && textProps) return textProps;
      // Allow navigable names
      if (typeof nameOrIndex === "string" && __isNavigable(nameOrIndex)) {
        if (!layerProps[nameOrIndex]) {
          layerProps[nameOrIndex] = __makeProp(nameOrIndex);
        }
        return layerProps[nameOrIndex];
      }
      if (typeof nameOrIndex === "string") {
        throw new Error('layer.property("' + nameOrIndex + '") is not a known AE matchName');
      }
      return null;
    },

    // Transform shorthand - layer.transform is property("ADBE Transform Group")
    // But in real AE, layer.transform is just a reference. We use property().
    __transformGroup: transformGroup,
    __effectsGroup: effectsGroup,
    __rootVectors: rootVectors,
    __textProps: textProps,
    __layerProps: layerProps
  };

  return layer;
}

// -- CompItem --------------------------------------------------------------
// ae-scripting.docsforadobe.dev/item/compitem/
function __makeCompItem(name, width, height, pixelAspect, duration, frameRate) {
  var layerList = [];
  var comp = {
    name: name,
    width: width,
    height: height,
    pixelAspect: pixelAspect,
    duration: duration,
    frameRate: frameRate,
    __layers: layerList,
    numLayers: 0,

    // compitem/ - openInEssentialGraphics
    openInEssentialGraphics: function() {
      __calls.push({ method: "openInEssentialGraphics", args: [] });
    },

    // compitem/ - exportAsMotionGraphicsTemplate
    exportAsMotionGraphicsTemplate: function(doOverwrite, filePath) {
      __calls.push({
        method: "exportAsMotionGraphicsTemplate",
        args: [doOverwrite, filePath instanceof Object ? filePath.fsName : filePath]
      });
      return true;
    },

    // compitem/ - layer(index_or_name)
    layer: function(indexOrName) {
      if (typeof indexOrName === "number") return layerList[indexOrName - 1] || null;
      for (var i = 0; i < layerList.length; i++) {
        if (layerList[i].name === indexOrName) return layerList[i];
      }
      return null;
    },

    layers: {
      // layercollection/ - addShape()
      addShape: function() {
        var layer = __makeLayer("shape");
        layerList.push(layer);
        layer.index = layerList.length;
        comp.numLayers = layerList.length;
        return layer;
      },

      // layercollection/ - addText([sourceText])
      addText: function(sourceText) {
        var layer = __makeLayer("text");
        layerList.push(layer);
        layer.index = layerList.length;
        comp.numLayers = layerList.length;
        // Set source text if provided
        if (sourceText !== undefined) {
          var textDoc = textProps(layer);
          if (typeof sourceText === "string") {
            textDoc.setValue(new TextDocument(sourceText));
          } else {
            textDoc.setValue(sourceText);
          }
        }
        return layer;
      },

      // layercollection/ - addNull([duration])
      addNull: function(dur) {
        var layer = __makeLayer("null");
        layerList.push(layer);
        layer.index = layerList.length;
        comp.numLayers = layerList.length;
        return layer;
      },

      // layercollection/ - add(item[, duration])
      add: function(item, dur) {
        var layer = __makeLayer("precomp");
        layer.source = item;
        layer.name = item.name;
        layerList.push(layer);
        layer.index = layerList.length;
        comp.numLayers = layerList.length;
        return layer;
      },

      // layercollection/ - addSolid(color, name, width, height, pixelAspect[, duration])
      addSolid: function(color, name, w, h, pa, dur) {
        var layer = __makeLayer("solid");
        layer.name = name;
        layerList.push(layer);
        layer.index = layerList.length;
        comp.numLayers = layerList.length;
        return layer;
      },

      // layercollection/ - addBoxText([width, height])
      addBoxText: function(size) {
        var layer = __makeLayer("text");
        // Box text: initialise the TextDocument with boxText = true
        var td = layer.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.boxText = true;
        td.pointText = false;
        if (size) td.boxTextSize = size;
        layerList.push(layer);
        layer.index = layerList.length;
        comp.numLayers = layerList.length;
        return layer;
      }
    }
  };
  return comp;
}

function textProps(layer) {
  return layer.property("ADBE Text Properties").property("ADBE Text Document");
}

// -- app -------------------------------------------------------------------
// ae-scripting.docsforadobe.dev/general/application/
var app = {
  beginUndoGroup: function(name) {
    __calls.push({ method: "beginUndoGroup", args: [name] });
  },
  endUndoGroup: function() {
    __calls.push({ method: "endUndoGroup", args: [] });
  },

  // ae-scripting.docsforadobe.dev/text/fontsobject/ (AE 24.0+)
  fonts: {
    getFontsByPostScriptName: function(psName) {
      for (var i = 0; i < __missingFonts.length; i++) {
        if (__missingFonts[i] === psName) return [];
      }
      return [{ postScriptName: psName, family: psName }];
    }
  },

  project: {
    items: {
      // ae-scripting.docsforadobe.dev/item/itemcollection/ - addComp
      addComp: function(name, width, height, pixelAspect, duration, frameRate) {
        var comp = __makeCompItem(name, width, height, pixelAspect, duration, frameRate);
        __comps.push(comp);
        return comp;
      }
    }
  },

  version: "24.0"
};

// ExtendScript $ object
var $ = { fileName: "/tmp/script.jsx" };
`
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

function buildExtractScript(): string {
  return `
(function() {
  function xProp(p) {
    if (!p) return null;
    if (p.__kfs) {
      return {
        keyframes: p.__kfs,
        expression: p.__expression || "",
        value: p.value
      };
    }
    return null;
  }

  function xLayer(layer) {
    var props = {};
    var essentials = [];

    // Transform
    var tg = layer.__transformGroup;
    if (tg) {
      var tNames = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"];
      for (var ti = 0; ti < tNames.length; ti++) {
        var tn = tNames[ti];
        var tp = tg.__children[tn];
        if (tp && tp.__kfs && tp.__kfs.length > 0) {
          props[tn] = xProp(tp);
        } else if (tp && tp.value !== undefined) {
          props[tn] = xProp(tp);
        }
      }
    }

    // Shape layer content
    if (layer.__rootVectors) {
      xGroup(layer.__rootVectors, props);
    }

    // Text layer
    if (layer.__textProps) {
      var doc = layer.__textProps.__children["ADBE Text Document"];
      if (doc) {
        props["ADBE Text Document"] = xProp(doc);
      }
      var anims = layer.__textProps.__children["ADBE Text Animators"];
      if (anims) {
        xAnimators(anims, props);
      }
    }

    // Effects
    if (layer.__effectsGroup) {
      xEffects(layer.__effectsGroup, props);
    }

    // Essential Graphics from calls
    for (var ci = 0; ci < __calls.length; ci++) {
      var c = __calls[ci];
      if (c.method === "addToMotionGraphicsTemplateAs" && c.args.length >= 2) {
        essentials.push(c.args[1]);
      }
    }

    return {
      kind: layer.__kind,
      name: layer.name,
      properties: props,
      essentialProperties: essentials.length > 0 ? essentials : undefined
    };
  }

  function xGroup(group, props) {
    if (!group || !group.__children) return;
    for (var key in group.__children) {
      var child = group.__children[key];
      if (child && child.__kfs !== undefined) {
        if (child.__kfs.length > 0 || child.value !== undefined || child.__expression) {
          props[key] = xProp(child);
        }
      } else if (child && child.__children) {
        xGroup(child, props);
      }
    }
    if (group.__indexedChildren) {
      for (var j = 0; j < group.__indexedChildren.length; j++) {
        var ic = group.__indexedChildren[j];
        if (ic && ic.__kfs !== undefined) {
          // Include any property that was explicitly added via addProperty
          props[ic.__matchName] = xProp(ic);
        } else if (ic && ic.__children) {
          xGroup(ic, props);
        }
      }
    }
  }

  function xAnimators(animsGroup, props) {
    if (!animsGroup || !animsGroup.__indexedChildren) return;
    for (var i = 0; i < animsGroup.__indexedChildren.length; i++) {
      var anim = animsGroup.__indexedChildren[i];
      if (!anim || !anim.__children) continue;
      // Animator properties
      var ap = anim.__children["ADBE Text Animator Properties"];
      if (ap) xGroup(ap, props);
      // Selectors
      var sels = anim.__children["ADBE Text Selectors"];
      if (sels) xGroup(sels, props);
    }
  }

  function xEffects(effectsGroup, props) {
    if (!effectsGroup || !effectsGroup.__indexedChildren) return;
    for (var i = 0; i < effectsGroup.__indexedChildren.length; i++) {
      var eff = effectsGroup.__indexedChildren[i];
      if (eff && eff.__children) xGroup(eff, props);
    }
  }

  var result = { calls: __calls, alerts: __alerts, comps: [] };
  for (var i = 0; i < __comps.length; i++) {
    var comp = __comps[i];
    var layers = [];
    for (var j = 0; j < comp.__layers.length; j++) {
      layers.push(xLayer(comp.__layers[j]));
    }
    result.comps.push({
      name: comp.name,
      width: comp.width,
      height: comp.height,
      pixelAspect: comp.pixelAspect,
      duration: comp.duration,
      frameRate: comp.frameRate,
      layers: layers
    });
  }
  return result;
})()
`
}
