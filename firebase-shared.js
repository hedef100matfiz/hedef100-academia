import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, 
    onSnapshot, query, where, serverTimestamp, orderBy, getDocs, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDvO9NCk8PbDmFxYjVl7HAE8PkjpwCJLaI",
    authDomain: "hedef100-academia.firebaseapp.com",
    projectId: "hedef100-academia",
    storageBucket: "hedef100-academia.firebasestorage.app",
    messagingSenderId: "886084339971",
    appId: "1:886084339971:web:ca31ab9d1575344d234136"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// === TEMEL KULLANICI ===
export function listenAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
    const docSnap = await getDoc(doc(db, "users", uid));
    return docSnap.exists() ? docSnap.data() : null;
}

export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Çıkış hatası:", error);
        window.location.href = 'login.html';
    }
}

// === KOÇLUK TALEPLERİ ===
export async function sendCoachingRequest(data) {
    try {
        const docRef = await addDoc(collection(db, "coachingRequests"), {
            ...data, status: 'pending', createdAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) { return { success: false, error }; }
}

export function listenCoachingRequests(teacherId, callback) {
    const q = query(collection(db, "coachingRequests"));
    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((d) => requests.push({ id: d.id, ...d.data() }));
        requests.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const tB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return tB - tA;
        });
        callback(requests);
    });
}

export async function updateCoachingRequest(id, status) {
    try {
        await setDoc(doc(db, "coachingRequests", id), { status: status, updatedAt: serverTimestamp() }, { merge: true });
        return true;
    } catch (error) { return false; }
}

// Öğrencinin kendi koçluk taleplerini dinlemesi
export function listenMyCoachingRequests(studentId, callback) {
    const q = query(collection(db, "coachingRequests"), where("studentId", "==", studentId));
    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((d) => requests.push({ id: d.id, ...d.data() }));
        requests.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const tB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return tB - tA;
        });
        callback(requests);
    });
}

// === MESAJLAŞMA (Koçluk Kabul Sonrası) ===
export async function sendMessage(requestId, data) {
    try {
        await addDoc(collection(db, "coachingRequests", requestId, "messages"), {
            ...data, createdAt: serverTimestamp()
        });
        return true;
    } catch (error) { return false; }
}

export function listenMessages(requestId, callback) {
    const q = query(collection(db, "coachingRequests", requestId, "messages"));
    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((d) => messages.push({ id: d.id, ...d.data() }));
        messages.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt ? b.createdAt.toMillis() : 0;
            return tA - tB;
        });
        callback(messages);
    });
}

// === TÜM ÖĞRETMENLERİ ÇEKME ===
export async function getAllTeachers() {
    try {
        const q = query(collection(db, "users"), where("role", "==", "teacher"));
        const snap = await getDocs(q);
        const teachers = [];
        snap.forEach(d => teachers.push({ id: d.id, ...d.data() }));
        return teachers;
    } catch (e) { return []; }
}

// === YOKLAMA ===
export async function saveAttendance(date, classId, teacherId, absentStudents) {
    try {
        await addDoc(collection(db, "attendance"), { date, classId, teacherId, absentStudents, createdAt: serverTimestamp() });
        return true;
    } catch (error) { return false; }
}

// === ÖDEV ===
export async function addAssignment(data) {
    try {
        await addDoc(collection(db, "assignments"), { ...data, createdAt: serverTimestamp() });
        return true;
    } catch (error) { return false; }
}

export function listenAssignments(targetClass, callback) {
    const q = query(collection(db, "assignments"));
    return onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach((d) => {
            const data = d.data();
            if (data.targetClass === targetClass || data.targetClass === "all" || targetClass === "all") {
                items.push({ id: d.id, ...data });
            }
        });
        items.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const tB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return tB - tA;
        });
        callback(items);
    });
}

// === HATA KUTUSU ===
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
        snapshot.forEach((d) => questions.push({ id: d.id, ...d.data() }));
        questions.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const tB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return tB - tA;
        });
        callback(questions);
    });
}

// === ÖĞRENCİ GÖREVLERİ ===
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
        snapshot.forEach((d) => tasks.push({ id: d.id, ...d.data() }));
        callback(tasks);
    });
}

export async function toggleStudentTask(taskId, isDone) {
    await setDoc(doc(db, "studentTasks", taskId), { done: isDone }, { merge: true });
}

export async function deleteStudentTask(taskId) {
    try {
        await deleteDoc(doc(db, "studentTasks", taskId));
        return true;
    } catch (error) { return false; }
}

// === DENEME SONUÇLARI ===
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
        snapshot.forEach(d => students.push({ id: d.id, ...d.data() }));
        return students;
    } catch (e) { return []; }
}

// === SINIF VE DAVET KODU ===
export async function createClass(teacherId, className) {
    try {
        const docRef = await addDoc(collection(db, "classes"), { name: className, teacherId: teacherId, createdAt: serverTimestamp() });
        return { success: true, id: docRef.id };
    } catch (error) { return { success: false, error }; }
}

export function listenClasses(teacherId, callback) {
    const q = query(collection(db, "classes"), where("teacherId", "==", teacherId));
    return onSnapshot(q, (snapshot) => {
        const classes = [];
        snapshot.forEach((d) => classes.push({ id: d.id, ...d.data() }));
        classes.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const tB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return tA - tB;
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
        await addDoc(collection(db, "inviteCodes"), { code, role: "student", classId, className, createdBy: teacherId, createdAt: serverTimestamp() });
        return { success: true, code };
    } catch (error) { return { success: false, error }; }
}

export async function joinClassWithCode(studentId, code) {
    try {
        const codeUpper = code.toUpperCase();
        const q = query(collection(db, "inviteCodes"), where("code", "==", codeUpper));
        const snap = await getDocs(q);
        if (snap.empty) return { success: false, error: "Geçersiz veya süresi dolmuş davet kodu." };
        const codeData = snap.docs[0].data();
        await setDoc(doc(db, "users", studentId), { classId: codeData.classId, className: codeData.className, teacherId: codeData.createdBy }, { merge: true });
        return { success: true, className: codeData.className };
    } catch (error) { return { success: false, error: "Bir hata oluştu." }; }
}

// === PROFİL ===
export async function uploadProfilePhoto(file, userId) {
    try {
        const fileRef = ref(storage, `profilePhotos/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (error) { return null; }
}

export async function updateUserProfile(uid, data) {
    try {
        await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
        return true;
    } catch (error) { return false; }
}
