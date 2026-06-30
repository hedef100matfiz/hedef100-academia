import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, 
    onSnapshot, query, where, serverTimestamp, orderBy, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
export const storage = getStorage(app);

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
    // Şimdilik demo ve test amaçlı WHERE filtresini kaldırdık. 
    // Böylece öğrencinin attığı istek herhangi bir öğretmenin paneline anında düşecek.
    const q = query(
        collection(db, "coachingRequests"), 
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

// ================= 4. AŞAMA 3 (GERÇEK VERİ HAVUZU) FONKSİYONLARI =================

// --- 4.1 Yoklama (Attendance) ---
export async function saveAttendance(date, classId, teacherId, absentStudents) {
    try {
        await addDoc(collection(db, "attendance"), {
            date, classId, teacherId, absentStudents,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Yoklama kaydedilemedi:", error);
        return false;
    }
}

// --- 4.2 Ödev & Görev Merkezi (Assignments) ---
export async function addAssignment(data) {
    try {
        await addDoc(collection(db, "assignments"), {
            ...data, createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Ödev eklenemedi:", error);
        return false;
    }
}

export function listenAssignments(targetClass, callback) {
    const q = query(
        collection(db, "assignments"),
        where("targetClass", "in", [targetClass, "all"]),
        orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snapshot) => {
        const assignments = [];
        snapshot.forEach((doc) => assignments.push({ id: doc.id, ...doc.data() }));
        callback(assignments);
    });
}

// --- 4.3 Dijital Hata Kutusu (Error Box & Storage) ---
export async function uploadErrorBoxImage(file, studentId) {
    try {
        const fileRef = ref(storage, `errorBox/${studentId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (error) {
        console.error("Resim yüklenemedi:", error);
        return null;
    }
}

export async function askQuestion(data) {
    try {
        await addDoc(collection(db, "errorBox"), {
            ...data, status: 'pending', createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Soru gönderilemedi:", error);
        return false;
    }
}

export function listenErrorBox(callback) {
    const q = query(collection(db, "errorBox"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const questions = [];
        snapshot.forEach((doc) => questions.push({ id: doc.id, ...doc.data() }));
        callback(questions);
    });
}

// --- 4.4 Öğrenci Haftalık Görevleri (Student Tasks) ---
export async function addStudentTask(studentId, taskData) {
    try {
        await addDoc(collection(db, "studentTasks"), {
            studentId, ...taskData, createdAt: serverTimestamp()
        });
        return true;
    } catch (e) { return false; }
}

export function listenStudentTasks(studentId, callback) {
    const q = query(collection(db, "studentTasks"), where("studentId", "==", studentId));
    return onSnapshot(q, (snapshot) => {
        const tasks = [];
        snapshot.forEach((doc) => tasks.push({ id: doc.id, ...doc.data() }));
        callback(tasks);
    });
}

export async function toggleStudentTask(taskId, isDone) {
    await setDoc(doc(db, "studentTasks", taskId), { done: isDone }, { merge: true });
}

export async function clearStudentTasks(studentId) {
    // Normalde backend'den batch delete yapılır, demo amaçlı basit yapıyoruz.
    // Çoklu silme işlemi için ayrı bir logic gerekir, frontend'den tek tek silinebilir.
}

// --- 4.5 Deneme ve Risk Radarı (Exam Results) ---
export async function saveExamResult(data) {
    try {
        await addDoc(collection(db, "examResults"), {
            ...data, createdAt: serverTimestamp()
        });
        return true;
    } catch (e) { return false; }
}

// Eğitmenin sınıfındaki öğrencileri çekmesi
export async function getStudentsByClass(classId) {
    try {
        const q = query(collection(db, "users"), where("role", "==", "student"), where("classId", "==", classId));
        const snapshot = await getDocs(q);
        const students = [];
        snapshot.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
        return students;
    } catch (e) {
        console.error("Öğrenciler çekilemedi:", e);
        return [];
    }
}
