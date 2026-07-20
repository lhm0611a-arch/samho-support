import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  projectId: "enhanced-tokenizer-wd2jw",
  appId: "1:482301380709:web:af5f8cad74ff0873471e8c",
  apiKey: "AIzaSyC_fQq_qdlXbJ8BwBY1Zqq4Ljq2r_eJZmQ",
  authDomain: "enhanced-tokenizer-wd2jw.firebaseapp.com",
  storageBucket: "enhanced-tokenizer-wd2jw.firebasestorage.app",
  messagingSenderId: "482301380709"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, 'ai-studio-masterspecai-e22969bb-3c6a-42e5-a094-d4bb0566063a');


export let messaging: any = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.log('Firebase Messaging not supported in this environment');
}

export const requestForToken = async () => {
  try {
    if (!messaging) return null;
    const currentToken = await getToken(messaging, { 
      vapidKey: 'BF1iB4Q96Fj_1-Nq-Wb47M3i-vO1O0X3sR-DqJzN99Fz3O_r5D8w3_83X34XG4FqJ3H4-4D4qM4W3wX3Gz4' // We will use a dummy or skip if not provided
    });
    if (currentToken) {
      console.log('current token for client: ', currentToken);
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
