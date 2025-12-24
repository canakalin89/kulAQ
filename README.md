
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

## 🛠 Teknik Altyapı

*   **Frontend:** React (Hooks + Functional Components)
*   **AI Engine:** Google Gemini 2.5 Flash Preview TTS
*   **Styling:** Tailwind CSS (Modern Dark UI)
*   **Visualization:** D3.js
*   **Audio Engine:** Web Audio API (PCM Decoding & WAV Encoding)
*   **Language Support:** Full i18n (Türkçe & English)

---

## 📖 Kullanım Klavuzu

1.  **Mod Seçimi:** Tekil metin (Monolog) veya Diyalog Stüdyosu arasında seçim yapın.
2.  **Metin Girişi:** Seslendirilmesini istediğiniz İngilizce metni yazın. Uzun duraklamalar için `...` kullanabilirsiniz.
3.  **Karakter Ayarları:** Sağ panelden karakterinizin sesini ve hızını seçin.
4.  **Oluştur:** "SINAV SESİNİ OLUŞTUR" butonuna basın. Yapay zeka saniyeler içinde sesi sentezleyecektir.
5.  **Önizleme & İndir:** Timeline üzerinden sesi kontrol edin ve ihtiyacınız varsa bulut ikonu ile bilgisayarınıza indirin.

---

## 👨‍💻 Geliştirici Notu

Bu uygulama, eğitim materyali üretimini demokratikleştirmek ve öğretmenlerin yüksek maliyetli stüdyo ekipmanlarına veya pahalı aboneliklere ihtiyaç duymadan profesyonel içerik üretmelerini sağlamak amacıyla geliştirilmiştir.

**Geliştirici:** [Can AKALIN](https://instagram.com/can_akalin)

---

## 📜 Lisans & Haklar

Kulaq, Google Gemini API kullanım politikalarına tabidir. Ticari kullanımlarda Google'ın TTS kullanım şartlarının göz önünde bulundurulması önerilir.

---
*Developed with ❤️ for Educators.*
