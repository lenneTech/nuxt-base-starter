import type { FormKitEvent, FormKitNode } from '@formkit/core';

export function valueChangesPlugin(node: FormKitNode) {
  const { getDifferences } = useFormHelper();
  if (node.props.type === 'form') {
    setTimeout(() => {
      node.on('commit', (event: FormKitEvent) => {
        const diff = getDifferences(event.origin.props._init, event.payload);
        node.emit('valueChanges', { init: event.origin.props._init, current: event.payload, diff: diff });
      });
    }, 300);
  }
}