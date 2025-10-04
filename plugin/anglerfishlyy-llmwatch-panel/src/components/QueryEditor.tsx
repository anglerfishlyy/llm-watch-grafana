import React from 'react';
import { Field, Input } from '@grafana/ui';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export const QueryEditor: React.FC<Props> = ({ value, onChange }) => {
  return (
    <Field label="PromQL Expression" description="Enter a Prometheus query expression"> 
      <Input value={value} onChange={(e) => onChange((e.target as HTMLInputElement).value)} />
    </Field>
  );
};
