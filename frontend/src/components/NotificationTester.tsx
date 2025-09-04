import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Plus, Loader2 } from 'lucide-react';
import './NotificationTester.css';

export const NotificationTester: React.FC = () => {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState('');

  const createTestNotification = async () => {
    if (!user?.uid) return;

    setIsCreating(true);
    try {
      // Erstelle eine Test-Benachrichtigung über die Firebase Functions
      const testData = {
        userId: user.uid,
        tenantId: 'test-tenant',
        title: 'Test-Benachrichtigung',
        message: 'Dies ist eine Test-Benachrichtigung für das P3-Priority Real-Time Notifications System.',
        type: 'info',
        documentId: 'test-doc-123',
        data: {
          oldStatus: 'uploaded',
          newStatus: 'processing',
          testMode: true
        }
      };

      // Simuliere das Backend-System durch direktes Erstellen in Firestore
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      await addDoc(collection(db, 'notifications'), {
        ...testData,
        isRead: false,
        createdAt: serverTimestamp()
      });

      setMessage('✅ Test-Benachrichtigung erfolgreich erstellt!');
      
      console.log('🧪 Test notification created:', testData);
    } catch (error) {
      console.error('❌ Error creating test notification:', error);
      setMessage('❌ Fehler beim Erstellen der Test-Benachrichtigung');
    } finally {
      setIsCreating(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (!user) return null;

  return (
    <div className="notification-tester">
      <button 
        onClick={createTestNotification}
        disabled={isCreating}
        className="test-button"
        title="Test-Benachrichtigung erstellen"
      >
        {isCreating ? (
          <Loader2 size={16} className="spinning" />
        ) : (
          <Plus size={16} />
        )}
        Test-Benachrichtigung
      </button>
      
      {message && (
        <div className={`test-message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
};
