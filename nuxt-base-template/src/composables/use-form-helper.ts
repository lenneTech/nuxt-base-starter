import type { FormKitEventListener, FormKitNode } from '@formkit/core';
import { getNode, submitForm as submitFormkit } from '@formkit/core';

export function useFormHelper() {
  function prepareNode(node: FormKitNode | undefined, listener: FormKitEventListener, eventName: string = 'input') {
    if (node?.on) {
      node.on(eventName, listener);
    }
    node?.children?.forEach((childNode) => {
      prepareNode(childNode as FormKitNode, listener, eventName);
    });
  }

  async function valueChanges(nodeId: string, listener: FormKitEventListener, eventName: string = 'input') {
    // Puffer to load form
    await new Promise<void>((resolve) => setTimeout(() => {
      resolve();
    }, 1));
    prepareNode(getNode(nodeId), listener, eventName);
  }

  function submitForm(formId: string) {
    submitFormkit(formId);
  }

  function isDirty(formId: string): boolean {
    const form = getNode(formId);
        
    return !!form?.context?.state?.dirty;
  }

  async function getChangedValue(formId: string): Promise<null | object> {
    await new Promise(f => setTimeout(f, 100));
    const form = getNode(formId);

    if (!form) {
      return null;
    }
    return getDifferences(form?.props?.initial, form?.value);
  }

  function getDifferences(obj1: any, obj2: any): any {
    if (obj1 === obj2) {
      return undefined;
    }

    if (typeof obj1 !== typeof obj2) {
      return obj2;
    }

    if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) {
      return obj2;
    }

    if (Array.isArray(obj1) !== Array.isArray(obj2)) {
      return obj2;
    }

    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) {
        return obj2;
      }

      const diffArray: any[] = [];

      for (let i = 0; i < obj1.length; i++) {
        const itemDiff = getDifferences(obj1[i], obj2[i]);
        if (itemDiff !== undefined) {
          diffArray[i] = itemDiff;
        }
      }

      if (diffArray.length === 0) {
        return undefined;
      } else {
        return diffArray;
      }
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    const allKeys = new Set([...keys1, ...keys2]);
    const diffObj: any = {};
    for (const key of allKeys) {
      const keyDiff = getDifferences(obj1[key], obj2[key]);
      if (keyDiff !== undefined) {
        diffObj[key] = keyDiff;
      }
    }

    if (Object.keys(diffObj).length === 0) {
      return undefined;
    } else {
      return diffObj;
    }
  }

  return { getChangedValue, getDifferences, isDirty, submitForm, prepareNode, valueChanges };
}