importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "enhanced-tokenizer-wd2jw",
  appId: "1:482301380709:web:af5f8cad74ff0873471e8c",
  apiKey: "AIzaSyC_fQq_qdlXbJ8BwBY1Zqq4Ljq2r_eJZmQ",
  authDomain: "enhanced-tokenizer-wd2jw.firebaseapp.com",
  storageBucket: "enhanced-tokenizer-wd2jw.firebasestorage.app",
  messagingSenderId: "482301380709"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || '알림';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
