import type { FormKitNode } from '@formkit/core';

export function scrollToErrors(node: any) {
  if (node.props.type === 'form') {
    function scrollTo(node: FormKitNode) {
      const el = document.getElementById(node.props.id);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    function scrollToErrors() {
      node.walk((child: any) => {
        // Check if this child has errors
        if (child.ledger.value('blocking') || child.ledger.value('errors')) {
          // We found an input with validation errors
          scrollTo(child);
          // Stop searching
          return false;
        }
      }, true);
    }

    function defaultInvalid(node: FormKitNode) {
      console.error('FormKit::invalidForm', node);
    }

    const onSubmitInvalid = node.props.onSubmitInvalid ?? defaultInvalid;
    node.props.onSubmitInvalid = () => {
      onSubmitInvalid(node);
      scrollToErrors();
    };
    node.on('unsettled:errors', scrollToErrors);
  }
  return false;
}