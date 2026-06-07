import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Root } from './app.jsx';
import './styles.css';
import './styles/ui-system.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/san-pham" replace />} />
      <Route path="/desktop" element={<Navigate to="/desktop/san-pham" replace />} />
      <Route path="/desktop/san-pham/*" element={<Root />} />
      <Route path="/desktop/sub-task/*" element={<Root />} />
      <Route path="/desktop/subtasks/*" element={<Root />} />
      <Route path="/desktop/nhan-su/*" element={<Root />} />
      <Route path="/desktop/toi" element={<Root />} />
      <Route path="/may-tinh" element={<Navigate to="/desktop/san-pham" replace />} />
      <Route path="/may-tinh/*" element={<Root />} />
      <Route path="/san-pham/*" element={<Root />} />
      <Route path="/sub-task/*" element={<Root />} />
      <Route path="/products/*" element={<Root />} />
      <Route path="/subtasks/*" element={<Root />} />
      <Route path="/nhan-su/*" element={<Root />} />
      <Route path="/people/*" element={<Root />} />
      <Route path="/toi" element={<Root />} />
      <Route path="/me" element={<Root />} />
      <Route path="*" element={<Navigate to="/san-pham" replace />} />
    </Routes>
  </BrowserRouter>,
);
