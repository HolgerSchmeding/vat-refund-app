import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot,
  getDocs
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
      console.log('🔍 useDocuments: No user, clearing documents');
      setDocuments([]);
      setLoading(false);
      return;
    }

    console.log('🔍 useDocuments: Setting up query for user:', user.uid);

    // Temporary: Always disable WHERE queries to avoid timestamp comparison issues
    const baseCollection = collection(db, 'documents');
    const q = query(baseCollection);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('🔍 useDocuments: Snapshot received, docs count:', snapshot.docs.length);
        let docs = snapshot.docs.map(doc => {
          const raw = doc.data();
          // Defensive Normalisierung: leere Objekte {} und ungültige Timestamps bei createdAt/updatedAt ersetzen
          const isValidTimestamp = (ts: any) => ts && typeof ts.toDate === 'function';
          const isEmptyObject = (ts: any) => ts && typeof ts === 'object' && Object.keys(ts).length === 0;
          
          // Debug: Log raw timestamp values to understand the issue
          console.log('🐛 Debug raw timestamps for doc', doc.id, {
            createdAt: (raw as any).createdAt,
            createdAtType: typeof (raw as any).createdAt,
            createdAtKeys: (raw as any).createdAt ? Object.keys((raw as any).createdAt) : 'null',
            updatedAt: (raw as any).updatedAt,
            updatedAtType: typeof (raw as any).updatedAt,
            updatedAtKeys: (raw as any).updatedAt ? Object.keys((raw as any).updatedAt) : 'null'
          });
          
          let createdAt = null;
          let updatedAt = null;
          
          if (isValidTimestamp((raw as any).createdAt)) {
            createdAt = (raw as any).createdAt;
            console.log('✅ Valid createdAt timestamp for doc:', doc.id);
          } else if (isEmptyObject((raw as any).createdAt)) {
            console.warn('🔧 Found empty object {} in createdAt, replacing with fallback timestamp for doc:', doc.id);
            createdAt = { toDate: () => new Date() } as any;
          } else {
            console.warn('❌ Invalid createdAt timestamp for doc:', doc.id, (raw as any).createdAt);
          }
          
          if (isValidTimestamp((raw as any).updatedAt)) {
            updatedAt = (raw as any).updatedAt;
            console.log('✅ Valid updatedAt timestamp for doc:', doc.id);
          } else if (isEmptyObject((raw as any).updatedAt)) {
            console.warn('🔧 Found empty object {} in updatedAt, replacing with fallback timestamp for doc:', doc.id);
            updatedAt = createdAt || { toDate: () => new Date() } as any;
          } else {
            console.warn('❌ Invalid updatedAt timestamp for doc:', doc.id, (raw as any).updatedAt);
          }
          
          if (!createdAt) {
            // Fallback: künstlichen Timestamp erzeugen (epoch + incremental index) um Sortierfehler zu vermeiden
            createdAt = { toDate: () => new Date(0) } as any;
          }
          if (!updatedAt) {
            updatedAt = createdAt;
          }
          
          // Korrigierte Timestamps zuweisen
          (raw as any).createdAt = createdAt;
          (raw as any).updatedAt = updatedAt;
          
          const data = { ...raw } as any;
          console.log('📄 Document (normalized):', doc.id, { createdAt: data.createdAt, updatedAt: data.updatedAt, status: data.status, uploadedBy: data.uploadedBy });
          return {
            id: doc.id,
            ...data
          } as Document;
        });

        console.log('🔍 useDocuments: Before filter - docs count:', docs.length);
        console.log('🔍 useDocuments: Current user.uid:', user.uid);
        
        // Debug: Log all document userIds to see what we have
        docs.forEach((doc, index) => {
          console.log(`🔍 Doc ${index}:`, {
            id: (doc as any).id,
            userId: (doc as any).userId,
            uploadedBy: (doc as any).uploadedBy,
            originalFileName: (doc as any).originalFileName
          });
        });

        // Always filter client-side to avoid Firestore query issues
        // Fixed: Filter by userId (not uploadedBy)
        docs = docs.filter(d => (d as any).userId === user.uid);
        
        console.log('🔍 useDocuments: After filter - docs count:', docs.length);
        
        // Sort manually by createdAt to avoid Firestore ordering issues
        docs.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setDocuments(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('❌ Error fetching documents:', err);
        // Fallback: Einmaliger Einzellese-Versuch (getDocs) ohne Listener, um Datentyp-Probleme einzugrenzen
        (async () => {
          try {
            const snap = await getDocs(collection(db, 'documents'));
            console.log('🧪 Fallback getDocs count:', snap.docs.length);
          } catch (e) {
            console.error('🧪 Fallback getDocs failed:', e);
          }
        })();
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

    console.log('🔍 useSubmissions: Setting up query for user:', user.uid);
    // Temporary: Always disable WHERE queries to avoid timestamp comparison issues
    const baseCollection = collection(db, 'submissions');
    const q = query(baseCollection);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('🔍 useSubmissions: Snapshot received, submissions count:', snapshot.docs.length);
        let subs = snapshot.docs.map(doc => {
          const raw = doc.data();
          // Defensive Normalisierung: leere Objekte {} und ungültige Timestamps behandeln
          const isValidTimestamp = (ts: any) => ts && typeof ts.toDate === 'function';
          const isEmptyObject = (ts: any) => ts && typeof ts === 'object' && Object.keys(ts).length === 0;
          
          let createdAt = null;
          
          if (isValidTimestamp((raw as any).createdAt)) {
            createdAt = (raw as any).createdAt;
          } else if (isEmptyObject((raw as any).createdAt)) {
            console.warn('🔧 Found empty object {} in submission createdAt, replacing with fallback timestamp for doc:', doc.id);
            createdAt = { toDate: () => new Date() } as any;
          }
          
          if (!createdAt) {
            createdAt = { toDate: () => new Date(0) } as any;
          }
          
          (raw as any).createdAt = createdAt;
          const data = { ...raw } as any;
            console.log('📄 Submission (normalized):', doc.id, { createdAt: data.createdAt, status: data.status });
            return { id: doc.id, ...data } as Submission;
        });

        // Always filter client-side to avoid Firestore query issues
        subs = subs.filter(s => (s as any).uploadedBy === user.uid);
        
        // Sort manually by createdAt to avoid Firestore ordering issues
        subs.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setSubmissions(subs);
        setLoading(false);
        setError(null);
      },
      (err) => {
  console.error('❌ Error fetching submissions:', err);
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
