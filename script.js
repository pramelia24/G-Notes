document.addEventListener('DOMContentLoaded', () => {
    let db; // Database
    let subjectProgressChart; // Variabel diagram
    const daysOfWeek = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    
    // === ELEMEN DOM ===
    const identityPage = document.getElementById('page-identity');
    const mainApp = document.getElementById('main-app');
    const identityForm = document.getElementById('identity-form');
    const welcomeMessage = document.getElementById('welcome-message');
    const appTitle = document.getElementById('app-title');
    
    const pages = document.querySelectorAll('.page');
    const navButtons = document.querySelectorAll('.nav-btn');
    const fab = document.getElementById('fab-add-task');

    // Modal Tugas
    const taskModal = document.getElementById('modal-add-task');
    const closeTaskModalBtn = document.getElementById('close-task-modal');
    const taskForm = document.getElementById('task-form');
    
    // Modal Jadwal
    const scheduleModal = document.getElementById('modal-add-schedule');
    const showScheduleModalBtn = document.getElementById('show-schedule-modal');
    const closeScheduleModalBtn = document.getElementById('close-schedule-modal');
    const scheduleForm = document.getElementById('schedule-form');
    const scheduleSubjectSelect = document.getElementById('schedule-subject');
    const taskSubjectSelect = document.getElementById('task-subject');

    // Halaman Home
    const timetableTodayContainer = document.getElementById('timetable-today');
    const taskListToday = document.getElementById('task-list-today');
    const taskListUpcoming = document.getElementById('task-list-upcoming');

    // Halaman Jadwal
    const timetableTabs = document.querySelector('.tabs');
    const timetableContent = document.getElementById('timetable-content');

    // Halaman Mapel
    const subjectGrid = document.getElementById('subject-grid');
    const subjectFormBtn = document.getElementById('show-subject-form-btn');
    // ... (Elemen form mapel) ...

    // Halaman Detail Mapel
    const subjectDetailTitle = document.getElementById('subject-detail-title');
    const subjectDetailTeacher = document.getElementById('subject-detail-teacher');
    const subjectDetailTasks = document.getElementById('subject-detail-tasks');
    const backToSubjectsBtn = document.getElementById('back-to-subjects');
    const subjectInfoForm = document.getElementById('subject-info-form');
    const subjectGallery = document.getElementById('subject-gallery');

    
    // === 1. INISIALISASI DATABASE (INDEXEDDB) ===
    const initDB = () => {
        const request = indexedDB.open('AkademiProDB', 1);

        request.onerror = (e) => console.error('Database error:', e.target.error);
        request.onsuccess = (e) => {
            db = e.target.result;
            console.log('Database berhasil dibuka.');
            checkIdentity(); // Titik awal aplikasi
        };
        request.onupgradeneeded = (e) => {
            let db = e.target.result;
            db.createObjectStore('profile', { keyPath: 'id' });
            db.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
            db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
            // Buat 'tabel' jadwal pelajaran dengan index 'day' agar mudah dicari
            const scheduleStore = db.createObjectStore('classSchedule', { keyPath: 'id', autoIncrement: true });
            scheduleStore.createIndex('day', 'day', { unique: false });
        };
    };

    // === 2. FUNGSI DATABASE (CRUD HELPER) ===
    // (Fungsi helper generik untuk membaca/menulis dari IndexedDB)
    const dbGet = (storeName, key) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const dbGetAll = (storeName) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const dbPut = (storeName, data) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const dbQuery = (storeName, indexName, query) => {
         return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const req = index.getAll(query);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    // === 3. FUNGSI IDENTITAS & INISIALISASI ===
    const checkIdentity = async () => {
        const profile = await dbGet('profile', 1);
        if (profile) {
            // Jika ada profil, tampilkan aplikasi utama
            identityPage.classList.add('hidden');
            mainApp.classList.remove('hidden');
            await initializeApp(profile);
        } else {
            // Jika tidak, tampilkan halaman identitas
            identityPage.classList.remove('hidden');
            mainApp.classList.add('hidden');
        }
    };

    identityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userName = document.getElementById('user-name').value;
        const userSchool = document.getElementById('user-school').value;
        const profile = { id: 1, name: userName, school: userSchool };
        await dbPut('profile', profile);
        checkIdentity(); // Muat ulang aplikasi
    });

    const initializeApp = async (profile) => {
        welcomeMessage.innerText = `Halo, ${profile.name}!`;
        await loadAllSubjects();
        await renderDashboard();
        showPage('page-home');
        
        // Mulai interval cek notifikasi
        startNotificationWatcher();
    };

    // === 4. FUNGSI NAVIGASI ===
    const showPage = (pageId) => {
        pages.forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
        
        // Ganti judul header
        if (pageId === 'page-home') appTitle.innerText = 'Dashboard';
        if (pageId === 'page-timetable') appTitle.innerText = 'Jadwal Pelajaran';
        if (pageId === 'page-subjects') appTitle.innerText = 'Mata Pelajaran';
    };

    navButtons.forEach(btn => btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        showPage(page);
        if (page === 'page-home') renderDashboard();
        if (page === 'page-timetable') renderTimetable('Senin'); // Tampilkan hari Senin
    }));

    // === 5. FUNGSI MAPEL (SUBJECTS) ===
    let allSubjects = []; // Cache untuk mapel
    const loadAllSubjects = async () => {
        allSubjects = await dbGetAll('subjects');
        
        // Render di Halaman Mapel
        subjectGrid.innerHTML = '';
        allSubjects.forEach(s => {
            subjectGrid.innerHTML += `
                <div class="subject-card" data-subject-id="${s.id}">
                    <i class="material-icons">class</i>
                    <h4>${s.name}</h4>
                </div>
            `;
        });
        
        // Update semua <select>
        const subjectOptions = allSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        scheduleSubjectSelect.innerHTML = subjectOptions;
        taskSubjectSelect.innerHTML = `<option value="">Pilih Mapel...</option>` + subjectOptions;
    };
    
    // (Logika untuk show/hide form mapel & submit form mapel)
    // ...

    // Klik kartu mapel
    subjectGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.subject-card');
        if (card) {
            const subjectId = parseInt(card.dataset.subjectId);
            showSubjectDetail(subjectId);
        }
    });

    // === 6. FUNGSI DETAIL MAPEL (Penjelasan & Diagram) ===
    
    backToSubjectsBtn.addEventListener('click', () => showPage('page-subjects'));

    const showSubjectDetail = async (subjectId) => {
        const subject = allSubjects.find(s => s.id === subjectId);
        appTitle.innerText = subject.name;
        subjectDetailTitle.innerText = subject.name;
        subjectDetailTeacher.innerText = `Guru: ${subject.teacher || '-'}`;
        
        // Set ID di form info
        document.getElementById('subject-info-id').value = subjectId;
        document.getElementById('subject-notes').value = subject.notes || '';

        // Render galeri (lampiran mapel)
        renderSubjectGallery(subject.attachments);

        // Render diagram progres
        renderSubjectProgressChart(subjectId);
        
        // TODO: Render tugas terkait
        // ...

        showPage('page-subject-detail');
    };
    
    // Fungsi untuk render diagram pie progres
    const renderSubjectProgressChart = async (subjectId) => {
        const allTasks = await dbGetAll('tasks');
        const tasks = allTasks.filter(t => t.subjectId === subjectId);
        
        const completed = tasks.filter(t => t.isComplete).length;
        const pending = tasks.length - completed;

        const ctx = document.getElementById('subject-progress-chart').getContext('2d');
        if (subjectProgressChart) subjectProgressChart.destroy();
        
        subjectProgressChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Selesai', 'Belum Selesai'],
                datasets: [{
                    data: [completed, pending],
                    backgroundColor: ['#39FF14', '#FF6384'],
                    borderColor: 'var(--white)',
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'top' } } }
        });
        
    };

    // Fungsi untuk menyimpan info & galeri mapel
    subjectInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subjectId = parseInt(document.getElementById('subject-info-id').value);
        const notes = document.getElementById('subject-notes').value;
        const file = document.getElementById('subject-attachment-input').files[0];
        
        const subject = allSubjects.find(s => s.id === subjectId);
        subject.notes = notes;
        
        if (file) {
            const attachment = await fileToBlob(file);
            if (!subject.attachments) subject.attachments = [];
            subject.attachments.push(attachment);
        }
        
        await dbPut('subjects', subject);
        // Refresh galeri
        renderSubjectGallery(subject.attachments);
        document.getElementById('subject-attachment-input').value = null; // Kosongkan input
    });
    
    // Fungsi render galeri
    const renderSubjectGallery = (attachments) => {
        subjectGallery.innerHTML = '';
        if (!attachments) return;
        
        attachments.forEach(file => {
            const url = URL.createObjectURL(file.blob);
            if (file.type.startsWith('image/')) {
                subjectGallery.innerHTML += `
                    <div class="gallery-item">
                        <a href="${url}" target="_blank"><img src="${url}" alt="${file.name}"></a>
                    </div>`;
            } else if (file.type.startsWith('audio/')) {
                subjectGallery.innerHTML += `
                    <div class="gallery-item">
                        <audio controls src="${url}"></audio>
                    </div>`;
            }
        });
    };
    

    // === 7. FUNGSI JADWAL PELAJARAN (TIMETABLE) ===
    
    // Buka Modal Jadwal
    showScheduleModalBtn.addEventListener('click', () => {
        scheduleForm.reset();
        document.getElementById('schedule-id').value = '';
        scheduleModal.classList.add('show');
    });
    closeScheduleModalBtn.addEventListener('click', () => scheduleModal.classList.remove('show'));

    // Ganti tab hari
    timetableTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderTimetable(e.target.dataset.day);
        }
    });

    // Render Jadwal untuk hari terpilih
    const renderTimetable = async (day) => {
        timetableContent.innerHTML = '';
        // Cari jadwal berdasarkan index 'day'
        const schedules = await dbQuery('classSchedule', 'day', day);
        
        if (schedules.length === 0) {
            timetableContent.innerHTML = '<p>Tidak ada jadwal untuk hari ini.</p>';
            return;
        }

        schedules.sort((a,b) => a.startTime.localeCompare(b.startTime)); // Urutkan jam
        
        schedules.forEach(item => {
            const subject = allSubjects.find(s => s.id === item.subjectId) || { name: 'Mapel Dihapus' };
            timetableContent.innerHTML += `
                <div class="timetable-item" data-schedule-id="${item.id}">
                    <h4>${subject.name}</h4>
                    <p>Waktu: ${item.startTime} - ${item.endTime}</p>
                    <p>Ruang: ${item.room || '-'}</p>
                    </div>
            `;
        });
    };

    // Simpan Jadwal Pelajaran (Tambah/Edit)
    scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const scheduleData = {
            subjectId: parseInt(document.getElementById('schedule-subject').value),
            day: document.getElementById('schedule-day').value,
            startTime: document.getElementById('schedule-start-time').value,
            endTime: document.getElementById('schedule-end-time').value,
            room: document.getElementById('schedule-room').value,
        };
        
        const id = document.getElementById('schedule-id').value;
        if (id) scheduleData.id = parseInt(id); // Mode Edit

        await dbPut('classSchedule', scheduleData);
        scheduleModal.classList.remove('show');
        await renderTimetable(scheduleData.day); // Render ulang hari yang baru diubah
    });

    // === 8. FUNGSI DASHBOARD (HOME) ===
    const renderDashboard = async () => {
        // Render Jadwal Hari Ini
        const todayName = daysOfWeek[new Date().getDay()];
        timetableTodayContainer.innerHTML = '';
        const todaySchedules = await dbQuery('classSchedule', 'day', todayName);
        
        if (todaySchedules.length > 0) {
             todaySchedules.sort((a,b) => a.startTime.localeCompare(b.startTime));
             todaySchedules.forEach(item => {
                const subject = allSubjects.find(s => s.id === item.subjectId) || { name: '?' };
                timetableTodayContainer.innerHTML += `
                    <div class="timetable-item">
                        <h4>${subject.name} (${item.startTime} - ${item.endTime})</h4>
                    </div>
                `;
             });
        } else {
            timetableTodayContainer.innerHTML = '<p>Tidak ada jadwal pelajaran hari ini.</p>';
        }

        // Render Tugas Hari Ini & Mendatang
        // (Logika sama seperti versi sebelumnya)
        // ...
    };

    // === 9. FUNGSI TUGAS (TASK) & LAMPIRAN ===
    fab.addEventListener('click', () => {
        taskForm.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-attachment-list').innerHTML = '';
        taskModal.classList.add('show');
    });
    closeTaskModalBtn.addEventListener('click', () => taskModal.classList.remove('show'));

    // Helper untuk konversi File ke format simpan
    const fileToBlob = (file) => {
        return new Promise((resolve, reject) => {
             // Simpan file blob-nya langsung
             resolve({
                name: file.name,
                type: file.type,
                blob: file 
            });
        });
    };
    
    // Simpan Tugas (Tambah/Edit)
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('task-attachments').files[0];
        let taskAttachment = null;
        
        if (file) {
            taskAttachment = await fileToBlob(file);
        }

        const taskData = {
            subjectId: parseInt(document.getElementById('task-subject').value),
            title: document.getElementById('task-title').value,
            deadline: document.getElementById('task-deadline').value,
            isComplete: false,
            attachment: taskAttachment // Simpan lampiran
        };
        
        const id = document.getElementById('task-id').value;
        if (id) {
            taskData.id = parseInt(id);
            // (Logika untuk mempertahankan status complete & lampiran lama)
        }
        
        await dbPut('tasks', taskData);
        taskModal.classList.remove('show');
        await renderDashboard(); // Render ulang dashboard
    });

    // === 10. FUNGSI NOTIFIKASI (BERVARIASI) ===
    const checkNotifications = async () => {
        if (Notification.permission !== 'granted') return;
        
        const tasks = await dbGetAll('tasks');
        const now = new Date().getTime();

        tasks.forEach(task => {
            const deadline = new Date(task.deadline).getTime();
            const timeDiff = deadline - now;
            
            // Cek jika deadline 1 jam dari sekarang (3600000 ms)
            if (!task.isComplete && timeDiff > 0 && timeDiff <= 3600000) {
                // Cek apakah sudah pernah notif (perlu flag tambahan di DB)
                // Untuk simple, kita notif saja
                new Notification('Deadline Segera!', {
                    body: `Tugas "${task.title}" harus dikumpulkan dalam 1 jam!`,
                    icon: 'icon.png' // Ganti dengan path icon Anda
                });
            }
        });
    };
    
    const startNotificationWatcher = () => {
        // Minta izin saat pertama kali
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Cek notifikasi setiap 5 menit
        setInterval(checkNotifications, 300000); 
    };

    // === MULAI APLIKASI ===
    initDB();
});
