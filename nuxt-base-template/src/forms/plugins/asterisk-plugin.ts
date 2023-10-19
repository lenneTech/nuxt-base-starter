const isCheckboxAndRadioMultiple = (node: any) => (node.props.type === 'checkbox' || node.props.type === 'radio') && node.props.options;

export function addAsteriskPlugin(node: any) {
  node.on('created', () => {
    const isRequired = node.props.parsedRules.some((rule: any) => rule.name === 'required');
    if (!isRequired) {
      return;
    }

    const isMultiOption = isCheckboxAndRadioMultiple(node);

    // if we're going to modify the schema then we need
    // to update the schemaMemoKey so we don't get an
    // invalid cached schema.
    node.props.definition.schemaMemoKey = `required_${isMultiOption ? 'multi_' : ''}${node.props.definition.schemaMemoKey}`;

    const schemaFn = node.props.definition.schema;
    node.props.definition.schema = (sectionsSchema: any = {}) => {
      if (isRequired) {
        if (!isMultiOption) {
          sectionsSchema.label = {
            children: ['$label', ' *'],
          };
        }
      }
      return schemaFn(sectionsSchema);
    };
  });
}