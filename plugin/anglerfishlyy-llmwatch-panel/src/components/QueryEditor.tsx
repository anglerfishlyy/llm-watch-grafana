import React from 'react';

// Placeholder QueryEditor
// Note: Implementing a full Grafana query editor that integrates with the query builder
// and datasource-specific helpers requires using Grafana's panel option builder with
// custom react components and typings. For now we export a minimal placeholder
// so the module compiles and the panel options UI can show the promQuery textarea.

export const QueryEditorPlaceholder: React.FC = () => {
  return (
    <div style={{ padding: 8, color: 'var(--text-sublte)' }}>
      Query editor integration is a planned enhancement. Use the panel option "PromQL Query" to enter an expression.
    </div>
  );
};

export default QueryEditorPlaceholder;
