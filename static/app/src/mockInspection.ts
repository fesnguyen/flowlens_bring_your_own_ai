import type { CodeBlock, Inspection, InspectionNode } from './inspection';

const paymentFile = 'payment_service.py';

const capture: InspectionNode = {
  id: 'capture',
  kind: 'operation',
  title: 'Capture Payment',
  description: 'Capture the customer’s payment through the gateway.',
  source: { file: paymentFile, symbol: 'PaymentService.capture', startLine: 35, endLine: 64 },
  code: [
    {
      lines: [
        [35, '# Capture the customer’s payment.'],
        [36, 'payment = await gateway.capture('],
        [37, '    customer_id=customer_id,'],
        [38, '    amount=amount,'],
        [39, ')'],
      ],
    },
    {
      omitted: {
        startLine: 40,
        endLine: 59,
        summary: 'Record the gateway response and update payment metadata.',
      },
    },
    {
      lines: [
        [60, 'if payment.timed_out:'],
        [61, '    logger.warning("Gateway response timed out")'],
        [62, '    return CaptureResult.retryable(payment.id)'],
        [63, ''],
        [64, 'return CaptureResult.from_gateway(payment)'],
      ],
    },
  ],
  findings: [
    {
      id: 'F-001',
      title: 'Payment capture timeout risk',
      status: 'Suspected',
      explanation: 'The gateway response may exceed the configured timeout.',
      evidence: [{ file: paymentFile, startLine: 35, endLine: 64 }],
      suggestion: 'Handle delayed gateway responses and evaluate asynchronous capture.',
    },
  ],
};

const retry: InspectionNode = {
  id: 'retry',
  kind: 'retry',
  title: 'Retry Payment',
  description: 'Back off before another attempt if the failure is retryable and attempts remain.',
  source: { file: paymentFile, symbol: 'PaymentService.can_retry', startLine: 66, endLine: 71 },
  code: [{
    lines: [
      [66, 'if not result.retryable:'],
      [67, '    return False'],
      [68, 'if attempt >= MAX_ATTEMPTS:'],
      [69, '    return False'],
      [70, 'await asyncio.sleep(backoff(attempt))'],
      [71, 'return True'],
    ],
  }],
};

const success: InspectionNode = {
  id: 'success', kind: 'end', title: 'End Success', description: 'The paid order is available.',
};

const failure: InspectionNode = {
  id: 'failure', kind: 'error', title: 'End Failure',
  description: 'Checkout ends after retries are exhausted or the gateway declines the payment.',
};

const createOrder: InspectionNode = {
  id: 'create-order',
  kind: 'operation',
  title: 'Create Order',
  description: 'Persist the paid order with the captured payment ID.',
  source: { file: 'order_service.py', symbol: 'OrderService.create', startLine: 72, endLine: 75 },
  code: [{
    lines: [
      [72, 'order = Order(customer_id=customer_id)'],
      [73, 'order.payment_id = payment.id'],
      [74, 'order.status = "PAID"'],
      [75, 'return await orders.save(order)'],
    ],
  }],
};

const paymentSuccessful: InspectionNode = {
  id: 'decision', kind: 'decision', title: 'Payment successful?',
  description: 'Continue only when the capture result reports success.',
  source: { file: 'checkout.py', symbol: 'CheckoutService.process', startLine: 88, endLine: 89 },
  code: [{ lines: [[88, 'if result.success:'], [89, '    break']] }],
};

const verifyWebhook: InspectionNode = {
  id: 'verify', kind: 'operation', title: 'Verify Event',
  description: 'Authenticate the gateway signature and parse the event payload.',
  source: { file: 'webhooks.py', symbol: 'PaymentWebhook.verify', startLine: 22, endLine: 25 },
  code: [{
    lines: [
      [22, 'signature = request.headers["X-Signature"]'],
      [23, 'payload = await request.body()'],
      [24, 'gateway.verify(payload, signature)'],
      [25, 'return PaymentEvent.parse(payload)'],
    ],
  }],
};

const webhookUpdate: InspectionNode = {
  id: 'update', kind: 'operation', title: 'Update Order Status',
  description: 'Find the order by payment ID and apply the gateway status.',
  source: { file: 'webhooks.py', symbol: 'PaymentWebhook.apply', startLine: 42, endLine: 46 },
  code: [{
    lines: [
      [42, 'order = await orders.find_by_payment(event.payment_id)'],
      [43, 'if order is None:'],
      [44, '    return Response(status_code=204)'],
      [45, 'order.status = event.status'],
      [46, 'return await orders.save(order)'],
    ],
  }],
  findings: [{
    id: 'F-002',
    title: 'Early webhook can be dropped',
    status: 'Suspected',
    explanation: 'A successful webhook is acknowledged even if the order has not been written yet.',
    evidence: [{ file: 'webhooks.py', startLine: 42, endLine: 44 }],
    suggestion: 'Store the event for replay when the order becomes available.',
  }],
};

const proposedCode: CodeBlock[] = [{
  lines: [
    [1, 'order = await orders.create_pending(customer_id)'],
    [2, 'await payments.enqueue_capture(order.id)'],
    [3, 'return order'],
  ],
}];

// Fictional inspection data, kept in the same shape as an imported analysis.
export const mockInspection: Inspection = {
  version: 1,
  issue: { key: 'SHOP-142' },
  analysis: {
    repository: 'shop-backend',
    revision: 'a4c8f21',
    summary: 'Checkout capture, retry policy, and gateway webhook handling.',
  },
  flows: [
    {
      id: 'checkout',
      name: 'Checkout Processing',
      type: 'original',
      description: 'Trace payment capture, the retry policy, and order creation.',
      entryNodeIds: ['start'],
      nodes: [
        { id: 'start', kind: 'start', title: 'Start Checkout', description: 'A customer submits checkout.' },
        capture, paymentSuccessful, createOrder, success, retry, failure,
      ],
      edges: [
        { source: 'start', target: 'capture' },
        { source: 'capture', target: 'decision' },
        { source: 'decision', target: 'create-order', label: 'Yes', kind: 'branch' },
        { source: 'create-order', target: 'success' },
        { source: 'decision', target: 'retry', label: 'No', kind: 'branch' },
        { source: 'retry', target: 'capture', label: 'Attempts left', kind: 'retry' },
        { source: 'retry', target: 'failure', label: 'Exhausted or declined', kind: 'branch' },
      ],
      conclusion: {
        level: 'potential_issues',
        summary: 'Payment capture may time out under load. The current retry behavior requires further investigation.',
        evidence: [{ nodeId: 'capture' }, { nodeId: 'retry' }],
        remainingQuestions: ['Do gateway logs show delayed responses for the affected checkouts?'],
      },
    },
    {
      id: 'payment-retry',
      name: 'Payment Retry',
      type: 'original',
      description: 'Follow the retry policy after a capture attempt fails.',
      entryNodeIds: ['failed-attempt'],
      nodes: [
        { id: 'failed-attempt', kind: 'start', title: 'Capture Failed', description: 'A capture attempt returns a non-success result.' },
        retry, capture, paymentSuccessful, success, failure,
      ],
      edges: [
        { source: 'failed-attempt', target: 'retry' },
        { source: 'retry', target: 'capture', label: 'Attempts left', kind: 'branch' },
        { source: 'retry', target: 'failure', label: 'Exhausted or declined', kind: 'branch' },
        { source: 'capture', target: 'decision' },
        { source: 'decision', target: 'success', label: 'Yes', kind: 'branch' },
        { source: 'decision', target: 'retry', label: 'No', kind: 'retry' },
      ],
      conclusion: {
        level: 'inconclusive',
        summary: 'Retries are bounded in source. Gateway timings are needed to assess whether the retry window is adequate.',
        evidence: [{ nodeId: 'retry' }],
      },
    },
    {
      id: 'payment-webhook',
      name: 'Payment Webhook Handling',
      type: 'original',
      description: 'Trace gateway events from delivery to order reconciliation.',
      entryNodeIds: ['delivery', 'redelivery'],
      nodes: [
        { id: 'delivery', kind: 'start', title: 'Webhook Received', description: 'The gateway reports a payment status.' },
        { id: 'redelivery', kind: 'start', title: 'Webhook Redelivered', description: 'The gateway delivers the same event again.' },
        verifyWebhook, webhookUpdate,
        { id: 'acknowledge', kind: 'end', title: 'Event Acknowledged', description: 'The gateway receives a successful response.' },
      ],
      edges: [
        { source: 'delivery', target: 'verify', kind: 'async' },
        { source: 'redelivery', target: 'verify', kind: 'async' },
        { source: 'verify', target: 'update' },
        { source: 'update', target: 'acknowledge' },
      ],
      conclusion: {
        level: 'likely_root_cause',
        summary: 'An early webhook can be acknowledged before its order exists. Compare event and order timestamps to verify this hypothesis.',
        evidence: [{ nodeId: 'update' }],
      },
    },
    {
      id: 'checkout-suggestion',
      name: 'Checkout Processing (Suggestion)',
      type: 'suggestion',
      basedOnFlowId: 'checkout',
      description: 'Persist a pending order and capture payment in a background worker.',
      entryNodeIds: ['start'],
      nodes: [
        { id: 'start', kind: 'start', title: 'Start Checkout', description: 'Receive the checkout request.' },
        {
          id: 'queue', kind: 'operation', title: 'Queue Payment Capture',
          description: 'Save the pending order before enqueueing payment capture.',
          code: proposedCode,
        },
        {
          id: 'worker', kind: 'operation', title: 'Capture in Worker',
          description: 'Use one idempotency key per order and reconcile delayed gateway responses.',
          code: [{
            lines: [
              [1, 'key = f"capture:{order.id}"'],
              [2, 'result = await gateway.capture(order, key=key)'],
              [3, 'await payments.reconcile(order.id, result)'],
            ],
          }],
        },
        { id: 'finish', kind: 'end', title: 'Status Recorded', description: 'The worker records the confirmed gateway outcome.' },
      ],
      edges: [
        { source: 'start', target: 'queue' },
        { source: 'queue', target: 'worker', label: 'Background job', kind: 'async' },
        { source: 'worker', target: 'finish' },
      ],
    },
  ],
};
