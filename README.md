# 📍 CA Wayspot Tools (v1.8.0)

![CA Wayspot Tools Preview](./img/preview.png)

**เครื่องมือช่วยวางแผนและจำลองตำแหน่ง Wayspot สำหรับชุมชน Community Ambassador Thailand**

CA Wayspot Tools คือเว็บแอปพลิเคชัน (PWA) ที่ออกแบบมาเพื่อช่วยให้นักเล่นเกมที่ต้องใช้พิกัดแผนที่ (เช่น Pokémon GO, Ingress) สามารถวางแผนจุดตั้งเสา (Wayspot) ได้อย่างแม่นยำ คำนวณระยะห่าง และเช็คขอบเขต S2 Cells ได้ในที่เดียว

## ✨ คุณสมบัติเด่น (Key Features)

- **📍 Multi-Type Markers:** รองรับการเพิ่มจุดหลายประเภท เช่น PokeStop, Gym, CA PokeStop และ CA Gym
- **🌐 S2 Cell Overlay:** แสดงเส้นขอบเขต S2 Cell ระดับ L14 และ L17
- **☁️ Google Drive Sync:** สำรองข้อมูลและดึงข้อมูลกลับมาใช้งานผ่าน Google Drive ได้โดยตรง
- **📥 Import/Export KML:** รองรับการนำเข้าและส่งออกไฟล์ KML เพื่อทำงานร่วมกับ Google My Maps
- **🗺️ Diverse Map Layers:** เลือกสลับแผนที่ได้หลากหลาย เช่น Google Maps, OpenStreetMap และ Bing Maps
- **🌙 Dark Mode Support:** ถนอมสายตาด้วยโหมดกลางคืนที่ปรับตามระบบหรือตั้งค่าเอง
- **📱 PWA Ready:** ติดตั้งลงบนมือถือได้เหมือนแอปทั่วไป ใช้งานสะดวกทุกที่

## 🚀 วิธีการใช้งานเบื้องต้น

1. **การเพิ่มจุด:** คลิก 2 ครั้งในตำแหน่งทีต้องการเพื่อเพิ่มหมุด หรือกรอกพิกัด Lat/Lng ในแถบเมนู
2. **การแก้ไข:** ใช้เครื่องมือ "แก้ไขตำแหน่ง" (ไอคอนดินสอ) เพื่อลากย้ายจุดหรือเปลี่ยนชื่อ
3. **การดูขอบเขต:** เปิดการตั้งค่า (ไอคอนเฟือง) เพื่อเปิด "แสดง S2 Cells"
4. **การบันทึก:** ข้อมูลจะถูกบันทึกใน Browser อัตโนมัติ หรือเลือกบันทึกขึ้น Cloud ผ่านเมนู Google Drive

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Map Engine:** [Leaflet.js](https://leafletjs.com/)
- **Geometry:** [S2-Geometry](https://github.com/v88/s2-geometry-javascript)
- **Sync:** Google Drive API (GSI)
- **Design:** Modern UI (Glassmorphism) พร้อมระบบ i18n รองรับภาษาไทยและอังกฤษ

## 👥 เครดิต (Credits)

จัดทำโดย **CA: Community Ambassador Thailand**
สร้างขึ้นเพื่อเป็นเครื่องมือกลางให้เพื่อนๆ ในชุมชนได้พัฒนาพื้นที่ของตัวเองได้ง่ายขึ้น
