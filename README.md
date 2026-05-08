
# 🎧 Kulaq - Yapay Zeka Destekli ELT Ses Stüdyosu

**Kulaq**, özellikle İngilizce öğretmenleri ve materyal geliştiriciler için tasarlanmış, ElevenLabs kalitesinde ses üretimi sunan profesyonel bir **Text-to-Speech (TTS)** platformudur. Google'ın yeni nesil **Gemini 2.5 Flash Native Audio** teknolojisini kullanarak, doğal ve akıcı dinleme sınavı materyalleri oluşturmanıza olanak tanır.

---

## 🚀 Öne Çıkan Özellikler

### 1. Diyalog Stüdyosu (Multi-Speaker)
*   Aynı anda **6 farklı karaktere** kadar diyalog oluşturma.
*   Karakter isimlerini özelleştirebilme (Örn: Teacher, Student, Narrator).
*   Her satır için farklı bir ses atayabilme.

### 2. CEFR Uyumlu Hız Kontrolü
*   **V. Slow (A1 Beginner):** Kelimeler arası belirgin duraklamalarla dikte seviyesi.
*   **Slow (A2 Elementary):** Net ve anlaşılır, yavaş tempoda konuşma.
*   **Normal (B1-B2 Intermediate):** Doğal günlük konuşma hızı.
*   **Native (C1-C2 Advanced):** Akıcı ve hızlı ana dil seviyesi.

### 3. Profesyonel Ses Kütüphanesi
*   **Kore & Zephyr:** Kadın sesleri (Nazik ve Berrak).
*   **Puck, Charon & Fenrir:** Erkek sesleri (Genç, Derin ve Anlatıcı).
*   Cinsiyet ikonları ile kolay seçim.

### 4. Gelişmiş Oynatıcı ve Timeline
*   **İnteraktif Zaman Çizelgesi:** Sesin istediğiniz noktasına tıklayarak atlayabilme.
*   **Dinamik Görselleştirici:** D3.js ile güçlendirilmiş gerçek zamanlı frekans analizi.
*   **Süre Takibi:** Milisaniyelik hassasiyetle mevcut süre ve toplam süre gösterimi.

### 5. Akıllı Arşiv Sistemi
*   Üretilen tüm sesler "Arşivim" bölümünde saklanır.
*   Kayıtları tek tek silebilir veya tüm arşivi tek tıkla temizleyebilirsiniz.
*   Oluşturulan sesleri `.wav` formatında yüksek kalitede indirebilirsiniz.

---

## 🎨 Seslendirme Nüansları (Pro-Tips)

Kulaq, metin içindeki gizli komutları anlayabilen gelişmiş bir model kullanır. İşte sese duygu katma yolları:

*   **Duygusal Efektler:** Metin içine şu ifadeleri ekleyin:
    *   `[laughs]` -> Karakterin gülmesini sağlar.
    *   `[sighs]` -> Karakterin derin bir iç çekmesini sağlar.
    *   `[coughs]` -> Karakterin öksürmesini sağlar.
    *   `[clears throat]` -> Karakterin boğazını temizlemesini sağlar.
*   **Vurgu:** Önemli bir kelimeyi **TAMAMEN BÜYÜK HARFLE** yazarak AI'nın o kelimeye vurgu yapmasını sağlayın.
*   **Doğal Duraksamalar:**
    *   `,`: Kısa bir nefes payı.
    *   `.`: Standart cümle sonu es.
    *   `...`: Düşünceli veya uzun süreli sessizlik.
*   **Doğallık Katmanları:** Cümle başlarına "Um...", "Well," veya "Uh-oh," gibi ifadeler ekleyerek sınav materyalini gerçekçi kılın.

---

## 🛠 Teknik Altyapı

*   **Frontend:** React (Hooks + Functional Components)
*   **Ses Motoru:** Ücretsiz tarayıcı TTS varsayılan; isteğe bağlı Google Gemini 2.5 Flash Preview TTS
*   **API Katmanı:** Netlify Functions (`/.netlify/functions/tts`) — Gemini modu kullanılırsa anahtar tarayıcıya gönderilmez.
*   **Styling:** Tailwind CSS (Modern Dark UI)
*   **Visualization:** D3.js
*   **Audio Engine:** Web Audio API (PCM Decoding & WAV Encoding)
*   **Language Support:** Full i18n (Türkçe & English)

---

## 🔐 Gemini Olmadan Kullanım

Kulaq artık varsayılan olarak **Ücretsiz / Tarayıcı Sesi** modu ile açılır. Bu mod:

*   Gemini API anahtarı istemez.
*   Abonelik gerektirmez.
*   Tarayıcının/cihazın yerleşik Türkçe, İngilizce veya Almanca seslerini kullanır.
*   Tek kişi ve diyalog metinlerini sırayla oynatabilir.

> Not: Tarayıcı TTS ses kalitesi cihazdaki yüklü seslere bağlıdır ve Web Speech API doğrudan WAV indirme verisi sağlamaz.

Gemini modu isteğe bağlı olarak korunmuştur. Stüdyo kalitesinde WAV çıktısı istenirse kullanıcı uygulama içindeki Gemini API Key alanına kendi anahtarını girebilir. Anahtar yalnızca ses üretimi isteğinde kullanılır; "Bu cihazda hatırla" seçilmedikçe tarayıcıda saklanmaz.

Site sahibi olarak ortak bir anahtar kullanmak isterseniz anahtarı Netlify tarafında da saklayabilirsiniz:

1. Netlify Dashboard → Site configuration → Environment variables bölümüne girin.
2. `GEMINI_API_KEY` adında bir değişken ekleyin.
3. Siteyi yeniden deploy edin.

Frontend, Gemini modu için `/.netlify/functions/tts` endpoint'ini çağırır. Böylece uygulamayı kullanan öğretmenler API anahtarı girmez ve anahtar tarayıcı bundle'ına gömülmez.

---

## 👨‍💻 Geliştirici Notu

Bu uygulama, eğitim materyali üretimini demokratikleştirmek ve öğretmenlerin yüksek maliyetli stüdyo ekipmanlarına veya pahalı aboneliklere ihtiyaç duymadan profesyonel içerik üretmelerini sağlamak amacıyla geliştirilmiştir.

**Geliştirici:** [Can AKALIN](https://instagram.com/can_akalin)

---

## 📜 Lisans & Haklar

Kulaq, Google Gemini API kullanım politikalarına tabidir. Ticari kullanımlarda Google'ın TTS kullanım şartlarının göz önünde bulundurulması önerilir.

---
*Developed with ❤️ for Educators.*
