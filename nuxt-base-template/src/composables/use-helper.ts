export function useHelper() {
  function removeFields(obj: any): any {
    const ignoreFields = ['id', '__typename'];
    if (Array.isArray(obj)) {
      return obj.map(item => removeFields(item));
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {};
      for (const key in obj) {
        if (!ignoreFields.includes(key)) {
          newObj[key] = removeFields(obj[key]);
        }
      }
      return newObj;
    } else {
      return obj;
    }
  }

  function removeNullOrUndefined(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => removeNullOrUndefined(item)).filter(item => item !== null && item !== undefined);
    } else if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {};
      for (const key in obj) {
        const value = removeNullOrUndefined(obj[key]);
        if (value !== null && value !== undefined) {
          newObj[key] = value;
        }
      }
      return newObj;
    } else {
      return obj;
    }
  }

  function isValidMongoID(id: string): boolean {
    const validHexChars = /^[0-9a-fA-F]{24}$/;

    return validHexChars.test(id);
  }

  function groupBy<T>(arr: T[], fn: (item: T) => any) {
    return arr.reduce<Record<string, T[]>>((prev, curr) => {
      const groupKey = fn(curr);
      const group = prev[groupKey] || [];
      group.push(curr);
      return { ...prev, [groupKey]: group };
    }, {});
  }

  return { removeFields, removeNullOrUndefined, isValidMongoID, groupBy };
}