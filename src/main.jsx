import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import jsPDF from 'jspdf'
import App from './App.jsx'
import './index.css'

// Global helper to add page numbering (Page X / Y) to all jsPDF instances
const addPageNumbers = (doc) => {
  if (doc._pageNumbersAdded) return;
  doc._pageNumbersAdded = true;
  try {
    const totalPages = doc.internal.getNumberOfPages();
    console.log('[jsPDF Override] Adding page numbers to document. Total pages:', totalPages);
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      
      // Filter out small format documents like labels (e.g. 100x150 mm)
      if (pageW < 120 || pageH < 120) {
        continue;
      }
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      
      // Draw at bottom center (10mm from the bottom)
      doc.text(`Page ${i} / ${totalPages}`, pageW / 2, pageH - 10, { align: 'center' });
    }
  } catch (e) {
    console.error('Error adding page numbers:', e);
  }
};

const origSave = jsPDF.prototype.save;
jsPDF.prototype.save = function (...args) {
  addPageNumbers(this);
  return origSave.apply(this, args);
};

const origOutput = jsPDF.prototype.output;
jsPDF.prototype.output = function (...args) {
  addPageNumbers(this);
  return origOutput.apply(this, args);
};

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
