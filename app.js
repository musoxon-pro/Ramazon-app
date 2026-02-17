// app.js

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Shaharni localStorage dan olish yoki default
    let selectedCity = localStorage.getItem('selectedCity') || 'Toshkent';
    document.getElementById('city').value = selectedCity;

    // Hodisalarni ulash
    document.getElementById('city').addEventListener('change', (e) => {
        const city = e.target.value;
        localStorage.setItem('selectedCity', city);
        loadTimes(city);
    });

    document.getElementById('detect-location').addEventListener('click', detectLocation);

    // Ovozli tugmalar
    document.querySelectorAll('.play-sound').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.target.getAttribute('data-text');
            speakText(text);
        });
    });

    // Vaqtlarni yuklash
    await loadTimes(selectedCity);

    // Har daqiqada vaqtni tekshirish (ogohlantirish uchun)
    setInterval(() => checkNotification(), 60000); // 60 soniya

    // Har soniyada countdown yangilash
    setInterval(updateCountdown, 1000);

    // Notifikatsiya ruxsatini so'rash
    if ('Notification' in window) {
        Notification.requestPermission();
    }

    // Service Worker registratsiyasi (PWA)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(() => console.log('Service Worker registered'));
    }

    // Hijriy sana va milodiy sanani ko'rsatish
    updateDates();
}

// API dan vaqtlarni olish
async function getTimes(city) {
    try {
        // O'zbekiston uchun metod 2 (Hanafi)
        const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Uzbekistan&method=2`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('API xatosi:', error);
        // Fallback: lokal vaqtlar (test uchun)
        return {
            timings: {
                Fajr: '04:30',
                Maghrib: '18:45'
            },
            date: { readable: '16 Feb 2026', hijri: { date: '28 Rajab 1447' } }
        };
    }
}

// Vaqtlarni sahifaga yozish
async function loadTimes(city) {
    const data = await getTimes(city);
    const timings = data.timings;
    document.getElementById('saharlik').innerText = timings.Fajr;
    document.getElementById('iftorlik').innerText = timings.Maghrib;

    // Saqlash (keyinroq tekshirish uchun)
    localStorage.setItem('lastTimings', JSON.stringify({
        city,
        saharlik: timings.Fajr,
        iftorlik: timings.Maghrib
    }));

    // Hijriy sanani ham saqlash
    if (data.date && data.date.hijri) {
        document.querySelector('.hijri-date').innerText = data.date.hijri.date + ' hijriy';
    }
    if (data.date && data.date.readable) {
        document.querySelector('.gregorian-date').innerText = data.date.readable;
    }
}

// Geolokatsiya orqali shaharni aniqlash
function detectLocation() {
    if (!navigator.geolocation) {
        alert('Geolokatsiya qo‘llab-quvvatlanmaydi');
        return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        // Reverse geocoding (oddiy uchun shahar nomini olish)
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=uz`);
            const data = await response.json();
            const city = data.address.city || data.address.town || data.address.village || 'Toshkent';
            // Shaharni selectga yozish
            const select = document.getElementById('city');
            // Agar shahar ro'yxatda bo'lmasa, Toshkent qo'yamiz
            let found = false;
            for (let option of select.options) {
                if (option.value.toLowerCase() === city.toLowerCase()) {
                    select.value = option.value;
                    found = true;
                    break;
                }
            }
            if (!found) select.value = 'Toshkent';
            localStorage.setItem('selectedCity', select.value);
            loadTimes(select.value);
        } catch (e) {
            alert('Joylashuv aniqlanmadi, shaharni qo‘lda tanlang');
        }
    }, () => {
        alert('Joylashuvga ruxsat berilmadi');
    });
}

// Countdown (iftorga qolgan vaqt)
function updateCountdown() {
    const iftorlikElem = document.getElementById('iftorlik');
    const iftarTimeStr = iftorlikElem.innerText;
    if (!iftarTimeStr || iftarTimeStr === '--:--') return;

    const now = new Date();
    const [hours, minutes] = iftarTimeStr.split(':').map(Number);
    const iftarTime = new Date(now);
    iftarTime.setHours(hours, minutes, 0, 0);

    // Agar iftor vaqti o'tib ketgan bo'lsa, ertangi kunga qo'yamiz
    if (now > iftarTime) {
        iftarTime.setDate(iftarTime.getDate() + 1);
    }

    const diff = iftarTime - now;
    if (diff <= 0) {
        document.getElementById('countdown').innerText = '00:00:00';
        return;
    }

    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('countdown').innerText = 
        `${hoursLeft.toString().padStart(2, '0')}:${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`;
}

// Ogohlantirishlarni tekshirish
function checkNotification() {
    const timings = JSON.parse(localStorage.getItem('lastTimings'));
    if (!timings) return;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (currentTime === timings.saharlik) {
        notify('Saharlik vaqti!', 'Saharlikni o‘z vaqtida qilishni unutmang.');
    }
    if (currentTime === timings.iftorlik) {
        notify('Iftorlik vaqti!', 'Iftorlik duosini o‘qishni unutmang.');
    }
}

// Notifikatsiya va ovoz
function notify(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'icon-192.png' });
    }
    // Ovozli xabar
    speakText(body);
    // Qo'shimcha audio (ixtiyoriy)
    // let audio = new Audio('notification.mp3');
    // audio.play().catch(e => console.log('Audio play failed', e));
}

// Matnni ovozli o'qish
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'uz-UZ'; // O'zbek tili (agar qurilmada bo'lsa)
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    } else {
        console.log('Speech synthesis not supported');
    }
}

// Hijriy sana va milodiy (API dan olinadi, lekin bu yerda ham qo'lda ko'rsatish mumkin)
function updateDates() {
    // API dan kelgan sanani ko'rsatadi, agar bo'lmasa lokal
    const hijriElem = document.querySelector('.hijri-date');
    const gregElem = document.querySelector('.gregorian-date');
    if (!hijriElem.innerText) {
        hijriElem.innerText = 'Rajab 1447 hijriy';
    }
    if (!gregElem.innerText) {
        const today = new Date();
        gregElem.innerText = today.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
    }
}
