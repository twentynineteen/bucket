/**
 * Minimal AE ExtendScript object model stub (issue #329)
 *
 * Provides a stub of `app`, `CompItem`, `TextLayer`, `ShapeLayer`,
 * `KeyframeEase`, `alert`, `File` etc. for running generated scripts
 * in a Node vm context and recording what they did.
 *
 * Test-only helper. Not part of the production build.
 */
import vm from 'node:vm'

/** Recorded call to the AE stub. */
export interface AEStubCall {
  method: string
  args: unknown[]
}

/** Result of running a script in the AE stub. */
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
// Ease dimension lookup
// ---------------------------------------------------------------------------

const EASE_DIMS: Record<string, number> = {
  Scale: 3,
  Position: 1,
  Opacity: 1,
  Rotation: 1,
  'Fill Color': 1,
  'Rectangle Size': 1,
  'Tracking Amount': 1,
  'Trim Paths End': 1,
  'Trim Paths Offset': 1,
  Slider: 1,
  'Ellipse Size': 1,
  'Stroke Width': 1
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a generated .jsx script in a sandboxed vm context with the AE stub.
 */
export function runInAEStub(
  script: string,
  options?: { missingFonts?: string[] }
): AEStubResult {
  const missingFonts = options?.missingFonts ?? []

  // The entire AE object model is defined as a script preamble that runs
  // in the vm context before the generated script. This avoids crossing
  // the vm boundary with class instances.
  const preamble = buildPreamble(missingFonts)

  const extractScript = buildExtractScript()

  const context = vm.createContext({})

  // Setup
  vm.runInContext(preamble, context, { timeout: 5000 })

  // Run the generated script
  vm.runInContext(script, context, { timeout: 5000 })

  // Extract the result
  return vm.runInContext(extractScript, context, {
    timeout: 5000
  }) as AEStubResult
}

function buildPreamble(missingFonts: string[]): string {
  return `
var __calls = [];
var __comps = [];
var __alerts = [];
var __missingFonts = ${JSON.stringify(missingFonts)};
var __easeDims = ${JSON.stringify(EASE_DIMS)};

function alert(msg) { __alerts.push(String(msg)); }

var ParagraphJustification = {
  LEFT_JUSTIFY: "left",
  CENTER_JUSTIFY: "center",
  RIGHT_JUSTIFY: "right"
};

function KeyframeEase(speed, influence) {
  this.speed = speed;
  this.influence = influence;
}

function File(path) {
  this.fsName = path;
  this.path = path.replace(/\\/[^\\/]*$/, "");
}

function Shape() {
  this.vertices = [];
  this.inTangents = [];
  this.outTangents = [];
  this.closed = false;
}

function __makeProp(name) {
  var dims = __easeDims[name] || 1;
  var prop = {
    __propName: name,
    __kfs: [],
    __dims: dims,
    expression: undefined,
    value: undefined,
    numKeys: 0,
    setValue: function(val) { prop.value = val; },
    setValueAtTime: function(time, val) {
      prop.__kfs.push({
        time: time, value: val,
        inEase: undefined, outEase: undefined,
        spatialInterpolation: undefined
      });
      prop.numKeys = prop.__kfs.length;
    },
    setTemporalEaseAtKey: function(keyIndex, inEaseArr, outEaseArr) {
      __calls.push({ method: "setTemporalEaseAtKey", args: [keyIndex, inEaseArr, outEaseArr] });
      if (inEaseArr.length !== dims) {
        throw new Error('setTemporalEaseAtKey: "' + name + '" needs ' + dims + ' ease dims, got ' + inEaseArr.length);
      }
      if (outEaseArr.length !== dims) {
        throw new Error('setTemporalEaseAtKey: "' + name + '" needs ' + dims + ' ease dims, got ' + outEaseArr.length);
      }
      var kf = prop.__kfs[keyIndex - 1];
      if (kf) {
        kf.inEase = []; kf.outEase = [];
        for (var i = 0; i < inEaseArr.length; i++) {
          kf.inEase.push({ speed: inEaseArr[i].speed, influence: inEaseArr[i].influence });
        }
        for (var j = 0; j < outEaseArr.length; j++) {
          kf.outEase.push({ speed: outEaseArr[j].speed, influence: outEaseArr[j].influence });
        }
      }
    },
    setSpatialTangentsAtKey: function(keyIndex, inT, outT) {
      __calls.push({ method: "setSpatialTangentsAtKey", args: [keyIndex, inT, outT] });
      var kf = prop.__kfs[keyIndex - 1];
      if (kf) {
        var isLinear = true;
        for (var i = 0; i < inT.length; i++) { if (inT[i] !== 0) isLinear = false; }
        for (var j = 0; j < outT.length; j++) { if (outT[j] !== 0) isLinear = false; }
        kf.spatialInterpolation = isLinear ? "linear" : "bezier";
      }
    }
  };
  return prop;
}

function __makeTransform() {
  return {
    position: __makeProp("Position"),
    scale: __makeProp("Scale"),
    rotation: __makeProp("Rotation"),
    opacity: __makeProp("Opacity"),
    anchorPoint: __makeProp("Anchor Point")
  };
}

function __makeTextLayer() {
  var layer = {
    __kind: "text",
    name: "",
    transform: __makeTransform(),
    sourceText: __makeProp("Source Text"),
    __meta: {},
    __animators: [],
    __effects: [],
    addAnimator: function(name) {
      var anim = {
        name: name,
        __props: {},
        __selectors: [],
        addProperty: function(pName) {
          var p = __makeProp(pName);
          anim.__props[pName] = p;
          return p;
        },
        addSelector: function(sName) {
          var sel = __makeProp(sName);
          anim.__selectors.push(sel);
          return sel;
        }
      };
      layer.__animators.push(anim);
      return anim;
    },
    addEffect: function(name) {
      var eff = {
        name: name,
        slider: __makeProp("Slider")
      };
      layer.__effects.push(eff);
      return eff;
    }
  };
  return layer;
}

function __makeShapeLayer() {
  var layer = {
    __kind: "shape",
    name: "",
    transform: __makeTransform(),
    __shapes: [],
    __fill: undefined,
    __stroke: undefined,
    __trim: false,
    __meta: {},
    __cachedProps: {},
    fillColor: __makeProp("Fill Color"),
    trimEnd: __makeProp("Trim Paths End"),
    trimOffset: __makeProp("Trim Paths Offset"),
    addShape: function(name) { layer.__shapes.push(name); },
    setShapeProperty: function(name, val) {
      layer.__meta[name] = val;
    },
    setPath: function(verts, inT, outT, closed) {
      layer.__meta["Path Vertices"] = verts;
      layer.__meta["Path InTangents"] = inT;
      layer.__meta["Path OutTangents"] = outT;
      layer.__meta["Path Closed"] = closed;
    },
    addFill: function(col) { layer.__fill = col; },
    addStroke: function(col, width) {
      layer.__stroke = { color: col, width: width };
    },
    addTrimPaths: function() { layer.__trim = true; },
    shapeProp: function(name) {
      if (!layer.__cachedProps[name]) {
        layer.__cachedProps[name] = __makeProp(name);
      }
      return layer.__cachedProps[name];
    }
  };
  return layer;
}

function __makePrecompLayer(comp) {
  var layer = {
    __kind: "precomp",
    name: comp.name,
    transform: __makeTransform(),
    source: comp,
    __meta: {}
  };
  return layer;
}

function CompItem(name, width, height, pixelAspect, duration, frameRate) {
  var comp = {
    name: name,
    width: width,
    height: height,
    pixelAspect: pixelAspect,
    duration: duration,
    frameRate: frameRate,
    __layers: [],
    numLayers: 0,
    layers: {
      add: function(precomp) {
        var layer = __makePrecompLayer(precomp);
        comp.__layers.push(layer);
        comp.numLayers = comp.__layers.length;
        return layer;
      }
    },
    addShapeLayer: function() {
      var layer = __makeShapeLayer();
      comp.__layers.push(layer);
      comp.numLayers = comp.__layers.length;
      return layer;
    },
    addTextLayer: function() {
      var layer = __makeTextLayer();
      comp.__layers.push(layer);
      comp.numLayers = comp.__layers.length;
      return layer;
    },
    exportAsMotionGraphicsTemplate: function(overwrite, file) {
      __calls.push({
        method: "exportAsMotionGraphicsTemplate",
        args: [overwrite, file.fsName]
      });
    }
  };
  __comps.push(comp);
  return comp;
}

var app = {
  beginUndoGroup: function(name) {
    __calls.push({ method: "beginUndoGroup", args: [name] });
  },
  endUndoGroup: function() {
    __calls.push({ method: "endUndoGroup", args: [] });
  },
  fonts: {
    getFontByPostScriptName: function(psName) {
      for (var i = 0; i < __missingFonts.length; i++) {
        if (__missingFonts[i] === psName) return null;
      }
      return { postScriptName: psName };
    }
  },
  project: { items: __comps, numItems: 0 }
};

var $ = { fileName: "/tmp/script.jsx" };
`
}

function buildExtractScript(): string {
  return `
(function() {
  function extractProp(p) {
    if (!p) return null;
    return { keyframes: p.__kfs || [], expression: p.expression, value: p.value };
  }

  function extractLayer(layer) {
    var props = {};
    var kind = layer.__kind;

    // Transform
    if (layer.transform) {
      var t = layer.transform;
      if (t.position.__kfs.length > 0) props["Position"] = extractProp(t.position);
      if (t.scale.__kfs.length > 0) props["Scale"] = extractProp(t.scale);
      if (t.rotation.__kfs.length > 0) props["Rotation"] = extractProp(t.rotation);
      if (t.opacity.__kfs.length > 0) props["Opacity"] = extractProp(t.opacity);
    }

    // Text layer specifics
    if (kind === "text") {
      if (layer.sourceText) {
        props["Source Text"] = extractProp(layer.sourceText);
      }
      if (layer.__meta) {
        if (layer.__meta.font !== undefined) props["Font"] = { keyframes: [], value: layer.__meta.font };
        if (layer.__meta.justification !== undefined) props["Justification"] = { keyframes: [], value: layer.__meta.justification };
        if (layer.__meta.leading !== undefined) props["Leading"] = { keyframes: [], value: layer.__meta.leading };
        if (layer.__meta.textKind !== undefined) props["Text Kind"] = { keyframes: [], value: layer.__meta.textKind };
      }
      // Animators
      if (layer.__animators) {
        for (var a = 0; a < layer.__animators.length; a++) {
          var anim = layer.__animators[a];
          for (var pName in anim.__props) {
            props[pName] = extractProp(anim.__props[pName]);
          }
          if (anim.__selectors.length > 0) {
            props["Expression Selector"] = extractProp(anim.__selectors[0]);
          }
        }
      }
      // Effects (counter slider)
      if (layer.__effects) {
        for (var e = 0; e < layer.__effects.length; e++) {
          var eff = layer.__effects[e];
          if (eff.slider) props["Slider"] = extractProp(eff.slider);
        }
      }
    }

    // Shape layer specifics
    if (kind === "shape") {
      if (layer.__meta) {
        for (var key in layer.__meta) {
          props[key] = { keyframes: [], value: layer.__meta[key] };
        }
      }
      if (layer.__fill) {
        props["Fill Color"] = props["Fill Color"] || { keyframes: [], value: layer.__fill };
      }
      if (layer.__stroke) {
        props["Stroke Width"] = { keyframes: [], value: layer.__stroke.width };
        props["Stroke Color"] = { keyframes: [], value: layer.__stroke.color };
      }
      if (layer.fillColor && layer.fillColor.__kfs && layer.fillColor.__kfs.length > 0) {
        props["Fill Color"] = extractProp(layer.fillColor);
      }
      if (layer.trimEnd && layer.trimEnd.__kfs && layer.trimEnd.__kfs.length > 0) {
        props["Trim Paths End"] = extractProp(layer.trimEnd);
      }
      if (layer.trimOffset && layer.trimOffset.__kfs && layer.trimOffset.__kfs.length > 0) {
        props["Trim Paths Offset"] = extractProp(layer.trimOffset);
      }
      if (layer.__cachedProps) {
        for (var cp in layer.__cachedProps) {
          var cached = layer.__cachedProps[cp];
          if (cached && cached.__kfs && cached.__kfs.length > 0) {
            props[cp] = extractProp(cached);
          }
        }
      }
    }

    var essentials = undefined;
    if (layer.__meta && layer.__meta.essentialProp) {
      essentials = [layer.__meta.essentialProp];
    }

    return { kind: kind, name: layer.name, properties: props, essentialProperties: essentials };
  }

  var result = { calls: __calls, alerts: __alerts, comps: [] };
  for (var i = 0; i < __comps.length; i++) {
    var comp = __comps[i];
    var layers = [];
    for (var j = 0; j < comp.__layers.length; j++) {
      layers.push(extractLayer(comp.__layers[j]));
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
