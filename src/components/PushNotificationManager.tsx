import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { requestForToken, onMessageListener } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const PushNotificationManager = () => {
  const [hasPermission, setHasPermission] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setIsSupported(false);
      return;
    }
    
    if (Notification.permission === 'granted') {
      getToken();
    }
    
    // Listen for foreground messages
    const listen = async () => {
      try {
        const payload: any = await onMessageListener();
        console.log('Foreground Push Notification received: ', payload);
        // We could show a toast here if we had one
        if (payload?.notification) {
          // Native browser notification for foreground
          new Notification(payload.notification.title || '알림', {
            body: payload.notification.body,
            icon: '/icon.png'
          });
        }
      } catch (err) {
        console.log('failed: ', err);
      }
    };
    
    listen();
  }, []);

  const getToken = async () => {
    try {
      const t = await requestForToken();
      if (t) {
        setToken(t);
        // In a real app, send this token to Firestore under the user's document
        console.log("FCM Token: ", t);
        const { user, role } = useAuthStore.getState();
        if (user && user.uid) {
          try {
             let col = role === 'counselor' ? 'counselors' : (role === 'worker' ? 'workers' : 'admins');
             // Attempt to update the user doc with the fcm_token
             await updateDoc(doc(db, col, user.uid), { fcm_token: t });
          } catch(e) { console.error('Failed to save FCM token to user doc', e); }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setHasPermission(true);
        await getToken();
      }
    } catch (e) {
      console.error("Error requesting permission", e);
    }
  };

  if (!isSupported) return null;

  return (
    <button 
      onClick={hasPermission ? undefined : handleRequestPermission}
      className={`p-2 rounded-xl transition-colors border ${hasPermission ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-default' : 'hover:bg-white/10 text-gray-400 hover:text-white border-transparent'}`}
      title={hasPermission ? '푸시 알림 활성화됨' : '푸시 알림 켜기'}
    >
      {hasPermission ? <BellRing className="w-4 h-4 md:w-5 md:h-5" /> : <BellOff className="w-4 h-4 md:w-5 md:h-5" />}
    </button>
  );
};
