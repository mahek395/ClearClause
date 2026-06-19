// src/hooks/useAnalysisStream.js
import { useState, useEffect, useRef } from 'react';
import { tokenStore } from '../utils/tokenStore';
import api from '../utils/axiosInstance';

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

  // Tracks whether we've already attempted a refresh-and-reconnect
  // for THIS documentId, to avoid infinite reconnect loops.
  const hasRetriedRef = useRef(false);

  useEffect(() => {
    if (!documentId) return;

    hasRetriedRef.current = false;
    let eventSource = null;
    let cancelled = false;

    setStatus('connecting');
    setSections([]);
    setSummary('');
    setDocType('');
    setMissingClauses([]);
    setOverallRisk('');
    setKeyDates([]);
    setKeyAmounts([]);
    setError(null);

    function connect(token) {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const eventSource = new EventSource(
        `${BASE_URL}/analyze/stream/${documentId}?token=${token}`
      );

      eventSource.onopen = () => setStatus('streaming');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'doc_type') setDocType(data.value);
          if (data.type === 'overall_risk') setOverallRisk(data.value);

          if (data.type === 'summary') {
            setSummary(data.chunk || '');
          }

          if (data.type === 'section') {
            const section = data.data || {};

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
          console.debug('[SSE Parse Error]', err.message);
        }
      };

      eventSource.onerror = async () => {
        eventSource.close();

        if (cancelled) return;

        // ── If we haven't tried refreshing yet, attempt silent refresh + reconnect ──
        const currentToken = tokenStore.get();
        if (!hasRetriedRef.current && currentToken) {
          hasRetriedRef.current = true;

          try {
            const { data } = await api.post('/auth/refresh');
            const newToken = data.accessToken;
            tokenStore.set(newToken);

            if (!cancelled) {
              setStatus('connecting');
              connect(newToken);
            }
            return;
          } catch (refreshErr) {
            // Refresh failed too — fall through to error state.
            // (axiosInstance's own interceptor will also redirect to /login
            //  if this refresh fails, since /auth/refresh itself 401s.)
          }
        }

        if (!cancelled) {
          setError('Connection lost or unauthorized.');
          setStatus('error');
        }
      };
    }

    const token = tokenStore.get() || '';
    connect(token);

    return () => {
      cancelled = true;
      if (eventSource) eventSource.close();
    };
  }, [documentId]);

  return {
    sections, summary, docType, overallRisk,
    missingClauses, keyDates, keyAmounts,
    aiProvider, status, error,
  };
}