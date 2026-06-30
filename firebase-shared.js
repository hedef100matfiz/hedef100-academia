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

// 3. Koçluk Talebi Fonksiyonları
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
    const q = query(collection(db, "coachingRequests"));
    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => requests.push({ id: doc.id, ...doc.data() }));
        requests.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
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

// Tüm öğretmenleri çekme (Koçluk paneli için)
export async function getAllTeachers() {
    try {
        const q = query(collection(db, "users"), where("role", "==", "teacher"));
        const snap = await getDocs(q);
        const teachers = [];
        snap.forEach(doc => teachers.push({ id: doc.id, ...doc.data() }));
        return teachers;
    } catch (e) {
        console.error("Öğretmenler çekilemedi:", e);
        return [];
    }
}

// ================= 4. AŞAMA 3 FONKSİYONLARI =================

export async function saveAttendance(date, classId, teacherId, absentStudents) {
    try {
        await addDoc(collection(db, "attendance"), {
            date, classId, teacherId, absentStudents,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) { return false; }
}

export async function addAssignment(data) {
    try {
        await addDoc(collection(db, "assignments"), { ...data, createdAt: serverTimestamp() });
        return true;
    } catch (error) { return false; }
}

export function listenAssignments(targetClass, callback) {
    const q = query(collection(db, "assignments"));
    return onSnapshot(q, (snapshot) => {
        const assignments = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.targetClass === targetClass || data.targetClass === "all" || targetClass === "all") {
                assignments.push({ id: doc.id, ...data });
            }
        });
        assignments.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });
        callback(assignments);
    });
}

export async function uploadErrorBoxImage(file, studentId) {
    try {
        const fileRef = ref(storage, `errorBox/${studentId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (error) { return null; }
}

export async function askQuestion(data) {
    try {
        await addDoc(collection(db, "errorBox"), { ...data, status: 'pending', createdAt: serverTimestamp() });
        return true;
    } catch (error) { return false; }
}

export function listenErrorBox(callback) {
    const q = query(collection(db, "errorBox"));
    return onSnapshot(q, (snapshot) => {
        const questions = [];
        snapshot.forEach((doc) => questions.push({ id: doc.id, ...doc.data() }));
        questions.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });
        callback(questions);
    });
}

export async function addStudentTask(studentId, taskData) {
    try {
        await addDoc(collection(db, "studentTasks"), { studentId, ...taskData, createdAt: serverTimestamp() });
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

export async function deleteStudentTask(taskId) {
    try {
        const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await deleteDoc(doc(db, "studentTasks", taskId));
        return true;
    } catch (error) { return false; }
}

export async function saveExamResult(data) {
    try {
        await addDoc(collection(db, "examResults"), { ...data, createdAt: serverTimestamp() });
        return true;
    } catch (e) { return false; }
}

export async function getStudentsByClass(classId) {
    try {
        const q = query(collection(db, "users"), where("role", "==", "student"), where("classId", "==", classId));
        const snapshot = await getDocs(q);
        const students = [];
        snapshot.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
        return students;
    } catch (e) { return []; }
}

// ================= 5. SINIF VE DAVET KODU YÖNETİMİ =================

export async function createClass(teacherId, className) {
    try {
        const docRef = await addDoc(collection(db, "classes"), {
            name: className, teacherId: teacherId, createdAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) { return { success: false, error }; }
}

export function listenClasses(teacherId, callback) {
    const q = query(collection(db, "classes"), where("teacherId", "==", teacherId));
    return onSnapshot(q, (snapshot) => {
        const classes = [];
        snapshot.forEach((doc) => classes.push({ id: doc.id, ...doc.data() }));
        classes.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeA - timeB; 
        });
        callback(classes);
    });
}

export async function createInviteCode(teacherId, classId, className, customCode) {
    try {
        const code = customCode ? customCode.toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
        const checkQ = query(collection(db, "inviteCodes"), where("code", "==", code));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) return { success: false, error: "Bu kod zaten kullanımda." };

        await addDoc(collection(db, "inviteCodes"), {
            code: code, role: "student", classId: classId, className: className,
            createdBy: teacherId, createdAt: serverTimestamp()
        });
        return { success: true, code: code };
    } catch (error) { return { success: false, error }; }
}

// Davet koduyla sınıfa katılma (Öğrenci)
export async function joinClassWithCode(studentId, code) {
    try {
        const codeUpper = code.toUpperCase();
        const q = query(collection(db, "inviteCodes"), where("code", "==", codeUpper));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            return { success: false, error: "Geçersiz veya süresi dolmuş davet kodu." };
        }

        const codeData = snap.docs[0].data();
        
        const userRef = doc(db, "users", studentId);
        await setDoc(userRef, {
            classId: codeData.classId,
            className: codeData.className,
            teacherId: codeData.createdBy
        }, { merge: true });

        return { success: true, className: codeData.className };
    } catch (error) {
        console.error("Sınıfa katılım hatası:", error);
        return { success: false, error: "Bir hata oluştu." };
    }
}

// ================= 6. PROFİL GÜNCELLEME VE FOTOĞRAF =================

export async function uploadProfilePhoto(file, userId) {
    try {
        const fileRef = ref(storage, `profilePhotos/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (error) { return null; }
}

export async function updateUserProfile(uid, data) {
    try {
        const docRef = doc(db, "users", uid);
        await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        return true;
    } catch (error) { return false; }
}
