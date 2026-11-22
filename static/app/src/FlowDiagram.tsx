
import dagre from '@dagrejs/dagre';
import {
  Background, Edge, getNodesBounds, getViewportForBounds, Handle, MarkerType, Node, NodeProps,
  PanOnScrollMode, Position, ReactFlow, ReactFlowProvider, useNodesInitialized,
  useNodesState, useReactFlow, useStore,
} from '@xyflow/react';
import {
  AlertCircle, ArrowRight, Check, Code2, GitBranch, Maximize, Minus, Plus, RotateCw,
} from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CodePreview } from './CodeViewer';
import type { Flow, InspectionNode, LegacyNode } from './inspection';
import { impactTargets } from './inspection/flow_collection';

/**
 * GraphNode — React Flow's representation of an inspection step.
 *
 * Extends the library's Node type with our application-specific data:
 * - step: The inspection node to display.
 * - proposed: Whether it belongs to a suggested flow.
 * - onSelect: Callback invoked when the user clicks the node.
 *
 * 'execution' identifies the custom renderer registered in nodeTypes.
 */
type GraphNode = Node<
  { step: InspectionNode; proposed: boolean; impacted?: boolean; onSelect: (id: string, trigger: HTMLButtonElement) => void },
  'execution'
>;

// Icons displayed beside node titles, based on their execution type.
const nodeIcons = {
  start: ArrowRight,
  operation: Code2,
  decision: GitBranch,
  retry: RotateCw,
  end: Check,
  error: AlertCircle,
};

/** Render the responsibility and signals on the card, with full blocks in Node Details. */
function ExecutionNode({ data, selected }: NodeProps<GraphNode>) {
  const { step, proposed, impacted, onSelect } = data;
  const knownKind = step.kind && Object.hasOwn(nodeIcons, step.kind) ? step.kind as LegacyNode['kind'] : undefined;
  const Icon = nodeIcons[knownKind ?? 'operation'];
  const warningCount = step.content.filter(item =>
    item.format === 'legacyFinding' ||
    (item.format === 'content' && ['warning', 'diagnostic', 'finding'].includes(item.block.type.toLowerCase())),
  ).length;
  const range = step.source;
  const legacyCode = step.content.find(item => item.format === 'legacyCode');
  const preview = step.content.find(item => item.format === 'content');

  return (
    <>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="target" position={Position.Bottom} id="return" />

      {/* Selecting the card opens full details and marks AI-declared impact targets. */}
      <button
        className={`execution-node nodrag ${knownKind ?? ''} ${proposed ? 'proposed-node' : ''} ${impacted ? 'impact-target' : ''}`}
        type="button"
        aria-pressed={selected}
        onClick={(event) => onSelect(step.id, event.currentTarget)}
      >
        <span className="node-heading">
          <span className="node-icon"><Icon size={16} aria-hidden="true" /></span>
          <strong>{step.title}</strong>
        </span>
        {(step.sequence !== undefined || step.kind) && (
          <span className="node-category">
            {step.sequence !== undefined && <span>Step {step.sequence}</span>}
            {step.kind && <span>{step.kind}</span>}
          </span>
        )}
        {step.subheader && <span className="node-description">{step.subheader}</span>}
        {range && (
          <span className="node-source">
            <span title={range.file}>{range.file}</span>
            {range.symbol && <span title={range.symbol}>{range.symbol}</span>}
          </span>
        )}
        {legacyCode && <CodePreview blocks={legacyCode.blocks} />}
        {preview && preview.block.type.toLowerCase() !== 'code' && (
          <span className="node-description">{preview.block.title ?? preview.block.text}</span>
        )}
        {warningCount > 0 && (
          <span className="finding-count">{warningCount} investigation {warningCount === 1 ? 'note' : 'notes'}</span>
        )}
        {impacted && <span className="impact-label">Potential impact</span>}
      </button>

      <Handle type="source" position={Position.Right} id="out" />
      <Handle type="source" position={Position.Bottom} id="branch" />
      <Handle type="source" position={Position.Bottom} id="loop" />
    </>
  );
}

// Register the custom execution card with React Flow.
const nodeTypes = { execution: ExecutionNode };

// Allowed zoom range for the graph canvas.
const minZoom = 0.15;
const maxZoom = 1.6;

/**
 * layoutNodes — Calculate node positions using Dagre.
 *
 * Dagre automatically arranges the graph from left to right.
 * React Flow is responsible for rendering the positioned nodes.
 *
 * Important layout rules:
 * - Use measured node dimensions to prevent overlapping cards.
 * - Exclude retry edges from layout ranking to avoid shifting earlier steps.
 * - Prefer Yes branches above No branches.
 */
function layoutNodes(nodes: GraphNode[], flow: Flow) {
  const graph = new dagre.graphlib.Graph();

  // LR = left-to-right. Spacing and margins control card separation.
  graph.setGraph({
    rankdir: 'LR',
    align: 'UL',
    ranksep: 64,
    nodesep: 44,
    marginx: 20,
    marginy: 20,
  });

  // Register each node's measured size before calculating positions.
  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.measured?.width ?? 0,
      height: node.measured?.height ?? 0,
    });
  }

  // Register forward edges. Retry edges remain visible but do not
  // influence the left-to-right ordering of execution steps.
  for (const edge of flow.edges) {
    if (edge.kind !== 'retry') {
      graph.setEdge(edge.source, edge.target, {
        width: edge.label ? edge.label.length * 6 + 14 : 0,
        height: 20,
      });
    }
  }

  // In LR layout, sibling branches are arranged vertically.
  // Try to place the Yes branch above the No branch for readability.
  const constraints = flow.edges.flatMap((edge) => {
    if (edge.label !== 'Yes') return [];

    const negative = flow.edges.find((other) =>
      other.source === edge.source && other.label === 'No' && other.kind !== 'retry');

    return negative ? [{ left: edge.target, right: negative.target }] : [];
  });

  // Ask Dagre to calculate the final node positions.
  dagre.layout(graph, { constraints });

  // Dagre positions nodes by their centers, while React Flow expects
  // top-left coordinates. Convert between the two coordinate systems.
  return nodes.map((node) => {
    const { x, y, width, height } = graph.node(node.id);

    return {
      ...node,
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });
}

/**
 * graphEdges — Convert inspection connections into React Flow edges.
 *
 * Defines how arrows look and where they connect to execution cards.
 *
 * Visual rules:
 * - Negative/error paths use red.
 * - Retry/async paths use purple.
 * - Normal execution paths use blue-gray.
 * - Async edges use dashed lines.
 */
function graphEdges(flow: Flow): Edge[] {
  return flow.edges.map((edge, index) => {
    const loop = edge.kind === 'retry';

    // Identify negative branches and connections to error nodes.
    const negative = edge.label === 'No' ||
      flow.nodes.some((node) => node.id === edge.target && node.kind === 'error');

    // Choose the connection color based on its execution meaning.
    const tone = negative
      ? '#a53e4a'
      : loop || edge.kind === 'async'
        ? '#6555a0'
        : '#49627f';

    return {
      id: `${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,

      // Select the appropriate connection handles on the cards.
      sourceHandle: loop ? 'loop' : edge.label === 'No' ? 'branch' : 'out',
      targetHandle: loop ? 'return' : 'in',

      // CONNECTION LINE: Rounded path with an arrow pointing to the target.
      type: 'smoothstep',
      label: edge.label,
      pathOptions: { offset: loop ? 27 : 18, borderRadius: 9 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: tone,
      },

      // LINE STYLE: Dashed for asynchronous execution.
      style: {
        stroke: tone,
        strokeWidth: 1.8,
        strokeDasharray: edge.kind === 'async' ? '6 4' : undefined,
      },

      // EDGE LABEL: For example, Yes / No on decision branches.
      labelStyle: { fill: tone, fontWeight: 700, fontSize: 12 },
      labelBgPadding: [7, 4],
      labelBgBorderRadius: 5,
      labelBgStyle: {
        fill: negative ? '#fff1f2' : '#eef2f8',
        fillOpacity: 1,
      },

      // Edges are visual connections, not interactive selections.
      focusable: false,
    };
  });
}

/**
 * Graph — Interactive execution graph canvas.
 *
 * Responsibilities:
 * 1. Convert inspection steps into React Flow nodes and edges.
 * 2. Wait until node dimensions are measured.
 * 3. Arrange nodes using Dagre.
 * 4. Set the initial viewport to a readable position.
 * 5. Handle graph navigation and zoom controls.
 *
 * The selected node is controlled by App through selectedId.
 */
function Graph({ flow, selectedId, onSelect }: {
  flow: Flow;
  selectedId?: string;
  onSelect: (id: string, trigger: HTMLButtonElement) => void;
}) {
  // DOM reference used to measure the available graph canvas size.
  const canvas = useRef<HTMLDivElement>(null);

  // Prevent repeated automatic layout after the initial positioning.
  const [layoutReady, setLayoutReady] = useState(false);

  // React Flow manages the graph nodes and their internal changes.
  // Initial positions are placeholders until Dagre calculates the layout.
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(
    flow.nodes.map((step) => ({
      id: step.id,
      type: 'execution',
      data: {
        step,
        proposed: flow.type === 'suggestion',
        onSelect,
      },
      position: { x: 0, y: 0 },
    })),
  );

  // Becomes true once React Flow has measured all registered nodes.
  const initialized = useNodesInitialized();

  // React Flow functions for positioning and navigating the canvas.
  const { fitView, getNodes, setViewport, zoomIn, zoomOut } = useReactFlow<GraphNode>();

  // Subscribe to the current zoom level for the toolbar percentage.
  const zoom = useStore((state) => state.transform[2]);

  // Rebuild edges only when the selected flow changes.
  const edges = useMemo(() => graphEdges(flow), [flow]);
  const impacted = useMemo(() => impactTargets(flow, selectedId), [flow, selectedId]);
  // Selection changes styling only. Keep the measured layout and viewport in place.
  const visibleNodes = useMemo(() => nodes.map(node => ({
    ...node,
    selected: node.id === selectedId,
    data: { ...node.data, impacted: impacted.has(node.id) },
  })), [nodes, selectedId, impacted]);

  /**
   * INITIAL GRAPH LAYOUT
   *
   * useLayoutEffect runs after DOM layout but before the browser paints.
   * This lets us position measured cards before showing the finished graph.
   */
  useLayoutEffect(() => {
    // Wait for node measurements and a valid canvas before positioning.
    if (!initialized || layoutReady || !canvas.current) return;

    const { clientWidth: width, clientHeight: height } = canvas.current;

    // Calculate node positions and the bounding box of the complete graph.
    const positioned = layoutNodes(getNodes(), flow);
    const bounds = getNodesBounds(positioned);

    // Viewport that would fit the entire graph inside the canvas.
    const viewport = getViewportForBounds(
      bounds, width, height, minZoom, 1, 0.12,
    );

    // Prefer opening on the selected node if fitting the whole graph
    // would make execution cards and code previews too small to read.
    const focus = positioned.find((node) => node.id === selectedId) ?? positioned[0];
    const focusWidth = focus.measured?.width ?? 340;
    const wideCanvas = width >= 700;

    // Wide screens use a fixed readable zoom.
    // Narrow screens adapt zoom to the focused card's width.
    const readableZoom = wideCanvas
      ? 0.86
      : Math.min(1, Math.max(0.76, (width - 30) / focusWidth));

    // Calculate viewport offsets to position the focused node.
    const centerX = width / 2 - (focus.position.x + focusWidth / 2) * readableZoom;
    const centerY = height * 0.35 -
      (focus.position.y + (focus.measured?.height ?? 0) / 2) * readableZoom;

    // Apply the calculated node positions.
    setNodes(positioned);

    // Fit the graph when it remains readable; otherwise use a closer view.
    void setViewport(viewport.zoom >= readableZoom ? viewport : {
      x: Math.min(24 - bounds.x * readableZoom, centerX),
      y: wideCanvas
        ? (height - bounds.height * readableZoom) / 2 - bounds.y * readableZoom
        : centerY,
      zoom: readableZoom,
    });

    // Mark layout complete so the graph can become visible.
    setLayoutReady(true);
  }, [flow, getNodes, initialized, layoutReady, selectedId, setNodes, setViewport]);

  return (
    <div ref={canvas} className={`graph-canvas ${layoutReady ? 'graph-ready' : ''}`}>

      {/* ===== GRAPH CANVAS: Interactive execution diagram ===== */}
      <ReactFlow
        aria-label={`${flow.name} execution graph`}
        nodes={visibleNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}

        // Disable graph editing; FlowLens is currently an inspection viewer.
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        elementsSelectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}

        // NAVIGATION: Scroll/pan the canvas without modifying the graph.
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnDoubleClick={false}
        minZoom={minZoom}
        maxZoom={maxZoom}
        proOptions={{ hideAttribution: true }}
      >
        {/* CANVAS BACKGROUND: Dotted grid behind execution nodes */}
        <Background color="#c5d0df" gap={19} size={1.25} />
      </ReactFlow>

      {/* ===== BOTTOM GRAPH TOOLBAR: Zoom and fit controls ===== */}
      <div className="graph-toolbar" role="group" aria-label="Graph controls">

        {/* ZOOM CONTROLS: Zoom out, current percentage, zoom in */}
        <div className="zoom-controls">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={zoom <= minZoom}
            onClick={() => void zoomOut({ duration: 160 })}
          >
            <Minus size={15} aria-hidden="true" />
          </button>

          {/* CURRENT ZOOM: Percentage displayed between zoom buttons */}
          <span aria-label="Zoom level">{Math.round(zoom * 100)}%</span>

          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={zoom >= maxZoom}
            onClick={() => void zoomIn({ duration: 160 })}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>

        {/* FIT BUTTON: Zoom out or in to display the complete execution graph */}
        <button
          className="fit-control"
          type="button"
          title="Fit graph"
          aria-label="Fit graph"
          onClick={() => void fitView({
            duration: 230,
            padding: 0.16,
            maxZoom: 1,
          })}
        >
          <Maximize size={14} aria-hidden="true" /> Fit
        </button>
      </div>

      {/* NAVIGATION HINT: Explains how to move around the graph */}
      <span className="pan-hint">Drag to pan</span>
    </div>
  );
}

/**
 * FlowDiagram — Public entry point for the execution graph.
 *
 * Wraps Graph with ReactFlowProvider, which supplies the internal
 * graph state required by React Flow hooks.
 *
 * The flow ID is used as a React key so switching flows creates
 * a fresh graph instance with new nodes, layout, and viewport.
 *
 * Parameters<typeof Graph>[0] reuses Graph's props type instead
 * of defining the same interface twice.
 */
export function FlowDiagram(props: Parameters<typeof Graph>[0]) {
  return (
    <ReactFlowProvider key={props.flow.id}>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
