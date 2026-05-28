// src/hooks/useAnalysisStream.js
import { useState, useEffect } from 'react';
import { tokenStore } from '../utils/tokenStore';

export function useAnalysisStream(documentId) {
  const [sections, setSections] = useState([]);
  const [summary, setSummary] = useState('');
  const [docType, setDocType] = useState('');
  const [missingClauses, setMissingClauses] = useState([]);
  const [overallRisk, setOverallRisk] = useState('');
  const [keyDates, setKeyDates] = useState([]);
  const [keyAmounts, setKeyAmounts] = useState([]);
  const [aiProvider, setAiProvider] = useState('');
  const [status, setStatus] = useState('idle');
  // idle | connecting | waiting | streaming | complete | error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!documentId) return;

    setStatus('connecting');
    setSections([]);
    setSummary('');
    setDocType('');
    setMissingClauses([]);
    setOverallRisk('');
    setKeyDates([]);
    setKeyAmounts([]);
    setError(null);

    const token = tokenStore.get();
    if (!token) {
      setError('Authentication required.');
      setStatus('error');
      return;
    }

    const eventSource = new EventSource(
      `http://localhost:5001/api/analyze/stream/${documentId}?token=${token}`
    );

    eventSource.onopen = () => setStatus('streaming');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'doc_type') setDocType(data.value);
        if (data.type === 'overall_risk') setOverallRisk(data.value);

        // ✅ FIXED: The controller sends the full summary as 'chunk', not streaming chunks
        // So we set it directly, not concatenate
        if (data.type === 'summary') {
          setSummary(data.chunk || '');
        }

        if (data.type === 'section') {
          const section = data.data || {};

          console.log('[DEBUG] Raw section:', JSON.stringify(section)); // ADD THIS DEBUG LOG

          setSections(prev => [...prev, {
            heading: section.heading || section.title || `Section ${prev.length + 1}`,
            plain_english: section.plain_english || section.plain_summary || '',
            who_benefits: section.who_benefits || section.benefits_who || 'both',
            risk_level: section.risk_level || 'neutral',
            risk_reason: section.risk_reason || '',
            original_text: section.original_text || '',
          }]);
        }

        if (data.type === 'missing_clauses') {
          // Ensure missing_clauses is an array of objects with {clause, why_it_matters}
          const clauses = Array.isArray(data.data) ? data.data : [];
          setMissingClauses(clauses.map(m => ({
            clause: typeof m === 'string' ? m : (m.clause || ''),
            why_it_matters: typeof m === 'object' && m !== null ? (m.why_it_matters || '') : '',
          })));
        }

        if (data.type === 'key_dates') setKeyDates(data.data || []);
        if (data.type === 'key_amounts') setKeyAmounts(data.data || []);
        if (data.type === 'provider') setAiProvider(data.value);

        if (data.type === 'waiting') {
          setStatus('waiting');
          eventSource.close();
        }
        if (data.type === 'complete') {
          setStatus('complete');
          eventSource.close();
        }
        if (data.type === 'error') {
          setError(data.message);
          setStatus('error');
          eventSource.close();
        }
      } catch (err) {
        // Log silently but don't break on ping messages
        console.debug('[SSE Parse Error]', err.message);
      }
    };

    eventSource.onerror = () => {
      setError('Connection lost or unauthorized.');
      setStatus('error');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [documentId]);

  return {
    sections, summary, docType, overallRisk,
    missingClauses, keyDates, keyAmounts,
    aiProvider, status, error,
  };
}