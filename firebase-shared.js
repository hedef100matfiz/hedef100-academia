import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, 
    onSnapshot, query, where, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. Firebase Yapılandırması
const firebaseConfig = {
    apiKey: "AIzaSyDvO9NCk8PbDmFxYjVl7HAE8PkjpwCJLaI",
    authDomain: "hedef100-academia.firebaseapp.com",
    projectId: "hedef100-academia",
    storageBucket: "hedef100-academia.firebasestorage.app",
    messagingSenderId: "886084339971",
    appId: "1:886084339971:web:ca31ab9d1575344d234136"
};

// Uygulamayı ve servisleri başlat
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 2. Temel Kullanıcı Fonksiyonları
export function listenAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return null;
}

export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Çıkış yapılırken hata oluştu:", error);
    }
}

// 3. Koçluk Talebi Fonksiyonları (Aşama 2 İçin)
export async function sendCoachingRequest(data) {
    try {
        const docRef = await addDoc(collection(db, "coachingRequests"), {
            ...data,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Talep gönderilemedi:", error);
        return { success: false, error };
    }
}

export function listenCoachingRequests(teacherId, callback) {
    const q = query(
        collection(db, "coachingRequests"), 
        where("teacherId", "==", teacherId),
        orderBy("createdAt", "desc")
    );
    
    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => {
            requests.push({ id: doc.id, ...doc.data() });
        });
        callback(requests);
    });
}

export async function updateCoachingRequest(id, status) {
    try {
        const docRef = doc(db, "coachingRequests", id);
        await setDoc(docRef, { status: status, updatedAt: serverTimestamp() }, { merge: true });
        return true;
    } catch (error) {
        console.error("Durum güncellenemedi:", error);
        return false;
    }
}
