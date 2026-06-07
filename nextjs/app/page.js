'use client';

import App from '@/components/App';
import IOSDevice from '@/components/IOSFrame';

export default function Page() {
  return (
    <IOSDevice width={402} height={874}>
      <App />
    </IOSDevice>
  );
}
