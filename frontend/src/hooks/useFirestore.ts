import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { Document, Submission, DashboardMetrics } from '../types';
import { DocumentStatus } from '../types/DocumentStatus';
import { useAuth } from './useAuth';

/**
 * Hook to fetch documents for the current user
 */
export function useDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'documents'),
      where('uploadedBy', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Document[];
        
        setDocuments(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching documents:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { documents, loading, error };
}

/**
 * Hook to fetch submissions for the current user
 */
export function useSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    // For now, we'll use a simple query. In production, you might want to
    // filter by tenantId instead of uploadedBy
    const q = query(
      collection(db, 'submissions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Submission[];
        
        setSubmissions(subs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching submissions:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { submissions, loading, error };
}

/**
 * Hook to calculate dashboard metrics
 */
export function useDashboardMetrics() {
  const { documents } = useDocuments();
  const { submissions } = useSubmissions();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalDocuments: 0,
    documentsAwaitingValidation: 0,
    documentsReadyForSubmission: 0,
    totalExpectedRefund: 0,
    totalSubmissions: 0
  });

  useEffect(() => {
    const newMetrics: DashboardMetrics = {
      totalDocuments: documents.length,
      documentsAwaitingValidation: documents.filter(d => 
        d.status === DocumentStatus.AWAITING_VALIDATION || d.status === DocumentStatus.UPLOADING
      ).length,
      documentsReadyForSubmission: documents.filter(d => 
        d.status === DocumentStatus.READY_FOR_SUBMISSION
      ).length,
      totalExpectedRefund: documents.reduce((sum, doc) => 
        sum + (doc.totalRefundableVatAmount || 0), 0
      ),
      totalSubmissions: submissions.length
    };

    setMetrics(newMetrics);
  }, [documents, submissions]);

  return metrics;
}
