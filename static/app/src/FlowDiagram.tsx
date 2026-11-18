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
import type { Flow, InspectionNode } from './inspection';

type GraphNode = Node<
  { step: InspectionNode; proposed: boolean; onSelect: (id: string, trigger: HTMLButtonElement) => void },
  'execution'
>;

const nodeIcons = {
  start: ArrowRight,
  operation: Code2,
  decision: GitBranch,
  retry: RotateCw,
  end: Check,
  error: AlertCircle,
};

function ExecutionNode({ data, selected }: NodeProps<GraphNode>) {
  const { step, proposed, onSelect } = data;
  const Icon = nodeIcons[step.kind];
  const findingCount = step.findings?.length ?? 0;
  const range = step.source;
  const compact = ['start', 'end', 'error'].includes(step.kind) && !range && !step.code;

  return (
    <>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="target" position={Position.Bottom} id="return" />
      <button
        className={`execution-node nodrag ${step.kind} ${compact ? 'compact-node' : ''} ${proposed ? 'proposed-node' : ''}`}
        type="button"
        aria-pressed={selected}
        onClick={(event) => onSelect(step.id, event.currentTarget)}
      >
        <span className="node-heading">
          <span className="node-icon"><Icon size={16} aria-hidden="true" /></span>
          <strong>{step.title}</strong>
          {findingCount > 0 && (
            <span className="finding-count">{findingCount} {findingCount === 1 ? 'finding' : 'findings'}</span>
          )}
        </span>
        {!compact && (
          <>
            {proposed && <span className="type-label suggestion">Proposed</span>}
            {range && step.kind !== 'decision' && (
              <span className="node-source">
                <span title={range.file}>{range.file}</span>
                <span title={range.symbol}>{range.symbol}</span>
                <span className="source-range">Lines {range.startLine}–{range.endLine}</span>
              </span>
            )}
            <span className="node-description">{step.description}</span>
            {step.code && <CodePreview blocks={step.code} />}
          </>
        )}
      </button>
      <Handle type="source" position={Position.Right} id="out" />
      <Handle type="source" position={Position.Bottom} id="branch" />
      <Handle type="source" position={Position.Bottom} id="loop" />
    </>
  );
}

const nodeTypes = { execution: ExecutionNode };
const minZoom = 0.15;
const maxZoom = 1.6;

function layoutNodes(nodes: GraphNode[], flow: Flow) {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', align: 'UL', ranksep: 64, nodesep: 44, marginx: 20, marginy: 20 });

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.measured?.width ?? 0,
      height: node.measured?.height ?? 0,
    });
  }
  // The return edge remains visible but must not push earlier steps forward in the layout.
  for (const edge of flow.edges) {
    if (edge.kind !== 'retry') {
      graph.setEdge(edge.source, edge.target, { width: edge.label ? edge.label.length * 6 + 14 : 0, height: 20 });
    }
  }

  // In a left-to-right Dagre layout, sibling order is vertical. Keep the
  // affirmative path above the negative branch when both leave one decision.
  const constraints = flow.edges.flatMap((edge) => {
    if (edge.label !== 'Yes') return [];
    const negative = flow.edges.find((other) =>
      other.source === edge.source && other.label === 'No' && other.kind !== 'retry');
    return negative ? [{ left: edge.target, right: negative.target }] : [];
  });
  dagre.layout(graph, { constraints });
  return nodes.map((node) => {
    const { x, y, width, height } = graph.node(node.id);
    return { ...node, position: { x: x - width / 2, y: y - height / 2 } };
  });
}

function graphEdges(flow: Flow): Edge[] {
  return flow.edges.map((edge, index) => {
    const loop = edge.kind === 'retry';
    const negative = edge.label === 'No' || flow.nodes.some((node) => node.id === edge.target && node.kind === 'error');
    const tone = negative ? '#a53e4a' : loop || edge.kind === 'async' ? '#6555a0' : '#49627f';

    return {
      id: `${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: loop ? 'loop' : edge.label === 'No' ? 'branch' : 'out',
      targetHandle: loop ? 'return' : 'in',
      type: 'smoothstep',
      label: edge.label,
      pathOptions: { offset: loop ? 27 : 18, borderRadius: 9 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: tone },
      style: { stroke: tone, strokeWidth: 1.8, strokeDasharray: edge.kind === 'async' ? '6 4' : undefined },
      labelStyle: { fill: tone, fontWeight: 700, fontSize: 12 },
      labelBgPadding: [7, 4],
      labelBgBorderRadius: 5,
      labelBgStyle: { fill: negative ? '#fff1f2' : '#eef2f8', fillOpacity: 1 },
      focusable: false,
    };
  });
}

function Graph({ flow, selectedId, onSelect }: {
  flow: Flow;
  selectedId?: string;
  onSelect: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(flow.nodes.map((step) => ({
    id: step.id,
    type: 'execution',
    data: { step, proposed: flow.type === 'suggestion', onSelect },
    position: { x: 0, y: 0 },
  })));
  const initialized = useNodesInitialized();
  const { fitView, getNodes, setViewport, zoomIn, zoomOut } = useReactFlow<GraphNode>();
  const zoom = useStore((state) => state.transform[2]);
  const edges = useMemo(() => graphEdges(flow), [flow]);

  useLayoutEffect(() => {
    if (!initialized || layoutReady || !canvas.current) return;
    const { clientWidth: width, clientHeight: height } = canvas.current;
    const positioned = layoutNodes(getNodes(), flow);
    const bounds = getNodesBounds(positioned);
    const viewport = getViewportForBounds(bounds, width, height, minZoom, 1, 0.12);

    // When fitting would make code hard to read, open on the selected card.
    // Fit remains available for an overview of the complete graph.
    const focus = positioned.find((node) => node.id === selectedId) ?? positioned[0];
    const focusWidth = focus.measured?.width ?? 340;
    const wideCanvas = width >= 700;
    const readableZoom = wideCanvas ? 0.86 : Math.min(1, Math.max(0.76, (width - 30) / focusWidth));
    const centerX = width / 2 - (focus.position.x + focusWidth / 2) * readableZoom;
    const centerY = height * 0.35 - (focus.position.y + (focus.measured?.height ?? 0) / 2) * readableZoom;

    setNodes(positioned);
    void setViewport(viewport.zoom >= readableZoom ? viewport : {
      x: Math.min(24 - bounds.x * readableZoom, centerX),
      y: wideCanvas ? (height - bounds.height * readableZoom) / 2 - bounds.y * readableZoom : centerY,
      zoom: readableZoom,
    });
    setLayoutReady(true);
  }, [flow, getNodes, initialized, layoutReady, selectedId, setNodes, setViewport]);

  return (
    <div ref={canvas} className={`graph-canvas ${layoutReady ? 'graph-ready' : ''}`}>
      <ReactFlow
        aria-label={`${flow.name} execution graph`}
        nodes={nodes.map((node) => ({ ...node, selected: node.id === selectedId }))}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        elementsSelectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnDoubleClick={false}
        minZoom={minZoom}
        maxZoom={maxZoom}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#c5d0df" gap={19} size={1.25} />
      </ReactFlow>
      <div className="graph-toolbar" role="group" aria-label="Graph controls">
        <div className="zoom-controls">
          <button type="button" title="Zoom out" aria-label="Zoom out" disabled={zoom <= minZoom} onClick={() => void zoomOut({ duration: 160 })}>
            <Minus size={15} aria-hidden="true" />
          </button>
          <span aria-label="Zoom level">{Math.round(zoom * 100)}%</span>
          <button type="button" title="Zoom in" aria-label="Zoom in" disabled={zoom >= maxZoom} onClick={() => void zoomIn({ duration: 160 })}>
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>
        <button className="fit-control" type="button" title="Fit graph" aria-label="Fit graph"
          onClick={() => void fitView({ duration: 230, padding: 0.16, maxZoom: 1 })}>
          <Maximize size={14} aria-hidden="true" /> Fit
        </button>
      </div>
      <span className="pan-hint">Drag to pan</span>
    </div>
  );
}

export function FlowDiagram(props: Parameters<typeof Graph>[0]) {
  return (
    <ReactFlowProvider key={props.flow.id}>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
