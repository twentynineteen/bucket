/**
 * Colour-param bind paths, e.g. `layers[1].children[0]`.
 *
 * The schema, resolveTemplate and the Fusion exporter all read these paths.
 * They share this one parser so a bind that validates is also one every
 * consumer can follow, at any depth.
 */

const PATH_RE = /^layers\[(\d+)\]((?:\.children\[\d+\])*)$/
const CHILD_RE = /\.children\[(\d+)\]/g

/** The path as a list of indices from the root, or null when malformed. */
export function parseBindPath(path: string): number[] | null {
  const match = PATH_RE.exec(path)
  if (!match) return null
  const indices = [Number(match[1])]
  for (const child of match[2].matchAll(CHILD_RE)) indices.push(Number(child[1]))
  return indices
}

interface TreeNode {
  children?: unknown
}

/** The node a bind path points at, or null when it does not exist. */
export function resolveBindPath<T extends TreeNode>(
  layers: readonly T[],
  path: string
): T | null {
  const indices = parseBindPath(path)
  if (!indices) return null
  let level: readonly T[] = layers
  let node: T | null = null
  for (let i = 0; i < indices.length; i++) {
    node = level[indices[i]] ?? null
    if (!node) return null
    if (i < indices.length - 1) {
      if (!Array.isArray(node.children)) return null
      level = node.children as T[]
    }
  }
  return node
}
