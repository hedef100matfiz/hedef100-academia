import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, 
    onSnapshot, query, where, serverTimestamp, orderBy, getDocs,
    deleteDoc, updateDoc, arrayUnion
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
    // Tüm koçluk taleplerini çekip istemci tarafında tarihe göre sıralıyoruz (Firebase Index hatasını önlemek için)
    const q = query(collection(db, "coachingRequests"));
    
    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => {
            requests.push({ id: doc.id, ...doc.data() });
        });
        
        // Frontend Sıralama (En yeniden eskiye)
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
export function listenStudentCoachingRequests(studentId, callback) {
    const q = query(collection(db, "coachingRequests"), where("studentId", "==", studentId));
    return onSnapshot(q, (snapshot) => {
        const requests = [];
        snapshot.forEach((doc) => {
            requests.push({ id: doc.id, ...doc.data() });
        });
        requests.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });
        callback(requests);
    });
}
export async function addCoachingMessage(requestId, messageObj) {
    try {
        const docRef = doc(db, "coachingRequests", requestId);
        await updateDoc(docRef, {
            messages: arrayUnion({ ...messageObj, timestamp: Date.now() })
        });
        return true;
    } catch (error) {
        console.error("Mesaj gönderilemedi:", error);
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
    // Firebase Composite Index hatasını önlemek için filtreleme ve sıralamayı frontend'de yapıyoruz
    const q = query(collection(db, "assignments"));
    
    return onSnapshot(q, (snapshot) => {
        const assignments = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Sadece ilgili sınıfın veya tüm sınıfların ödevlerini al
            if (data.targetClass === targetClass || data.targetClass === "all" || targetClass === "all") {
                assignments.push({ id: doc.id, ...data });
            }
        });
        
        // Frontend Sıralama
        assignments.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });
        
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
    // Index hatasını engellemek için orderBy kaldırıldı, frontend'de sıralanıyor
    const q = query(collection(db, "errorBox"));
    return onSnapshot(q, (snapshot) => {
        const questions = [];
        snapshot.forEach((doc) => questions.push({ id: doc.id, ...doc.data() }));
        
        // Frontend Sıralama
        questions.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });
        
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
export async function deleteStudentTask(taskId) {
    try {
        await deleteDoc(doc(db, "studentTasks", taskId));
        return true;
    } catch (error) {
        console.error("Görev silinemedi:", error);
        return false;
    }
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
// ================= 5. SINIF VE DAVET KODU YÖNETİMİ =================
// Öğrencinin Kod ile Sınıfa Katılması
export async function joinClassWithCode(studentId, code) {
    try {
        const q = query(collection(db, "inviteCodes"), where("code", "==", code.toUpperCase().trim()));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return { success: false, error: "Geçersiz davet kodu! Lütfen eğitmeninizden doğru kodu isteyin." };
        }
        
        let inviteData = null;
        snapshot.forEach(doc => inviteData = doc.data());
        
        // Öğrencinin classId bilgisini güncelle
        const docRef = doc(db, "users", studentId);
        await setDoc(docRef, {
            classId: inviteData.classId,
            className: inviteData.className,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        return { success: true, className: inviteData.className };
    } catch (error) {
        console.error("Sınıfa katılamadı:", error);
        return { success: false, error: "Sunucu bağlantı hatası." };
    }
}
// Yeni Sınıf Oluştur
export async function createClass(teacherId, className) {
    try {
        const docRef = await addDoc(collection(db, "classes"), {
            name: className,
            teacherId: teacherId,
            createdAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Sınıf oluşturulamadı:", error);
        return { success: false, error };
    }
}
// Eğitmenin kendi oluşturduğu sınıfları dinlemesi
export function listenClasses(teacherId, callback) {
    const q = query(collection(db, "classes"), where("teacherId", "==", teacherId));
    return onSnapshot(q, (snapshot) => {
        const classes = [];
        snapshot.forEach((doc) => classes.push({ id: doc.id, ...doc.data() }));
        
        // Frontend Sıralama
        classes.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeA - timeB; // Eskiden yeniye (ilk açılan sınıf üstte)
        });
        
        callback(classes);
    });
}
// Davet Kodu Üret (Bir sınıfa ait)
export async function createInviteCode(teacherId, classId, className, customCode) {
    try {
        // İsteğe bağlı özel kod girilmişse onu kullan, yoksa rastgele üret
        const code = customCode ? customCode.toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Kodun daha önce alınıp alınmadığını kontrol et (Basit güvenlik)
        const checkQ = query(collection(db, "inviteCodes"), where("code", "==", code));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) {
            return { success: false, error: "Bu kod zaten kullanımda, lütfen başka bir tane deneyin." };
        }
        await addDoc(collection(db, "inviteCodes"), {
            code: code,
            role: "student", // Bu kod sadece öğrencileri hedefliyor
            classId: classId,
            className: className,
            createdBy: teacherId,
            createdAt: serverTimestamp()
        });
        return { success: true, code: code };
    } catch (error) {
        console.error("Davet kodu üretilemedi:", error);
        return { success: false, error };
    }
}
// ================= 6. PROFİL GÜNCELLEME VE FOTOĞRAF =================
export async function uploadProfilePhoto(file, userId) {
    try {
        const fileRef = ref(storage, `profilePhotos/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return await getDownloadURL(fileRef);
    } catch (error) {
        console.error("Profil fotoğrafı yüklenemedi:", error);
        return null;
    }
}
export async function updateUserProfile(uid, data) {
    try {
        const docRef = doc(db, "users", uid);
        await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
        return true;
    } catch (error) {
        console.error("Profil güncellenemedi:", error);
        return false;
    }
}
// ================= 7. KURUM PANELİ YÖNETİM FONKSİYONLARI =================
// Hedef ID ile kullanıcıyı bul ve Kurum ağına ekle
export async function addMemberByHedefId(kurumId, hedefId) {
    try {
        const q = query(collection(db, "users"), where("hedefId", "==", hedefId.toUpperCase().trim()));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return { success: false, error: "Bu Hedef ID'ye ait kullanıcı bulunamadı." };
        }
        
        let targetUser = null;
        snapshot.forEach(doc => { targetUser = { id: doc.id, ...doc.data() }; });
        
        if(targetUser.kurumId === kurumId) {
            return { success: false, error: "Bu kullanıcı zaten ağınızda." };
        }
        // Kullanıcıya kurumId ekle
        await setDoc(doc(db, "users", targetUser.id), {
            kurumId: kurumId,
            kurumJoinedAt: serverTimestamp()
        }, { merge: true });
        
        return { success: true, user: targetUser };
    } catch (error) {
        console.error("Üye eklenemedi:", error);
        return { success: false, error: "Bağlantı hatası." };
    }
}
// Kuruma ait üyeleri dinle (role: 'teacher' veya 'student')
export function listenKurumMembers(kurumId, role, callback) {
    const q = query(collection(db, "users"), where("kurumId", "==", kurumId), where("role", "==", role));
    return onSnapshot(q, (snapshot) => {
        const members = [];
        snapshot.forEach((doc) => members.push({ id: doc.id, ...doc.data() }));
        callback(members);
    });
}
// Kurum için yeni sınıf oluştur
export async function createKurumClass(kurumId, className, level) {
    try {
        const docRef = await addDoc(collection(db, "classes"), {
            name: className,
            level: level,
            kurumId: kurumId,
            assignedTeachers: [], // Kurum sonradan atayacak
            createdAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        return { success: false, error };
    }
}
export function listenKurumClasses(kurumId, callback) {
    const q = query(collection(db, "classes"), where("kurumId", "==", kurumId));
    return onSnapshot(q, (snapshot) => {
        const classes = [];
        snapshot.forEach((doc) => classes.push({ id: doc.id, ...doc.data() }));
        classes.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt ? b.createdAt.toMillis() : 0;
            return tB - tA;
        });
        callback(classes);
    });
}
export async function assignTeacherToClass(classId, teacherId, teacherName) {
    try {
        const docRef = doc(db, "classes", classId);
        // add to assignedTeachers array
        await updateDoc(docRef, {
            assignedTeachers: arrayUnion({ id: teacherId, name: teacherName })
        });
        
        // Eğitmenin profiline de eklenebilir veya eğitmen "classes" tablosunda assignedTeachers içinde kendi ID'si geçenleri dinleyebilir.
        return true;
    } catch (error) {
        return false;
    }
}
// Karne İşlemleri
export async function createReportCard(kurumId, studentId, studentName, title, dataObj) {
    try {
        await addDoc(collection(db, "reportCards"), {
            kurumId, studentId, studentName, title, ...dataObj,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        return false;
    }
}
export function listenReportCards(studentId, callback) {
    const q = query(collection(db, "reportCards"), where("studentId", "==", studentId));
    return onSnapshot(q, (snapshot) => {
        const cards = [];
        snapshot.forEach((doc) => cards.push({ id: doc.id, ...doc.data() }));
        callback(cards);
    });
}
// Toplu Mesaj (Duyuru) İşlemleri
export async function createAnnouncement(kurumId, targetRole, message) {
    try {
        await addDoc(collection(db, "announcements"), {
            kurumId: kurumId,
            targetRole: targetRole, // 'all', 'teacher', 'student'
            message: message,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        return false;
    }
}
export function listenAnnouncements(kurumId, role, callback) {
    const q = query(collection(db, "announcements"), where("kurumId", "==", kurumId));
    return onSnapshot(q, (snapshot) => {
        const msgs = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if(data.targetRole === 'all' || data.targetRole === role) {
                msgs.push({ id: doc.id, ...data });
            }
        });
        msgs.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt ? b.createdAt.toMillis() : 0;
            return tB - tA; // en yeni en üstte
        });
        callback(msgs);
    });
}
// ================= 8. VELİ PANELİ (PARENT DASHBOARD) FONKSİYONLARI =================
// Hedef ID kullanarak öğrenciyi velinin profiline bağla
export async function linkStudentToParent(parentUid, hedefId) {
    try {
        const cleanId = hedefId.toUpperCase().trim();
        const q = query(collection(db, "users"), where("hedefId", "==", cleanId), where("role", "==", "student"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return { success: false, error: "Bu Hedef ID'ye ait bir öğrenci bulunamadı." };
        }
        
        let studentData = null;
        snapshot.forEach(doc => { studentData = { id: doc.id, ...doc.data() }; });
        
        // Velinin profiline öğrenci ID'sini ekle
        const parentRef = doc(db, "users", parentUid);
        await updateDoc(parentRef, {
            linkedStudents: arrayUnion(studentData.id)
        });
        
        return { success: true, student: studentData };
    } catch (error) {
        console.error("Öğrenci eklenemedi:", error);
        return { success: false, error: "Sunucu hatası veya izin reddedildi." };
    }
}
// Veliye bağlı tüm öğrencileri anlık olarak dinle
export function listenParentStudents(parentUid, callback) {
    // 1. Önce velinin dokümanını dinle ki `linkedStudents` dizisi güncellendiğinde tetiklensin
    const parentRef = doc(db, "users", parentUid);
    
    return onSnapshot(parentRef, async (parentSnap) => {
        if (!parentSnap.exists()) return callback([]);
        
        const parentData = parentSnap.data();
        const linkedIds = parentData.linkedStudents || [];
        
        if (linkedIds.length === 0) {
            return callback([]);
        }
        
        // 2. Bağlı olan öğrencilerin profillerini çek
        // (Eğer öğrenci sayısı 10'dan azsa 'in' query'si kullanılabilir, biz basit bir döngüyle çekeceğiz)
        const students = [];
        for (const sId of linkedIds) {
            const sSnap = await getDoc(doc(db, "users", sId));
            if (sSnap.exists()) {
                students.push({ id: sSnap.id, ...sSnap.data() });
            }
        }
        
        callback(students);
    });
}
// Veli-Öğretmen mesajlaşması için (messages tablosuna yazar)
export async function sendParentTeacherMessage(parentUid, studentId, teacherId, text) {
    try {
        await addDoc(collection(db, "messages"), {
            senderId: parentUid,
            senderRole: "parent",
            receiverId: teacherId,
            studentContext: studentId,
            message: text,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Veli mesajı gönderilemedi:", e);
        return false;
    }
}
